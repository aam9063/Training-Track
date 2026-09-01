# Design: Training Load Monitoring Agent

## Technical Approach

One pure, zero-dependency calculation core becomes the single producer of `daily_training_load` and the single four-signal alert rulebook (`acwr_zone`, `tsb_critical`, `low_completion`, `high_rpe` — each independently evaluated, deduplicated and lifecycled). A `training-load-monitor` Edge Function wraps it, owns *all* I/O (`strava_activities` and `training_sessions` reads, alert writes, delivery), and is invoked from two directions (reactive `strava-webhook`, scheduled `pg_cron` sweep). Frontend and `weekly-ai-reports` demote to consumers. Delivery sits behind an env kill switch so the data layer ships independently of any alerting behaviour.

## Architecture Decisions

### Decision: Shared core lives at `supabase/functions/_shared/trainingLoadCore.js`

**Choice**: A single plain-ESM `.js` file (JSDoc types, zero imports) under the existing `_shared/` directory. Deno imports it with an explicit `.js` extension; `src/lib/trainingMetrics.js` re-exports it via `../../supabase/functions/_shared/trainingLoadCore.js` so every existing frontend import site is unchanged.

| Option | Tradeoff | Verdict |
|---|---|---|
| Core in `src/lib/`, Deno imports it | Supabase CLI only bundles files under `supabase/functions/` — imports above that root are not uploaded | Rejected: hard runtime constraint |
| New top-level `packages/load-core/` | Same CLI constraint as above, plus monorepo tooling this repo does not have | Rejected |
| Duplicate in both trees + parity test | Two files to keep in sync by discipline; parity test proves equality but not intent | Rejected as primary |
| **Core in `supabase/functions/_shared/`** | Deno-native (proven by `_shared/cors.ts`); Vite resolves any path inside project root and handles bare `.js` with no config | **Chosen** |

**Rationale**: Only one of the two runtimes has a hard placement constraint, so the file belongs on that side. `.js` over `.ts` is deliberate: the existing ESLint flat config globs `**/*.{js,jsx}`, so the core is linted for free, while Deno does not type-check imported JS (`checkJs` off by default). "Pure and dependency-free" is what makes this work — no import graph means no resolver divergence between esbuild and Deno.

**RESOLVED — root cause fixed, original choice (direct import) stands.** `git ls-files supabase` initially returned zero rows: `supabase/*` and `openspec/*` were blanket-ignored in `.gitignore:37-38` alongside `.claude/*`/`.agents/*`, so not even `_shared/cors.ts` (which exists on disk and deploys today) was in git. The user has since removed both lines from `.gitignore` (kept a narrower `supabase/.temp/*` + `supabase/.branches/*` exclusion for Supabase CLI machine-local cache, which is genuinely not source). **The whole `supabase/` and `openspec/` trees are still untracked on disk** — un-ignoring them doesn't add/commit anything by itself. `sdd-tasks` must include a first task: `git add supabase openspec` + a dedicated commit bringing the existing Edge Functions and prior SDD history into version control for the first time, landed and verified on Vercel *before* this change's own migrations build on top of it. Content was scanned for embedded secrets (service-role usage in RLS is expected and fine; no literal keys, passwords, or connection strings with credentials found) — safe to commit as-is.

Once that commit exists, the direct import stands as designed: `src/lib/trainingMetrics.js` re-exports `../../supabase/functions/_shared/trainingLoadCore.js` with zero build step, since Vite resolves any path inside the project root. No D-A′ sync-copy mechanism is needed — it only existed to work around files Vercel's checkout couldn't see, and that's no longer the case.

### Decision: Deterministic full-window recompute, never incremental patching

**Choice**: Every run reads activities for `[today-189d, today]`, seeds CTL/ATL/chronic28 at 0, and batch-upserts the last 120 rows with `calc_version` + `computed_at`.
**Alternatives**: incremental update from yesterday's stored row (current client behaviour).
**Rationale**: D3 requires determinism. Incremental seeding propagates any bad historical row forever and makes backfill non-idempotent. 126-day warm-up is satisfied inside the read window; rows whose athlete has less history are flagged `low_confidence = true` and are alert-suppressed.

### Decision: Four independent signals, four independent episode streams

