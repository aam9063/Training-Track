# Spec: AI Analysis Reports (ai-analysis-reports)

Status: proposed
Scope: edge functions (`analyze-metric-chart`, `list-ai-reports`), DB (`ai_reports_history`, `ai_analysis_cache`), frontend (modal, history page, chart registry).

Each requirement below is verifiable by a scenario. Scenarios use the format **Given / When / Then**.

---

## Capabilities

### REQ-1: Structured report output from `analyze-metric-chart`

The edge function MUST return a JSON object `{report: {sections: Section[]}, cached, remainingQuota, reportId}`. `Section` MUST be one of the six types: `text`, `heading`, `chart`, `kpi`, `recommendation`, `list`.

#### Scenario 1.1 — happy path, fresh analysis
- **Given** an authenticated athlete with remaining quota and no cache hit for `(chartType='tsb', dataHash=X)`
- **When** they call `analyzeMetricChart({chartType:'tsb', data, athleteContext})`
- **Then** the response contains `report.sections[]` with ≥ 1 section, `cached === false`, `remainingQuota` decremented by 1, and `reportId` is a UUID.

#### Scenario 1.2 — Gemma returns valid JSON wrapped in ```json fences
- **Given** Gemma 4 returns `` ```json\n{"sections":[{"type":"text","content":"hola"}]}\n``` ``
- **When** the parser runs
- **Then** fences are stripped, JSON parses successfully, and the saved `report` equals `{sections:[{type:'text', content:'hola'}]}`.

#### Scenario 1.3 — malformed JSON fallback
- **Given** Gemma returns `"Tu forma está genial, entrena más"` (not JSON)
- **When** the parser runs
- **Then** the response is `{sections:[{type:'text', content:'Tu forma está genial, entrena más'}]}`, the row is still saved, and no error is surfaced to the client.

#### Scenario 1.4 — section cap
- **Given** Gemma returns 17 sections
- **When** the parser validates
- **Then** only the first 10 are persisted and returned.

#### Scenario 1.5 — chart cap
- **Given** Gemma returns 8 `chart` sections interleaved with text
- **When** the parser validates
- **Then** only the first 5 `chart` sections survive; the remaining `chart` entries are dropped (other section types are preserved).

#### Scenario 1.6 — invalid section type
- **Given** Gemma returns `[{"type":"video", "url":"..."}]`
- **When** the parser validates
- **Then** the invalid section is dropped; if the result is empty, it falls back to a single `{type:'text', content: raw}` section.

---

### REQ-2: Report persistence in `ai_reports_history`

Every successful analysis MUST be persisted, including cached responses re-served to the same user.

#### Scenario 2.1 — fresh analysis persists
- **Given** a successful generation for athlete A
- **When** the response is returned
- **Then** a row exists in `ai_reports_history` with `athlete_id = A`, `chart_type`, `report` matching the JSON, `title` auto-generated, `source_data_hash` equal to the cache key.

#### Scenario 2.2 — auto-title format (per chart)
- **Given** `chartType = 'tsb'` and `created_at` on 2026-04-14
- **When** a row is inserted
- **Then** `title = 'TSB — 14 abr 2026'` (Spanish abbreviation of month).

#### Scenario 2.3 — auto-title format (general)
- **Given** `chartType = 'general'`
- **When** a row is inserted
- **Then** `title = 'Análisis general — 14 abr 2026'`.

#### Scenario 2.4 — cached hit still persists
- **Given** a cache hit for athlete B
- **When** the response is served
- **Then** a NEW row is inserted in `ai_reports_history` for athlete B (the cache avoids LLM call, not persistence).

---

### REQ-3: RLS for `ai_reports_history`

RLS MUST ensure athletes only see their own rows; coaches MUST NOT read the table.

#### Scenario 3.1 — SELECT own
- **Given** authenticated athlete A
- **When** they query `ai_reports_history`
- **Then** only rows with `athlete_id = (select auth.uid())` are returned.

#### Scenario 3.2 — SELECT others forbidden
- **Given** athlete B tries to SELECT a row with `athlete_id = A`
- **Then** 0 rows returned.

#### Scenario 3.3 — DELETE own
- **Given** athlete A owns row R
- **When** they call `deleteAnalysis(R.id)`
- **Then** row is deleted and a subsequent list excludes it.

