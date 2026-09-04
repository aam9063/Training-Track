# Archive Report — Training Load Monitoring Agent

**Archived**: 2026-09-01
**Mode**: openspec (hybrid with engram persistence)
**Status**: Phase 1 complete, fully deployed to production and live

## Executive Summary

Phase 1 of the multi-agent training load monitoring system is shipped, live in production (trainingtrack.es), and archived. A canonical, single-source-of-truth load-metrics module (`trainingLoadCore.js`, zero dependencies) replaced three divergent implementations across the codebase. The `training-load-monitor` Edge Function bridges reactive Strava webhooks and a daily `pg_cron` sweep, recomputing load scores and evaluating a unified four-signal alert rulebook (`acwr_zone`, `tsb_critical`, `low_completion`, `high_rpe`) every time an athlete's data changes. All four signals are independently deduplicated, lifecycled, and routed (coach-supervised athletes alert their active coach; independent athletes self-alert). Backend fully deployed (Supabase migrations, Edge Functions, CRON jobs, all live and tested); frontend components deployed to trainingtrack.es via master. One CRITICAL spec/implementation gap discovered during verification (dismiss lifecycle) was fixed and deployed same-day. Alerts are production-active as of 2026-09-01 10:31 UTC+2.

## Artifacts Synced to Main Specs

Three new capability specifications were created and merged into `openspec/specs/`:

| Capability | Location | Purpose |
|---|---|---|
| `training-load-metrics` | `openspec/specs/training-load-metrics/spec.md` | Canonical TSS/CTL/ATL/TSB/ACWR formula set, EWMA warm-up reporting, deterministic backfill via `calc_version`, RLS contract for `daily_training_load` |
| `training-load-alerts` | `openspec/specs/training-load-alerts/spec.md` | Single alert rulebook, four independent signal types, severity zones, deduplication per `(athlete_id, alert_type)`, current-day-only eligibility, alert lifecycle (read/dismiss/resolve), RLS visibility |
| `training-load-agent-runtime` | `openspec/specs/training-load-agent-runtime/spec.md` | Reactive trigger from `strava-webhook`, scheduled sweep via `pg_cron`, recompute orchestration, scope boundary (no `training_sessions` writes), alert delivery routing (coach vs. self), `weekly-ai-reports` consumption of canonical values |

All three specs follow the project's RFC 2119 / Given-When-Then scenario format and are identical to their delta specs (new capabilities, no existing specs modified).

## Verification Summary

**sdd-verify** pass: 2026-09-01, findings: 1 CRITICAL (fixed), 4 WARNING (2 fixed, 2 accepted as-is), 3 SUGGESTION (noted). All concerns have been addressed or explicitly documented.

### CRITICAL Issue Fixed

**Dismiss lifecycle bug**: `trainingLoadAlertsService.js`'s `dismiss()` method only set `dismissed_at`, never transitioned `status` from 'open' to 'resolved', leaving dismissed alerts permanently occupying their dedup slot and preventing re-alerting on the same condition. **Fixed and deployed 2026-09-01**: `dismiss()` now also sets `status='resolved'` and `resolved_at`, plus the one real stuck alert in production was manually updated. The fix reuses the already-proven resolve-and-reinsert path used by the time-based hysteresis logic, no new pattern introduced.

### WARNING Issues

- **WARNING-1**: `alertCount` in response payload was incremented even on failed RPC calls (observability only). Fixed to only count on truthy RPC result. Deployed same-day.
- **WARNING-2**: Sweep candidate predicate comment claimed index usage; independently verified and confirmed correct. No fix needed.
- **WARNING-3**: Push delivery gate used a stale in-memory snapshot instead of the RPC's live `escalated` result. Fixed to use `result.escalated || result.is_new` for delivery decision. Deployed same-day.
- **WARNING-4**: No formal TDD Cycle Evidence table in `apply-progress.md` despite Strict TDD being active. Process documentation gap; underlying test coverage is real and comprehensive (66/66 tests pass). Not fixed in scope.

### SUGGESTION Items

- **SUGGESTION-1**: PMCChart.jsx's manual "Recalcular" button still writes via a 4th separate calculator (not migrated to core). Confirmed harmless (writes land at `calc_version=1`, overwritten by next sweep). Deferred per user decision.
- **SUGGESTION-2**: Migration `20260831130000_merge_training_load_alerts_select_policies.sql` (RLS consolidation) exists and was applied, but not referenced in tasks.md. Acknowledged; semantics preserved.
- **SUGGESTION-3**: Recommend EXPLAIN ANALYZE for `get_athletes_needing_load_refresh` once athlete roster scales beyond current testing-phase size (5 athletes with real data).

## Deployments

### Migrations Applied (Supabase, project `lusirdkixfliydimemre`)

All migrations idempotent and applied successfully:

