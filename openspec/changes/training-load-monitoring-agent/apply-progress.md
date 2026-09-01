# Apply Progress: Training Load Monitoring Agent

Merged history — engram topic_key `sdd/training-load-monitoring-agent/apply-progress`.
This file is the file-backed mirror (artifact store: openspec, git-untracked
pending the user's own `git add`/commit of `openspec/`+`supabase/`).

## Phase 1 — Data Layer (core module + migrations 1-5, zero behaviour change)

Tasks 1.1-1.16: **done**. `supabase/functions/_shared/trainingLoadCore.js` (zero-import
core), 5 migrations, `src/lib/trainingMetrics.js` delegates via re-export,
`src/services/trainingLoadService.js` reads stored values. See tasks.md for
per-task verification notes (several open design questions resolved via live
Supabase queries: `strava_activities.start_date_local` is timestamptz, RLS
already existed on `daily_training_load`, `training_sessions` status domain
is exactly `{planned, completed}`, completion-rate denominator resolved to
the literal whole-week reading by explicit user decision).

## Phase 2 — Testing & Deployment Gate

Tasks 2.1-2.4: **done**. 34/34 core tests passed at the time, build/lint
verified zero new problems, all 5 Slice-1 migrations applied directly to
production (`lusirdkixfliydimemre`, no staging branch existed, user
decision), one real bug found and fixed before applying (migration 3's FK
target corrected from `public.users` to `public.athletes`).

## Phase 3 — Agent Silent (training-load-monitor, triggers, migration 6)

Tasks 3.1-3.11: **done**. 3.12 (observe one Monday) remains open —
inherently time-gated. `training-load-monitor/index.ts` + `logic.js` (pure,
Node-testable) + `index.test.js` (27 tests), `strava-webhook` webhook
trigger added, `pg_cron` migration written, backfill run with
`TRAINING_LOAD_ALERTS_ENABLED=false` (confirmed silent, 0 alert rows from
600 backfilled `daily_training_load` inserts). A separate atomic-upsert RPC
(`upsert_training_load_alert`) was added as a necessary, flagged scope
addition (PostgREST `.upsert()` cannot express a partial-unique-index
`WHERE` predicate in `ON CONFLICT`).

**Incident (2026-08-31, resolved, unrelated to this change's own code)**:
the 3.10 backfill fired a pre-existing, undocumented trigger
(`trg_push_acwr_alert`) with no insert-side dedup, flooding the coach's
phone with ~50 pushes. `TRAINING_LOAD_ALERTS_ENABLED=false` was correctly
respected throughout — not this change's alert system. Trigger dropped
per user decision (`20260819147000_drop_legacy_acwr_push_trigger.sql`).

## Phase 4 — Slice 3: Delivery + UI (THIS BATCH)

Scope: tasks 4.1-4.5 and 4.7 only. **4.6 explicitly NOT touched** — flipping
`TRAINING_LOAD_ALERTS_ENABLED=true` is a live production go-live decision
reserved for the orchestrator/user. Mode: STRICT TDD (new
`acwrFromComponents` core function written test-first in
`trainingLoadCore.test.js` before being consumed by `weekly-ai-reports`).
No git operations performed (user-reserved).

### 4.1 — Alert feed UI

- Created `src/components/shared/TrainingLoadAlertFeed.jsx`: cross-context
  (coach + athlete) component listing open, non-dismissed
  `training_load_alerts` for one `athleteId`. Distinct icon/label per
  `alert_type` (`acwr_zone`/`tsb_critical`/`low_completion`/`high_rpe`),
  severity-colored (critical=red, warning=amber), unread dot, click-to-read,
  dismiss button, es-ES copy from `message_es`, empty state, loading state.
  Follows the repo's existing "shared" component convention (plain Tailwind
  dark-mode classes, not `coach-`/`ath-` theme tokens — matches
  `src/components/shared/ACWRGauge.jsx`'s precedent) since it's genuinely
  used by both surfaces.
- Created `src/components/dashboard/AthleteLoadAlerts.jsx`: thin wrapper
  around the shared feed, satisfying this feature's expected
  `src/components/dashboard/` file location without forking the markup.
- Wired into `src/pages/dashboard/AthleteProfile.jsx` (coach's per-athlete
  page — alerts are per-athlete, so this fits better than the team-wide
  `Dashboard.jsx`), inserted above the Conconi/VAM test cards section.
- Wired into `src/pages/athlete/Dashboard.jsx` directly (uses
  `TrainingLoadAlertFeed`, `athleteId={profile.id}` — works identically for
  coached and independent athletes since RLS decides visibility), inserted
  after the stats grid, before the independent-athlete-only block so it's
  visible to both athlete kinds.

### 4.2 — trainingLoadAlertsService.js

Created `src/services/trainingLoadAlertsService.js`: `getAlerts(athleteId,
{status='open', includeDismissed=false})`, `markRead(alertId)`,
`dismiss(alertId)`. Plain `supabase.from('training_load_alerts')` calls —
RLS is the actual enforcement boundary, this service does not widen or
narrow it.

### 4.3 — weekly-ai-reports consumes canonical values

Modified `supabase/functions/weekly-ai-reports/index.ts`:
- Removed `deriveAlertLevel()` (5-threshold inline severity logic) and the
  inline 28-day-Strava-window ACWR re-derivation (query #4 in the old
  `Promise.all`, `acwrStart`/`acwrStartStr`/`runningAcwr` computation).
- **Finding, verified against both migration files (not guessed)**:
  `daily_training_load` has NO stored `acwr` column — only `atl` and
  `chronic_load_28` (added by `20260819141000_daily_training_load_metrics_v2.sql`).
  Added `export function acwrFromComponents(atl, chronicLoad28)` to
  `supabase/functions/_shared/trainingLoadCore.js` (single formula,
  `round2(atl/chronicLoad28)`, matches `computeLoadSeries`'s own ACWR
  exactly — proven by a parity test) so `weekly-ai-reports` derives ACWR
  from the row it already fetches for TSB, instead of duplicating the
  ratio inline or adding a new stored column.
- Added a `training_load_alerts` query (open, all 4 types) alongside the
  existing PMC query; `alertLevelFromOpenAlerts()` replaces
  `deriveAlertLevel()` (critical if any open `critical`-severity alert,
  attention if any `warning`-severity, else ok) — display-only mapping,
  not a threshold reimplementation, since severity itself comes from the
  single rulebook's stored rows.
- Added an "ALERTAS ACTIVAS" block to the Gemini prompt, listing each open
  alert's `message_es`.
- Test coverage: `acwrFromComponents` — 5 new tests in
  `trainingLoadCore.test.js` (parity with `computeLoadSeries`, null on
  missing/zero `chronicLoad28`, null on non-numeric `atl`, rounding).
  `npm run test:core`: 66/66 passing (was 61/61 before this batch).

### 4.4 — getAcwrZone/getAcwrAlertConfig/deriveAlertLevel full removal

Grep-verified zero remaining call sites or definitions of the 3 named
identifiers anywhere in `src/` or `supabase/functions/` (only historical
comment references remain, same style as design.md/tasks.md's own
documentation of the old names).

**Scope note, resolved not silently**: these identifiers had surviving call
sites outside this task's originally-listed files
(`src/components/dashboard/TeamHealthTable.jsx`,
`src/components/athlete/PMCChart.jsx`, `src/pages/athlete/Metrics.jsx` —
flagged as a known follow-up in `trainingMetrics.js`'s own Phase-1 comment
block). Resolved by renaming to `getAcwrZoneDisplay`/`getAcwrAlertDisplay`
in `src/lib/trainingMetrics.js` — both are now thin display-only wrappers
(color/label/icon/message lookups) delegating zone classification to the
core's `acwrZone()`, not threshold reimplementations — and updating all 3
call sites' imports/usages. Verified with `npm run build` (succeeds) and a
lint diff (204 problems vs. 203 pre-existing baseline — the +1 is the
`motion`-unused false positive on the new `TrainingLoadAlertFeed.jsx` file,
an identical systemic ESLint quirk already present on ~15+ other
`framer-motion`-importing files in this repo, not a real issue).

`calculateAcwr` (generic `atl/denominator` ratio helper) was deliberately
**left untouched** — it isn't one of the 3 named identifiers, and its 2
call sites (`PMCChart.jsx`, `teamHealthService.js`) still pass the legacy
`ctl` denominator instead of `chronic_load_28`; fixing that is an unscoped
behaviour change to files outside this batch's assignment. Flagged against
the proposal's Success Criteria in 4.7 below.

### 4.5 — Drop client-write migration

Created `supabase/migrations/20260831120000_daily_training_load_drop_client_write.sql`
+ `_rollback.sql`: drops `dtl_write_own_insert`/`dtl_write_own_update`
(the exact pair added in `20260819140000_daily_training_load_baseline.sql`,
migration 1). Rollback restores the exact original policy definitions.
**Written only, NOT applied** — no Supabase access in this batch, and per
design.md's rollout note this should only be applied once the frontend
deploy that removes the client write path (`trainingLoadService.js`'s
`recalculateTrainingLoad`) is actually live in production.

### 4.6 — NOT DONE (explicitly out of scope)

`TRAINING_LOAD_ALERTS_ENABLED=true` was NOT flipped. This is a live
production go-live decision reserved for the orchestrator/user, especially
given the 2026-08-31 legacy-trigger incident (unrelated to this change's
code, but reason enough for extra scrutiny before enabling live alerting).

### 4.7 — Full-repo grep verification (proposal Success Criteria)

- **`training_sessions` writes under `supabase/functions/training-load-monitor/`**:
  zero. One read-only `.from("training_sessions")` at `index.ts:110`; no
  write verb within scanning distance (also covered by the pre-existing
  `index.test.js` static grep test, part of the green 66/66 suite).
- **Exactly one implementation of formulas/rulebook**: mostly true, one
  known gap flagged (not silently passed) — see 4.4's note on
  `calculateAcwr`'s legacy `ctl`-denominator call sites. This is a genuine,
  if trivial (`atl/denominator`, one line), duplicate of the ACWR ratio
  relative to the proposal's literal "zero inline duplicates... in
  trainingMetrics.js" bullet. Not fixed in this batch (unscoped files).
- **No repeat alert for an ongoing condition (any `alert_type`)**: verified
  at the unit level by the pre-existing Phase 3 `reconcileFinding`/
  `planReconciliation` test suite (hysteresis, escalate-only redelivery,
  2-clear-day resolve, 4 concurrent independent episode types never
  colliding). No live Postgres available this batch to also prove it
  end-to-end against a real race.

## Files changed this batch (Phase 4)

Created:
- `src/components/shared/TrainingLoadAlertFeed.jsx`
- `src/components/dashboard/AthleteLoadAlerts.jsx`
- `src/services/trainingLoadAlertsService.js`
- `supabase/migrations/20260831120000_daily_training_load_drop_client_write.sql`
- `supabase/migrations/20260831120000_daily_training_load_drop_client_write_rollback.sql`

Modified:
- `supabase/functions/weekly-ai-reports/index.ts` (4.3)
- `supabase/functions/_shared/trainingLoadCore.js` (`acwrFromComponents` added)
- `supabase/functions/_shared/trainingLoadCore.test.js` (5 new tests)
- `src/lib/trainingMetrics.js` (`getAcwrZone`→`getAcwrZoneDisplay`, `getAcwrAlertConfig`→`getAcwrAlertDisplay`, `acwrZone` re-exported)
- `src/components/dashboard/TeamHealthTable.jsx` (call site update)
- `src/components/athlete/PMCChart.jsx` (call site update)
- `src/pages/athlete/Metrics.jsx` (call site update)
- `src/pages/athlete/Dashboard.jsx` (alert feed wired in)
- `src/pages/dashboard/AthleteProfile.jsx` (alert feed wired in)
- `openspec/changes/training-load-monitoring-agent/tasks.md` (4.1-4.5, 4.7 marked `[x]`; 4.6 left `[ ]`)

## Verification run this batch

- `npm run test:core`: 66/66 passing (61 pre-existing + 5 new `acwrFromComponents` tests)
- `npm run build`: succeeds
- `npm run lint`: 204 problems (194 errors, 10 warnings) vs. 203 pre-existing
  baseline (confirmed via `git stash`/`git stash pop` differential) — the
  +1 is a pre-existing systemic false positive (`motion` flagged unused
  despite `<motion.div>` JSX usage) on the one new file that imports
  `framer-motion`, matching the identical unfixed pattern already present
  on ~15+ other files in this repo. Zero new *real* lint errors introduced.

## Next steps (for whoever picks this up)

1. Review/decide on 4.6 (flip `TRAINING_LOAD_ALERTS_ENABLED=true`) — live
   go-live decision, needs explicit sign-off, extra scrutiny post-incident.
2. Apply migration `20260831120000_daily_training_load_drop_client_write.sql`
   once this batch's frontend changes are deployed and confirmed live.
3. Consider (separately, unscoped here) fixing `calculateAcwr`'s legacy
   `ctl` denominator in `PMCChart.jsx`/`teamHealthService.js` to
   `chronic_load_28`, to fully close the proposal's "zero inline
   duplicates" Success Criteria bullet.
4. 3.12 (observe one Monday `pg_cron` firing) still pending — time-gated,
   unrelated to Phase 4.
