# Design: Continuous Planning Agent (Agent 3)

## Technical Approach

A pure, zero-import core (`planAdjustmentCore.js`) maps **one** selected finding to **one** deterministic reduction patch over an athlete's remaining future `planned` sessions. A `planning-agent` Edge Function owns all I/O and is invoked from two directions (daily `pg_cron` sweep + fire-and-forget reactive call from `training-load-monitor` on `acwr_zone` danger). The suggestion carries both the patch and a **snapshot of every targeted session**. A single `SECURITY DEFINER` plpgsql RPC, reachable only from the coach's approval modal, is the *only* code path in the repo that writes `training_sessions` in this change.

Conventions are inherited verbatim from Agents 1 and 2: `supabase/functions/_shared/` placement for the pure core, `index.ts` I/O + `logic.js` pure-decision split inside the function directory, `CHECK` over `ENUM`, `_rollback.sql` (+ `_verify.sql` where stated) siblings, Vault-seeded `cron_secret` / `project_url` (**already seeded — do not reseed**), `Europe/Madrid` local-date derivation via `Intl.DateTimeFormat('sv-SE', …)` and never `toISOString().split('T')[0]` (`timezone_date_bug`), `(select auth.uid())` initplan-hoisted RLS, `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` on every backend-only function.

## Architecture Decisions

### Decision: Candidate selection is **alert-driven**, not roster-driven — a new `get_planning_candidates` RPC

| Option | Tradeoff | Verdict |
|---|---|---|
| Reuse Agent 1's `get_athletes_needing_load_refresh` | Gated on `EXISTS(strava_activities …)` + `computed_at` freshness — selects athletes needing *recomputation*, which is orthogonal to "has an actionable open finding" | Rejected |
| Reuse Agent 2's `get_engagement_candidates` | Correct roster gate, but returns four signal-of-life `MAX()` probes this agent never reads, and returns the *whole* supervised roster | Rejected |
| **New `get_planning_candidates(p_today, p_limit, p_offset)`** | One more RPC to maintain | **Chosen** |

Agent 3 acts **only where a finding already exists**, so its candidate set is not the roster — it is the join of open `training_load_alerts` (types `acwr_zone`/`tsb_critical`/`low_completion` only) with an active `coach_athlete_relationship`, minus athletes who already hold a `pending` suggestion. In practice that is single-digit rows per day, not roster-sized. This is what makes the design's one deliberate N+1 (future-sessions fetch per candidate, below) acceptable where it would not be for Agent 2.

The `coach_athlete_relationship` join is also the **only** thing that keeps independent athletes out — an independent athlete has no row there, so no join, no candidate, no suggestion. It is the same single choke point Agent 2 used, and it is enforced again independently in RLS and in the apply RPC (defense in depth, since `training_load_alerts` itself is not coach-scoped).

Priority ordering happens in the core, not in SQL: the RPC returns *all* open actionable alerts per athlete (up to 3 rows) and `resolveFinding()` picks one. Ordering in SQL would hide the co-fire case from the unit tests.

### Decision: The apply RPC is `LANGUAGE plpgsql` and **returns** a refusal — it never `RAISE`s one

Two independent reasons, both hard:

1. **`LANGUAGE sql` CTE form is unusable here.** This project has found *twice* (Agent 1's `upsert_training_load_alert`, restated in Agent 2's `20260901102000_upsert_engagement_alert_rpc.sql` header) that expressing read-old-value-then-write as a single statement with a `SELECT … FOR UPDATE` CTE alongside the write CTE returns wrong values due to snapshot/CTE-materialization interaction. The drift guard is exactly that pattern, at higher stakes. plpgsql's statement-by-statement execution has no such ambiguity.
2. **A `RAISE` would roll back the `superseded` marking.** On drift the RPC must do two things: refuse the write *and* durably mark the row `superseded`. An exception aborts the whole transaction, discarding the second. So drift returns `(applied := false, refusal_reason := 'snapshot_drift', …)` as a row, and only genuinely exceptional conditions (unauthorized caller, missing suggestion) `RAISE`.

The RPC is the enforcement point for every invariant, not merely the executor of a patch computed elsewhere: it re-verifies the caller's active coach relationship, re-verifies `status = 'planned' AND scheduled_date > p_today` per target, enforces the **field whitelist**, and enforces the **reduction-only invariant** numerically. The core computing only reductions is a correctness property; the RPC refusing to write an increase is a security property.

### Decision: "Removing" a session means converting it to a rest day — the RPC has **no `DELETE` path at all**

| Option | Tradeoff | Verdict |
|---|---|---|
| `DELETE` the trailing sessions | Matches D2's word "drop", but the row is gone: `adjusted_by_agent` / `last_adjustment_id` have nothing to mark, the change is unattributable afterwards, and the snapshot becomes the only record it ever existed | Rejected |
| **Set `training_type='rest'`, volume 0, rest-day copy** | A visible "Descanso" card remains in the week | **Chosen** |

`AIPlanReviewModal.jsx:153-172` (`deleteSession`) *already* does exactly this — deleting a session in the coach's existing plan-review UI replaces it with a rest day rather than removing it. Agent 3 follows the interaction the coach already knows.

The consequence is architecturally large: `insert_recovery` and `reduce_frequency` become the *same* mechanism (`rest_day` op) differing only in target selection and copy, `apply_plan_adjustment` needs one operation type ("set whitelisted fields on an existing row"), and **no code path in this change can delete a `training_sessions` row.** That is a stronger and much cheaper-to-verify guarantee than any scoped-delete predicate — and it is precisely the class of bug `assignPlanToAthletes` has (explicitly out of scope, `src/services/planningService.js` is not touched).

### Decision: Reactive expiry is an `AFTER UPDATE` trigger on `training_load_alerts`, not a client-callable RPC

Same reasoning frame Agent 2 applied, same conclusion, for partly different reasons.