#### Scenario 3.4 — DELETE others forbidden
- **Given** athlete B tries to DELETE row owned by athlete A
- **Then** 0 rows affected.

#### Scenario 3.5 — coach has no access
- **Given** a coach with a `coach_athlete_relationship` with athlete A
- **When** the coach queries `ai_reports_history` for `athlete_id = A`
- **Then** 0 rows returned.

---

### REQ-4: Paginated history listing via `list-ai-reports`

The edge function MUST paginate results and scope to the authenticated user.

#### Scenario 4.1 — first page default
- **Given** athlete with 23 saved reports
- **When** calling `listAnalysisHistory({page:1, limit:10})`
- **Then** response is `{items: [10 items], total: 23, page: 1, limit: 10, has_more: true}`, ordered by `created_at DESC`.

#### Scenario 4.2 — last page
- **When** calling `listAnalysisHistory({page:3, limit:10})`
- **Then** `items.length === 3`, `has_more === false`.

#### Scenario 4.3 — filter by chart_type
- **When** calling with `chartType:'tsb'`
- **Then** only `tsb` rows returned, correctly paginated.

#### Scenario 4.4 — unauthenticated
- **When** called without a JWT
- **Then** 401.

---

### REQ-5: `ai_analysis_cache` stores JSON

The `response` column MUST be `jsonb` after migration.

#### Scenario 5.1 — migration wraps existing rows
- **Given** a pre-migration row with `response = 'texto'`
- **When** the migration runs
- **Then** the row becomes `response = {"sections":[{"type":"text","content":"texto"}]}`.

#### Scenario 5.2 — service reads a still-plain value (defense in depth)
- **Given** the service receives `response: "foo"` (string) from a stale path
- **When** processing
- **Then** it wraps it as `{sections:[{type:'text', content:'foo'}]}` before returning to components.

---

### REQ-6: Quota accounting unchanged semantics

The quota MUST decrement once per successful non-cached generation and MUST NOT decrement on cache hits.

#### Scenario 6.1 — quota counted on fresh generation
- **Given** remaining quota 4
- **When** a non-cached generation succeeds
- **Then** remaining quota is 3 and `ai_analysis_usage` is updated for the current month.

#### Scenario 6.2 — quota not counted on cache hit
- **Given** remaining quota 4 and a cache hit
- **When** the call returns
- **Then** remaining quota is still 4.

#### Scenario 6.3 — quota exhausted
- **Given** remaining quota 0
- **When** a non-cached generation is requested
- **Then** the edge function returns `429` with `code: 'quota_exceeded'` and NO row is inserted in `ai_reports_history`.

---

### REQ-7: `ReportRenderer` renders all six section types

#### Scenario 7.1 — heading + text
- **Given** `sections = [{type:'heading', content:'Hola'}, {type:'text', content:'Mundo'}]`
- **Then** the DOM has `<h3>Hola</h3>` and a paragraph "Mundo".

#### Scenario 7.2 — kpi with positive delta
- **Given** `{type:'kpi', label:'TSB', value:'+12', delta: 5}`
- **Then** renders label "TSB", value "+12", and a green "▲ 5" chip.

#### Scenario 7.3 — kpi with negative delta
- **Given** `delta: -3`
- **Then** renders a red "▼ 3" chip.

#### Scenario 7.4 — recommendation priority
- **Given** three recommendations with priorities `high`, `medium`, `low`
- **Then** each is rendered with a distinct visual treatment (colour/icon) matching priority.

#### Scenario 7.5 — list
- **Given** `{type:'list', items:['a','b','c']}`
- **Then** renders `<ul><li>a</li><li>b</li><li>c</li></ul>`.

#### Scenario 7.6 — unknown section type
- **Given** `{type:'foo', content:'...'}`
- **Then** renders nothing (skipped silently) and does not throw.

---

### REQ-8: Embedded chart renderers

Each of the five chart types MUST render given valid data and gracefully degrade on invalid data.

#### Scenario 8.1 — `line_trend` valid
- **Given** `{x:['S1','S2','S3'], y:[450,520,480], label:'Carga'}`
- **Then** a line chart with 3 points is rendered; caption text appears beneath if provided.

