# Proposal: AI Analysis Reports (ai-analysis-reports)

Status: proposed
Owner: athlete-ai
Depends on: `metrics-ai-analysis` (in place — provides `analyze-metric-chart` edge function, `ai_analysis_usage`, `ai_analysis_cache`, `AiAnalysisModal`, `GeneralAnalysisCTA`)

## Why

The current AI analysis flow has two fundamental limitations:

1. **Reports are ephemeral.** `analyze-metric-chart` returns plain text that is rendered in `AiAnalysisModal.jsx`. When the user closes the modal the response disappears. The only "persistence" today is the 24h `ai_analysis_cache` entry keyed by a hash of the input data — which is a mechanism to avoid re-billing the LLM, not a historical archive the athlete can browse. Athletes tell us they want to go back to previous insights, and coaches reference them in follow-up conversations.
2. **Plain text feels like a chat, not a report.** Athletes consistently value *visual* insights (trend lines, zone bars, progress gauges) and text-only analyses are quickly forgotten. The edge function currently instructs Gemma 4 to write a conversational paragraph; there is no way to embed a chart, a KPI, or a prioritised recommendation inside the response.

Both limitations compound: because reports are ephemeral, there is no incentive to produce rich reports; because reports are plain text, there is no incentive to keep them.

This change solves both problems at once: (A) **persist every analysis** in a dedicated `ai_reports_history` table, and (B) **restructure the LLM output** from a plain string into a validated JSON report made of typed sections (`text`, `heading`, `chart`, `kpi`, `recommendation`, `list`) that the frontend renders through a component registry.

## What Changes

### Database
- **New table `ai_reports_history`** (`id`, `athlete_id`, `chart_type`, `title`, `report jsonb`, `athlete_context jsonb`, `source_data_hash`, `created_at`) with RLS: athlete SELECT/DELETE own, service_role ALL, coach cannot read.
- **Migrate `ai_analysis_cache.response`** from `text` to `jsonb`. Existing rows are wrapped as `{"sections":[{"type":"text","content": <old_text>}]}`.
- Indexes: `(athlete_id, created_at DESC)` and `(athlete_id, chart_type, created_at DESC)`.

### Edge functions
- **Rewrite `analyze-metric-chart`**: prompts are updated with a few-shot JSON example so Gemma 4 returns structured output. The response handler:
  1. Strips ```json code fences.
  2. `JSON.parse` with try/catch.
  3. Validates each section has a legal `type` and required fields.
  4. On parse or validation failure: falls back to `{sections:[{type:'text', content: raw}]}`.
  5. Caps output at 10 sections and at most 5 `chart` sections.
  6. Persists the validated report to `ai_reports_history` with an auto-generated `title` (e.g. `"Análisis general — 14 abr 2026"`, `"TSB — 14 abr"`).
  7. Updates cache with JSON response and existing quota counter.
- **New `list-ai-reports`**: paginated listing (default 10 per page) scoped by athlete via JWT. Supports optional filter by `chart_type` and returns `{items, total, page, limit, has_more}`.

### Frontend
- **New component `ReportRenderer.jsx`** (`src/components/athlete/reports/`) — takes `report.sections[]` and renders each section by delegating to a typed sub-renderer. Unknown/invalid types degrade to a caption or are skipped silently.
- **New chart registry** with 5 components (all accept a `data` prop, render via Chart.js or CSS):
  - `LineTrend.jsx` (`{x, y, label}`)
  - `BarComparison.jsx` (`{labels, values}`)
  - `DonutDistribution.jsx` (`{segments:[{label,value,color?}]}`)
  - `ProgressGauge.jsx` (`{current, max, label}`)
  - `ZoneBar.jsx` (`{zones:[{zone,pct,color?}]}`)
- **Rewrite `AiAnalysisModal.jsx`**: remove plain-text rendering, use `ReportRenderer`. Existing quota/loading/error states are preserved. Title is sourced from the saved report so re-opened historical reports show the same header.
- **New page `src/pages/athlete/AnalysisHistory.jsx`** — paginated list (10/page) with each row showing `title`, `chart_type` badge, `created_at` formatted with `dateUtils.toLocalDateStr`, and actions (view / delete). Clicking "view" opens `AiAnalysisModal` populated from the stored report (no LLM call). Delete asks for confirmation and calls the service.
- **Sidebar entry** added in `AthleteSidebar.jsx`: *"Mis análisis IA"* → `/athlete/analysis-history`.
- **Route** in `App.jsx` (lazy) → `/athlete/analysis-history` → `AnalysisHistory`.

### Service layer
- `metricAnalysisService.js` extended:
  - `analyzeMetricChart(...)` now returns `{report, cached, remainingQuota, reportId}` instead of `{response, cached, remainingQuota}`.
  - `listAnalysisHistory({page, limit, chartType?})` calls `list-ai-reports`.
  - `getAnalysisById(id)` direct select on `ai_reports_history` (RLS scoped).
  - `deleteAnalysis(id)` direct delete on `ai_reports_history` (RLS scoped).
- Backward-compat shim: if the edge function returns a bare string (old cache entry), the service wraps it as a single-section report before returning.

## Affected Files

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDD_ai_reports_history.sql` | NEW |
| `supabase/functions/analyze-metric-chart/index.ts` | Rewrite (prompts + parser + persistence) |
| `supabase/functions/list-ai-reports/index.ts` | NEW |
| `src/services/metricAnalysisService.js` | Extend |
| `src/components/athlete/AiAnalysisModal.jsx` | Rewrite render path |
| `src/components/athlete/reports/ReportRenderer.jsx` | NEW |
| `src/components/athlete/reports/LineTrend.jsx` | NEW |
| `src/components/athlete/reports/BarComparison.jsx` | NEW |
| `src/components/athlete/reports/DonutDistribution.jsx` | NEW |
| `src/components/athlete/reports/ProgressGauge.jsx` | NEW |
| `src/components/athlete/reports/ZoneBar.jsx` | NEW |
| `src/pages/athlete/AnalysisHistory.jsx` | NEW |
| `src/App.jsx` | Add lazy route |
| `src/components/athlete/AthleteSidebar.jsx` | Nav entry |
| `src/hooks/useAiAnalysisQuota.js` | Adjust to new response shape |

## Risks

- **Gemma returns malformed JSON.** Mitigation: strict parse + schema validation + fallback to single `text` section. Low severity (user still sees content).
- **Report size blow-up.** Mitigation: prompt caps (10 sections / 5 charts) + server-side trim. Rows also have a hard ceiling of 64KB on `report jsonb` enforced by validation.
- **Cache shape drift.** Old `ai_analysis_cache.response` rows are `text`; migration wraps them. Service has a defensive shim in case a stale client reads a pre-migration row.
- **Coach-athlete tension.** Reports are **private to the athlete** (ADR-3). Coach cannot query this table. If a coach wants visibility later it is a new, explicit change.
- **Storage growth.** `ai_reports_history` grows monotonically. Out of scope here; tracked as a follow-up (optional 6-month cleanup job).
- **RLS pitfalls.** Using `(select auth.uid())` per project conventions. Insert path goes through edge function using service_role to avoid RLS write complexity.

## Next Phase

Run `sdd-spec` and `sdd-design` in parallel, then `sdd-tasks`.