**Coverage.** `training_load_alerts.status` has two live writers: `training-load-monitor`'s `resolveEpisode` (service_role, hysteresis-driven) and the client's `trainingLoadAlertsService.dismiss()`. Wiring expiry at both call sites is two edits today and permanently fragile; a trigger is zero call sites and cannot be bypassed by a future writer.

**Causality, and the asymmetry that makes this safe.** Agent 2 rejected client-assertion because an athlete could `SECURITY DEFINER`-clear their own churn flag from the coach's feed — *hiding information from the coach with no evidence behind it*. Here the direction is inverted: `training_load_alerts` RLS grants self-update, so an athlete dismissing their own alert **will** expire the coach's pending suggestion. That is correct, not a hole. Expiry only ever **withdraws a proposed mutation**; it can never cause one. The failure mode is a coach losing a suggestion whose stated justification was withdrawn — which is D3's intended semantics ("an ACWR that normalises on its own withdraws its own suggestion"), and the next sweep re-proposes it if the finding is still real. A trigger also cannot fire without an actual row write, so causality is DB-side and immutable exactly as in Agent 2.

**Flood safety** (the documented `trg_push_acwr_alert` incident): the trigger only `UPDATE`s `… WHERE status='pending'`, with no push, no `notifications` insert, no fan-out. With no pending row it is one probe of a partial index and zero writes. `WHEN (NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved')` narrows it further.

**Date-based expiry cannot be a trigger** — no row write happens when a date passes. It is a `expire_stale_plan_adjustments(p_today)` RPC called once at the head of each sweep, plus the apply RPC's own `scheduled_date > p_today` re-validation, which is the guard that actually matters.

### Decision: `dias_disponibles` is a jsonb **day-flag map**, not a count

`supabase/athlete_profile.sql:26` — `dias_disponibles jsonb NOT NULL DEFAULT '{}'`, shaped `{"L":true,"M":false,…,"D":true}` (`OnboardingWizard.jsx:58`). The proposal's "floored at `athlete_profile.dias_disponibles`" therefore requires counting truthy values; the core exposes `countAvailableDays()` and returns `null` for `{}`/absent, which degrades the floor to `MIN_SESSIONS_PER_WEEK = 2` per the proposal's dependency note.

Second gotcha: `athlete_profile` is keyed on `user_id`, not `athlete_id`. `athletes.id IS users.id` (`schema.sql:102`), so the lookup is `athlete_profile.user_id = athlete_id` — no join through `athletes`.

### Decision: the kill switch gates **production of suggestions only**, never their approval

`PLANNING_SUGGESTIONS_ENABLED` (default `false`, D5) is OR'd with the request `dryRun` into one `effectiveDryRun`, exactly as `engagement-monitor/index.ts:310` does. It lives in the Edge Function; `apply_plan_adjustment` is SQL and has no env access by construction. Flipping the switch off stops new suggestions and leaves any already-pending one approvable — which is the correct rollback semantic (a coach mid-review is not interrupted, and step 1 of the rollback plan stays lossless).

## Data Flow

```
pg_cron (daily 05:15) ──pg_net + Bearer cron_secret──► planning-agent {mode:'sweep'}
                                                              │
                                            rpc expire_stale_plan_adjustments(today)
                                                              │
                                            rpc get_planning_candidates(today, limit, offset)
   open training_load_alerts (acwr_zone|tsb_critical|low_completion) ──┤
   ⋈ coach_athlete_relationship (active)          ── one query ────────┤
   ANTI-JOIN pending plan_adjustment_suggestions                       │
                                                              ▼
                            per candidate:  future planned sessions  (scheduled_date > today,
                                            status='planned', + adjusted_by_agent, last_adjustment_id)
                                            athlete_profile.dias_disponibles
                                                              │
                                                              ▼
                              evaluateAdjustment(candidate, sessions, profile, today)   (pure core)
                                    resolveFinding → ruleFor(finding) → patch | null
                                                              │  0 or 1 patch
                                                    [effectiveDryRun ⇒ count only]
                                                              ▼
                                   INSERT plan_adjustment_suggestions (status='pending',
                                          patch + snapshot)   ◄── partial unique (athlete_id) WHERE pending
                                                              │           prior pending → 'superseded'
                                                              ▼
                                          notifications insert + best-effort push (coach)

REACTIVE PRODUCE:  training-load-monitor.processAthlete
                     alertType==='acwr_zone' && severity==='danger' && (is_new || escalated)
                       └─ EdgeRuntime.waitUntil(fetch planning-agent {mode:'reactive', alert_id, athlete_id})

REACTIVE EXPIRE:   training_load_alerts UPDATE → status='resolved'
                       └─ AFTER trigger ─► expire_plan_adjustments_for_alert(alert_id)
                                             UPDATE … SET status='expired' WHERE status='pending'

APPLY (the ONLY training_sessions write path):
   coach → PlanAdjustmentReviewModal → planAdjustmentService.approve()
        → rpc apply_plan_adjustment(suggestion_id)
             re-auth coach ▸ re-fetch targets ▸ diff vs snapshot
               drift  → row 'superseded', RETURN (applied=false, refusal_reason)   [0 sessions written]
               clean  → UPDATE each target (whitelist, reduction-checked)
                        + adjusted_by_agent=true, last_adjustment_id
                        → row 'approved'  ▸ RETURN (applied=true, session_ids)
```

## Migration Plan (applied in this order)