**Choice**: The rulebook emits 0–4 alerts per evaluation, one per signal (`acwr_zone`, `tsb_critical`, `low_completion`, `high_rpe`), never blended. Dedup key = `(athlete_id, alert_type) WHERE status = 'open'` — an athlete may legitimately hold up to four concurrent open episodes. Lifecycle (`open`/`resolved`) stays orthogonal to UI state (`read_at`, `dismissed_at`), so a coach reading an alert does not free the dedup slot.

Reconciliation runs **once per alert_type**, independently, on each current-day evaluation:
- finding present, no open episode of that type → INSERT + deliver
- finding present, open episode of that type exists → UPDATE `last_seen_on`, refresh `metrics`; **escalate only** (warning→critical re-delivers; same/lower severity does not)
- open episode of that type absent from today's findings → resolve only after the condition has cleared for **2 consecutive days** (`last_seen_on < metric_date - 1`)
- **No N-day re-fire.** An ongoing condition never re-notifies; the open episode stays visible in the feed.

Consequences of the 4-signal split on the mechanics above — both are no-code, by construction:
- `tsb_critical` / `low_completion` / `high_rpe` are **single-severity** (danger only). "Escalate only" is therefore a permanent no-op for them: severity never changes, so an open episode never re-delivers. Only `acwr_zone` (caution→danger) can escalate. No special-casing needed.
- The two weekly signals are evaluated **daily** against a week-to-date window, so `last_seen_on` advances daily exactly like the daily signals and the 2-day hysteresis behaves identically. At Monday rollover the denominator resets; a clean new week resolves the stale episode two days in, instead of a bad week bleeding into a good one.

**Alternatives**: one generic `alert_type` with a blended severity (rejected — spec forbids blending, and it would make an ACWR recovery silently mask an unresolved RPE problem); re-fire every 7 days while open (rejected — reintroduces the alert fatigue dedup exists to prevent); dedup on `(athlete_id, alert_type, metric_date)` (rejected — that is per-day dedup, i.e. daily nagging).

**Postgres gotcha**: a *partial* unique index requires the predicate in the inference clause — `ON CONFLICT (athlete_id, alert_type) WHERE status = 'open' DO UPDATE ...`. Omitting `WHERE status = 'open'` fails to match the index and raises `no unique or exclusion constraint matching the ON CONFLICT specification`. This upsert form is what makes the webhook and cron paths safe when they race on the same athlete.

### Decision: "Current training week" = ISO Monday–Sunday, evaluated week-to-date

**Choice**: The window for `low_completion` and `high_rpe` is `[monday(todayLocal), todayLocal]` — ISO Monday-anchored, truncated at today.

| Option | Tradeoff | Verdict |
|---|---|---|
| Rolling trailing 7 days | Self-normalising (no partial-week effect), but invents a boundary no other surface in the app uses, and straddles two coach-authored weekly plans — a "completion rate" over a window that spans half of plan A and half of plan B is not a number anyone authored | Rejected |
| **ISO Monday–Sunday, week-to-date** | Partial-week denominator needs handling (below) | **Chosen** |

**Rationale — consistency, not intrinsic merit.** Monday-anchored weeks are already the app's only week: `getWeekStartDate()` (`src/services/weeklyTrainingService.js:530`, `day === 0 ? -6 : 1`), `weekly_diary.week_start`, `weekly_ai_reports.week_start/week_end`, `get_athlete_planned_km(p_week_start, p_week_end)`, and `(getDay() + 6) % 7` Monday=0 indexing across the calendar views. Sessions themselves are *authored* per Monday-anchored plan (`createWeeklyPlan(weekStartDate = lunes)`), so planned-vs-completed is only a well-defined ratio inside that same boundary. A rolling window would put "completion 40%" in an alert while the coach's dashboard and the Monday AI report both show 60% for the same athlete — a contradiction more damaging than either boundary is better.

**Derivation**: from `todayLocal` (Europe/Madrid), per the Date Handling section — **not** from `weekly-ai-reports`' `getUTCDay()` + `toISOString().split('T')[0]`, which is the `timezone_date_bug` pattern and is wrong for anyone training after 22:00 local in summer.

