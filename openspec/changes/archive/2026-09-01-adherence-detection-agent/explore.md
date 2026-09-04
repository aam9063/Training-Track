# Exploration — adherence-detection-agent

Agent 2 of the planned multi-agent system for TrainingTrack. Agent 1 (`training-load-monitoring-agent`) shipped and archived — see `openspec/changes/archive/2026-09-01-training-load-monitoring-agent/` and `openspec/specs/training-load-{metrics,alerts,agent-runtime}/`.

## Mandate (from the original multi-agent brief)

"Adherencia: detecta atletas que dejan de subir datos o de responder y avisa al coach antes de que se produzca el abandono" — detect athletes going quiet and warn the coach before churn.

## Current state

No adherence/inactivity/churn detection exists anywhere in the codebase today — zero hits for inactiv/abandono/churn/dropout outside Agent 1's own "out of scope" notes. This is greenfield.

### Reusable infrastructure from Agent 1

- `training_load_alerts` table pattern: dedup per `(athlete_id, alert_type) WHERE status='open'`, 2-day hysteresis resolve, orthogonal read/dismiss lifecycle, RLS (self / coach-active-relationship / service_role)
- `training-load-monitor` Edge Function pattern: reactive (`strava-webhook` via `EdgeRuntime.waitUntil`) + `pg_cron` daily sweep, `CRON_SECRET`/`SERVICE_ROLE_KEY` dual auth
- `supabase/functions/_shared/trainingLoadCore.js` convention: pure zero-import core module, resolved directly by both Deno and Vite with no build step
- `resolveActiveCoachId()` routing pattern (coach-supervised → active coach; independent → self)
- `send_push_notification` RPC + `send-push` function (best-effort; failure must not block the in-app alert row)
- Migration convention: every migration ships a `_rollback.sql` sibling; CHECK constraints (not ENUM) for reversibility

### Signal inventory (verified against live code, not assumed)

| Signal | Source | Coverage | Reliability |
|---|---|---|---|
| Session completion | `training_sessions.status`/`completed_at` | All athletes | Best — universal, already read by `teamHealthService.js` |
| Strava activity recency | `strava_activities.start_date_local` | Strava-connected only | Good but partial |
| Strava sync recency | `devices.last_sync` | Strava-connected only | Weak — written client-side only, stale by construction |
| Login/app-open | `users.last_login` | Schema-wide | Dead — column exists, never written anywhere in the repo |
| Chat responsiveness | `chat_messages` (not `unified_chat_messages` as the brief names it) | Coach-supervised only | Real but structurally coach-only |
| Wellness check-in | `wellness_log` | All athletes | Good — daily, independent of training completion |
| "New athlete" cutoff | `coach_athlete_relationship.start_date` (coached) / `users.created_at` + `athletes.created_at` (independent) | All athletes, two different columns | Solid, but two code paths needed |

**Gotcha**: `teamHealthService.js` filters sessions on `.in('status', ['completed','skipped','pending'])` — `'pending'` isn't a valid live enum value (only `planned`/`completed` are actually used, per Agent 1's live verification). Dead filter clause, harmless today, worth knowing if Agent 2 touches that query.

### UI extension points

- `src/components/dashboard/TeamHealthTable.jsx` already has a "days since last session" badge (`LastSessionBadge`) — natural extension point.
- `src/components/shared/TrainingLoadAlertFeed.jsx` + `src/services/trainingLoadAlertsService.js` are already wired into `AthleteLoadAlerts.jsx` (coach), `src/pages/athlete/Dashboard.jsx` + `Metrics.jsx` (independent self-view), `src/pages/dashboard/AthleteProfile.jsx`.

## Approaches (terrain only, not decided — sdd-propose's job)

1. **Extend `training_load_alerts` with a 5th `alert_type`** — reuses all of Agent 1's plumbing (RLS, dedup, lifecycle, UI feed) via a MODIFIED-requirement delta to the already-archived `training-load-alerts` spec (its "Alert Type Taxonomy" requirement currently says exactly four values).
   - Pros: zero new UI surface, zero new RLS, immediate delivery via the existing push path.
   - Cons: conflates a physiological-load table with an engagement/churn table conceptually; touches a shipped, archived spec.
   - Effort: Low.
2. **New dedicated table/capability** (e.g. `athlete_adherence_alerts`) — mirrors the same patterns (dedup, RLS, `_shared/` core, sweep) as its own capability.
   - Pros: clean separation of concerns, no naming collision, own spec lifecycle.
   - Cons: duplicates scaffolding (RLS policies, a UI feed variant or a generalized shared feed).
   - Effort: Medium.

## Risks

- **Naming/scope collision (most consequential)**: `training_load_alerts.alert_type='low_completion'` is already shipped and labeled "Adherencia" in the UI, and "plan adherence %" is an established term elsewhere in the codebase (the `independent-athlete` change's AI chat context, meaning weekly session-completion-rate). Agent 2's actual mandate is broader/longer-horizon (multi-week silence/churn precursor), not the same thing as a single week's completion rate. Must be disambiguated before any UI copy is written, or it will read as a duplicate of something already live.
- **No reactive-trigger analog**: Agent 1's dual-invocation model (webhook + sweep) only half-transfers — there's no event to react to for "nothing happened." Only the `pg_cron` sweep pattern applies directly (though an incoming chat/wellness entry could reactively *resolve* an open adherence alert — a legitimate design option for later).
- **Uneven signal coverage per athlete**: Strava-based signals only apply to Strava-connected athletes; chat only applies to coach-supervised athletes; only `training_sessions` and `wellness_log` are universal. Any blended signal design must account for this.
- **`users.last_login` is dead**: reviving it as a real signal requires adding a new write path (client-side touch or auth hook) — not free, not yet decided if worth it.
- **Independent athlete self-alert semantics unresolved**: Agent 1's precedent has independents self-alert about their own physiological risk; "churn prevention for the coach" doesn't map 1:1 onto an athlete with no coach — the alert would need to become a different kind of motivational nudge, or be scoped out entirely for independents.
- **Pre-existing `send-push` payload-shape bug** on 2 legacy triggers (documented, deferred from Agent 1) — do not copy that broken shape if Agent 2 delivers via push.

## Open questions for the proposal phase

1. Naming collision with existing "Adherencia"/`low_completion` — resolve before any copy is written.
2. Reuse `training_load_alerts` (5th type via a MODIFIED delta) vs. a new dedicated table — tradeoff belongs to the proposal.
3. Which signal(s) actually define "gone quiet" — session completion alone (universal coverage) vs. a blended multi-signal approach (uneven coverage)?
4. Does self-alerting inactivity make sense for independent athletes with no coach in the loop?
5. Is reviving `users.last_login` in scope, given it requires a new write path?
6. What time horizon/threshold distinguishes "quiet" from "an off week" — needs its own calibration, analogous to Agent 1's ACWR breakpoints but for absence rather than intensity.

## Recommended next phase

`sdd-propose`