| # | File | Contents |
|---|---|---|
| 1 | `..._plan_adjustment_suggestions.sql` | New table (below) + `ENABLE ROW LEVEL SECURITY` + **one** merged SELECT policy + `service_role` ALL + partial unique index + two supporting indexes. `_rollback.sql`, `_verify.sql`. |
| 2 | `..._training_sessions_agent_provenance.sql` | `ADD COLUMN IF NOT EXISTS adjusted_by_agent boolean NOT NULL DEFAULT false`, `ADD COLUMN IF NOT EXISTS last_adjustment_id uuid REFERENCES public.plan_adjustment_suggestions(id) ON DELETE SET NULL`. No backfill — no agent has ever written a session, so `false` is factually correct for every existing row (D4). Must follow #1 for the FK. `_rollback.sql`. |
| 3 | `..._planning_candidates_rpc.sql` | `get_planning_candidates(...)` + `expire_stale_plan_adjustments(p_today)`, both `SECURITY DEFINER`, `SET search_path TO 'public'`, `REVOKE … FROM PUBLIC, anon, authenticated`. `_rollback.sql`. |
| 4 | `..._apply_plan_adjustment_rpc.sql` | `apply_plan_adjustment(p_suggestion_id uuid)` — plpgsql, `SECURITY DEFINER`. Granted to `authenticated` (the coach's modal calls it); authorization is enforced **inside** the body, not by the grant. `_rollback.sql`, `_verify.sql`. |
| 5 | `..._plan_adjustment_reactive_expiry.sql` | `expire_plan_adjustments_for_alert(uuid)` + `tg_expire_plan_adjustments()` + `AFTER UPDATE ON training_load_alerts` trigger. `_rollback.sql`. |
| 6 | `..._pg_cron_planning_sweep.sql` | `cron.unschedule`-by-name-if-exists then `cron.schedule('planning-daily-sweep','15 5 * * *', …)` reading the **already-seeded** Vault secrets — no `vault.create_secret`. 05:15 UTC, 30 min after Agent 2's 04:45 and 60 min after Agent 1's 04:15, so alerts are fresh before Agent 3 reads them. `_rollback.sql`, `_verify.sql`. |

`CHECK` over `ENUM` throughout, per Agent 1's rollback-reversibility rationale (an enum value can never be removed, so a `_rollback.sql` would be unwritable). A **single merged SELECT policy** is mandatory, not stylistic — `20260831130000_merge_training_load_alerts_select_policies.sql` had to collapse two permissive policies to clear the Supabase advisor's "Multiple Permissive Policies" warning; ship in that shape on day one.

**Verify before applying #2 and #4**: `select * from information_schema.triggers where event_object_table = 'training_sessions'` — this repo has a documented history of undocumented triggers (`trg_push_acwr_alert` flood), and `training_sessions` is already known to carry `trg_notify_athlete_training_assigned` (AFTER INSERT) and `trg_notify_coach_training_completed` (AFTER UPDATE). The apply RPC only `UPDATE`s, so the INSERT trigger is irrelevant; the UPDATE trigger's `WHEN` guard must be re-read to confirm it does not fire on a `planned`→`planned` field change.

**V8 RESOLVED 2026-09-01** (see Open Questions below): `training_type` is confirmed live as `{running,gym,rest,cross_training}`; migration 4 uses `training_type='rest'`, not `'descanso'`.

## Interfaces / Contracts

### `plan_adjustment_suggestions`

```
id                  uuid PK DEFAULT uuid_generate_v4()
athlete_id          uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE
coach_id            uuid NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE
triggering_alert_id uuid NOT NULL REFERENCES public.training_load_alerts(id) ON DELETE CASCADE
finding_source      text NOT NULL CHECK (finding_source IN ('acwr_zone','tsb_critical','low_completion'))
patch_type          text NOT NULL CHECK (patch_type IN ('deload_volume','insert_recovery','reduce_frequency'))
patch               jsonb NOT NULL   -- {"sessions":{"<session_uuid>":{"<field>":<new value>, …}, …}}
snapshot            jsonb NOT NULL   -- {"sessions":{"<session_uuid>":{scheduled_date,status,training_type,
                                     --   estimated_duration_minutes,title}, …}}
metrics             jsonb NOT NULL DEFAULT '{}'  -- rule inputs, so the UI never recomputes to render
message_es          text NOT NULL
status              text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','expired','superseded'))
refusal_reason      text            -- set only alongside status='superseded' from a refused apply
earliest_target_date date NOT NULL  -- min(scheduled_date) over targets; drives date-based expiry
created_at          timestamptz NOT NULL DEFAULT now()
decided_at          timestamptz     -- coach pressed approve/reject
resolved_at         timestamptz     -- reached any terminal status (approved/rejected/expired/superseded)
read_at             timestamptz
updated_at          timestamptz NOT NULL DEFAULT now()

UNIQUE INDEX (athlete_id) WHERE status = 'pending'      -- D3: one pending per athlete
INDEX (triggering_alert_id) WHERE status = 'pending'    -- the expiry trigger's probe
INDEX (coach_id, status)                                -- the feed query
```

`coach_id` is denormalized (mirroring `training_load_alerts.recipient_id`) so push targeting needs no second lookup — but **RLS never trusts it**: the policies re-check the live `coach_athlete_relationship`, so a terminated coach loses access even though the column still names them.

RLS — three policies, mirroring `athlete_engagement_alerts` exactly and for the same reason:

| Policy | Role | Predicate |
|---|---|---|
| `…_select_coach` | `authenticated` | `EXISTS (car WHERE car.athlete_id = …athlete_id AND car.coach_id = (select auth.uid()) AND car.status='active')` |
| `…_update_coach` | `authenticated` | same, `USING` + `WITH CHECK` — for `read_at` and the reject path only |
| `…_service_all` | `service_role` | `USING (true) WITH CHECK (true)` |

**No self-select policy, deliberately.** `src/pages/athlete/Dashboard.jsx:174-177` renders the (now source-agnostic) alert feed for every athlete; a self-select policy would show an athlete *"tu plan se va a recortar"* before their coach has decided anything. RLS returning `[]` for a supervised athlete means the merged feed needs **zero client-side role branching**, exactly as with Agent 2. Independent athletes are excluded by the `coach_athlete_relationship` predicate itself — no separate rule needed.

### `supabase/functions/_shared/planAdjustmentCore.js` — zero imports

```js
// ── Named constants (proposal Risk table: "named constants in the pure core,
//    unit-testable, revisit after a month of approve/reject ratios")
export const FINDING_SOURCES   = ['acwr_zone', 'tsb_critical', 'low_completion'];
export const FINDING_PRIORITY  = ['acwr_zone', 'tsb_critical', 'low_completion']; // D2 tie-break order
export const DELOAD_FACTOR             = 0.7;  // acwr_zone danger volume multiplier
export const DELOAD_WINDOW_DAYS        = 7;    // next N days of planned sessions scaled
export const RECOVERY_WINDOW_DAYS      = 3;    // tsb_critical: search horizon for the rest day
export const MIN_SESSIONS_PER_WEEK     = 2;    // reduce_frequency floor
export const VOLUME_FIELDS   = ['estimated_duration_minutes'];  // sole pre-completion volume estimate;
                                                                  // estimated_distance_km does not exist
                                                                  // (confirmed live 2026-09-01)
export const PATCHABLE_FIELDS = [...VOLUME_FIELDS, 'training_type', 'title', 'description'];
export const SNAPSHOT_FIELDS  = ['scheduled_date', 'status', 'training_type',
                                 'estimated_duration_minutes', 'title'];
export const REST_TYPE = 'rest';  // confirmed live 2026-09-01; NOT 'descanso' (see V8)

// ── Helpers
export function countAvailableDays(diasDisponibles);
//   jsonb day-flag map {"L":true,…} → int | null   (null for {}/absent ⇒ floor = MIN_SESSIONS_PER_WEEK)
export function daysBetween(fromDateStr, toDateStr);   // pure string in/out, UTC-anchored (copied shape
                                                       // from engagementCore — NOT imported; zero imports)
export function eligibleSessions(sessions, todayLocal, findingSource);
//   keeps status==='planned' AND scheduled_date > todayLocal
//   drops sessions with adjustedByAgent===true && lastAdjustmentSource===findingSource   (D4 suppression)

// ── The three rules. Each: (finding, eligibleSessions, context) → patch | null
export function ruleDeloadVolume(finding, sessions, ctx);     // acwr_zone danger
export function ruleInsertRecovery(finding, sessions, ctx);   // tsb_critical
export function ruleReduceFrequency(finding, sessions, ctx);  // low_completion

// ── Priority resolution + entry point
export function resolveFinding(openFindings);
//   [{alertType, severity, metrics}] → the single winner by FINDING_PRIORITY, or null.
//   acwr_zone qualifies ONLY when metrics.zone === 'danger' (caution is the observation
//   point, D2). CORRECTED 2026-09-01: `training_load_alerts.severity` is CHECK-constrained
//   to 'warning'/'critical' only (supabase/migrations/20260819142000_training_load_alerts.sql)
//   — there is no literal 'danger' severity value in the schema. The acwr zone lives in
//   `metrics.zone` (produced by trainingLoadCore.js's acwrZone()), never in `severity`.
export function evaluateAdjustment(candidate, sessions, profile, todayLocal);
//   candidate: { athleteId, coachId, openFindings: [...] }
//   sessions:  [{ id, scheduled_date, status, training_type, estimated_duration_minutes,
//                 title, description, adjustedByAgent, lastAdjustmentSource }]
//   profile:   { diasDisponibles }  (jsonb day-flag map, or null)
//   → null | { findingSource, patchType, triggeringAlertId, earliestTargetDate,
//              patch:    { sessions: { [id]: {field: newValue} } },
//              snapshot: { sessions: { [id]: {SNAPSHOT_FIELDS…} } },
//              metrics, messageEs }
//
//   Mirrors evaluateLoad()/evaluateEngagement(): pure, short-circuiting, returns the
//   finding shape the I/O layer persists verbatim. Returns null when no rule produces
//   a target set (an empty patch is never a suggestion).
```

Every rule builds its patch through one shared `buildPatch(targets, mutate)` helper that (a) restricts writes to `PATCHABLE_FIELDS`, (b) captures `SNAPSHOT_FIELDS` for every target, and (c) **asserts the reduction-only invariant** — for each `VOLUME_FIELDS` entry, `newValue <= oldValue`; no session id may appear in `patch` that is absent from `snapshot`. A rule that violates it returns `null` rather than a bad patch, so the invariant is a property of the module, not of each rule's diligence. `insert_recovery` and `reduce_frequency` share a `toRestDay(session)` mutator (`training_type: 'rest'`, both volume fields `0`, `title: 'Descanso'`, `description: 'Día de recuperación completa'`) — the same visible-rest-day *interaction* as `AIPlanReviewModal.deleteSession`, though that component's own in-memory draft state uses the Spanish label `'descanso'`, never actually persisted (see V8).

The core never sees a Supabase client, React, or a Deno API. `todayLocal` is derived by `index.ts` from `Europe/Madrid`.

### `get_planning_candidates(p_today date, p_limit int DEFAULT 100, p_offset int DEFAULT 0)`

```sql
SELECT tla.athlete_id, car.coach_id, tla.id AS alert_id,
       tla.alert_type, tla.severity, tla.metrics, tla.created_at
FROM public.training_load_alerts tla
JOIN public.coach_athlete_relationship car
  ON car.athlete_id = tla.athlete_id AND car.status = 'active'
WHERE tla.status = 'open'
  AND tla.dismissed_at IS NULL
  AND tla.alert_type IN ('acwr_zone','tsb_critical','low_completion')
  AND NOT EXISTS (SELECT 1 FROM public.plan_adjustment_suggestions pas
                   WHERE pas.athlete_id = tla.athlete_id AND pas.status = 'pending')
ORDER BY tla.athlete_id, tla.alert_type
LIMIT p_limit OFFSET p_offset;
```

Multiple rows per athlete are intentional (the co-fire case); `index.ts` groups by `athlete_id` before calling the core. `LIMIT/OFFSET` paginate **alert rows**, so `index.ts` must not split an athlete's group across pages — it drops a trailing partial group and lets the next page pick it up, and self-chains via `EdgeRuntime.waitUntil` on a full page, mirroring `chainNextSweepPage` verbatim.

### `apply_plan_adjustment(p_suggestion_id uuid)` — the only write path

`RETURNS TABLE (applied boolean, refusal_reason text, session_ids uuid[])`, `LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'`. Granted to `authenticated`; **`REVOKE … FROM PUBLIC, anon`**.

```
1. SELECT … FROM plan_adjustment_suggestions WHERE id = p_suggestion_id FOR UPDATE
     not found                → RAISE (a hard error: the client sent a bad id)
     status <> 'pending'      → RETURN (false, 'not_pending', '{}')
2. Authorize: current_user is service_role
     OR EXISTS (car WHERE athlete_id = suggestion.athlete_id
                      AND coach_id = (select auth.uid()) AND status = 'active')
     else                     → RAISE insufficient_privilege
3. v_today := (now() AT TIME ZONE 'Europe/Madrid')::date   -- see correction below
   For every session id in snapshot.sessions:
     SELECT … FROM training_sessions WHERE id = <id> FOR UPDATE
     missing, OR status <> 'planned', OR scheduled_date <= v_today,
     OR any SNAPSHOT_FIELD IS DISTINCT FROM its snapshot value
                              → drift
4. drift → UPDATE suggestion SET status='superseded', refusal_reason='snapshot_drift',
                                 resolved_at=now(), decided_at=now()
           RETURN (false, 'snapshot_drift', '{}')          -- ZERO sessions written
5. clean → per target, UPDATE training_sessions SET <whitelisted patch fields>,
             adjusted_by_agent = true, last_adjustment_id = p_suggestion_id
           reject (RAISE) any patch field outside the whitelist, or any volume field
             whose new value exceeds the snapshot value
           UPDATE suggestion SET status='approved', decided_at=now(), resolved_at=now()
           RETURN (true, NULL, <ids>)
```

**Correction (2026-09-01, found during Phase 2 `sdd-apply`, no live-DB access to verify but fixed
here for consistency):** step 3 above referenced `p_today` as if it were a function parameter,
but the function's own signature (`apply_plan_adjustment(p_suggestion_id uuid)`, one line above)
and the frontend's call site (`supabase.rpc('apply_plan_adjustment', {p_suggestion_id})`, see
Frontend section below) both pass only the suggestion id — no `p_today` parameter exists
anywhere else in this design. `20260901113000_apply_plan_adjustment_rpc.sql` resolves "today"
internally via `v_today := (now() AT TIME ZONE 'Europe/Madrid')::date`, matching this project's
established Europe/Madrid local-date rule (the JS-side `Intl.DateTimeFormat('sv-SE', {timeZone:
'Europe/Madrid'})` convention used throughout Agents 1-3's Edge Functions) rather than relying on
the Postgres server's session timezone (`CURRENT_DATE`, which on Supabase is UTC and would
disagree with Europe/Madrid by up to 2 hours around local midnight).