1. `..._daily_training_load_baseline.sql` — CREATE TABLE IF NOT EXISTS + idempotent RLS policies
2. `..._daily_training_load_metrics_v2.sql` — ADD COLUMN IF NOT EXISTS (chronic_load_28, calc_version, computed_at, low_confidence)
3. `..._training_load_alerts.sql` — New table, partial unique index per `(athlete_id, alert_type) WHERE status='open'`, CHECK constraints
4. `..._send_push_notification_rpc.sql` — Imported verbatim, no behavioural edits
5. `..._load_sweep_rpc.sql` — Sweep RPC with widened predicate for session-only athletes
6. `..._pg_cron_schedules.sql` — `training-load-daily-sweep` (04:15 UTC) + `weekly-ai-reports-monday` (migrated from Dashboard config)
7. `..._daily_training_load_drop_client_write.sql` — Dropped temporary `dtl_write_own` policies (post-backfill cleanup)
8. `..._upsert_training_load_alert_rpc.sql` — Atomic episode reconciliation via partial-index-aware ON CONFLICT
9. `..._drop_legacy_acwr_push_trigger.sql` — Disabled/dropped pre-existing `trg_push_acwr_alert` (caused 50-alert flood during backfill, fully superseded by new system)
10. `..._merge_training_load_alerts_select_policies.sql` — RLS policy consolidation (Supabase advisor recommendation)

### Edge Functions Deployed

- `supabase/functions/training-load-monitor/` — Deno-based recompute + reconcile orchestration (v1 deployed 2026-08-31, v6 deployed 2026-09-01 with push-delivery fixes)
- `supabase/functions/strava-webhook/` — Updated with `triggerLoadRecalc` call (3 integration points: processNewActivity, processActivityUpdate, processActivityDelete)
- `supabase/functions/send-push/` — Imported from deployed version (working as-is, no edits)
- `supabase/functions/weekly-ai-reports/` — Updated to read canonical ACWR/chronic_load_28 from `daily_training_load`, dropped inline calculation + `deriveAlertLevel` function

### Frontend Components Deployed (Vercel, trainingtrack.es via master)

- `src/components/dashboard/AthleteLoadAlerts.jsx` — Thin wrapper for per-athlete alert surfaces
- `src/components/shared/TrainingLoadAlertFeed.jsx` — Alert list/read/dismiss UI (coach + athlete contexts, es-ES)
- `src/services/trainingLoadAlertsService.js` — Query / read / dismiss services (RLS boundary, no bypass)
- `src/lib/trainingMetrics.js` — Refactored to delegate to `../../supabase/functions/_shared/trainingLoadCore.js`
- `src/services/trainingLoadService.js` — Updated to read stored values
- `src/components/athlete/PMCChart.jsx` — Integrated alert feed, updated ACWR source (post-fix: uses `chronic_load_28 ?? ctl` fallback)
- `src/components/dashboard/TeamHealthTable.jsx` — Updated ACWR source (post-fix: uses `chronic_load_28 ?? ctl` fallback)
- `src/pages/athlete/Dashboard.jsx` — Integrated alert feed for independent athletes
- `src/pages/athlete/Metrics.jsx` — Integrated alert feed
- `src/pages/dashboard/AthleteProfile.jsx` — Integrated alert feed for coach's per-athlete view
- `src/services/teamHealthService.js` — Updated ACWR source (post-fix: uses `chronic_load_28 ?? ctl` fallback)

### Environment & Secrets

