# Exploration — training-load-monitoring-agent

## Scope decisions (confirmed, not re-litigated in this phase)

1. This change includes the prerequisite cleanup: unify ACWR/TSB/TSS calculation into a single source of truth, and write a proper versioned migration for `daily_training_load`.
2. Covers both coach-supervised athletes and independent athletes (self-alerting, no coach in the loop).
3. Alert thresholds are hardcoded (standard sports-science values) for this first version — not configurable per coach yet.

## Current state

### ACWR/TSB/TSS — two genuinely divergent implementations, not just duplicated code

1. **`src/lib/trainingMetrics.js`** (client-side; only invoked from `src/components/athlete/PMCChart.jsx:84` via `recalculateTrainingLoad` in `src/services/trainingLoadService.js`): TSS via `calculateRtss`/`calculateHrTss`/duration fallback → `updateCtl` (42-day EWMA) / `updateAtl` (7-day EWMA) → `calculateTsb = ctl - atl` → `calculateAcwr(atl, ctl) = atl/ctl` (EWMA-ratio method). Thresholds already exist twice in this file — `getAcwrZone` and `getAcwrAlertConfig` are near-duplicate bucket definitions using the same 0.8/1.3/1.5 breakpoints.
2. **`supabase/functions/weekly-ai-reports/index.ts`** (lines 293-302): ACWR = 7-day km sum ÷ (28-day km sum / 4) — a rolling-average/Gabbett-style method, mathematically different from #1. TSB here is just read from `daily_training_load.tsb`, i.e. trusts whatever the client last wrote — can be stale or null if nobody opened PMCChart. This function also has its own alert rulebook, `deriveAlertLevel()` (ACWR>1.5 / completion<50% / TSB<-30 / RPE≥8.5 → critical) — a third independent "is this dangerous" definition alongside the two in `trainingMetrics.js`.

**Three independent alert-severity rulebooks exist today** (`getAcwrZone`, `getAcwrAlertConfig`, `deriveAlertLevel`). Scope of unification needs to be explicit in the proposal.

### `daily_training_load` schema drift — confirmed, and systemic, not isolated

Zero migration references `daily_training_load` anywhere in `supabase/migrations/`. The same is true for sibling tables read by the same services: `wellness_log`, `activity_splits`, `training_zones`, `users.is_independent` (queried directly in `strava-webhook`), and the `notifications` table. The migrations directory only starts 2026-04-10 — the base schema predates the migration convention entirely. Scope decision #1 limits the fix to `daily_training_load` only; the agent will still read from other unversioned tables at runtime.

Columns in use (from code, not yet from a migration): `date, tss, ctl, atl, tsb, intensity_factor, total_distance_m, activity_count, ramp_rate, source`.

### Reusable RLS precedent

From `20260410150000_strava_deep_ingestion.sql` (closest prior art for "undocumented but live table gets a proper migration"): self-select via `(select auth.uid()) = athlete_id` (covers independent athletes automatically, no special-casing needed), coach-select via `EXISTS (... coach_athlete_relationship ... status='active')`, `service_role` all. The DB also has unused RLS helper functions (`is_coach()` etc.) that are explicitly revoked/dead — do not use them as a pattern.

### No scheduler in-repo

No `pg_cron`, no Vercel cron, no GitHub Actions. `weekly-ai-reports` checks an `x-supabase-cron-job` header, but its actual trigger config lives outside the repo (Supabase Dashboard, unverifiable from source). `cleanup-gym-files` uses a self-contained `CRON_SECRET` Bearer-token pattern — a better reuse candidate than the header check.

### Reactive trigger point confirmed

`strava-webhook/index.ts` is the only event-driven code in the repo (`EdgeRuntime.waitUntil` fire-and-forget pattern). Today it does **not** trigger any training-load recalculation — a real gap, meaning ACWR/TSB can go stale indefinitely if no human opens the PMC chart.

### Push/alert delivery — new finding, not previously flagged

Both the frontend (`src/lib/pushNotifications.js`) and `weekly-ai-reports`'s `notifyCoach()` call a Postgres RPC `send_push_notification`, and `strava-webhook` separately calls a `send-push` Edge Function via `fetch`. **Neither the RPC nor a `supabase/functions/send-push/` directory exist anywhere in this repository** — same drift pattern as the DB tables, but for executable logic this time. A design that assumes "just reuse the existing push pattern" would be building on infrastructure this repo cannot reproduce from source.

## Gaps identified

- Two numerically different ACWR formulas in production; unifying changes real alert behavior for existing users.
- `send_push_notification` RPC and `send-push` Edge Function are used in production but absent from the repo.
- No in-repo scheduler; `pg_cron` availability on the current Supabase plan is unconfirmed.
- `strava-webhook` never triggers training-load recalculation today — wiring the agent there is new coupling, not an extension of existing coupling.
- Three independent, inconsistent alert-severity rulebooks.

## Touchpoints for this change

| Component | Action |
|-----------|--------|
| `src/lib/trainingMetrics.js`, `src/services/trainingLoadService.js` | Consolidate to a single ACWR/TSB/TSS implementation |
| `supabase/functions/weekly-ai-reports/index.ts` (lines 201-320) | Remove inline ACWR/alert-level duplication, read from unified source |
| `supabase/functions/strava-webhook/index.ts` | Add recalculation trigger after activity sync |
| `supabase/functions/cleanup-gym-files/index.ts` | Reuse `CRON_SECRET` pattern for the new daily sweep function |
| `supabase/migrations/` (NEW) | Versioned baseline for `daily_training_load` + RLS |
| `src/lib/pushNotifications.js`, `src/contexts/NotificationContext.jsx` | Delivery pattern — contingent on resolving the missing-RPC gap |
| `coach_athlete_relationship` | RLS precedent for new alerts table |

## Open questions for the proposal phase

1. **Canonical ACWR formula**: EWMA-ratio (`trainingMetrics.js`) vs. rolling-average/Gabbett-style (`weekly-ai-reports`). Real behavioral consequence for existing alerts — needs an explicit call, not a silent pick.
2. **Missing push infrastructure**: is reconstructing `send_push_notification`/`send-push` in-repo part of this change's scope, or does the proposal treat current push delivery as an external dependency and design an alternative (e.g., in-app `coach_alerts` feed first, push later)?
3. **Scheduler for the catch-all sweep**: `pg_cron` (needs confirming it's enabled on the Supabase plan) vs. continuing the undocumented Dashboard-cron pattern already used by `weekly-ai-reports`.
4. How existing `daily_training_load` rows (written by the old client-side formula) migrate/backfill once the canonical formula changes.

## Recommended next phase

`sdd-propose`
