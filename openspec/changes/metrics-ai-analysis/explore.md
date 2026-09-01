# Exploration — metrics-ai-analysis

## Current state

### Metrics page (both roles)
- **Single shared page**: `src/pages/athlete/Metrics.jsx` (2281 lines) is used by BOTH coached and independent athletes. `isIndependent` only branches the Strava-connect CTA (`Metrics.jsx:1159`). A coach-side `src/pages/dashboard/Metrics.jsx` also exists (separate page; out of scope unless we mirror).
- **Chart library**: Chart.js via `react-chartjs-2` (`Metrics.jsx:3-16`, `package.json:21` `"chart.js":"^4.5.1"`). `recharts` also exists in deps (`package.json:40`) but is not used here. No single reusable chart wrapper — each chart is inline.
- **Chart sections (candidates for per-chart AI button)**:
  - `InternalMetricsSection` — Weekly km bar + RPE trend (`Metrics.jsx:470-660`)
  - `Predictor de Tiempos` — VDOT/Daniels (`Metrics.jsx:1349-1410`)
  - `PMCChart` (CTL/ATL/TSB) component (`Metrics.jsx:1420`)
  - `TrainingZonesCard` (Daniels) (`Metrics.jsx:1436`)
  - `HR Training Zones` + distribution donut (`Metrics.jsx:1444-1572`)
  - `ActivityTypeDistribution` + `TotalActivityTimeChart` (`Metrics.jsx:1574-1606`)
  - `Gestión de Carga` — ACWR gauge + weekly bars (`Metrics.jsx:1608-1720`)
  - `Progresión Semanal Running` (`Metrics.jsx:1726`) and `Récords & Mejores marcas` (`Metrics.jsx:2150`)
- Data is loaded through hooks `useStravaMetrics`, `useInternalMetrics`, plus `getDailyLoads`/`calculateLoadMetrics` from `services/aiReportService.js`.

### AI edge function patterns
- **Model**: Gemma 4 (`gemma-4-26b-a4b-it`) via `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=` — secret is `GEMMA4_API_KEY` read from `Deno.env` (`athlete-ai-chat/index.ts:6-8`; `generate-ai-report/index.ts:4-6`).
- **Auth**: JWT verified via `supabase.auth.getUser(authHeader)` (`athlete-ai-chat:259`). `generate-ai-report` creates a supabase client with user's JWT (`generate-ai-report:33-38`).
- **Request body**: arbitrary JSON — `{ athleteId, message }` for chat; `{ reportData, athleteId, periodWeeks }` for reports.
- **Response shape**: `aiResult.candidates[0].content.parts[]`. Gemma 4 may return `thought: true` parts; the code filters those: `parts.filter(p => !p.thought).map(p => p.text).join('')` with a fallback to include thoughts if empty (`athlete-ai-chat:526-527`, `generate-ai-report:224-225`).
- **Timeout/retry**: None explicit — relies on Deno `fetch`. Report expects JSON reply; chat returns plain text.
- **System prompt format rule**: plain text, no markdown (`athlete-ai-chat:91, 229`). Reports force JSON-only.
- **Storage patterns**: chat persists to `ai_chat_sessions` (upsert by `coach_id,athlete_id`). Reports persist to `ai_reports`.

### Plan feature gating
- `src/hooks/useSubscription.js` exposes `plan`, `planLabel`, `status`, `isExempt`, `isTrialing`, `trialDaysLeft`, `hasActiveSubscription`, `canAccess(feature)`, `canAddAthlete(n)`, `needsPaywall`, `subscription` (`useSubscription.js:84-97`).
- `src/lib/planFeatures.js` PLAN_FEATURES matrix — athlete keys: `viewTraining, stravaSync, basicMetrics, aiPlans, hermesChat, advancedMetrics, competitions, vamTest, wellness` (`planFeatures.js:79-106`). **No `aiAnalysis` flag exists** — must add.
- `canAccess()` usage in the app is almost non-existent: grep shows only `planLabel`/`isTrialing`/`isExempt`/`needsPaywall` are consumed. There is **no codebase example of `canAccess('feature')` being called today** — gating is by plan bool via `planFeatures` but wired through page-level guards rather than conditional buttons.

### Coached athlete detection + coach plan lookup
- `AuthContext.jsx:536` — `isIndependent: profile?.role === 'athlete' && profile?.is_independent === true`.
- For coached athletes, coach id is read via `profile?.athlete?.coach_athlete_relationship?.[0]?.coach_id` (see `pages/athlete/Training.jsx:88`, `pages/athlete/GymFiles.jsx:26`). The relationship is embedded in the profile fetch (`AuthContext.jsx:54-68`).
- To look up the coach's subscription: query `subscriptions` table by `user_id = coachId` — **not currently done anywhere** (each user only reads their own subscription in `AuthContext.jsx:72-76`).

### Usage quotas
- **No monthly/quota pattern exists** in the codebase. Only quota-like enforcement found:
  - `ai_chat_sessions` rate limit: 40 user messages/hour, computed from the `messages` jsonb column (`athlete-ai-chat:310-314`).
  - `coach_free.maxAthletes: 3` bound via `canAddAthlete(n)` (`planFeatures.js:10, useSubscription.js:73-79`).