**Denominator — resolved by explicit user decision, literal spec wins.** Design originally proposed narrowing the denominator to elapsed-only planned sessions with a `<3` suppression floor, specifically to avoid `completed/planned` reading 0/6 = 0% every Monday morning. **The user was shown this exact tradeoff and chose the literal spec reading instead: `completionRate = completedToDate / plannedForWeek`, over the whole week's planned sessions, with no suppression floor.** This is a known, accepted behavior, not an oversight: `low_completion` **will** fire on Mondays/Tuesdays for most athletes by construction, until enough of the week has elapsed to catch up. `completionRate` is `null` only when `plannedForWeek === 0` (no sessions were scheduled that week — an undefined ratio, not a low one).

### Decision: `pg_cron` secrets via Vault, not literals

`cron.schedule` SQL cannot read Deno env. The migration reads `CRON_SECRET` and the project URL from `vault.decrypted_secrets`, seeded once manually. No secret value ever enters git.

## Data Flow

```
Strava ──► strava-webhook ──EdgeRuntime.waitUntil──┐
                                                    ├──► training-load-monitor  (fetch layer)
pg_cron (daily 04:15) ──pg_net──► CRON_SECRET ─────┘         │
                                                             │
   strava_activities  ──read [today-189d, today]────────────►│
   training_sessions  ──read [monday(todayLocal), sunday(todayLocal)]►│  ◄── NEW read path, WHOLE week (not truncated at today)
                                                             │
                                     ┌───────────────────────┴───────────────────┐
                                     ▼                                           ▼
                          computeLoadSeries()                        summarizeWeekSessions()
                          (pure core)                                (pure core)
                                     │                                           │
                    ┌────────────────┤                                           │
                    ▼                ▼                                           │
        daily_training_load     row ──────────► evaluateLoad(row, weekSummary) ◄─┘
        (batch upsert,                                  │   row=null|lowConfidence ⇒ skip
         calc_version)                                  │     acwr_zone + tsb_critical
                                                        │   weekSummary=null ⇒ skip
                                                        │     low_completion + high_rpe
                                                        ▼
                              0..4 findings ──► episode reconcile, per alert_type
                                                        │  [flag ON, metric_date = todayLocal]
                                                        ▼
                                            training_load_alerts
                                        (≤1 open row per athlete × alert_type)
                                                        │
                                     ┌──────────────────┴──────────────┐
                                     ▼                                 ▼
                           notifications insert           rpc send_push_notification
                                (recipient = coach if active relationship, else athlete)
```

## Migration Plan (applied in this order)

| # | File | Contents |
|---|---|---|
| 1 | `..._daily_training_load_baseline.sql` | Idempotent `CREATE TABLE IF NOT EXISTS` matching live columns (`athlete_id, date, tss, ctl, atl, tsb, intensity_factor, total_distance_m, total_duration_s, activity_count, ramp_rate, source, updated_at`); `CREATE UNIQUE INDEX IF NOT EXISTS ... (athlete_id, date)`; `ENABLE ROW LEVEL SECURITY` + `DROP POLICY IF EXISTS`/`CREATE POLICY` for self-select, coach-select via active `coach_athlete_relationship`, `service_role` all — mirroring `20260410150000_strava_deep_ingestion.sql`. **Plus a temporary `dtl_write_own` INSERT/UPDATE policy** so the still-live client write path does not break. |
| 2 | `..._daily_training_load_metrics_v2.sql` | `ADD COLUMN IF NOT EXISTS chronic_load_28 numeric, calc_version smallint NOT NULL DEFAULT 1, computed_at timestamptz, low_confidence boolean NOT NULL DEFAULT false`. Additive + nullable ⇒ rollback-safe. |
| 3 | `..._training_load_alerts.sql` | New table (below) + RLS (self/coach/service_role) + `CREATE UNIQUE INDEX ... (athlete_id, alert_type) WHERE status = 'open'` + `CHECK` constraints on `alert_type` / `severity` / `status` + `CREATE INDEX IF NOT EXISTS idx_training_sessions_athlete_date ON public.training_sessions (athlete_id, scheduled_date)` (see below). |
| 4 | `..._send_push_notification_rpc.sql` | `CREATE OR REPLACE FUNCTION public.send_push_notification(p_user_ids, p_title, p_body, p_url, p_tag)` — imported verbatim from the deployed definition, **no behavioural edits**. |
| 5 | `..._load_sweep_rpc.sql` | `get_athletes_needing_load_refresh(...)` (SECURITY DEFINER), following the existing `get_athlete_planned_km` pattern. **Candidate predicate widened** for the two session-derived signals — see below. |
| 6 | `..._pg_cron_schedules.sql` | `create extension if not exists pg_cron, pg_net`; `cron.unschedule` by name then `cron.schedule` for **both** `training-load-daily-sweep` and the existing `weekly-ai-reports` Monday job (closing the Dashboard drift). |
| 7 | `..._daily_training_load_drop_client_write.sql` | Drops `dtl_write_own` — applied only in Slice 3, after the frontend stops writing. |

