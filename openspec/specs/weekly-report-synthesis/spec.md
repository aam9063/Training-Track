# Weekly Report Synthesis Specification

## Purpose

Defines the cross-agent synthesis contract that this change adds to `weekly-ai-reports`: the three per-athlete input sources a report MUST read, the causal-narrative requirement over those sources, alert-level derivation across three severity vocabularies, the `sweep`/`athlete` invocation modes and their week windows, the same-week dedup guard, both kill switches, coach-supervised-only scope, the authorization tightening, and the no-athlete-facing-output invariant. It does not specify the shipped prompt's PMC/Strava/diary/competition-prediction content — only the behavior this change owns.

## Requirements

### Requirement: Three-Source Input Contract

`processAthlete` MUST read three sources for each athlete in its existing parallel query block: open `training_load_alerts`, open `athlete_engagement_alerts`, and pending or recently-applied `plan_adjustment_suggestions`. Absence of rows in any source MUST NOT fail report generation.

#### Scenario: All three sources are queried per athlete
- GIVEN `processAthlete` runs for an athlete
- WHEN its parallel query block executes
- THEN it queries `training_load_alerts`, `athlete_engagement_alerts`, and `plan_adjustment_suggestions` for that athlete

#### Scenario: Missing signals from one source do not block the report
- GIVEN an athlete has open `training_load_alerts` but no `athlete_engagement_alerts` or `plan_adjustment_suggestions` rows
- WHEN the report is generated
- THEN the report completes using only the available sources

### Requirement: Causal Cross-Agent Narrative

When an athlete has signals from two or more of the three sources, the prompt MUST instruct the model to produce one causal explanation crossing the sources, not three separate per-source observations. `resumen`, `alertas[]`, and `recomendaciones[]` remain the only carriers of this content — no new top-level response key is introduced.

#### Scenario: Multi-agent signals yield one causal narrative
- GIVEN an athlete has an open `acwr_zone` alert and an open `danger` `engagement_silence` alert in the same week
- WHEN the report is generated
- THEN `ai_analysis.resumen` references both signals as one causal explanation, not as two unrelated observations

### Requirement: Alert Level Derivation Across Three Vocabularies

`alertLevelFromOpenAlerts` MUST widen to accept findings from all three sources and MUST normalize an open `athlete_engagement_alerts` row at severity `danger` to the report's `critical` tier, mirroring `alertFeedService.mapEngagementAlert`.

#### Scenario: Engagement danger alone yields report-level critical
- GIVEN an athlete has an open `engagement_silence` alert at `danger` and no `training_load_alerts`
- WHEN `alertLevelFromOpenAlerts` runs
- THEN it returns `critical`, not `ok`

#### Scenario: Engagement warning does not escalate report level to critical
- GIVEN an athlete has only an open `engagement_silence` alert at `warning`
- WHEN `alertLevelFromOpenAlerts` runs
- THEN it returns `attention`, not `critical`

### Requirement: The Model's Alert Level Never Downgrades the Deterministic Level

`processAthlete` currently lets the model's own `nivel_alerta` field unconditionally overwrite the deterministic `alertLevelFromOpenAlerts` result before it is persisted — a real, pre-existing behavior confirmed live against `weekly-ai-reports/index.ts`. Because `alertLevelFromOpenAlerts` is widened by this change to derive `critical` from engagement/plan-adjustment signals it did not previously read, an unconstrained overwrite can silently downgrade that result on a single unfavorable Gemini sample, defeating this change's own headline guarantee (an athlete with an open `danger` engagement alert MUST report `critical`). The final persisted `alert_level` MUST never be lower-severity than the deterministic `alertLevelFromOpenAlerts` result — the model's `nivel_alerta` MUST only ever raise the level, never lower it, when `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED` is `true`.

#### Scenario: A lower-severity model response does not downgrade a deterministic critical
- GIVEN `alertLevelFromOpenAlerts` deterministically returns `critical` for an athlete
- AND the model's `nivel_alerta` for that same report is `attention`
- WHEN the report is persisted
- THEN `alert_level` is `critical`, not `attention`

#### Scenario: A higher-severity model response is honored
- GIVEN `alertLevelFromOpenAlerts` deterministically returns `attention`
- AND the model's `nivel_alerta` for that same report is `critical`
- WHEN the report is persisted
- THEN `alert_level` is `critical`

### Requirement: `sweep`/`athlete` Invocation Modes and Week Windows

The function MUST accept `mode: 'sweep' | 'athlete'` on the request body, defaulting to `sweep` when absent so the existing cron body and `triggerWeeklyReports` are unaffected. `mode: 'athlete'` MUST additionally accept `athlete_id` and MUST compute the CURRENT week (Monday of the week containing "now"), not the digest's default last-completed week.

#### Scenario: Absent mode defaults to sweep with unchanged behavior
- GIVEN a request body with no `mode` field
- WHEN the function processes it
- THEN it behaves as `mode: 'sweep'` over the last completed week, unchanged from pre-change behavior

