# Design: AI Analysis Reports (ai-analysis-reports)

Status: proposed
Reads: `proposal.md`

## 1. Architecture Overview

```
┌──────────────────┐       ┌──────────────────────────┐       ┌───────────────────┐
│  Athlete UI      │──────▶│ analyze-metric-chart     │──────▶│   Gemma 4 API     │
│  Modal / History │       │ (edge function)          │       │   (JSON output)   │
└─────────┬────────┘       └────────┬─────────────────┘       └───────────────────┘
          │                         │
          │                         ▼
          │                 ┌───────────────────────────┐
          │                 │ Parse + validate JSON     │
          │                 │ Fallback to text section  │
          │                 └────────┬──────────────────┘
          │                          │
          │                          ├─────▶ ai_analysis_cache (jsonb)
          │                          ├─────▶ ai_analysis_usage
          │                          └─────▶ ai_reports_history
          │
          ▼
┌──────────────────┐
│ list-ai-reports  │──▶ SELECT ai_reports_history (RLS scoped)
└──────────────────┘
```

## 2. Database

### 2.1 Migration (up)

```sql
-- Up
CREATE TABLE public.ai_reports_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chart_type text NOT NULL,
  title text NOT NULL,
  report jsonb NOT NULL,
  athlete_context jsonb,
  source_data_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_reports_athlete_created
  ON public.ai_reports_history (athlete_id, created_at DESC);

CREATE INDEX idx_ai_reports_chart_type
  ON public.ai_reports_history (athlete_id, chart_type, created_at DESC);

ALTER TABLE public.ai_reports_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_select_own_reports"
  ON public.ai_reports_history FOR SELECT
  USING (athlete_id = (select auth.uid()));

CREATE POLICY "athlete_delete_own_reports"
  ON public.ai_reports_history FOR DELETE
  USING (athlete_id = (select auth.uid()));

CREATE POLICY "service_role_all_reports"
  ON public.ai_reports_history FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Migrate ai_analysis_cache.response: text -> jsonb
ALTER TABLE public.ai_analysis_cache
  ADD COLUMN response_jsonb jsonb;

UPDATE public.ai_analysis_cache
  SET response_jsonb = jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object('type', 'text', 'content', response)
    )
  )
  WHERE response IS NOT NULL;

ALTER TABLE public.ai_analysis_cache DROP COLUMN response;
ALTER TABLE public.ai_analysis_cache RENAME COLUMN response_jsonb TO response;
ALTER TABLE public.ai_analysis_cache ALTER COLUMN response SET NOT NULL;
```

### 2.2 Migration (down — documented for manual rollback)

```sql
-- Down (manual)
DROP TABLE IF EXISTS public.ai_reports_history CASCADE;

-- Revert cache.response back to text (data loss of structure)
ALTER TABLE public.ai_analysis_cache ADD COLUMN response_text text;
UPDATE public.ai_analysis_cache
  SET response_text = coalesce(
    (response->'sections'->0->>'content'),
    response::text
  );
ALTER TABLE public.ai_analysis_cache DROP COLUMN response;
ALTER TABLE public.ai_analysis_cache RENAME COLUMN response_text TO response;
```

## 3. Section JSON Schema (source of truth)

```ts
type Section =
  | { type: 'text';           content: string }
  | { type: 'heading';        content: string }
  | { type: 'chart';          chart_id: ChartId; data: Record<string, unknown>; caption?: string }
  | { type: 'kpi';            label: string; value: string; delta?: number }
  | { type: 'recommendation'; content: string; priority: 'high'|'medium'|'low' }
  | { type: 'list';           items: string[] };

type ChartId =
  | 'line_trend' | 'bar_comparison' | 'donut_distribution'
  | 'progress_gauge' | 'zone_bar';

type Report = { sections: Section[] };
```

**Validation rules (edge function):**
- `sections` is a non-empty array.
- Length ≤ 10 (truncate extras).
- `chart` sections ≤ 5 (drop extras in order).
- Each section's required fields are present and string fields non-empty after trim.
- Unknown `type` → drop section.
- Invalid `chart_id` → keep the section only if `caption` present; else drop.
- Serialized JSON size ≤ 64KB (defensive truncate or fallback to text).

## 4. Edge function: `analyze-metric-chart` (rewrite)

### 4.1 Prompt template (excerpt)

