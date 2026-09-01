# Proposal: Training Load Monitoring Agent

## Intent

ACWR/TSB only recalculate when a human opens the PMC chart, and two numerically divergent formulas disagree about what "dangerous" means. Nobody is proactively warned when an athlete's load enters injury-risk territory. This change delivers Phase 1 / Agent 1: one canonical load-metrics engine plus an agent that recomputes on new activity data and alerts the coach (or the independent athlete directly). The agent **only proposes** — it never writes `training_sessions` and never replans.

## Decisions

### D1 — Canonical ACWR: EWMA 7:28 over TSS (neither existing implementation)

| Option | Verdict |
|---|---|
| `trainingMetrics.js` — `ATL(7d EWMA) / CTL(42d EWMA)` | Rejected. The 0.8/1.3/1.5 thresholds are calibrated for a **28-day** chronic window; a 42-day chronic lags harder and systematically inflates ACWR during ramps. Today's alerts over-fire. |
| `weekly-ai-reports` — rolling 7d/28d km sums | Rejected. Distance ignores intensity; rolling averages suffer known washout/decay insensitivity (Lolli et al.). |
| **Chosen: `acwr = ewma7(tss) / ewma28(tss)`** | Keeps the better-validated EWMA method (Williams et al. 2017) and restores the 7:28 window the thresholds assume. |

CTL(42d), ATL(7d) and TSB keep their current constants, so **existing PMC charts do not change visually** — only ACWR moves. Requires a new `chronic_load_28` column, independent of CTL.

### D2 — Scheduler: `pg_cron` + `pg_net`, declared in a versioned migration

Ends the out-of-repo cron drift that makes `weekly-ai-reports`' trigger unreproducible from source. Auth via `CRON_SECRET` Bearer (the self-contained `cleanup-gym-files` pattern), not the `x-supabase-cron-job` header. **Confirmed by the user: `pg_cron` is already active on the project** — it's what fires `weekly-ai-reports` every Monday today, just configured out-of-repo via the Supabase Dashboard rather than in a migration. This change versions that same mechanism instead of introducing a new one, and `weekly-ai-reports`' own schedule should be migrated into the same versioned `pg_cron` declaration while we're at it, closing that drift too.

### D3 — Backfill: deterministic recompute, version-tagged rows

Add `calc_version` to `daily_training_load`. Existing rows were written by the old client formula and cannot be patched in place, but the series is deterministic from raw activities, so recompute rather than migrate values. Warm-up needs ≥126 days of history for a stable 42-day EWMA. **Backfilled rows MUST NOT emit alerts** — only the current day's row is alert-eligible. Rows with a stale `calc_version` are re-derived lazily by the sweep.

## Scope

### In Scope

- Migration: versioned baseline + RLS for `daily_training_load`; add `chronic_load_28`, `calc_version`
- Migration: `training_load_alerts` table — self-select via `(select auth.uid()) = athlete_id`, coach-select via active `coach_athlete_relationship`, `service_role` all; dedup key so one condition doesn't alert daily
- One pure, dependency-free core module for TSS/CTL/ATL/TSB/ACWR **and** a single alert rulebook, replacing all three current ones (`getAcwrZone`, `getAcwrAlertConfig`, `deriveAlertLevel`)
- `training-load-monitor` Edge Function: recompute → evaluate thresholds → persist alert → deliver
- Reactive trigger from `strava-webhook` (`EdgeRuntime.waitUntil`) + daily catch-all sweep for non-syncing athletes
- Alert surface for coach dashboard **and** independent athletes (self-alert, no coach in loop)
- Pull the already-deployed `send-push` function and `send_push_notification` RPC into the repo as versioned files — same drift cleanup rationale as `daily_training_load`; they work today, they're just not in git

### Out of Scope

- Per-coach configurable thresholds (v1 uses hardcoded sports-science values)
- Any write to `training_sessions`; auto-replanning; adherence detection; communication agent (Phase 1, agents 2–4)
- MCP/SDK extraction (Phase 2). Only constraint honoured now: the core module imports nothing from Supabase or the UI
- Migrations for the other drifted tables (`wellness_log`, `activity_splits`, `training_zones`, `notifications`)

## Capabilities

### New Capabilities

- `training-load-metrics`: canonical TSS/CTL/ATL/TSB/ACWR computation and the `daily_training_load` persistence contract
- `training-load-alerts`: threshold rulebook, severity levels, deduplication, alert lifecycle (read/dismissed), RLS visibility
- `training-load-agent-runtime`: reactive + scheduled triggers, recompute orchestration, alert delivery

### Modified Capabilities

