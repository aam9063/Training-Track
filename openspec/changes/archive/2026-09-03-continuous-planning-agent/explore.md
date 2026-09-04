# Explore: Continuous Planning Agent (Agent 3)

Third of the planned multi-agent system (Fase 1: Monitorización → [[training-load-monitoring-agent]] shipped; Adherencia → [[adherence-detection-agent]] shipped; Planificación continua → this exploration; later Comunicación; Fase 2 eventual MCP/SDK extraction explicitly deferred, not started).

## Current State

**Agent 1** (`training-load-monitoring-agent`) and **Agent 2** (`adherence-detection-agent`), both archived, establish this repo's multi-agent conventions:
- Zero-import shared core at `supabase/functions/_shared/{trainingLoadCore,engagementCore}.js` — pure compute, no I/O, imported by both Deno (explicit `.js` extension) and Vite (no build step needed).
- Edge Function owns all I/O; dual invocation — reactive (`EdgeRuntime.waitUntil` fire-and-forget from `strava-webhook`/session-completion/etc.) + scheduled `pg_cron` sweep, one function with a `mode` discriminator.
- `pg_cron` secrets via Vault (`CRON_SECRET`/`project_url`), never literals in SQL.
- Kill switch env var gates delivery only, not computation — but the two agents picked **opposite defaults**: `TRAINING_LOAD_ALERTS_ENABLED` defaults `true`, `ENGAGEMENT_ALERTS_ENABLED` defaults `false` (`supabase/functions/engagement-monitor/index.ts`). Both support a `dryRun` param OR'd with `!ALERTS_ENABLED`.
- Both prior agents' runtime specs explicitly forbid writing `training_sessions` or triggering plan regeneration (`openspec/specs/training-load-agent-runtime/spec.md`, `openspec/specs/engagement-agent-runtime/spec.md`, "Agent Scope Boundary" requirement). **Agent 3 would be the first agent in this system authorized to touch planning data.**
- Signal sources already available: `training_load_alerts` (4 independent types — `acwr_zone`, `tsb_critical`, `low_completion`, `high_rpe` — dedup per `(athlete_id, alert_type) WHERE status='open'`, 2-day hysteresis) and `athlete_engagement_alerts` (1 type `engagement_silence`, warning@10d/danger@21d, coach-only RLS, immediate reactive resolve).

**AI Training Planner** (`supabase/functions/generate-ai-plan/index.ts`) is one-shot, not reactive:
- Dual auth: coach path (verified `coach_athlete_relationship`) vs. independent-athlete self-generation (rate-limited **2/7-day window** — the coach path has **no rate limit at all**).
- Calls Gemini with a 58s abort timeout, fit to the documented 60s Edge Function wall-clock limit — a hard constraint Agent 3 would inherit for any Gemini-based re-evaluation.
- Two persistence paths that don't share code:
  - **Coach path** (`AIPlanReviewModal.jsx` → `src/services/planningService.js`'s `assignPlanToAthletes`): deletes `training_sessions` by `plan_id`+`athlete_id` with **no status/date filter** — reassigning the same plan would delete completed session history too.
  - **Independent-athlete path** (`src/services/independentPlanService.js`'s `autoAssignPlan`): correctly scoped delete (`status='planned' AND scheduled_date >= today`), preserving history.
- **No provenance tracking exists anywhere on `training_sessions`** — confirmed via exhaustive grep of every write site across `src/services/*`. Nothing distinguishes an AI-generated session from a coach's manual edit.
- `athlete_profile` carries the durable constraints (`dias_disponibles`, `horas_por_dia`, `acceso_gimnasio`, `acceso_pista`, `lesiones`, `objetivo`/`competicion_fecha`) any adjustment logic must respect.
- `supabase/schema.sql` is stale (predates `rpe_score`, `estimated_distance_km`, etc.) — do not trust as ground truth; re-verify live schema at design time.

## Affected Areas
- `supabase/functions/generate-ai-plan/index.ts` — reuse candidate for a "regenerate" approach
- `src/services/planningService.js` — `assignPlanToAthletes`'s unscoped deletion bug needs fixing before any automated reuse
- `src/services/independentPlanService.js` — correctly-scoped regeneration reference implementation
- `src/components/dashboard/AIPlanReviewModal.jsx` — existing approval-UI pattern
- `training_load_alerts`, `athlete_engagement_alerts` — candidate trigger sources
- `training_sessions`, `daily_training_load`, `athlete_profile`, `training_plans`/`mesocycles`/`microcycles` — data model
- No existing `_shared/` core module for planning logic — would be new

## Approaches Considered (not decided — for proposal phase)

1. **Full plan regeneration** — reuse Gemini prompt engineering; but destroys coach edits (no provenance) and inherits the `assignPlanToAthletes` deletion bug. Effort: Medium/High.
2. **Surgical adjustment of remaining sessions** — deterministic patch of future `planned` sessions, no LLM call; cheap, testable like Agent 1's pure-core pattern; needs a new rulebook. Effort: High (design) / Low (runtime cost).
3. **Suggestion-only, coach-approved** — mirrors the one interaction pattern this codebase already has (`AIPlanReviewModal`); safest; independent athletes would need a self-approval variant. Effort: Medium.
4. **Autonomous direct write** — truly continuous, but architecturally unsafe today given zero provenance tracking; breaks the scope-boundary precedent both prior agents set. Effort: Low to build / High trust risk.

Not mutually exclusive: deterministic adjustment logic (2) proposed for coach approval first (3), with autonomous write (4) only after a provenance mechanism exists, is the shape most consistent with existing precedent and the known bugs below.

## Open Questions for Proposal Phase (deliberately unresolved here)
- Full plan regeneration vs. surgical adjustment of remaining sessions in the current block?
- Autonomous (agent edits `training_sessions` directly) vs. suggestion-only (agent proposes, coach approves)?
- Trigger: reactive on each new alert row, a scheduled weekly sweep, or both (mirroring Agent 1/2's dual-invocation pattern)?
- Cost/latency: does continuous replanning risk hitting Gemini quota/cost limits if triggered per-alert rather than batched, given the existing 58s/60s timeout constraint?
- Scope: coach-supervised athletes only (like Agent 2) or also independent athletes (who already self-generate plans via the same `generate-ai-plan` function, under a stricter rate limit)?
- How does this interact with a coach's own manual edits to a plan already in `AIPlanReviewModal` — does an autonomous agent risk clobbering coach intent, given there's no provenance to tell the two apart?
- Which kill-switch default (Agent 1's `true` or Agent 2's `false`) is right for a write-capable agent, and why?

## Risks
- **No provenance on `training_sessions`** — the single biggest gap any write-capable design must resolve. Nothing today distinguishes an AI-generated session from a coach's manual edit.
- **`assignPlanToAthletes` deletion bug** — unscoped delete by `plan_id`+`athlete_id` would delete completed session history if reused for automated re-planning.
- **Gemini cost/latency + asymmetric rate limiting** — independent athletes capped at 2/7-day, coach path uncapped; per-alert triggering risks quota/cost blowup.
- **Independent-athlete scope ambiguity** for any coach-approval design (no coach to approve on their behalf).
- **Kill-switch default inconsistency** between prior agents, unexplained in either's artifacts — proposal should pick and justify one for this agent.
- `supabase/schema.sql` is stale; re-verify live schema at design time, not from this file.

## Ready for Proposal
Yes.