**V8 RESOLVED live 2026-09-01** (orchestrator, before migration 4 was applied):
`training_sessions.training_type` IS the `supabase/schema.sql` ENUM `training_type` with values
`('running','gym','rest','cross_training')` — confirmed via `information_schema.columns` against
production, plus live data (`running`=183, `gym`=24, `cross_training`=2, `rest`=1 rows) confirming
no row has ever held `'descanso'`. `src/components/dashboard/AIPlanReviewModal.jsx`'s
`'descanso'`/`'carrera'` are client-side draft-plan-JSON labels only — the actual insert path
(`src/services/planningService.js`'s `assignPlanToAthletes`) hardcodes `training_type='running'`
for every session regardless of type (a separate, pre-existing bug — out of scope for this
change, `planningService.js` is explicitly not touched, per the proposal). So `'descanso'` has
never actually reached this column in production. `planAdjustmentCore.js`'s `REST_TYPE` was wrong
at `'descanso'` and has been corrected to `'rest'` — fixed in Phase 1's already-merged code and
tests before Phase 2's migrations were applied, so no migration ever ran with the wrong value.

Steps 3–5 run in one implicit transaction, so the patch lands atomically or not at all (D3). `FOR UPDATE` on both the suggestion and every target serializes a double-click and a concurrent sweep.

**Numeric-comparison gotcha**: compare snapshot values by casting out of jsonb to the column's own type (`(snap->>'estimated_duration_minutes')::numeric`), never as jsonb or text — jsonb `70` and `70.0` are distinct as text and equal as numeric, and a false drift refusal is a silent feature failure.

### Reactive expiry

```sql
CREATE FUNCTION public.expire_plan_adjustments_for_alert(p_alert_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.plan_adjustment_suggestions
     SET status='expired', resolved_at=now(), updated_at=now()
   WHERE triggering_alert_id = p_alert_id AND status = 'pending';
$$;
REVOKE EXECUTE ON FUNCTION public.expire_plan_adjustments_for_alert(uuid)
  FROM PUBLIC, anon, authenticated;
```

Trigger: `AFTER UPDATE ON public.training_load_alerts FOR EACH ROW WHEN (NEW.status='resolved' AND OLD.status IS DISTINCT FROM 'resolved') EXECUTE FUNCTION public.tg_expire_plan_adjustments()`. This covers dismissal too, because `trainingLoadAlertsService.dismiss()` sets `status:'resolved'` alongside `dismissed_at` (the fix Agent 1's `sdd-verify` pass confirmed necessary and Agent 2 carried over) — one trigger, both events, no second `WHEN` branch.

### `planning-agent` Edge Function

`POST /functions/v1/planning-agent`, `verify_jwt = false`, auth accepts `Bearer CRON_SECRET` **or** `Bearer SERVICE_ROLE_KEY` via `logic.js`'s `isAuthorized` (identical to both prior agents).

| Mode | Body | Behaviour |
|---|---|---|
| `sweep` | `{mode:'sweep', limit?, offset?, dryRun?}` | `expire_stale_plan_adjustments(today)` → `get_planning_candidates` page → group by athlete → per athlete fetch future sessions + profile → `evaluateAdjustment` → persist → self-chain on full page |
| `reactive` | `{mode:'reactive', alert_id, athlete_id}` | Single athlete. Re-reads the athlete's open actionable alerts (so the priority rule still applies — a reactive `acwr_zone` danger must not bypass a co-firing evaluation) and runs the identical per-athlete path. |

`index.ts` = I/O only (Supabase queries/RPCs, push, chaining, `todayLocalStr()`); `logic.js` = pure (`isAuthorized`, `groupCandidatesByAthlete`, `mapSessionRow`, `summarizeSweep`) and imports only `../_shared/planAdjustmentCore.js`, so it runs unmodified under `node --test`. Exactly the `engagement-monitor` split.

Persisting a suggestion when a stale `pending` row exists (the `superseded` path of D3) is a two-statement sequence inside one `.rpc()`-free transaction is not available from PostgREST — so persistence goes through a small `upsert_plan_adjustment_suggestion(...)` plpgsql RPC that marks any existing `pending` row `superseded` then inserts, in that order, avoiding a partial-unique-index violation. This is the same plpgsql-over-CTE rule as everywhere else in this repo.

### `training-load-monitor` outbound call site

Inside `processAthlete`'s `for (const alertType of ALERT_TYPES)` loop (`index.ts:280-315`), immediately after the existing `deliverPush` gate:

```ts
if (alertType === "acwr_zone" && decision.finding.metrics?.zone === "danger"
    && result && (result.is_new || result.escalated)) {
  triggerPlanningAgent(athleteId, result.alert_id);
}
```

**Correction (2026-09-01, found during Phase 1 `sdd-apply`):** the gate was originally
written as `decision.finding.severity === "danger"`. That condition can never be true —
`training_load_alerts.severity` is CHECK-constrained to `'warning'`/`'critical'` only
(`supabase/migrations/20260819142000_training_load_alerts.sql`), and `evaluateLoad()` in
`trainingLoadCore.js` never emits a `'danger'` severity. The acwr zone
(`'danger'`/`'caution'`/`'optimal'`/`'undertraining'`) is carried in `finding.metrics.zone`
(set by `acwrZone()`), not in `finding.severity`. `planAdjustmentCore.js`'s `resolveFinding()`
was implemented against `metrics.zone` from the start (see its Interfaces block above); this
call site — Phase 4, not yet implemented — must gate on the same field for consistency.

Gating on `is_new || escalated` — the same race-safe RPC-derived flags the push already uses, never the pre-write `decision` — means a daily *refresh* of an already-open danger alert does **not** re-fire the agent. The one-pending-per-athlete index would absorb a duplicate anyway; this avoids the wasted invocation.

`triggerPlanningAgent` copies `chainNextSweepPage`'s shape verbatim: `fetch(...)` with `.then(logEvent).catch(logEvent)` attached **before** being handed to `EdgeRuntime.waitUntil` inside a `try/catch`, authorized with `Bearer ${CRON_SECRET || SERVICE_ROLE_KEY}` from env. Zero awaits on the alerting path; a pre-attached `.catch` prevents an unhandled rejection from tearing down the isolate. Per the proposal's risk table, **failure here must not fail alert creation** — the sweep picks the athlete up the next morning.

## Frontend

**Correction (2026-09-03, found during Phase 5 `sdd-apply`):** this section originally named the
list function `getSuggestions` and the diff shape included a `distanceKm` field. Both are fixed
below: the shipped function is `getPlanAdjustments` (functionally identical to `getSuggestions`,
renamed for clarity between "suggestion" as a DB-row noun and "get the athlete's plan
adjustments" as the service's verb — a naming choice made while authoring
`planAdjustmentService.js` and `alertFeedService.js` together in the same batch, not a
cross-file compatibility break), and `distanceKm` is dropped from the diff shape entirely —
`estimated_distance_km` does not exist on `training_sessions` (V4, resolved 2026-09-01, already
reflected in `VOLUME_FIELDS`/`SNAPSHOT_FIELDS` above) so it was never a real field to diff in the
first place; this Frontend section's `diffs` example just hadn't been updated to match V4's fix
in the rest of the document.

| File | Action | Description |
|---|---|---|
| `src/services/planAdjustmentService.js` | Create | `getPlanAdjustments(athleteId, {status})`, `markRead(id)` — line-for-line parallel to `athleteEngagementAlertsService.js`. Plus `approve(id)` → `supabase.rpc('apply_plan_adjustment', {p_suggestion_id})` returning `{applied, refusalReason, sessionIds}`, and `reject(id)` → plain `UPDATE status='rejected', decided_at, resolved_at` under the coach UPDATE policy (no RPC — rejection writes no session). |
| `src/services/alertFeedService.js` | Modify | Third source. `Promise.all` gains `getPlanAdjustments(athleteId, {status:'pending'})`; `mapPlanSuggestion` emits `{id, source:'plan_suggestion', label:'Ajuste de plan: <patch_type fragment>', tone:'action', messageEs, createdAt, readAt, dismissedAt:null, payload}`. `tone:'action'` (not `'warning'`) is a deliberate correction — a plan suggestion needs a coach *decision*, not just an acknowledgement, so it gets its own `SEVERITY_CLASSES` entry in `TrainingLoadAlertFeed.jsx` rather than being visually folded into the same tone as a read-only physiological alert. `markRead`/`dismiss` dispatch on `item.source` as they already do — `dismiss` on a suggestion maps to `reject` (kept for dispatcher completeness; the feed row itself does not expose a dismiss (×) button for `plan_suggestion` — see next row). |
| `src/components/shared/TrainingLoadAlertFeed.jsx` | Modify | Render `source==='plan_suggestion'` rows with a "Revisar" action opening the modal, no dismiss (×) button (a suggestion's only terminal actions are approve/reject, both inside the modal — a one-click dismiss would let a coach discard a plan change without seeing the diff first). `SEVERITY_CLASSES` gains an `action` entry; `ALERT_LABEL_CONFIG` is not extended for `plan_suggestion` (its label varies per `patch_type`) — icon selection branches on `alert.source` instead. |
| `src/components/dashboard/PlanAdjustmentReviewModal.jsx` | Create | Diff view + approve/reject. |
| `src/pages/dashboard/AthleteProfile.jsx` | Modify | Mark sessions with `adjusted_by_agent === true` (badge only). The session query itself needed no change — `weeklyTrainingService.js`'s `getAthleteWeeklyTraining` already does `select('*')` on `training_sessions`, so the two provenance columns were already coming through; only `useAthleteProfileData.js`'s `coachTrainingTransform` (which narrows each row to a fixed view-model before `AthleteProfile.jsx` ever sees it) needed to carry `adjusted_by_agent` through. |
| `src/services/planningService.js` | **Unchanged** | Explicitly not touched (proposal Out of Scope). Verifiable by diff. |

`PlanAdjustmentReviewModal` data contract — modeled on `AIPlanReviewModal`'s `{isOpen, onClose, …, onAssigned}` shape, but **read-only over the diff** (the coach approves or rejects the computed patch; editing it would invalidate the snapshot guard and is not in slice 1):

```js
<PlanAdjustmentReviewModal
  isOpen onClose
  suggestion={{ id, findingSource, patchType, messageEs, metrics, earliestTargetDate, createdAt, patch, snapshot }}
  athleteName
  onApplied={(result) => …}   // result: {applied, refusalReason, sessionIds}
/>
```

`suggestion` is passed as the raw `plan_adjustment_suggestions` row (`alertFeedService.js`'s
`payload`); the modal derives `diffs` internally via its own `buildDiffs(suggestion)` rather than
taking a pre-computed `diffs` prop — one fewer thing for the caller to keep in sync. Each diff is
`{ sessionId, scheduledDate, before: {trainingType, durationMinutes, title}, after:
{trainingType, durationMinutes, title}, descriptionAfter, changedFields }` — **no `distanceKm`**
(see this section's correction note above). `description` is patchable but not part of
`SNAPSHOT_FIELDS`, so it cannot be diffed before/after; it is surfaced as an after-only
supplementary line (`descriptionAfter`) instead of a fabricated before/after pair.

`diffs` is derived **client-side from the suggestion's own `patch` + `snapshot`** — never by
re-querying `training_sessions`. That keeps the modal showing exactly what the coach is being
asked to approve, and makes the refusal path meaningful: if the live data has drifted, the RPC
refuses and the modal surfaces *"El plan cambió desde que se calculó esta sugerencia"*, rather
than silently rendering fresh values that were never what the agent proposed.

**Correction — `AIPlanReviewModal`'s `DAY_MAP`/`TYPE_CONFIG` are NOT reused, despite this
section's original wording.** Both are keyed off that modal's own in-memory *draft* plan-JSON
vocabulary (`training_type: 'carrera'|'gimnasio'|'descanso'`, `day_of_week: 'monday'|…`), which
per V8 is never what actually reaches `training_sessions` (the real INSERT path hardcodes
`training_type='running'` regardless — a separate, out-of-scope, pre-existing bug in
`planningService.js`). `plan_adjustment_suggestions.patch`/`snapshot` diff the REAL
`training_sessions` row shape instead: the real ENUM (`running|gym|rest|cross_training`) and real
`scheduled_date` values. `PlanAdjustmentReviewModal` therefore reuses `getTypeLabel`/
`getTypeColor` from `src/lib/athleteUtils.js` instead — already keyed off that exact real
vocabulary (it is what `AthleteProfile.jsx`'s own week grid uses) — and computes its day label
directly from each diff's real `scheduledDate` rather than from a `day_of_week` string. This is
not a stylistic swap: reusing `AIPlanReviewModal`'s constants as originally written would have
rendered every "Carrera"/"Descanso" card as a literal untranslated `running`/`gym`/`rest` string
(TYPE_CONFIG has no entry for those keys), a real bug this correction avoids. `INTENSITY_CONFIG`
remains correctly excluded — `intensity` is not a `training_sessions` column (D1).

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Reduction-only invariant across the **full** finding × session-shape matrix — no patch ever raises a volume field, adds a session id absent from the snapshot, or moves `scheduled_date` | `node --test` over `supabase/functions/_shared/planAdjustmentCore.test.js`, `npm run test:core` (Agent 1's harness, zero new deps). This is the proposal's headline success criterion. |
| Unit | `resolveFinding` priority: acwr danger + tsb + low_completion co-firing yields exactly one patch, the acwr one; acwr **caution** yields none | table-driven, one row per D2 line |
| Unit | Each rule's targeting: 7-day window, 3-day highest-volume pick, trailing-drop floor at `max(2, countAvailableDays)` and at completed count | fixture session arrays |
| Unit | `countAvailableDays` over `{}`, absent, all-false, mixed — degrades to `MIN_SESSIONS_PER_WEEK` | pure in/out |
| Unit | `eligibleSessions`: excludes `completed`/`skipped`, excludes `scheduled_date <= today`, excludes same-source `adjusted_by_agent` rows (D4 anti-undo) | direct assertion |
| Unit | `evaluateAdjustment` returns `null` for an empty target set (never an empty patch) | direct assertion |
| Integration | Drift guard: seed a pending suggestion, mutate one target session, call the RPC → `applied=false`, `refusal_reason='snapshot_drift'`, **zero** rows in `training_sessions` changed, suggestion `superseded` | `_verify.sql` |
| Integration | Happy path: all fields applied, `adjusted_by_agent`/`last_adjustment_id` stamped on every touched row, suggestion `approved`; numeric `70` vs `70.0` snapshot does **not** false-refuse | `_verify.sql` |
| Integration | One-pending-per-athlete: two sweeps produce one pending row, the first `superseded` | fixture sequence |
| Integration | Reactive expiry: open alert + pending suggestion → resolve the alert → suggestion `expired`, zero sweeps run; and again via the client `dismiss()` path | `_verify.sql` |
| Manual | RLS under three JWTs — the coach sees the row, **the athlete does not**, another coach does not; `apply_plan_adjustment` raises for a coach without an active relationship; `get_planning_candidates` is not callable as `authenticated` | `_verify.sql` |
| Manual | `information_schema.triggers` on `training_sessions` reviewed before the first live approval (documented prior incident) | pre-apply gate |
| Manual | Dry-run sweep counts **per rule** reviewed before `PLANNING_SUGGESTIONS_ENABLED=true` | proposal-mandated gate |
| Grep | No write to `training_sessions` outside `apply_plan_adjustment`; `planAdjustmentCore.js` has zero imports; `planningService.js` diff is empty | CI-checkable assertions |

## Rollout / Rollback

1. **Slice 1 — schema + core, zero behaviour.** Migrations 1–4, `planAdjustmentCore.js` + unit tests. Nothing produces or applies anything.
2. **Slice 2 — agent silent.** `planning-agent` deployed with `PLANNING_SUGGESTIONS_ENABLED=false`, migrations 5–6. Run `{mode:'sweep', dryRun:true}` manually, review per-rule counts, then flip the flag.
3. **Slice 3 — coach surfaces.** `planAdjustmentService`, feed third source, `PlanAdjustmentReviewModal`, adjusted-session marker, and the `training-load-monitor` reactive call.

Rollback maps 1:1 to the proposal: flip the flag (instant, silent, already the default) → `cron.unschedule('planning-daily-sweep')` + revert the `training-load-monitor` call → revert the UI commit (the feed degrades to the two-source Agent 1 + Agent 2 view with no change to their rows) → drop `apply_plan_adjustment` (with it gone, nothing in the repo can write a patch) → `_rollback.sql` on the table. The two `training_sessions` columns are additive and nullable; **already-approved patches are not reverted** — they are legitimate coach-approved plan edits, and `last_adjustment_id` records which rows they were.

## Open Questions — all resolved live 2026-09-01 (project `lusirdkixfliydimemre`), before `sdd-apply`

- [x] `training_sessions.status` — corrected: it is a genuine Postgres ENUM `training_status` (`planned`,`in_progress`,`completed`,`skipped`), not the `{'planned','completed'}` Agent 1 supposedly verified (only those two currently have live rows, but `skipped` is a valid value with no CHECK-constraint issue). No change needed: `status = 'planned'` already excludes `skipped`/`in_progress`/`completed`, no extra predicate required in `eligibleSessions`.
- [x] `estimated_distance_km` does **not** exist on `training_sessions` — confirmed via `information_schema.columns`. `rpe_score` (smallint) does exist. `VOLUME_FIELDS`/`SNAPSHOT_FIELDS`/`PATCHABLE_FIELDS` above, and every spec/proposal reference, corrected to drop it — `estimated_duration_minutes` is the sole volume lever.
- [x] `trg_notify_coach_training_completed` — read its function body: it has its own internal guard (`IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')`). The apply RPC's `planned`→`planned` updates cannot satisfy `NEW.status = 'completed'`, so this trigger never fires from an approved patch. No workaround needed.
- [x] `athlete_profile` coverage for coach-supervised athletes — measured: 2 of 2 active `coach_athlete_relationship` rows have a matching `athlete_profile` row (100% coverage today). Sample is tiny (this project is still in its testing phase per Agent 2's own finding), so this is not a strong signal either way for the `reduce_frequency` floor at scale — re-measure once the roster grows, don't calibrate `MIN_SESSIONS_PER_WEEK` off this number.
- [x] `athlete_profile.user_id` — no explicit FK constraint was found on `athlete_profile` at all (a `pg_constraint`/`information_schema` check for a foreign key off `user_id` returned zero rows — a minor pre-existing data-integrity gap, out of scope to fix here). The join is still safe in practice: joining `athlete_profile.user_id` against `coach_athlete_relationship.athlete_id` for the 2 live active relationships matched both rows, confirming the value space is the same uuid identity (`auth.users(id)` == `athletes.id` == `users.id` in this schema, per the FK convention documented for Agents 1/2).
- [x] **V8 (found during Phase 2 `sdd-apply`, resolved live by the orchestrator immediately after, 2026-09-01):** `training_sessions.training_type` is confirmed live as the `supabase/schema.sql` ENUM `('running','gym','rest','cross_training')` (`information_schema.columns`, plus live row counts: `running`=183, `gym`=24, `cross_training`=2, `rest`=1 — zero rows have ever held `'descanso'`). `AIPlanReviewModal.jsx`'s `'descanso'`/`'carrera'` are draft-plan-JSON/UI labels only, never actually persisted (the real insert path, `planningService.js`'s `assignPlanToAthletes`, hardcodes `training_type='running'` for every session — a separate, out-of-scope, pre-existing bug). `planAdjustmentCore.js`'s `REST_TYPE` was wrong at `'descanso'` and is corrected to `'rest'` (Phase 1's already-merged code, tests, and this document, all fixed before migration 4 was applied — no migration ever ran against the wrong value).