```text
Eres un analista deportivo. Devuelve SOLO JSON válido con esta estructura:

{"sections":[
  {"type":"heading","content":"Estado general"},
  {"type":"text","content":"Tu forma..."},
  {"type":"chart","chart_id":"line_trend",
    "data":{"x":["S1","S2","S3"],"y":[450,520,480],"label":"Carga semanal"},
    "caption":"Evolución últimas 3 semanas"},
  {"type":"kpi","label":"TSB actual","value":"+12","delta":5},
  {"type":"recommendation","content":"Reduce intensidad esta semana","priority":"high"}
]}

REGLAS:
- Máximo 10 secciones, máximo 5 charts.
- chart_id ∈ { line_trend, bar_comparison, donut_distribution, progress_gauge, zone_bar }.
- priority ∈ { high, medium, low }.
- Escribe en español.
- NO añadas texto fuera del JSON, NO uses ```json ni comentarios.

Datos del atleta y gráfica:
<<context>>
```

A per-chart-type override appends required fields (e.g. TSB must include 1 `kpi` for TSB and 1 `recommendation`).

### 4.2 Parser pipeline

```ts
function parseGemmaResponse(raw: string): Report {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/```$/, '')
    .trim();
  let parsed: unknown;
  try { parsed = JSON.parse(stripped); }
  catch { return fallbackText(raw); }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).sections)) {
    return fallbackText(raw);
  }
  const valid = validateSections((parsed as any).sections);
  return valid.length > 0 ? { sections: valid } : fallbackText(raw);
}

function fallbackText(raw: string): Report {
  return { sections: [{ type: 'text', content: raw.slice(0, 4000) }] };
}
```

`validateSections` enforces caps, drops invalid sections, and for `general` chart type optionally injects a default heading if missing.

### 4.3 Persistence flow

1. Parse → report.
2. Compute `source_data_hash` (same SHA-256 as current cache key).
3. `upsert` cache row `{chart_type, data_hash, response: report, created_at}` with 24h TTL.
4. Insert `ai_reports_history` row `{athlete_id, chart_type, title, report, athlete_context, source_data_hash}`. Title built via `titleFor(chartType, new Date())`.
5. Increment `ai_analysis_usage` ONLY when the LLM was called (cache miss).
6. Return `{report, cached, remainingQuota, reportId}`.

### 4.4 Title helper

```ts
const MONTHS_ES_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function titleFor(chartType: string, d: Date): string {
  const day = d.getDate();
  const mon = MONTHS_ES_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const base = chartType === 'general'
    ? 'Análisis general'
    : chartType.toUpperCase();
  return `${base} — ${day} ${mon} ${year}`;
}
```

## 5. Edge function: `list-ai-reports`

- Input (query): `page` (default 1), `limit` (default 10, max 50), `chart_type?`.
- Auth via JWT; resolves `athleteId = sub`.
- `SELECT id, chart_type, title, created_at FROM ai_reports_history WHERE athlete_id = $1 [AND chart_type = $2] ORDER BY created_at DESC LIMIT $limit OFFSET $offset`.
- `SELECT count(*)` for total.
- Response: `{items, total, page, limit, has_more}`.
- Returns 401 unauthenticated, 400 invalid params.

## 6. Frontend

### 6.1 `ReportRenderer.jsx`

```jsx
const SECTION_COMPONENTS = {
  heading: HeadingSection,
  text: TextSection,
  chart: ChartSection,
  kpi: KpiSection,
  recommendation: RecommendationSection,
  list: ListSection,
};

export function ReportRenderer({ report }) {
  if (!report?.sections?.length) return <EmptyReport />;
  return (
    <div className="ai-report">
      {report.sections.map((s, i) => {
        const Cmp = SECTION_COMPONENTS[s.type];
        if (!Cmp) return null;
        return <Cmp key={i} section={s} />;
      })}
    </div>
  );
}
```

### 6.2 Chart registry

```js
export const CHART_COMPONENTS = {
  line_trend: LineTrend,
  bar_comparison: BarComparison,
  donut_distribution: DonutDistribution,
  progress_gauge: ProgressGauge,
  zone_bar: ZoneBar,
};
```

`ChartSection` looks up `chart_id` in the registry. If not found or `data` invalid, renders only `caption` (or nothing). Each chart component wraps Chart.js and defensively validates `data` shape before render.

### 6.3 Service layer (excerpt)

```js
export async function analyzeMetricChart({ chartType, data, athleteContext }) {
  const { data: res, error } = await supabase.functions.invoke('analyze-metric-chart', {
    body: { chartType, data, athleteContext },
  });
  if (error) throw error;
  // Backward compat shim
  if (typeof res.response === 'string') {
    return {
      report: { sections: [{ type: 'text', content: res.response }] },
      cached: !!res.cached,
      remainingQuota: res.remainingQuota,
      reportId: res.reportId ?? null,
    };
  }
  return res;
}

export async function listAnalysisHistory({ page = 1, limit = 10, chartType } = {}) {
  const { data, error } = await supabase.functions.invoke('list-ai-reports', {
    body: { page, limit, chart_type: chartType },
  });
  if (error) throw error;
  return data;
}

export async function getAnalysisById(id) {
  const { data, error } = await supabase
    .from('ai_reports_history')
    .select('id, athlete_id, chart_type, title, report, created_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAnalysis(id) {
  const { error } = await supabase.from('ai_reports_history').delete().eq('id', id);
  if (error) throw error;
}
```

### 6.4 `AnalysisHistory.jsx` layout

- Header: "Mis análisis IA".
- Filter chips (optional v1): `chart_type` pills (Todas, General, TSB, ...).
- List (10/page), rows are clickable cards with: title (bold), date (relative + absolute), chart type badge, small delete icon.
- Footer: "Anterior" / "Siguiente" buttons with disabled states.
- Empty state: illustration + CTA "Generar mi primer análisis" linking to `/athlete/metrics`.

### 6.5 `AiAnalysisModal.jsx` integration

- Props unchanged externally. Internally switch from `<p>{response}</p>` to `<ReportRenderer report={report} />`.
- New prop `mode: 'live' | 'history'`. In `history` mode the "Regenerar" button and "remaining quota" chip are hidden.

## 7. ADRs

### ADR-1: Structured JSON sections vs Markdown
**Context.** The output format must enable embedded charts, KPIs, and styled recommendations. Markdown-with-fenced-code-blocks was considered.
**Decision.** Structured JSON sections.
**Consequence.** Renderer is typed and testable; chart data is first-class. Gemma must be nudged with few-shot to stay valid JSON; we mitigate with a strict parser and a fallback.
**Rejected alternatives.** Custom Markdown with special fences — fragile parsing, no type safety.

### ADR-2: Save ALL reports to history (including cache hits)
**Context.** Cache exists to suppress LLM calls. Should a cache-served response also create a history row?
**Decision.** Yes, every served response creates a `ai_reports_history` row.
**Consequence.** Users perceive "this is my report, keep it" consistently. Storage grows a bit faster but remains bounded by human-scale analysis frequency.
**Rejected.** Saving only cache misses — confusing UX ("why isn't my report in history?").

### ADR-3: Reports are PRIVATE to the athlete
**Context.** Should coaches read the athlete's AI reports?
**Decision.** No. RLS excludes coach access.
**Consequence.** Simpler RLS, avoids coach-athlete tension, athletes can be candid. Opening visibility later is a new, explicit change.
**Rejected.** Coach read via `coach_athlete_relationship` — expands blast radius, needs consent UI.

### ADR-4: Pagination via edge function, not raw query
**Context.** Client could `supabase.from().select().range()` directly.
**Decision.** Wrap in `list-ai-reports` edge function.
**Consequence.** Centralises pagination, enables future sorting/filtering and logging. Slight latency cost.
**Rejected.** Raw query — harder to extend (e.g., joins for filter-by-range later).

### ADR-5: Start with 5 embedded chart types
**Context.** Adding more chart types increases prompt surface + renderer count.
**Decision.** Ship 5 (`line_trend`, `bar_comparison`, `donut_distribution`, `progress_gauge`, `zone_bar`).
**Consequence.** Covers 90% of insight needs. New types added incrementally with a single frontend component + prompt update.
**Rejected.** Ship 10+ — explodes prompt complexity and visual review workload for v1.

## 8. Observability

- Edge function logs: `{chart_type, hash, cached, remaining_quota, report_sections, had_fallback}`.
- Keep a `had_fallback` boolean in logs so we can measure JSON compliance rate; target < 5% fallback rate after first week.
- Capture total bytes of `report jsonb` in logs to monitor storage growth.

## 9. Deployment order

1. Apply DB migration (`ai_reports_history` + `ai_analysis_cache.response` → jsonb).
2. Deploy `list-ai-reports`.
3. Deploy `analyze-metric-chart` (new version).
4. Deploy frontend (new components + page + routes).

Rollback plan: revert frontend → revert `analyze-metric-chart` to v5 (service shim keeps UI working on bare strings) → leave DB in place (additive) → if required, run the documented DOWN script.

## 10. Testing strategy

- **Unit tests (edge function):** parser cases — valid, fenced, malformed, too many sections/charts, invalid section type, empty after validation.
- **Integration test:** happy path + RLS denies cross-athlete SELECT/DELETE + coach denial.
- **Frontend unit tests:** `ReportRenderer` renders each section type; unknown type is skipped; chart components render with valid data and degrade on invalid data.
- **E2E:** generate analysis → appears in history → reopen → delete → gone.

## 11. Out-of-scope / follow-ups
- Report cleanup job (6-month window).
- Coach read access with consent.
- PDF export.
- More chart types.