Every file ships a `_rollback.sql` sibling per repo convention; #1 and #3 also ship `_verify.sql`.

Migration #1 is written to be a no-op if RLS is already configured out-of-repo (the likely live state) — `DROP POLICY IF EXISTS` before each `CREATE POLICY` makes it re-declarative either way.

### Migration #3: `CHECK` constraint, not a Postgres `ENUM` type

**Choice**: `alert_type text NOT NULL CHECK (alert_type IN ('acwr_zone','tsb_critical','low_completion','high_rpe'))`, same shape for `severity IN ('warning','critical')` and `status IN ('open','resolved')`.

**Rationale**: the repo convention is a `_rollback.sql` sibling for every migration, and `ENUM` cannot honour it — `ALTER TYPE ... ADD VALUE` could not run inside a transaction block before PG 12, and a value can *never* be removed from an enum, so the rollback script for a fifth signal would be unwritable. A CHECK is `DROP CONSTRAINT` / `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT`, fully transactional and fully reversible. PostgREST exposes both identically to the client, so there is no API-surface argument for the enum.

### Migration #5: sweep candidate predicate must widen

The old predicate gated candidates on `EXISTS (strava_activities …)`, which was correct when every signal derived from activity data. It is now a **silent miss**: an athlete with planned sessions but no Strava activities can legitimately trigger `low_completion` or `high_rpe`, yet would never be swept. The `EXISTS` becomes a disjunction (see Interfaces). The `computed_at < now() - interval '20 hours'` freshness clause is left untouched — the 04:15 daily cron always clears a ~24 h gap, so it never suppresses a day's session evaluation.

## Interfaces / Contracts

```js
// supabase/functions/_shared/trainingLoadCore.js — zero imports
export const CALC_VERSION = 2;
export const ALERT_TYPES = ['acwr_zone', 'tsb_critical', 'low_completion', 'high_rpe'];

export function tssForActivity(activity, profile);            // rTSS → hrTSS → duration fallback
export function buildDailySeries(activities, profile, from, to); // [{date, tss, distanceM, durationS, count}]
export function computeLoadSeries(dailySeries);               // + {ctl, atl, tsb, chronicLoad28, acwr, rampRate, lowConfidence}

export function isoWeekStart(todayLocalStr);                  // 'YYYY-MM-DD' → Monday of that week, pure string math
export function summarizeWeekSessions(sessions, weekStart, weekEnd);
//   sessions: [{scheduled_date, status, rpe_score}] — ALL sessions scheduled Mon-Sun of the target week, fetched by the caller
//   → { planned, completed, completionRate|null, avgRpe|null, ratedCount }
//   completionRate = completed / planned over the WHOLE week (not elapsed-to-date) — literal spec reading, user-confirmed.
//   completionRate is null ONLY when planned === 0 (nothing scheduled that week — undefined ratio, not a low one).
//   No suppression floor. `low_completion` WILL fire early in the week for athletes with pending sessions — accepted tradeoff.

export function evaluateLoad(loadRow, weekSummary);           // → [{alertType, severity, messageEs, metrics}] (0..4)
//   loadRow     null | { …computeLoadSeries output, lowConfidence } → gates acwr_zone + tsb_critical ONLY
//   weekSummary null | summarizeWeekSessions output               → gates low_completion + high_rpe ONLY
// ACWR = ewma7(tss) / ewma28(tss)  (D1). CTL=42d, ATL=7d, TSB=ctl-atl unchanged.
```

**Why two arguments instead of a widened row.** The spec makes warm-up suppression asymmetric: `acwr_zone` and `tsb_critical` die on incomplete EWMA warm-up, `low_completion` and `high_rpe` do not. Two separately-nullable arguments encode that asymmetry *in the signature* — `evaluateLoad(null, summary)` is the warm-up case and it still returns session alerts; `evaluateLoad(row, null)` is the "no sessions planned" case and it still returns load alerts. Merging session fields onto `loadRow` was rejected: it would make `lowConfidence` look like it gates all four signals, and it would misrepresent `loadRow` as a `daily_training_load` row when half its fields come from `training_sessions`.