#### Scenario: mode athlete uses the current week
- GIVEN a request with `mode: 'athlete'` and an `athlete_id`, sent mid-week
- WHEN the function computes the report window
- THEN it uses the current in-progress week, not the previous completed week

### Requirement: Same-Week Dedup Guard

Before calling Gemini in `mode: 'athlete'`, the function MUST check for an existing `weekly_ai_reports` row at `(athlete_id, current week_start)` with `status = 'completed'`. If found, it MUST return `{ skipped: 'already_reported_this_week' }` and MUST NOT call Gemini.

#### Scenario: Second reactive call in the same week is skipped
- GIVEN a completed `weekly_ai_reports` row already exists for an athlete at the current week's `week_start`
- WHEN a second `mode: 'athlete'` call arrives for that athlete in the same week
- THEN no Gemini call is made and the function returns `{ skipped: 'already_reported_this_week' }`

#### Scenario: First reactive call in a week proceeds normally
- GIVEN no `weekly_ai_reports` row exists for an athlete at the current week's `week_start`
- WHEN a `mode: 'athlete'` call arrives
- THEN the function calls Gemini and upserts the row on `(athlete_id, week_start)`

### Requirement: Coach-Supervised-Only Scope

Neither `mode` MUST generate a report for an athlete without an active `coach_athlete_relationship`.

#### Scenario: Independent athlete is never processed
- GIVEN an athlete with no active coach relationship
- WHEN either `sweep` or `athlete` mode runs
- THEN no `weekly_ai_reports` row is generated for that athlete

### Requirement: Two Kill Switches With a Hard Digest Invariant

`WEEKLY_REPORT_WIDE_CONTEXT_ENABLED` MUST default `true`; when `false`, `processAthlete` MUST degrade to reading only `training_load_alerts`, matching pre-change behavior. `WEEKLY_REPORT_REACTIVE_ENABLED` MUST default `false`; when `false`, `mode: 'athlete'` invocations MUST be rejected or no-op. Neither gate MUST be capable of disabling the Monday `sweep` digest.

#### Scenario: Wide-context gate off restores pre-change input
- GIVEN `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=false`
- WHEN the Monday digest runs
- THEN `processAthlete` reads only `training_load_alerts`, producing output byte-equivalent in shape to a pre-change run

#### Scenario: Reactive gate off blocks athlete mode without affecting the digest
- GIVEN `WEEKLY_REPORT_REACTIVE_ENABLED=false` (the default)
- WHEN a `mode: 'athlete'` call arrives
- THEN no report is generated for that call
- AND the next Monday `sweep` digest still runs and produces reports for all eligible athletes

### Requirement: Authorization Tightening for `coach_id` and `mode: 'athlete'`

When the caller authenticates via a plain user JWT (not `x-supabase-cron-job` and not the service-role Bearer token), the request's `coach_id` MUST equal the authenticated user's id — an absent `coach_id` MUST also be rejected, not treated as an implicit "use my own id", since omitting it today silently sweeps every coach's roster (the pre-existing hole this requirement closes: no check tied the caller's identity to the requested `coach_id` at all). `mode: 'athlete'` MUST be reachable only by the cron header or the service-role Bearer token; a plain user JWT requesting `mode: 'athlete'` MUST be rejected.

#### Scenario: User JWT requesting another coach's id is rejected
- GIVEN a user JWT for coach A
- WHEN the request body sets `coach_id` to coach B's id
- THEN the request is rejected

#### Scenario: User JWT with no coach_id is rejected, not treated as an implicit self-request
- GIVEN a user JWT for coach A
- WHEN the request body omits `coach_id` entirely
- THEN the request is rejected

#### Scenario: mode athlete is unreachable via user JWT
- GIVEN a valid user JWT (not cron, not service-role)
- WHEN the request sets `mode: 'athlete'`
- THEN the request is rejected

#### Scenario: Cron and service-role callers are unaffected
- GIVEN a request carries `x-supabase-cron-job: true` or a service-role Bearer token
- WHEN it sets `mode: 'athlete'` and any `coach_id`
- THEN the request is processed normally, as before this change

### Requirement: Athlete-Visible Analysis Never Includes Wide-Context Signals

`weekly_ai_reports` carries a pre-existing RLS SELECT policy allowing an athlete to read their own row. Because of this, the analysis surfaced to an athlete reading their own report MUST have been generated from a `callDeepSeek` invocation whose input never included `athlete_engagement_alerts` or `plan_adjustment_suggestions` data (i.e. `wide_context: false`, `engagement_alerts: []`, `plan_adjustments: []`), regardless of what the coach-facing analysis for the same row contains. This MUST hold even when the coach-facing analysis for the same report is `critical` or explicitly mentions engagement/plan-adjustment signals. The persisted athlete-safe columns (`ai_analysis_athlete_safe`, `summary_athlete_safe`) MUST NOT be derived by post-processing, redacting, or instructing the model to omit content from the wide-context output — the guarantee is enforced by what data was ever sent to the model for that specific stored output, not by an instruction inside the prompt.

