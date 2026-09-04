# Design: Adherence Detection Agent (Agent 2)

## Technical Approach

A pure, zero-import core (`engagementCore.js`) owns the signal-of-life/tiering/eligibility rulebook. A SECURITY DEFINER RPC does the aggregate I/O in one query (four `MAX()` probes + planned-session count per candidate) so the daily sweep is one round trip, not N×5. An `engagement-monitor` Edge Function wraps them, invoked only by a versioned `pg_cron` job. Agent 1's reactive half is **inverted**: instead of a webhook raising alerts, incoming signals *resolve* them — enforced by AFTER triggers at the data layer, not by client calls. The frontend does not fork the feed; a merge service normalizes both alert tables into one view-model.

Conventions are inherited verbatim from Agent 1's archived design: `supabase/functions/_shared/` placement, plain zero-import ESM, `CHECK` over `ENUM`, `_rollback.sql` sibling per migration, Vault-seeded `cron_secret`/`project_url` (already seeded — **do not reseed**), `Europe/Madrid` local-date derivation, best-effort push that never blocks the in-app row.

## Architecture Decisions

### Decision: RLS is coach + `service_role` only — **no self-select policy**

| Option | Tradeoff | Verdict |
|---|---|---|
| Mirror `training_load_alerts` (self OR active-coach) | Symmetric, one less thing to explain | **Rejected** |
| **Coach-via-active-relationship + `service_role`** | Deviates from the shipped precedent | **Chosen** |

**This contradicts the proposal's In Scope bullet**, which explicitly specifies `RLS self-select via (select auth.uid()) = athlete_id`. Flagging rather than silently deviating. Evidence for the change:

