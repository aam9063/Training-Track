# Tasks: AI Analysis Reports (ai-analysis-reports)

Status: proposed
Reads: `spec.md`, `design.md`

Legend: `[ ]` pending · `[~]` in progress · `[x]` done · Parent tasks list subtasks.

---

## Phase 1 — Database migration

- [ ] **1.1** Create `supabase/migrations/YYYYMMDD_ai_reports_history.sql` with up script (table, indexes, RLS policies for SELECT own / DELETE own / service_role ALL).
- [ ] **1.2** Add in the same migration the `ai_analysis_cache.response` conversion from `text` to `jsonb`, wrapping existing rows as `{sections:[{type:'text', content: <old>}]}`.
- [ ] **1.3** Write the documented DOWN script as a SQL comment block at the bottom of the migration for manual rollback.
- [ ] **1.4** Apply migration on a Supabase preview branch; verify: `ai_reports_history` exists, indexes present, `ai_analysis_cache.response` is `jsonb`, existing cache rows are wrapped.
- [ ] **1.5** Run `SELECT` as athlete A (JWT) on `ai_reports_history` after inserting a row via service_role: only own rows returned.
- [ ] **1.6** Attempt cross-athlete SELECT/DELETE (athlete B on A's row): 0 rows affected.

## Phase 2 — Edge function `analyze-metric-chart` rewrite

- [ ] **2.1** Refactor prompt templates in `supabase/functions/analyze-metric-chart/index.ts` per-chart-type with the structured JSON few-shot example from design §4.1.
- [ ] **2.2** Implement `parseGemmaResponse(raw)`: strip ```json fences, `JSON.parse`, schema-validate, return `Report` or fallback.
- [ ] **2.3** Implement `validateSections(sections)`: drop invalid types, enforce ≤10 total, ≤5 `chart`, required fields per type, trim strings.
- [ ] **2.4** Implement `titleFor(chartType, date)` helper with Spanish month abbreviations.
- [ ] **2.5** Migrate cache read path: treat `response` as `jsonb`; defensive shim if a string is encountered.
- [ ] **2.6** Insert row into `ai_reports_history` on every response (cached and fresh). Return `reportId` in the function response.
- [ ] **2.7** Update response shape from `{response, cached, remainingQuota}` to `{report, cached, remainingQuota, reportId}`.
- [ ] **2.8** Keep quota decrement only on cache miss (unchanged logic).
- [ ] **2.9** Return `429 {code:'quota_exceeded'}` when quota is 0 AND no cache hit. Skip history insert in that path.
- [ ] **2.10** Add logs with `{chart_type, hash, cached, had_fallback, report_sections, report_bytes, remaining_quota}`.
- [ ] **2.11** Unit tests for parser: valid, fenced, malformed, >10 sections, >5 charts, invalid type, all-invalid.
- [ ] **2.12** Deploy to Supabase with `deploy_edge_function`; verify against preview branch.

## Phase 3 — Edge function `list-ai-reports`

- [ ] **3.1** Scaffold `supabase/functions/list-ai-reports/index.ts` (Deno + supabase-js).
- [ ] **3.2** Parse query params: `page` (default 1, min 1), `limit` (default 10, max 50), `chart_type?`.
- [ ] **3.3** Resolve `athleteId` from JWT; 401 if missing.
- [ ] **3.4** Query `ai_reports_history` with pagination + optional `chart_type` filter; order `created_at DESC`.
- [ ] **3.5** Compute `total` via `count(*)` query; derive `has_more`.
- [ ] **3.6** Response `{items, total, page, limit, has_more}`.
- [ ] **3.7** Deploy and smoke-test with a seeded athlete (3+ reports) for pages 1 and 2.

## Phase 4 — Frontend report renderer

- [ ] **4.1** Create folder `src/components/athlete/reports/`.
- [ ] **4.2** Implement `ReportRenderer.jsx` with the `SECTION_COMPONENTS` map and empty-state handling.
- [ ] **4.3** Implement `TextSection`, `HeadingSection`, `ListSection` (trivial).
- [ ] **4.4** Implement `KpiSection` with positive/negative/zero delta chips (colour + arrow icon).
- [ ] **4.5** Implement `RecommendationSection` with priority-based visual treatment (high=red, medium=amber, low=slate).
- [ ] **4.6** Implement `ChartSection`: lookup in `CHART_COMPONENTS`, defensive data validation, renders caption on fallback.
- [ ] **4.7** Implement `LineTrend.jsx` (Chart.js line) with `{x, y, label}` validation.
- [ ] **4.8** Implement `BarComparison.jsx` with `{labels, values}` validation.
- [ ] **4.9** Implement `DonutDistribution.jsx` with default palette for missing `color`.
- [ ] **4.10** Implement `ProgressGauge.jsx` (CSS-only) with `{current, max, label}`; clamp to [0,1].
- [ ] **4.11** Implement `ZoneBar.jsx` (horizontal stacked) — normalise pct so it sums to 100.
- [ ] **4.12** Unit-test each chart with valid and invalid data; verify no throws.

## Phase 5 — Integration (modal, history page, service, nav)

- [ ] **5.1** Extend `src/services/metricAnalysisService.js`:
  - [ ] **5.1.1** Adapt `analyzeMetricChart` to new response shape + backward-compat shim.
  - [ ] **5.1.2** Add `listAnalysisHistory({page, limit, chartType})`.
  - [ ] **5.1.3** Add `getAnalysisById(id)`.
  - [ ] **5.1.4** Add `deleteAnalysis(id)`.
- [ ] **5.2** Rewrite `src/components/athlete/AiAnalysisModal.jsx` to use `ReportRenderer`. Add `mode: 'live'|'history'` prop (hide "Regenerar" and quota chip in history mode).
- [ ] **5.3** Update `src/hooks/useAiAnalysisQuota.js` if it derived state from `response`; adapt to new shape.
- [ ] **5.4** Create `src/pages/athlete/AnalysisHistory.jsx`:
  - [ ] **5.4.1** List layout (title, chart_type badge, date via `toLocalDateStr`).
  - [ ] **5.4.2** Pagination controls (prev/next, disabled states).
  - [ ] **5.4.3** Click row → open `AiAnalysisModal` in `history` mode via `getAnalysisById`.
  - [ ] **5.4.4** Delete with confirmation dialog → `deleteAnalysis` + optimistic UI.
  - [ ] **5.4.5** Empty state with CTA.
- [ ] **5.5** Add lazy route in `src/App.jsx`: `/athlete/analysis-history` → `AnalysisHistory`.
- [ ] **5.6** Add sidebar entry in `src/components/athlete/AthleteSidebar.jsx`: "Mis análisis IA" with icon.
- [ ] **5.7** Verify `GeneralAnalysisCTA.jsx` still works with new response (it only reads `report` via the modal, so should be transparent once modal is updated).

## Phase 6 — Testing, polish, deploy

- [ ] **6.1** Frontend unit tests for `ReportRenderer`: all 6 section types + unknown type skipped.
- [ ] **6.2** E2E (Playwright): generate analysis → history shows new entry → reopen → delete → gone.
- [ ] **6.3** RLS integration test: athlete A cannot see athlete B's reports; coach cannot see any.
- [ ] **6.4** Observability check: logs include `had_fallback` and parsing metrics.
- [ ] **6.5** Review text copy (Spanish): sidebar label, page header, empty state, confirmation dialog.
- [ ] **6.6** Verify AGENTS.md conventions (GGA pre-commit) pass.
- [ ] **6.7** Deployment (in order):
  - [ ] **6.7.1** Apply migration on production.
  - [ ] **6.7.2** Deploy `list-ai-reports`.
  - [ ] **6.7.3** Deploy `analyze-metric-chart` new version.
  - [ ] **6.7.4** Merge frontend to `dev` and validate on preview.
  - [ ] **6.7.5** Merge `dev` → `master` (Vercel deploy).
- [ ] **6.8** Post-deploy monitoring: first week, track JSON fallback rate; target < 5%.

---

## Exit criteria

- All REQ-1…REQ-12 scenarios pass.
- JSON fallback rate measurable and < 5% in logs.
- Athlete can generate, review, reopen and delete reports end-to-end.
- RLS tests green for cross-athlete and coach-read cases.
- No regression in existing per-chart AI analysis flow (modal still opens from `GeneralAnalysisCTA` and per-chart callers).