The core still imports nothing and touches no client. `training_sessions` rows are fetched by `training-load-monitor/index.ts` and handed in as plain objects, exactly like `strava_activities` already are.

Sessions read (per-athlete, one indexed range scan of ~7 rows):

```sql
SELECT scheduled_date, status, rpe_score
FROM public.training_sessions
WHERE athlete_id = $1
  AND scheduled_date BETWEEN $weekStart AND $todayLocal;   -- Monday..today, Europe/Madrid
```

Deliberately **no `coach_id` filter** — `weekly-ai-reports` filters `.eq('coach_id', …)` because it is coach-scoped by construction, but the monitor must also serve independent athletes, who have no coach row and would otherwise return zero sessions and never alert.

`training_load_alerts`: `id, athlete_id, recipient_id, alert_type, severity, metric_date, metrics jsonb, message_es, status ('open'|'resolved'), episode_started_on, last_seen_on, resolved_at, read_at, dismissed_at, created_at, updated_at`. `alert_type`, `severity`, `status` each carry a `CHECK` constraint (see Migration #3). `metrics` carries the signal's own inputs — `{acwr, zone}`, `{tsb}`, `{plannedToDate, completedToDate, completionRate}`, or `{avgRpe, ratedCount}` — so the UI never has to recompute to render a message.

Function contract — `POST /functions/v1/training-load-monitor`, `verify_jwt = false`, auth accepts `Bearer CRON_SECRET` **or** `Bearer SERVICE_ROLE_KEY`:
`{ mode: 'athlete', athlete_id }` | `{ mode: 'sweep', limit?, offset? }`.

Sweep query (indexed, no full scan of the athlete×day table):

```sql
SELECT a.id FROM public.athletes a
LEFT JOIN public.daily_training_load d ON d.athlete_id = a.id AND d.date = p_today
WHERE (EXISTS (SELECT 1 FROM public.strava_activities sa
               WHERE sa.athlete_id = a.id AND sa.deleted = false
                 AND sa.start_date_local >= p_since)     -- uses idx_strava_activities_not_deleted
    OR EXISTS (SELECT 1 FROM public.training_sessions ts -- NEW: session-only athletes
               WHERE ts.athlete_id = a.id
                 AND ts.scheduled_date >= p_week_start)) -- uses idx_training_sessions_athlete_date
  AND (d.athlete_id IS NULL OR d.calc_version < p_calc_version
       OR d.computed_at < now() - interval '20 hours')   -- uses the (athlete_id, date) unique index
ORDER BY a.id LIMIT p_limit OFFSET p_offset;
```

Cost is still one index probe per athlete against the roster (now at most two), not a scan of `daily_training_load`. The sweep self-chains the next page via `EdgeRuntime.waitUntil` when a full page returns. `p_week_start` is passed in by the caller from the same `isoWeekStart(todayLocal)` the core uses, so the SQL never derives a week itself and cannot drift from the rulebook.

## `strava-webhook` Integration

New `triggerLoadRecalc(athleteId)` copies `triggerStreamsFetch` verbatim in shape: `fetch(...)` with `.then(logEvent).catch(logEvent)` attached **before** being handed to `EdgeRuntime.waitUntil` inside a `try/catch`. Called after `processNewActivity`, after a successful upsert in `processActivityUpdate`, and after `processActivityDelete` (a deletion changes the series too). Zero awaits on the request path — the handler already returns `EVENT_RECEIVED` immediately — and the pre-attached `.catch` prevents an unhandled rejection from tearing down the isolate.

## Date Handling

Deno runs UTC; `daily_training_load.date` is a local calendar date. The function derives `todayLocal` via `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' })` and never uses `toISOString().split('T')[0]` (see `timezone_date_bug`). Alert emission requires `row.date === todayLocal` for `acwr_zone`/`tsb_critical`, and `weekStart === isoWeekStart(todayLocal)` for `low_completion`/`high_rpe` — a recomputation of any past week is evaluated but never emitted, which is what keeps backfill silent for the session signals too.

`training_sessions.scheduled_date` is already a plain date string, so the week window is pure string comparison — no timezone conversion happens on the session side at all.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | core TSS/CTL/ATL/TSB/ACWR + all four rulebook signals | `node --test` (zero new dependency) over `supabase/functions/_shared/*.test.js`; script `npm run test:core` |
| Unit | `isoWeekStart` across Sunday, Monday, month and year boundaries, and a DST transition day | table-driven, pure string in/out |
| Unit | `summarizeWeekSessions`: whole-week denominator (not elapsed-to-date, no floor — user-confirmed), null only when `planned === 0`, RPE averaged over rated *completed* sessions only | fixture session arrays |
| Unit | argument asymmetry — `evaluateLoad(null, summary)` still yields session alerts; `evaluateLoad(lowConfidenceRow, summary)` yields session alerts only | direct assertion, this is the warm-up spec scenario |
| Parity | CTL/ATL/TSB byte-identical to today's `trainingMetrics.js` on a fixture series; ACWR *differs* by design | golden fixture asserted both ways |
| Integration | episode reconcile per alert_type (insert / escalate / hysteresis / resolve), plus two concurrent open types not colliding on the partial unique index | fixture sequence of daily rows driven through the reconcile function |
| Manual | RLS for coach, self, independent athlete; both cron jobs fire | `_verify.sql` + one Monday observed before removing Dashboard config |

## Rollout / Rollback

1. **Slice 1 — data layer, zero behaviour change.** Core + migrations 1–5; frontend delegates to core. Independently deployable.
2. **Slice 2 — agent silent.** `training-load-monitor` with `TRAINING_LOAD_ALERTS_ENABLED=false`, webhook trigger, migration 6. Backfill runs here → zero alerts by construction. Compare old vs new ACWR distribution.
3. **Slice 3 — delivery + UI.** Alert feed (coach + athlete, es-ES), `weekly-ai-reports` consumes canonical values, migration 7, flip the flag.

Rollback maps 1:1 to the proposal: flip flag (instant, silent) → `cron.unschedule` + revert webhook → revert frontend (new columns additive/nullable) → drop `training_load_alerts`.

## Open Questions

- [x] ~~BLOCKING for D-A: is `supabase/` actually tracked in git despite `.gitignore:37`?~~ Resolved — `.gitignore` no longer excludes `supabase/*`/`openspec/*` (narrowed to `supabase/.temp/*` + `supabase/.branches/*` for CLI-local cache only). **Still needs the actual `git add`/commit as `sdd-tasks` item 1**, verified on a Vercel deploy, before this change's own code lands.
- [x] `strava_activities.start_date_local` column type — **VERIFIED via live query**: `timestamp with time zone`. `weekly-ai-reports` comparing it as a string is a latent bug there, not a pattern to replicate; the sweep predicate compares it directly as timestamptz.
- [x] Is `pg_net` enabled? — **VERIFIED**: yes, `0.19.5` installed. `pg_cron` also independently confirmed (`1.6.4`). Migration 6's `create extension if not exists` is a confirming no-op.
- [x] Which table holds `lactate_threshold_pace` / `lactate_threshold_hr`? — **VERIFIED**: `athletes` (integer columns), as assumed.
- [x] Does `daily_training_load` already have RLS configured out-of-repo? — **VERIFIED**: yes, RLS enabled with 3 existing policies (`daily_training_load_select` self-or-active-coach, `_insert`, `_update` self-only). No explicit `service_role` policy (bypasses RLS by default). Migration #1's policies are a **restatement** of these three plus the new `dtl_write_own` addition, not a fresh grant.
- [x] **Spec refinement — RESOLVED by explicit user decision, not by design.** The user was shown the exact "0% every Monday" tradeoff and chose the literal spec reading over design's elapsed+floor refinement: `completionRate = completed / planned` over the whole week, no suppression floor. See the "Denominator" decision above — this is now final, not open.
- [x] Does `training_sessions` already have an index on `(athlete_id, scheduled_date)`? — **VERIFIED**: no, it does not exist. Migration #3's `CREATE INDEX IF NOT EXISTS idx_training_sessions_athlete_date` is a real create.
- [x] Confirm `training_sessions.status` domain — **VERIFIED via live query**: exactly `{'planned', 'completed'}`, no third state. `'completed'` being the only done-state holds exactly as assumed.