`src/pages/athlete/Dashboard.jsx:174-177` renders `TrainingLoadAlertFeed` for **every** athlete — the `isIndependent` gate only starts at line 179. Once the feed is source-agnostic (D2's mitigation), a self-select policy means a coach-supervised athlete opens their own dashboard and reads *"Riesgo de abandono: llevas 21 días sin registrar actividad"* — a coach's internal churn-risk assessment, shown to its subject, in a product whose stated mandate is "warn the coach **before** the relationship dies". The alert exists so the coach can intervene with the right tone; surfacing the raw signal pre-empts that intervention with the worst possible tone.

`training_load_alerts` self-select is correct there and not a precedent here: those four signals are physiological facts about the athlete's own training that they benefit from seeing, and independent athletes are their own recipients. Agent 2 has **no independent-athlete scope at all**, so self-select would grant visibility to exactly one population — the one it should not reach.

Consequence, and why this costs nothing in the UI: the merged feed calls both queries unconditionally for any viewer. For a supervised athlete, RLS returns `[]` for the engagement source — empty, not an error. **No client-side role branching is needed anywhere.**

### Decision: Reactive resolve via AFTER triggers, not a client-callable RPC

| Option | Tradeoff | Verdict |
|---|---|---|
| Client calls `resolve_*` RPC after each write | 3+ call sites today, silently missed by any future write path; and the client can *assert* liveness with no evidence | **Rejected** |
| Piggyback the next daily sweep | Violates the proposal's "without waiting for the next sweep" success criterion | Rejected |
| **AFTER triggers on the three signal tables + a direct `.rpc()` from `strava-webhook`** | Adds triggers to a repo with a documented trigger-flood incident | **Chosen** |

Two independent reasons:

1. **Coverage.** `training_sessions.completed_at` has **three** live write paths — `src/services/sessionCompletionService.js:38`, `src/services/weeklyTrainingService.js:414`, and `supabase/functions/strava-webhook/index.ts:302` (two clients, one server). Wiring resolve at each call site is already three edits and permanently fragile.
2. **Integrity (decisive).** Resolution must be *caused by* the signal, not *claimed by* the client. Any client-callable resolve RPC must be `SECURITY DEFINER` (the athlete has no UPDATE grant), which lets an athlete silently clear their own churn-risk flag from the coach's feed without producing a single data point. A trigger cannot be fired without actually writing the row. The resolve function is therefore **`REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`** — it has no client-reachable entry point at all.

Safety against the documented `trg_push_acwr_alert` flood: this trigger **only** `UPDATE`s `... WHERE status='open'` — no push, no `notifications` insert, no fan-out. When nothing is open it is one probe of the partial unique index and zero row writes. It is idempotent by construction.

**`strava_activities` deliberately gets no trigger.** The deep-ingestion backfill bulk-inserts *historical* activities; a trigger would resolve open alerts from months-old data. That is a correctness bug, not just cost. The Strava path instead uses a live-event-only fire-and-forget `.rpc()` inside `EdgeRuntime.waitUntil` in `strava-webhook`, mirroring `triggerLoadRecalc`. A direct `.rpc()` beats an HTTP hop to a new `engagement-monitor` mode: one fewer network failure mode, same semantics. (When Strava *does* match a planned session, the `training_sessions` trigger already fires — the webhook call covers the unmatched-activity case.)

### Decision: One `alert_type`, two severity tiers, variant in `metrics`

`alert_type = 'engagement_silence'` only. D5's "never started" is the **same type** with `metrics.variant = 'never_started'` and distinct `message_es`, so the dedup index means "at most one open engagement alert per athlete" — the strongest possible anti-noise guarantee. Tiers map to D1's labels: `warning` → "Inactividad", `danger` → "Riesgo de abandono". Severity vocabulary is `('warning','danger')` per the proposal, **not** Agent 1's `('warning','critical')`; the UI adapter normalizes both to a `tone` field so neither table imports the other's vocabulary.

### Decision: Sweep selection is the inverse of Agent 1's

Agent 1's `get_athletes_needing_load_refresh` gates on `EXISTS (recent activity)`. Copying that here would exclude **exactly the population being hunted**. Agent 2's candidate set is driven from `coach_athlete_relationship` (`status='active'` AND `start_date <= today - 21`), with **no activity-existence predicate and no freshness predicate**. Cost is roster-sized, which is correct: every supervised athlete must be evaluated every day.

## Data Flow

```
pg_cron (daily 04:45) ──pg_net + Bearer cron_secret──► engagement-monitor
                                                             │
                    rpc get_engagement_candidates(today, 21, limit, offset)
                                                             │
   coach_athlete_relationship (active, past warm-up) ────────┤
   MAX(training_sessions.completed_at)                       │
   MAX(wellness_log.date)                       ── one query ┤
   MAX(strava_activities.start_date_local)                   │
   MAX(chat_messages.created_at WHERE sender_id=athlete_id)  │
   COUNT(training_sessions planned in [today-10, today])     │
                                                             ▼
                                        evaluateEngagement(candidate, today)   (pure core)
                                                             │  0 or 1 finding
                                                             ▼
                                    rpc upsert_engagement_alert  (ON CONFLICT ... WHERE status='open')
                                                             │
                                          ┌──────────────────┴───────────────┐
                                          ▼                                  ▼
                               notifications insert            rpc send_push_notification
                                        (recipient = coach, always)     (best-effort)

RESOLVE (immediate, independent of the sweep):
  training_sessions UPDATE→completed ─┐
  wellness_log INSERT/UPDATE ─────────┼─► AFTER trigger ─► resolve_engagement_alerts(athlete_id)
  chat_messages INSERT ───────────────┘                          │  UPDATE ... WHERE status='open'
  strava-webhook (live event) ──EdgeRuntime.waitUntil .rpc()─────┘
```

## Migration Plan (applied in this order)

| # | File | Contents |
|---|---|---|
| 1 | `20260901100000_athlete_engagement_alerts.sql` | New table (below) + `ENABLE ROW LEVEL SECURITY` + **one** merged SELECT policy + UPDATE policy + `service_role` ALL + partial unique dedup index + recipient index. |
| 2 | `20260901101000_engagement_sweep_rpc.sql` | `get_engagement_candidates(...)` SECURITY DEFINER, `SET search_path TO 'public'`, `REVOKE ... FROM PUBLIC, anon, authenticated`. Supporting indexes (below). |
| 3 | `20260901102000_upsert_engagement_alert_rpc.sql` | `upsert_engagement_alert(...)` — plpgsql, the partial-index `ON CONFLICT (athlete_id, alert_type) WHERE status='open'` form. |
| 4 | `20260901103000_engagement_reactive_resolve.sql` | `resolve_engagement_alerts(uuid)` + `tg_resolve_engagement_alerts()` + three `AFTER` triggers. |
| 5 | `20260901104000_pg_cron_engagement_sweep.sql` | `cron.unschedule`-by-name-if-exists then `cron.schedule('engagement-daily-sweep','45 4 * * *', ...)`, reading the **already-seeded** `cron_secret` / `project_url` Vault secrets. No `vault.create_secret` call. |

Every file ships a `_rollback.sql` sibling; #1 and #4 also ship `_verify.sql`.

**Single merged SELECT policy is mandatory, not stylistic.** `20260831130000_merge_training_load_alerts_select_policies.sql` had to collapse two permissive SELECT policies into one OR'd policy to clear the Supabase advisor's "Multiple Permissive Policies" warning. Agent 2 ships in that shape on day one rather than repeating the cleanup migration. `(select auth.uid())` — wrapped in a subselect — is the repo's established initplan-hoisting form; do not write bare `auth.uid()`.

`CHECK` over `ENUM` for `alert_type` / `severity` / `status`, per Agent 1's rollback-reversibility rationale (an enum value can never be removed, so a `_rollback.sql` would be unwritable).

**Verify before applying** (no live DB access in this phase): `select * from information_schema.triggers where event_object_table in ('training_sessions','wellness_log','chat_messages')` — the repo has a documented history of undocumented triggers, and migration #4 must not stack onto a surprise.

Supporting indexes for migration #2 (each `IF NOT EXISTS`; `idx_training_sessions_athlete_date` already exists from Agent 1):

```sql
CREATE INDEX ... ON public.wellness_log (athlete_id, date DESC);
CREATE INDEX ... ON public.chat_messages (sender_id, created_at DESC);
CREATE INDEX ... ON public.coach_athlete_relationship (status, start_date);
```

## Interfaces / Contracts

### `athlete_engagement_alerts`

```
id uuid PK | athlete_id uuid → athletes(id) CASCADE | recipient_id uuid → users(id) CASCADE
alert_type text CHECK (alert_type IN ('engagement_silence'))
severity   text CHECK (severity   IN ('warning','danger'))
status     text CHECK (status     IN ('open','resolved')) DEFAULT 'open'
metric_date date | silence_days integer NOT NULL
metrics jsonb NOT NULL DEFAULT '{}'   -- {variant:'silence'|'never_started', lastSignalAt, lastSignalSource, plannedInWindow}
message_es text NOT NULL
episode_started_on date | last_seen_on date | resolved_at | read_at | dismissed_at | created_at | updated_at
UNIQUE INDEX (athlete_id, alert_type) WHERE status = 'open'
INDEX (recipient_id, status)
```

`recipient_id` is **always** the active coach — never the athlete. It is retained (rather than dropped as constant) for symmetry with `training_load_alerts` and to target `send_push_notification` without a second lookup.

### `supabase/functions/_shared/engagementCore.js` — zero imports

```js
export const ALERT_TYPES = ['engagement_silence'];
export const SILENCE_WARNING_DAYS = 10;   // one microcycle + 3d grace
export const SILENCE_DANGER_DAYS  = 21;   // three microcycles
export const WARMUP_DAYS          = 21;   // symmetric with the danger tier
export const SUPPRESSION_WINDOW_DAYS = 10; // = SILENCE_WARNING_DAYS

export function resolveLastSignal(signals);
//   signals: { lastSessionCompletedAt, lastWellnessDate, lastStravaAt, lastAthleteMessageAt }
//            each 'YYYY-MM-DD' | ISO timestamp | null
//   → { at: 'YYYY-MM-DD'|null, source: 'session'|'wellness'|'strava'|'chat'|null }
//   OR-blend: pure max. A null source can only FAIL TO RESCUE a silent athlete
//   (false negative), never manufacture a false positive (D3).

export function daysBetween(fromDateStr, toDateStr);   // pure string→int, no Date arithmetic on the hot path
export function isPastWarmUp(startDate, todayLocal);   // startDate null ⇒ false (not evaluable)
export function tierFor(silenceDays);                  // → 'danger' | 'warning' | null

export function evaluateEngagement(candidate, todayLocal);
//   candidate: { athleteId, coachId, startDate, plannedInWindow, ...signals }
//   → null | { alertType:'engagement_silence', severity, silenceDays, messageEs,
//              metrics:{ variant, lastSignalAt, lastSignalSource, plannedInWindow } }
//
//   Gate order (short-circuit, cheapest first):
//     1. !isPastWarmUp(startDate, today)          → null   (D5)
//     2. plannedInWindow === 0                    → null   (coach went quiet, not the athlete)
//     3. lastSignal.at === null                   → variant 'never_started',
//                                                   silenceDays = today − startDate
//     4. else                                     → variant 'silence',
//                                                   silenceDays = today − lastSignal.at
//     5. tierFor(silenceDays) === null            → null
//
//   Note: past warm-up implies ≥21 days, so 'never_started' always lands in
//   'danger'. Intentional — the coach action is onboarding, not re-engagement.
```

The core never sees a Supabase client, a `chat_messages` row, or React. `todayLocal` is derived by the Edge Function via `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' })` — **never** `toISOString().split('T')[0]` (`timezone_date_bug`).

### `get_engagement_candidates(p_today date, p_warmup_days int, p_window_days int, p_limit int DEFAULT 200, p_offset int DEFAULT 0)`

```sql
SELECT car.athlete_id, car.coach_id, car.start_date,
       (SELECT max(ts.completed_at)      FROM training_sessions ts WHERE ts.athlete_id = car.athlete_id)      AS last_session_completed_at,
       (SELECT max(wl.date)              FROM wellness_log wl      WHERE wl.athlete_id = car.athlete_id)      AS last_wellness_date,
       (SELECT max(sa.start_date_local)  FROM strava_activities sa WHERE sa.athlete_id = car.athlete_id
                                                                     AND sa.deleted = false)                 AS last_strava_at,
       (SELECT max(cm.created_at)        FROM chat_messages cm     WHERE cm.sender_id = car.athlete_id)       AS last_athlete_message_at,
       (SELECT count(*) FROM training_sessions ts2
         WHERE ts2.athlete_id = car.athlete_id
           AND ts2.scheduled_date BETWEEN (p_today - p_window_days) AND p_today)                              AS planned_in_window
FROM coach_athlete_relationship car
WHERE car.status = 'active'
  AND car.start_date IS NOT NULL
  AND car.start_date <= p_today - p_warmup_days
ORDER BY car.athlete_id
LIMIT p_limit OFFSET p_offset;
```

Verified column shapes: `athletes.id` **is** `users.id` (`schema.sql:102`), so `chat_messages.sender_id = athlete_id` is a valid athlete-sent test with no role join — and a coach-sent message resolves nothing, because no alert row is keyed on the coach's id. Correct by construction. `chat_messages` columns confirmed as `(id, conversation_key, sender_id, receiver_id, content, read, created_at)` from `src/services/chatService.js:19` — there is no `unified_chat_messages` table. `planned_in_window` intentionally counts **all** scheduled sessions regardless of status; the dead `'pending'` filter in `teamHealthService.js` is **not** copied.

### Reactive resolve

```sql
CREATE FUNCTION public.resolve_engagement_alerts(p_athlete_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.athlete_engagement_alerts
     SET status='resolved', resolved_at=now(), updated_at=now()
   WHERE athlete_id = p_athlete_id AND status = 'open';
$$;
REVOKE EXECUTE ON FUNCTION public.resolve_engagement_alerts(uuid) FROM PUBLIC, anon, authenticated;
```

| Hook | Trigger | `WHEN` guard |
|---|---|---|
| Session completed | `AFTER UPDATE ON training_sessions` | `NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed'` → `NEW.athlete_id` |
| Wellness entry | `AFTER INSERT OR UPDATE ON wellness_log` | none → `NEW.athlete_id` |
| Athlete message | `AFTER INSERT ON chat_messages` | none → `NEW.sender_id` |
| Strava activity | `strava-webhook/index.ts` | live event only; `EdgeRuntime.waitUntil(supabase.rpc('resolve_engagement_alerts', …).then(log).catch(log))` in `processNewActivity` |

The `.catch` is pre-attached **before** `waitUntil`, per `triggerLoadRecalc`'s shape, so a failure cannot tear down the isolate. `processActivityUpdate`/`processActivityDelete` do **not** resolve — an edit or deletion is not a new signal of life.

### Edge Function contract

`POST /functions/v1/engagement-monitor`, `verify_jwt = false`, auth accepts `Bearer CRON_SECRET` **or** `Bearer SERVICE_ROLE_KEY` (copied from `training-load-monitor`). Body: `{ mode:'sweep', limit?, offset?, dryRun? }` | `{ mode:'athlete', athlete_id }`. Self-chains the next page via `EdgeRuntime.waitUntil` when a full page returns. `dryRun: true` logs the finding counts and writes nothing — this is the mechanism for the proposal's mandatory pre-enable dry run. Kill switch `ENGAGEMENT_ALERTS_ENABLED` (default `false` until the dry run is reviewed).

## The `training-load-alerts` Delta is UI-Copy-Only

**Stated explicitly so `sdd-tasks` does not over-scope it.** D1 changes **one string literal**: `src/components/shared/TrainingLoadAlertFeed.jsx:21`, `low_completion: { icon: FiCheckSquare, label: 'Adherencia' }` → `label: 'Cumplimiento semanal'`. The `alert_type` value `'low_completion'` is unchanged, the `CHECK` constraint is unchanged, no data is touched. **No migration. No backfill. No `_rollback.sql`.** The `openspec/specs/training-load-alerts/spec.md` edit is prose only.

## UI Feed Generalization

| File | Action | Description |
|---|---|---|
| `src/services/athleteEngagementAlertsService.js` | Create | `getEngagementAlerts`, `markRead`, `dismiss` against `athlete_engagement_alerts` — line-for-line parallel to `trainingLoadAlertsService.js`. |
| `src/services/alertFeedService.js` | Create | `getMergedAlerts(athleteId)`: `Promise.all([...])` over both services, map each to the view-model, `concat`, sort `created_at` desc. Also `markRead(item)` / `dismiss(item)` dispatching on `item.source`. |
| `src/components/shared/TrainingLoadAlertFeed.jsx` | Modify | Consume `getMergedAlerts`; render from the view-model instead of `alert.alert_type`; `low_completion` label rename; default `title` → "Alertas". |
| `src/components/dashboard/AthleteLoadAlerts.jsx` | Modify | Prop pass-through only (title default). |
| `src/pages/dashboard/AthleteProfile.jsx`, `src/pages/athlete/Dashboard.jsx` | Modify | Comment/copy update only — **no role branching** (RLS returns `[]` for a supervised athlete's engagement query). |
| `src/services/teamHealthService.js` | Modify | One extra query: open engagement alerts `.in('athlete_id', rosterIds).eq('status','open')`, merged onto the athlete rows as `engagementTone`/`silenceDays`. Do not copy the dead `'pending'` status filter. |
| `src/components/dashboard/TeamHealthTable.jsx` | Modify | `LastSessionBadge` (line 41) accepts `silenceDays`/`tone`; amber ≥10d, red ≥21d, existing behaviour otherwise. |

View-model (the whole point of "source-agnostic"):

```js
{ id, source: 'training_load' | 'engagement',
  label,                       // 'Carga (ACWR)' | 'Cumplimiento semanal' | 'Inactividad' | 'Riesgo de abandono'
  tone: 'warning' | 'critical',// engagement 'danger' → 'critical'; load 'critical' → 'critical'
  messageEs, createdAt, readAt, dismissedAt }
```

The existing `ALERT_TYPE_CONFIG`/`SEVERITY_CLASSES` maps stay, keyed off `label`/`tone` instead of raw column values, so neither table's vocabulary leaks into the other's.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `resolveLastSignal` OR-blend: each source alone wins; all-null; mixed date/timestamp inputs | `node --test` over `supabase/functions/_shared/*.test.js`, `npm run test:core` (Agent 1's harness, zero new deps) |
| Unit | `evaluateEngagement` gate order — warm-up before suppression before tiering; `plannedInWindow===0` returns null even at 40 days silence | table-driven fixtures, one row per proposal success criterion |
| Unit | `never_started` variant: null signal + past warm-up → `danger`, `silenceDays` anchored to `start_date`, distinct copy | direct assertion |
| Unit | Boundaries: 9/10/20/21 days; warm-up day 20 vs 21; a Strava-less athlete training consistently is never flagged | table-driven |
| Unit | `daysBetween` across month, year, and a DST-transition boundary | pure string in/out |
| Integration | Dedup: two sweeps on the same day produce one row; warning→danger escalates in place, not a second row | fixture sequence through `upsert_engagement_alert` |
| Integration | Reactive resolve: insert an open alert, then write each of the four signals; assert `status='resolved'` with zero sweep runs | `_verify.sql` |
| Manual | RLS — coach sees the row, **the athlete does not**, another coach does not; `resolve_engagement_alerts` is not callable as `authenticated` | `_verify.sql` under three JWTs |
| Manual | Dry-run sweep volume reviewed before `ENGAGEMENT_ALERTS_ENABLED=true` | proposal-mandated gate |

## Rollout / Rollback

1. **Slice 1 — schema + core, zero behaviour.** Migrations 1–3, `engagementCore.js` + unit tests. Nothing writes yet.
2. **Slice 2 — agent silent.** `engagement-monitor` with `ENGAGEMENT_ALERTS_ENABLED=false`, migration 5. Run `{mode:'sweep', dryRun:true}` manually, review counts, then flip the flag.
3. **Slice 3 — resolve + UI.** Migration 4 (triggers), `strava-webhook` `.rpc()`, merge service, feed generalization, `TeamHealthTable`, label rename.

Rollback maps 1:1 to the proposal: flip the flag (instant, silent) → `cron.unschedule('engagement-daily-sweep')` → drop triggers + revert the webhook call → revert the UI commit (merged feed degrades to single-source; the label rename is independently revertible) → `_rollback.sql` drops the table (no FK points at it). The `training-load-alerts` spec delta is terminology-only and safe to leave in place even on a full rollback.

## Open Questions

- [ ] **RLS deviates from the proposal's In Scope bullet** (coach-only, no self-select). Needs an explicit user ACK before `sdd-tasks`; if the user prefers the proposal as written, the feed must additionally be role-gated on the athlete dashboard, which reintroduces client-side branching.
- [ ] `wellness_log` column shape assumed `(athlete_id, date, ...)` from `src/services/trainingLoadService.js:240-249` (`onConflict: 'athlete_id,date'`). No live DB access this phase — confirm before writing migration #2.
- [ ] `coach_athlete_relationship.start_date` is nullable (`schema.sql:133`) and the auto-link trigger (`schema.sql:697`) inserts with `status='pending'` and **no** `start_date`. Rows activated without ever setting `start_date` are silently never evaluated. Quantify (`count(*) where status='active' and start_date is null`) before enabling; if non-trivial, a backfill from `created_at` is a prerequisite task.
- [ ] Confirm no pre-existing triggers on `training_sessions` / `wellness_log` / `chat_messages` via `information_schema.triggers` before applying migration #4.
