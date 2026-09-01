# Tasks — metrics-ai-analysis

## Phase 1 — Database
- [ ] 1.1 Write migration `supabase/migrations/<ts>_metrics_ai_analysis.sql` with `ai_analysis_usage`, `ai_analysis_cache`, RLS policies, and `get_ai_analysis_limit` RPC (per design.md SQL block).
- [ ] 1.2 Apply migration to Supabase project `lusirdkixfliydimemre`.
- [ ] 1.3 Test RPC manually for 4 scenarios: free-solo, premium-solo, coached+coach_pro, coached+coach_free, exempt, trial. Verify returned `{ limit, source }`.
- [ ] 1.4 Write prepared rollback SQL file `supabase/migrations/rollback/<ts>_metrics_ai_analysis_down.sql` (DROP RPC, DROP tables).

## Phase 2 — Edge function
- [ ] 2.1 Scaffold `supabase/functions/analyze-metric-chart/index.ts` copying auth + CORS + Gemma 4 pattern from `athlete-ai-chat/index.ts`.
- [ ] 2.2 Implement `canonicalJson(obj)` + `sha256Hex(str)` helpers (Web Crypto).
- [ ] 2.3 Implement cache lookup (`SELECT ... WHERE input_hash AND expires_at > now()`), early return on HIT.
- [ ] 2.4 Implement quota check (RPC + usage SELECT, return 403 if exceeded with `resets_at`).
- [ ] 2.5 Build `PROMPTS` registry with all 12 chart_types (tsb, time_in_zone, cardiac_drift, best_efforts, intensity_distribution, weekly_load, shoes, vdot_predictor, zones_donut, activity_type_distribution, weekly_progression, general). Spanish, plain-text, structured output.
- [ ] 2.6 Call Gemma 4 with `AbortController` (25s timeout); filter `thought` parts; fallback if empty.
- [ ] 2.7 INSERT cache + UPSERT usage on success.
- [ ] 2.8 Return shaped response `{ ok, response, cache_hit, remaining, source }`.
- [ ] 2.9 Deploy edge function: `supabase functions deploy analyze-metric-chart --no-verify-jwt false`.
- [ ] 2.10 Smoke test with curl: valid auth + `chart_type=tsb` → 200; invalid chart_type → 400; missing auth → 401.

## Phase 3 — Frontend plan gating
- [ ] 3.1 Add `aiAnalysis: true` to ALL plans in `src/lib/planFeatures.js` (coach_*, athlete_*, athlete_indep_*).
- [ ] 3.2 Create `src/services/aiAnalysisService.js` with `analyze({ chartType, data, athleteContext })` wrapper.
- [ ] 3.3 Create `src/hooks/useAiAnalysisQuota.js` that queries RPC + usage table and returns `{ used, limit, remaining, canUse, source, refetch }`.
- [ ] 3.4 Extend `src/hooks/useSubscription.js` to optionally expose `aiAnalysisQuota` (call `useAiAnalysisQuota` internally, or document as separate hook).
- [ ] 3.5 Expose `coachId` helper in `src/contexts/AuthContext.jsx` (derived from `profile.athlete.coach_athlete_relationship?.[0]?.coach_id`).

## Phase 4 — UI
- [ ] 4.1 Create `src/components/athlete/AiAnalysisModal.jsx` with states loading/done/error (copy modal pattern from existing, e.g. `AIPlanReviewModal`).
- [ ] 4.2 Create `src/components/athlete/MetricAIAnalyzer.jsx` button wrapper (compact variant for inline charts, full variant for general).
- [ ] 4.3 Wire `<MetricAIAnalyzer>` into each chart section of `src/pages/athlete/Metrics.jsx`:
  - PMC (`chart_type='tsb'`)
  - HR zones + donut (`chart_type='time_in_zone'` or `zones_donut`)
  - Cardiac drift chart (`chart_type='cardiac_drift'`)
  - Weekly load/ACWR (`chart_type='weekly_load'`)
  - Intensity distribution (`chart_type='intensity_distribution'`)
  - Best efforts / records (`chart_type='best_efforts'`)
  - VDOT predictor (`chart_type='vdot_predictor'`)
  - Activity type (`chart_type='activity_type_distribution'`)
  - Weekly progression (`chart_type='weekly_progression'`)
  - Shoes (`chart_type='shoes'`) if shown
- [ ] 4.4 Add "Análisis general" button at header of `Metrics.jsx` (top-right next to existing actions) → `chart_type='general'` with aggregated snapshot payload.
- [ ] 4.5 When quota exhausted → disabled state + tooltip + click opens `PaywallModal` (reuse existing).

## Phase 5 — Testing
- [ ] 5.1 Manual QA matrix:
  - free-solo 0→1 use → success, second blocked.
  - premium-solo → 3 uses no-block.
  - coached+coach_pro → unlimited.
  - coached+coach_free → 1 global.
  - exempt → unlimited.
  - trial active → unlimited.
- [ ] 5.2 Cache TTL verification: consume + reopen <24h → cache HIT (check edge logs); wait/fake 25h → MISS.
- [ ] 5.3 Error path: disable network → modal muestra "No se pudo analizar" + retry funciona.
- [ ] 5.4 Prompt quality: revisar respuestas reales de Gemma para 3 chart_types (tsb, weekly_load, general); ajustar prompts si son genéricas.
- [ ] 5.5 RLS check: con token de atleta A → `SELECT * FROM ai_analysis_usage WHERE athlete_id = '<B>'` devuelve 0.

## Phase 6 — Deploy
- [ ] 6.1 Apply migration to prod Supabase.
- [ ] 6.2 Deploy edge function `analyze-metric-chart` a prod.
- [ ] 6.3 Deploy frontend via Vercel (push a `dev` → merge a `master`).
- [ ] 6.4 Monitor Supabase Function Logs primeras 24h (errores, latencia Gemma, cache_hit ratio).
- [ ] 6.5 Update `MEMORY.md` con "metrics-ai-analysis shipped: tabla `ai_analysis_usage`, edge fn `analyze-metric-chart`, feature flag `aiAnalysis`".

Total: ~30 tasks across 6 phases.