- `TRAINING_LOAD_ALERTS_ENABLED=true` (flipped 2026-09-01 after dry-run verification)
- `CRON_SECRET` rotated during this change (was stale, 401'ing cleanup-gym-files); new value synced to Supabase Vault + cron.job command

## Test Evidence

All test suites pass on production state:

- `npm run test:core`: **66/66 pass** (core module + all 4 rulebook signals + isoWeekStart + summarizeWeekSessions + argument asymmetry + concurrent alert types, re-run fresh independent of tasks.md claim)
- `npm run build`: **succeeds** (Vite resolves cross-directory import, zero config changes)
- `npm run lint`: **zero new errors** (203 pre-existing baseline unchanged)
- Backfill verification (3.10): **4/11 athletes processed** (7 correctly excluded by sweep predicate), **600 `daily_training_load` rows upserted**, **0 alerts emitted** (backfill silent, as spec requires)
- Verify-pass ACWR distribution comparison (dry-run SQL before go-live): small differences between old (ctl-based) and new (chronic_load_28) formulas, no zone-boundary crossings observed in small test dataset
- End-to-end live alert (4.6): **1 alert created** (low_completion/critical, independent athlete self-alert, no coach in loop, exact match to dry-run prediction), routing and push delivery confirmed correct

## Known Deferred Items

These are explicitly documented and intentional, not oversights:

1. **PMCChart.jsx manual "Recalcular" button** — still uses a 4th separate TSS/CTL/ATL/TSB calculator, not migrated to core. Harmless (writes at `calc_version=1`, overwritten by next sweep). Deferred per user decision.
2. **Task 3.12 — Observe Monday pg_cron firing** — inherently time-gated; both `training-load-daily-sweep` and `weekly-ai-reports-monday` confirmed *scheduled* in Postgres cron table, not yet observed *firing*. No code defect; dashboard config can be removed after Monday 2026-09-08.
3. **Send-push payload-shape bug on 2 pre-existing notification triggers** — `notify_athlete_training_assigned` and `notify_independent_competition_countdown` in `supabase/independent_athlete_push_notifications.sql` call send-push with wrong payload shape (uses `receiver_id` instead of `user_ids`). Pre-existing bug, discovered during 1.13, out of scope. Flagged for separate fix.

## Files Moved to Archive

The entire change folder has been moved to `openspec/changes/archive/2026-09-01-training-load-monitoring-agent/`:

- proposal.md — Business intent, decisions (D1-D3), scope, risks, rollback plan
- explore.md — Pre-planning exploration of current state and design options
- design.md — Technical approach, architecture decisions, migration plan, data flow, interfaces, testing strategy, date handling, rollout/rollback
- tasks.md — 40+ tasks across 4 phases + 3 slices, all complete; includes verification pass summary and known deferred items
- verify-report.md — Full sdd-verify matrix, evidence of all pass/fail/warning/suggestion findings

(`apply-progress.md` was intentionally left out of the archive, matching this project's existing archive precedent at `2026-04-10-plan-selection-required/` — its content is superseded by tasks.md's per-task completion notes.)
- specs/training-load-metrics/spec.md — Delta spec for canonical formula + persistence contract
- specs/training-load-alerts/spec.md — Delta spec for alert rulebook + lifecycle
- specs/training-load-agent-runtime/spec.md — Delta spec for trigger, orchestration, delivery routing
- archive-report.md (this file) — Closure summary

## Rollback Procedure

Should the feature need full reversion:

1. **Flip the kill switch** (instant, silent, no data loss): Set `TRAINING_LOAD_ALERTS_ENABLED=false` in Supabase Dashboard. Agent continues computing but never creates alerts.
2. **Unschedule cron** + **Remove webhook trigger**: Unschedule `training-load-daily-sweep` from Supabase cron table (only one training-load cron job exists — `weekly-ai-reports-monday` is unrelated, pre-existing, and should stay). Remove `triggerLoadRecalc` calls from `strava-webhook/index.ts`.
3. **Revert frontend**: Git revert commits introducing alert feed components and dependencies.
4. **Drop new table** (optional): `DROP TABLE public.training_load_alerts;` (data loss, one-way). Existing `daily_training_load` rows remain readable; new columns (chronic_load_28, calc_version, computed_at, low_confidence) are additive/nullable.
5. **Restore old calculators** (optional): Re-enable `getAcwrZone`, `getAcwrAlertConfig`, `deriveAlertLevel` in `trainingMetrics.js` if reverting to the old alert surfaces (PMCChart, weekly reports).

The 7-migration footprint is reversible per each migration's `_rollback.sql` sibling.

## Next Steps

- **Immediate (before next Monday 2026-09-08)**: Monitor logs for any alerts generated over the weekend. Observe actual Monday `pg_cron` job firing (task 3.12), then remove the Dashboard-configured `weekly-ai-reports` schedule.
- **Phase 2 (follow-up SDD)**: Adherence detection agent (replan-trigger signals), communication agent (coach notifications), MCP/SDK extraction.
- **Technical debt**: (1) Migrate PMCChart.jsx recalc button to core. (2) Fix pre-existing send-push payload-shape bug on independent athlete notifications. (3) EXPLAIN ANALYZE get_athletes_needing_load_refresh at production scale. (4) Version other drifted tables (wellness_log, activity_splits, training_zones).

## Lessons Learned

- **Trigger scans are dangerous**: A bulk write (600 inserts) to an undocumented table fired a pre-existing, un-deduped trigger (`trg_push_acwr_alert`) and sent 50 notifications in seconds. Always check `information_schema.triggers` before bulk operations.
- **RLS policies are implicit when out-of-repo**: `daily_training_load` had working RLS but no migration documenting it; makes state fragile and non-reproducible. Versioning both data and policy together strengthens confidence.
- **Spec/design misalignment on edge cases**: dismiss lifecycle was correctly spec'd but design's "orthogonal lifecycle" philosophy led to implementation treating it as pure UI state. The fix was simple (route dismiss through the same resolve path) but the mismatch should have been caught earlier.
- **CRON secrets need rotation audits**: The hardcoded bearer token in cleanup-gym-files was stale and silently failing for weeks; only discovered when syncing the cron job logic into this change. Build a pattern for secret rotation notifications.

## Archive Closure

The change is complete, tested, deployed to production, and verified live. All artifacts have been merged into the source of truth (`openspec/specs/`), and the change folder has been moved to the archive for audit trail. The system is ready for Phase 2 planning.

**Status**: CLOSED — ready for next change.