- None (`openspec/specs/` currently contains only `registration/plan-selection`)

## Approach

Extract one pure calculation core, make it the only producer of `daily_training_load`, then wrap it in an Edge Function invoked from two directions: reactively after `strava-webhook` ingests an activity, and via a daily `pg_cron` sweep that catches athletes with no recent sync. The function evaluates the single rulebook against the fresh row, writes a deduplicated `training_load_alerts` record, and delivers it in-app plus via the existing push RPC. The frontend and `weekly-ai-reports` become consumers of stored values rather than independent calculators.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `supabase/migrations/` | New | `daily_training_load` baseline + columns + RLS; `training_load_alerts`; `pg_cron` schedule; imported `send_push_notification` RPC |
| Core metrics module (location TBD in design) | New | Pure TSS/CTL/ATL/TSB/ACWR + alert rulebook, no Supabase/UI imports |
| `src/lib/trainingMetrics.js` | Modified | Delegates to core; `getAcwrZone`/`getAcwrAlertConfig` collapse into one rulebook |
| `src/services/trainingLoadService.js` | Modified | Reads stored values; client no longer the write path of record |
| `supabase/functions/training-load-monitor/` | New | Recompute + evaluate + alert + deliver |
| `supabase/functions/strava-webhook/index.ts` | Modified | Fire-and-forget call to the monitor after sync |
| `supabase/functions/weekly-ai-reports/index.ts` | Modified | Drop inline ACWR and `deriveAlertLevel`; consume canonical values |
| `supabase/functions/send-push/` | New (import) | Version the already-deployed function |
| Coach dashboard + athlete alert UI | New | Alert feed, Spanish (es-ES) copy |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| ACWR change shifts alert behaviour for existing users | High (intended) | Ship with a one-off recompute; surface old vs. new distribution before enabling delivery; thresholds unchanged so the shift is explainable |
| Migrating `weekly-ai-reports`' Dashboard-configured schedule into the versioned `pg_cron` declaration breaks its Monday run | Low | `pg_cron` confirmed active (proven by `weekly-ai-reports` running today); migrate the schedule in the same PR as the new job and verify both fire before removing the Dashboard config |
| Backfill storm emits historical alerts | Medium | Alert emission gated to the current day's row only |
| `daily_training_load` baseline migration diverges from live schema | Medium | Write as idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`); verify against live schema before apply |
| Insufficient history (<126 days) yields unstable EWMA | Medium | Mark rows low-confidence and suppress alerts until the warm-up window is satisfied |
| New `strava-webhook` coupling slows or breaks ingestion | Low | `EdgeRuntime.waitUntil` fire-and-forget; monitor failure must not fail the webhook |
| Push RPC import mismatches the deployed version | Low | Import as-is, no behavioural edits in this change |

## Rollback Plan

1. Disable delivery first: unschedule the `pg_cron` job and remove the `strava-webhook` call — the agent goes silent without any data loss.
2. Revert the frontend/`weekly-ai-reports` commits to restore the previous calculators; `daily_training_load` rows remain readable (new columns are additive and nullable).
3. `training_load_alerts` is a new, isolated table — drop it if needed; nothing else references it.
4. The `calc_version` column lets a subsequent recompute regenerate rows under either formula, so the value change is reversible.

## Dependencies

- Deployed-but-untracked `send_push_notification` RPC and `send-push` Edge Function (exist and work; being imported into the repo here)
- `pg_cron` availability — confirmed active (drives `weekly-ai-reports` today); `pg_net` needed for the HTTP call to the Edge Function, not yet independently confirmed
- `coach_athlete_relationship` for coach-side RLS
- Sufficient raw activity history per athlete for the EWMA warm-up

## Success Criteria

- [ ] Exactly one implementation of TSS/CTL/ATL/TSB/ACWR exists in the codebase; zero inline duplicates remain in `weekly-ai-reports` or `trainingMetrics.js`
- [ ] Exactly one alert rulebook exists (the three current ones are gone)
- [ ] `daily_training_load` is fully described by a versioned migration with RLS covering coach, self, and `service_role`
- [ ] A new Strava activity updates that day's load row without any human opening the PMC chart
- [ ] An athlete with no recent sync still gets their row refreshed by the daily sweep
- [ ] An ACWR breach produces exactly one alert, visible to the coach for supervised athletes and to the athlete for independent ones, with no repeat alert for the same ongoing condition
- [ ] Backfill completes with zero alerts emitted from historical rows
- [ ] `training_sessions` is never written by this change (verifiable by grep)
- [ ] The core metrics module has no import from Supabase, React, or any UI code