#### Scenario: Athlete-safe analysis excludes wide-context signals even when the coach-facing analysis is critical and explicit about them

- GIVEN `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true`
- AND an athlete has an open `danger` `engagement_silence` alert and a `pending` `plan_adjustment_suggestion`
- AND the coach-facing `ai_analysis` for that athlete's report is `critical` and its `resumen` explicitly names both signals in a causal narrative
- WHEN `ai_analysis_athlete_safe`/`summary_athlete_safe` are generated for the same report
- THEN they were produced by a separate `callDeepSeek` call whose `weekData` had `wide_context: false`, `engagement_alerts: []`, and `plan_adjustments: []`
- AND this holds regardless of what the coach-facing `ai_analysis`/`summary` for the same row contains

#### Scenario: WIDE_CONTEXT_ENABLED=false leaves no exposure gap

- GIVEN `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=false`
- WHEN a report is generated
- THEN `ai_analysis_athlete_safe`/`summary_athlete_safe` are not populated by a second call (the single `ai_analysis`/`summary` produced is already narrow)
- AND the resolved value contains no wide-context content by construction of the `WIDE_CONTEXT_ENABLED=false` degraded path

### Requirement: The Athlete-Safe Guarantee Is Enforced at the Database Layer, Not by an Application Query Convention

Postgres Row Level Security is row-level only — it does not restrict which *columns* a role may `SELECT` once a row is visible to it. An application-layer convention (e.g. "this component queries `ai_analysis_athlete_safe` instead of `ai_analysis`") MUST NOT be treated as satisfying this capability's privacy guarantee, because it is bypassable by any direct query against the base table using a valid athlete JWT — through devtools, a different client, or a future component that queries the base table without the same convention. The guarantee MUST instead be enforced such that: (a) the `authenticated` and `anon` roles hold no `SELECT` privilege on the `weekly_ai_reports` base table's columns at all, and (b) a single masked, row-filtered server-side surface (implementation detail: currently a `SECURITY DEFINER` function; MAY be any mechanism that provably enforces both row-visibility and column-masking without depending on an unverified assumption about role privileges) is the only way for non-`service_role` callers to read `ai_analysis`/`summary`, resolving them to the wide value only for the report's own coach and to the athlete-safe value otherwise, and returning zero rows for any caller who is neither. This requirement exists because two prior implementations of this capability both failed to hold this guarantee before it was caught: communication-agent D8 satisfied the scenarios below at the application layer only, while the database continued to grant unrestricted column-level `SELECT` to `authenticated`/`anon` on the base table; a subsequent database-layer fix (D9) used a masking VIEW whose row-filtering depended on an unverified assumption about the view owner's role privileges, which live verification found false for this project's actual Postgres role graph (D10) — the view returned every row to every caller regardless of who was asking, until replaced with a mechanism whose row-filter is explicit, verifiable SQL rather than an assumption about how RLS interacts with a given role.

#### Scenario: A direct query against the base table with an athlete's own JWT is rejected regardless of which columns are requested

- GIVEN an athlete's own valid JWT
- AND a `weekly_ai_reports` row exists where that athlete is `athlete_id`
- WHEN the athlete's session queries the base table directly (not the masked server-side surface) for any column, including columns unrelated to `ai_analysis`/`summary`
- THEN the query is rejected with a permission error, not with a row-filtered empty result and not with data

#### Scenario: The same athlete querying the masked surface for their own row receives the athlete-safe value under the wide columns' own names

- GIVEN the same athlete and row as above
- WHEN the athlete's session queries the masked surface's `ai_analysis` and `summary` columns for that row
- THEN the values returned are the athlete-safe (`ai_analysis_athlete_safe`/`summary_athlete_safe`) content
- AND this is true with zero query-shape difference from how the report's own coach queries the same surface for the same row — only the resolved value differs, driven by who is asking

#### Scenario: An unrelated caller receives zero rows, never every row

- GIVEN a valid JWT belonging to neither the report's `coach_id` nor its `athlete_id`
- WHEN that session queries the masked surface for that row
- THEN zero rows are returned
- AND this MUST hold regardless of which role owns the underlying database object implementing the masked surface — row-visibility MUST NOT depend on an assumption about the owning role's privileges that has not been verified live against this project's actual Postgres role graph

#### Scenario: A caller with no session at all is rejected

- GIVEN no `Authorization` header (`anon` role)
- WHEN a request queries either the base table or the masked surface for any `weekly_ai_reports` row
- THEN the request is rejected with a permission error

### Requirement: No Athlete-Facing Output on Any Channel

This capability MUST NOT draft or send any message to an athlete on any channel (chat, push, email) under either mode. Its only delivery MUST be the existing coach-facing push and `notifications` row.

#### Scenario: Report generation sends nothing to the athlete
- GIVEN a report is generated in either mode
- WHEN generation completes
- THEN no `chat_messages` row, push, or email is sent to the athlete