#### Scenario 8.2 — `bar_comparison` valid
- **Given** `{labels:['Ene','Feb'], values:[100,120]}`
- **Then** 2 bars render.

#### Scenario 8.3 — `donut_distribution` valid
- **Given** `{segments:[{label:'Z1', value:30},{label:'Z2', value:70}]}`
- **Then** a donut with 2 slices renders, colours from a default palette when `color` is absent.

#### Scenario 8.4 — `progress_gauge` valid
- **Given** `{current: 48, max: 60, label:'km semana'}`
- **Then** a gauge filled 80% renders with `48 / 60` text and label.

#### Scenario 8.5 — `zone_bar` valid
- **Given** `{zones:[{zone:'Z1', pct:50},{zone:'Z2', pct:30},{zone:'Z3', pct:20}]}`
- **Then** a horizontal stacked bar is rendered with 3 segments totalling 100%.

#### Scenario 8.6 — invalid chart data
- **Given** `{type:'chart', chart_id:'line_trend', data:{}, caption:'Semana'}`
- **When** the renderer runs
- **Then** the chart body is not rendered and the caption text "Semana" is shown alone. No error thrown.

#### Scenario 8.7 — unknown chart_id
- **Given** `chart_id: 'spaghetti'`
- **Then** the section is skipped silently (with caption shown if present).

---

### REQ-9: History page UX

#### Scenario 9.1 — empty state
- **Given** athlete with no reports
- **When** visiting `/athlete/analysis-history`
- **Then** an empty-state illustration + CTA "Ir a métricas" is shown.

#### Scenario 9.2 — list shows title, chart type, date
- **Given** 3 saved reports
- **Then** each row shows `title`, a `chart_type` badge, and `created_at` formatted with `toLocalDateStr`.

#### Scenario 9.3 — click row opens modal
- **Given** a report R is in the list
- **When** the user clicks the row
- **Then** `AiAnalysisModal` opens populated from `getAnalysisById(R.id)`, no LLM call is made, no quota is debited.

#### Scenario 9.4 — delete with confirmation
- **Given** a row is present
- **When** the user clicks delete and confirms
- **Then** the row is removed from `ai_reports_history` and from the UI.

#### Scenario 9.5 — pagination controls
- **Given** 23 reports
- **Then** page 1 shows 10, "siguiente" loads page 2 (10), page 3 (3). "anterior" navigates back.

---

### REQ-10: Modal integration

#### Scenario 10.1 — new analysis auto-saves
- **Given** an athlete triggers an analysis from `GeneralAnalysisCTA`
- **When** the request resolves
- **Then** the report renders AND appears at the top of the history list on next visit.

#### Scenario 10.2 — re-opened historical report
- **When** the modal opens from the history page
- **Then** no "remaining quota" chip is shown (since no quota was used) and no "Regenerar" button is shown.

#### Scenario 10.3 — general analysis mandatory sections
- **Given** a fresh `chartType='general'` generation
- **Then** the report contains at least: 1 `heading`, 1 `text`, 1 `chart`, and 1 `recommendation`. If Gemma omits any, the edge function post-processes by injecting a minimal heading + text if missing (best-effort; never inject charts).

---

### REQ-11: Navigation

#### Scenario 11.1 — sidebar entry
- **Given** an athlete is logged in
- **Then** `AthleteSidebar` contains an entry "Mis análisis IA" linking to `/athlete/analysis-history`.

#### Scenario 11.2 — route lazy-loaded
- **Given** the app bundle
- **Then** `AnalysisHistory` is loaded via `React.lazy` + `Suspense` like the other athlete pages.

---

### REQ-12: Backward compatibility

#### Scenario 12.1 — old cached string response
- **Given** a stale `ai_analysis_cache` row that pre-dates migration (shouldn't exist post-migration but defensive)
- **When** the edge function reads it
- **Then** it is wrapped into the section format before returning.

#### Scenario 12.2 — client receives plain string
- **Given** the service shim receives `{response: "texto"}` from any code path
- **Then** it returns `{report: {sections:[{type:'text', content:'texto'}]}}` to the component.

---

## Out of scope
- Coach visibility of athlete reports.
- Automated report cleanup / retention.
- PDF export of reports.
- More than 5 embedded chart types.
- Editing/annotating reports.