- No `ai_usage`, `monthly_usage`, or similar table. New pattern required.

### UI patterns (modals, markdown)
- 16 modal components, all ad-hoc `<motion.div>` overlays (e.g. `VAMTestModal`, `PaywallModal`, `AIPlanReviewModal`, `SessionCompletionModal`, `PlanPreviewModal`). **No shared `Modal` component** — copy-paste pattern.
- AI response rendering: `AIAssistant.jsx` uses a custom `stripMarkdown()` (`AIAssistant.jsx:19-28`) and renders with `whitespace-pre-wrap` inside a `MessageBubble` (`AIAssistant.jsx:32-51`). Typing indicator at `AIAssistant.jsx:55-63`.
- **No `react-markdown` dependency** (`package.json` checked — not present). Matches the enforced plain-text rule in all AI system prompts.

### Chart ecosystem
- Chart.js 4.5 + react-chartjs-2 (primary). `recharts` installed but unused in `Metrics.jsx`. `PMCChart` and `TrainingZonesCard` are the only composed chart components; rest are inline `<Line/Bar/Doughnut>`. No common chart wrapper — per-chart AI button must be attached inline or via a new `<ChartCard>` wrapper.

## Gaps identified
1. No `aiAnalysis` feature flag in `PLAN_FEATURES` → add for both athlete roles + coach roles.
2. No monthly-usage table or counter → need new table `ai_analysis_usage` (user_id, month, count) + RPC.
3. No response-cache table → need `ai_analysis_cache` (user_id, chart_key, input_hash, response, created_at) with 24h TTL read.
4. No helper to look up coach's effective plan from an athlete session → need service `getCoachPlan(coachId)` or join.
5. No reusable ChartCard/Modal → must either add one wrapper or duplicate Analyze button per chart.
6. Independent vs coached share a single `Metrics.jsx` — AI logic must respect both in one flow.
7. Edge function patterns are JSON (report) or text (chat) — design must choose: plain text per chart, JSON for structured "General analysis".

## Touchpoints

| Component | Action |
| --- | --- |
| `src/pages/athlete/Metrics.jsx` | Add Analyze buttons per chart + General Analysis button |
| `src/lib/planFeatures.js` | Add `aiAnalysis` feature to athlete_free/premium + coach_* |
| `src/hooks/useSubscription.js` | Expose effective plan for "coach covers athlete" resolution |
| `src/hooks/useAiAnalysisQuota.js` (new) | Counts remaining analyses / month, caches |
| `src/components/athlete/AiAnalysisModal.jsx` (new) | Shared modal for AI responses (loading + plain-text body) |
| `src/components/athlete/ChartCard.jsx` (new, optional) | Wrapper to standardise Analyze button placement |
| `src/services/aiAnalysisService.js` (new) | Calls new edge fn, reads cache, increments usage |
| `supabase/functions/analyze-metric-chart/index.ts` (new) | Gemma 4 edge function — input: chart_key + payload → text |
| DB migration | `ai_analysis_usage`, `ai_analysis_cache` tables + RLS |
| `AuthContext.jsx` | Optionally expose `coachId` shortcut (currently via nested path) |

## Open questions
1. **Coach-free + athlete**: if coach is Free, athlete gets 1/month total — whose counter is used? Proposal: count on the **athlete's row** regardless (simpler), and let the athlete see remaining.
2. **Coach-premium + athlete**: is the athlete unlimited, or still capped? Locked: unlimited.
3. **Cache scope**: cache per `(user_id, chart_key, input_hash)` — does a coached athlete share cache with coach? Proposal: per-athlete only.
4. **General analysis**: counts as 1 unit in the same monthly quota — confirmed.
5. **Plain text vs markdown**: follow existing rule (plain text, no markdown) to avoid adding `react-markdown`.
6. **Model**: Gemma 4 (same as chat/report). No new secret needed.
7. **Coach-side Metrics page** (`pages/dashboard/Metrics.jsx`): in-scope or defer? Proposal: defer to a follow-up.

## Recommended next phase
sdd-propose

---

## Executive summary
The athlete Metrics page (`src/pages/athlete/Metrics.jsx`, 2281 lines, Chart.js) hosts ~8 chart sections and is shared by coached and independent athletes via a single `isIndependent` flag. AI is already wired in two patterns: `athlete-ai-chat` (Gemma 4, plain-text, JWT auth, 40 msg/h rate limit) and `generate-ai-report` (Gemma 4, JSON response). Both live in `supabase/functions/` and read `GEMMA4_API_KEY`. `useSubscription` exposes `canAccess(feature)` and a plan matrix in `planFeatures.js` — but no `aiAnalysis` flag, no monthly-usage counter, and no response cache exist today. Coach id for coached athletes is available via `profile.athlete.coach_athlete_relationship[0].coach_id`; looking up the coach's subscription is not yet done. Markdown rendering is not used anywhere (no `react-markdown`); the codebase enforces plain-text AI replies. The change needs: a new `aiAnalysis` feature flag, a monthly-usage table + cache table with RLS, a shared `AiAnalysisModal`, a new edge function `analyze-metric-chart`, and coach-plan resolution from the athlete session. Everything else is additive — minimal risk to existing AI features. Ready for sdd-propose.
