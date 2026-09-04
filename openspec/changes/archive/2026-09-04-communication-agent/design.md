# Design: Communication Agent (Agent 4)

## Technical Approach

Unlike Agents 1–3, this change builds **no new Edge Function, no pure core, no table, and no
migration**. It widens the *input* of `supabase/functions/weekly-ai-reports/index.ts` — a
shipped, cron-scheduled, Gemini-backed per-athlete synthesis that already writes
`weekly_ai_reports` and already pushes the coach to `/dashboard/ai-reports` — so that
`processAthlete` reads Agent 2's `athlete_engagement_alerts` and Agent 3's
`plan_adjustment_suggestions` alongside the `training_load_alerts` it reads today, and the prompt
asks for **one causal explanation** across the three vocabularies instead of three lists.

A `mode: 'sweep' | 'athlete'` discriminator adds a single-athlete path that computes the
**current, in-progress** week rather than the digest's completed-last-week window.
`engagement-monitor` invokes it fire-and-forget when an `engagement_silence` alert reaches
`danger` on creation or on `warning → danger` escalation. The existing
`(athlete_id, week_start)` upsert key does double duty as the same-week dedup ledger and as the
mechanism by which the next Monday digest cleanly supersedes a mid-week reactive row.

Conventions inherited verbatim from Agents 1–3: `index.ts` I/O + `logic.js` pure-decision split
inside a function directory, `EdgeRuntime.waitUntil` fire-and-forget with `.then/.catch`
pre-attached *before* the handoff, `Europe/Madrid` local-date derivation via
`Intl.DateTimeFormat('sv-SE', …)` and never `toISOString().split('T')[0]` for **new** date code
(`timezone_date_bug`), pure UTC-anchored string math on an already-resolved local date, kill
switches read as `Deno.env.get(...) ?? default`, `node --test` over zero-dependency pure modules.

Two constraints shape every decision below. First, **`WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=false`
must be byte-identical to today's function** — not "equivalent", byte-identical, including the
assembled prompt string. Second, **this change touches a production handler that four callers
already depend on** (the `weekly-ai-reports-monday` `pg_cron` job, `triggerWeeklyReports`'s
regenerate button with an explicit week, the same button without one, and — new — the reactive
call). Every added branch is written so that the absent-parameter case reaches exactly the code
path it reaches today.

## Architecture Decisions

### Decision: the deterministic alert level becomes a **floor** the LLM may raise but never lower

This is the most consequential finding of reading the live file, and it is not in the proposal.

`index.ts:392-399` computes `alertLevel` deterministically from open alerts, then **overwrites it
wholesale** with whatever Gemini returned:

```ts
if (aiAnalysis?.nivel_alerta && ['critical','attention','ok'].includes(aiAnalysis.nivel_alerta)) {
  finalAlertLevel = aiAnalysis.nivel_alerta as string;   // LLM wins, unconditionally
}
```

So widening `alertLevelFromOpenAlerts` to three sources is **necessary but not sufficient** for
the proposal's success criterion *"an athlete with an open `danger` engagement alert and no
`training_load_alerts` yields `alert_level = 'critical'`"*. A prompt-only fix makes that criterion
a coin flip on a `temperature: 0.3` sample.

| Option | Tradeoff | Verdict |
|---|---|---|
| Prompt-only: instruct Gemini that `danger` ⇒ `critical` | Zero code, but the criterion is non-deterministic and unverifiable; one bad sample silently under-reports a churning athlete | Rejected |
| Ignore `nivel_alerta` entirely, always use the deterministic level | Discards the LLM's ability to escalate on evidence the rulebooks cannot see (e.g. `pain_notes` in the diary — today's item 7 explicitly asks for exactly that) | Rejected |
| **Floor: `finalAlertLevel = max(deterministic, nivel_alerta)` on the ordered tier scale** | One helper, and the LLM keeps its escalation power | **Chosen** |

This is a *restoration* of an invariant this file already claims. Its own header comment
(`index.ts:21-27`) states the function "only maps the athlete's currently open alert rows to the
report's 3-tier display level — it does not recompute any threshold itself (training-load-alerts
'Single Alert Rulebook' requirement)". Letting a language model return a value *below* the
rulebook's output is precisely recomputing the threshold, badly.

**The floor is gated on `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED`.** With the flag off there are no
engagement inputs, the deterministic level is today's `training_load_alerts`-only value, and
flooring would still be a behaviour change against today's "LLM wins" semantics — so it is
skipped, preserving byte-identity. Prompt instruction 9 (below) states the same rule in Spanish so
the model and the code agree instead of fighting; the code is the enforcement point, the prompt is
the alignment.

### Decision: `mode:'athlete'` uses Monday-through-**today**, not Monday-through-Sunday

The proposal mandates "the current (in-progress) week". Both endpoints are defensible; the choice
is load-bearing because every read in `processAthlete`'s parallel block is bounded by `weekEnd`.

| Option | Tradeoff | Verdict |
|---|---|---|
| `weekEnd` = this week's Sunday | `training_sessions` is queried `.lte('scheduled_date', weekEnd)`, so a Wednesday run counts Thursday–Sunday's *planned* sessions as planned but not done. The report opens with *"2/6 sesiones completadas"* and Gemini reads a 33% adherence catastrophe that is actually a normal Wednesday | Rejected |
| **`weekEnd` = today (Europe/Madrid)** | Planned and done are bounded by the same elapsed window, so the comparison is like-for-like. The stored `week_end` column temporarily reads mid-week | **Chosen** |

The stored `week_end` self-corrects: the following Monday's digest upserts the same
`(athlete_id, week_start)` row with the real Sunday and the completed week's numbers — the
supersession D1 already describes.

`get_athlete_planned_km(p_athlete_id, p_week_start, p_week_end)` receives the same truncated
window, so planned km are elapsed-week km. Consistent by construction.

Even with matched windows the week is partial, and adherence read as a full-week ratio is still
wrong. So `mode:'athlete'` adds one prompt line stating the week is in progress and how many days
have elapsed. This is a third prompt addition beyond the proposal's literal "two blocks and one
instruction" — it is confined to `mode:'athlete'`, a path that does not exist today, so it cannot
affect the digest or the byte-identity guarantee.

### Decision: the current-week computation uses **Europe/Madrid**, while the existing last-week block is left on UTC untouched

`index.ts:478-488` computes last week with `getUTCDay()` / `toISOString().split('T')[0]` — the
project's documented `timezone_date_bug` pattern. It is left **byte-unchanged**: it runs at
04:xx UTC on a Monday from cron, is 2 hours from any boundary, and rewriting it is unrelated
regression surface in the exact handler this change is already modifying.

The new branch cannot inherit it. Between 00:00 and 02:00 Europe/Madrid on a Monday, UTC still
reports Sunday, so `isoWeekStart` computed from UTC would return **last** Monday — and the
reactive run would then upsert a partial mid-week report *over the completed digest row the cron
job wrote four hours earlier*. That is the proposal's "a reactive run overwrites a completed
weekly report" risk, promoted from *Low* to *certain* by a two-hour window, and the same-week
dedup guard would not catch it (the digest row's `status` is `completed`, so the guard would
instead skip — silently, on the wrong week). New date code therefore uses
`Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' })` plus pure UTC-anchored string math
on the already-resolved local date, exactly as `engagement-monitor/index.ts:69-80` does.

### Decision: `WEEKLY_REPORT_REACTIVE_ENABLED` lives in **`weekly-ai-reports`**, not in `engagement-monitor`

| Option | Tradeoff | Verdict |
|---|---|---|
| Gate in `engagement-monitor` (skip the `fetch`) | Protects one caller. Any future caller of `mode:'athlete'` bypasses the switch entirely, and the disabled state produces no evidence for the mandated dry-run | Rejected |
| Gate in both | Two secrets to keep in sync across two functions; a half-flipped state is silently confusing | Rejected |
| **Gate in `weekly-ai-reports`, at the `mode:'athlete'` entry, before any read or Gemini call** | One HTTP round-trip per `danger` escalation is wasted while disabled | **Chosen** |

The wasted round-trip buys the thing D7 actually requires. While disabled, every would-have-fired
reactive run still reaches the function, is logged, and returns
`{ skipped: 'reactive_disabled' }` with **zero** Supabase reads and **zero** Gemini spend. The
disabled state *is* the mandated dry-run instrument, running continuously in production, so the
"how many reactive runs would the last 30 days of `danger` escalations have produced" review is a
log query rather than a bespoke script. Volume is single-digit per day (a `danger` escalation
happens once per silence episode), so the cost is noise.

`engagement-monitor` stays dumb: it always fires when its pure gate says so. One switch, one
function, one deploy to flip.

### Decision: the engagement gate keys on `finding.severity`, **not** `finding.metrics.zone`

Agent 1's `shouldTriggerReactivePlanning` gates on `finding.metrics.zone === 'danger'` and carries
a long doc comment warning that `finding.severity` can never be `'danger'` there, because
`training_load_alerts.severity` is `CHECK`-constrained to `('warning','critical')`. That comment
must not be cargo-culted here.

`athlete_engagement_alerts.severity` is `CHECK (severity IN ('warning','danger'))`
(`20260901100000_athlete_engagement_alerts.sql:25-26`), and `athlete_engagement_alerts.metrics`
carries `{variant, lastSignalAt, lastSignalSource, plannedInWindow}` — **there is no `zone` key**.
So `severity === 'danger'` is not merely correct here, it is the only available field, and
"fixing" this gate to `metrics.zone` would make it dead code that never fires. The two agents look
symmetric and are not; both gates are documented in place so neither is later "harmonised" into a
silent no-op.

The gate reuses the race-safe `is_new || escalated` flags from the `upsert_engagement_alert` RPC's
own atomic result — never `evaluateForSweep`'s pre-write `decision`, which is computed from a
`SELECT` taken before the write and can be stale under a concurrent invocation
(`logic.js:89-118`'s documented rationale). A daily *refresh* of an already-open `danger` episode
must not re-fire.

Dry runs are safe by construction and need no extra check: `processCandidate` returns early when
`effectiveDryRun`, so `upserted` is never computed and the gate is never reached.

### Decision: a `pending` plan-adjustment suggestion contributes `attention`, never `critical`

`plan_adjustment_suggestions` has no `severity` column, so the widened
`alertLevelFromOpenAlerts` needs a mapping decision.

Every suggestion is downstream of an open `training_load_alerts` row
(`triggering_alert_id uuid NOT NULL`) that is *already* contributing its own severity to the same
computation. Letting a suggestion reach `critical` would double-count one physiological event and
make the report's tier depend on whether Agent 3 happened to have a rule for that finding.

So: `status = 'pending'` contributes `attention` — an outstanding coach decision is real, unmet
signal, but not independent evidence of risk. Every other status (`approved`, `rejected`,
`expired`, `superseded`) contributes **nothing** to the tier; those rows are narrative context
only, which is exactly what they are good for (*"the deload you declined on the 12th"*).

### Decision: `mode:'athlete'` ignores a caller-supplied `week_start` / `week_end`

The body parser already accepts both. In `mode:'athlete'` they are overridden, not honoured.
The dedup guard and the digest-supersession property both depend on the reactive row landing on
*this* week's Monday; honouring an arbitrary caller-supplied week would let a reactive run write
into any week's row and defeat the ledger. `mode:'athlete'` is reachable only server-to-server
(D5), so no legitimate caller loses anything.

### Decision: three pure tier functions move to a new `weekly-ai-reports/logic.js`

The proposal's Out of Scope rejects "a new `_shared/communicationCore.js` and a fourth Edge
Function". It does not reject the *other* half of the house convention — the function-local
`logic.js` that Agents 1, 2 and 3 all have, and that `package.json`'s `test:core` script already
globs for three of the four function directories.

`index.ts` is TypeScript with `jsr:`/`https://esm.sh` imports and is not loadable under
`node --test`. The proposal's headline verifiable criterion (`danger` + no load alerts ⇒
`critical`) is a property of ~20 lines of pure tier arithmetic. Moving `TIER_ORDER`,
`normalizeEngagementSeverity`, `alertLevelFromOpenAlerts` and `higherTier` into
`supabase/functions/weekly-ai-reports/logic.js` makes that criterion a unit test with zero new
dependencies, in the harness that already exists.

Cost: one new file, one `test:core` glob entry in `package.json` — the only file this change
touches outside the proposal's Affected Areas table, and it is test wiring, not behaviour. Flag it
for the tasks phase rather than letting it appear as an unexplained diff.

Nothing else moves. Prompt assembly stays inline in `index.ts`: it is string interpolation over
I/O results, the proposal explicitly notes "there is no deterministic rulebook here, only prompt
assembly", and extracting it would be exactly the retro-refactor the proposal rules out.

### Decision: a user JWT with **no** `coach_id` is rejected, not just a mismatched one

D5 says "the request's `coach_id` MUST equal the authenticated user". Read literally, a user JWT
that simply **omits** `coach_id` passes — and omitting it is the *worse* case: `targetCoachId`
stays `null`, the relationship query is unfiltered, and the caller sweeps **every coach's entire
roster** through Gemini. That is the D1 hole at its maximum blast radius.

So for a non-cron, non-service-role caller, `coach_id` is **required** and must equal
`user.id`. `triggerWeeklyReports` (`aiReportService.js:568-593`) always sends
`body = { coach_id: coachId }`, so no shipped frontend path is affected. This is a deliberate
strengthening past the proposal's literal wording, in the same direction and for the same reason;
it belongs in the spec.

**Verify live before deploy** that every call site passes the *caller's own* id — `getSession()`
is read for the token but `coachId` arrives as an argument, so a component passing a viewed
coach's id rather than the session user's would start 403-ing.

### Decision (D8, amended post-Phase-5): the athlete-safe analysis is a SECOND Gemini call over a NARROW input, never a prompt instruction on the wide call

Found live by the orchestrator after Phase 5 completed, before deploy: `weekly_ai_reports` carries a pre-existing RLS SELECT policy — `(select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id` — and `src/pages/athlete/MyReports.jsx` is a live, shipped page that reads the athlete's own row and renders `ai_analysis.resumen`, `ai_analysis.alertas[].descripcion` and `ai_analysis.recomendaciones[]` verbatim. D2/D3's widening writes cross-agent synthesis into that same `ai_analysis` column, so once `WIDE_CONTEXT_ENABLED=true` reports exist, the athlete's own page would show them.

| Option | Tradeoff | Verdict |
|---|---|---|
| Prompt instruction: tell Gemini "the following is for the coach only, do not repeat engagement/plan-adjustment content in a way the athlete could see" | Zero new calls, zero new column. But the security boundary would be an LLM instruction — unenforceable, unverifiable, and the exact anti-pattern the user rejected outright. A single bad sample leaks the narrative permanently to the athlete's own read path | **Rejected — non-negotiable** |
| Post-process the wide output (strip/redact sentences that mention engagement/plan-adjustment content) before storing an "athlete view" | Same failure class as the prompt instruction: the wide-context content was already generated and already exists in the wide call's context window and output; redaction is pattern-matching over free text and will miss paraphrases | Rejected |
| **Second, independent `callDeepSeek` call, with a narrow `weekData` whose `wide_context`/`engagement_alerts`/`plan_adjustments` are exactly what a `WIDE_CONTEXT_ENABLED=false` run would produce, stored in a new column** | Up to 2× Gemini calls per `processAthlete` invocation when `WIDE_CONTEXT_ENABLED=true`. But the boundary is now *what data was ever sent to the model*, not an instruction about what it should say — the only boundary strong enough for a privacy guarantee | **Chosen** |

The narrow call reuses `callDeepSeek` **unmodified** — no second prompt template. `logic.js` gains one new pure function, `buildNarrowWeekData(weekData)`, that shallow-copies `weekData` with `wide_context: false`, `engagement_alerts: []`, `plan_adjustments: []` and every other key untouched. This is exactly the shape `callDeepSeek` already produces byte-identically for a `WIDE_CONTEXT_ENABLED=false` sweep run (task 2.12's byte-identity guarantee) — `buildNarrowWeekData` just makes that same narrow shape available as a second call's input without mutating the original `weekData` object, which the wide-context call still needs intact.

```js
// logic.js — new pure function, zero I/O, same convention as
// alertLevelFromOpenAlerts/higherTier.
export function buildNarrowWeekData(weekData) {
  return {
    ...weekData,
    wide_context: false,
    engagement_alerts: [],
    plan_adjustments: [],
  };
}
```

`processAthlete` calls it like this, immediately after the existing wide-context `callDeepSeek` call/catch block:

```ts
let aiAnalysisAthleteSafe: Record<string, unknown> | null = null;
if (WIDE_CONTEXT_ENABLED) {
  // D8 — athlete-safe analysis. Generated from a call whose weekData NEVER
  // included engagement_alerts/plan_adjustments, not from post-processing
  // the wide call's output. This independence is the actual security
  // guarantee: an athlete reading their own weekly_ai_reports row (the
  // pre-existing self-select RLS policy) via MyReports.jsx must never see
  // Agent 2/Agent 3 content, and the only reliable way to guarantee that is
  // to never send it to the model that produced this specific output.
  //
  // Independent failure: this call's own try/catch must never affect the
  // primary (coach-facing) report already computed above.
  try {
    aiAnalysisAthleteSafe = await callDeepSeek(athleteName, buildNarrowWeekData(weekData), competitionDays);
  } catch (err) {
    console.error(`DeepSeek athlete-safe error for athlete ${athleteId}:`, err);
  }
}
```

When `WIDE_CONTEXT_ENABLED=false`, no second call is made and `aiAnalysisAthleteSafe` stays `null` — correct, because in that state the single `aiAnalysis` produced IS already the narrow, pre-widening shape; there is nothing to duplicate. The frontend's fallback (below) covers this case.

`processAthlete`'s final `update` gains one field:

```ts
await supabase
  .from('weekly_ai_reports')
  .update({
    alert_level: finalAlertLevel,
    summary,
    ai_analysis: aiAnalysis,                       // unchanged — coach-facing, may be wide
    ai_analysis_athlete_safe: aiAnalysisAthleteSafe, // NEW — always narrow or null
    status: aiAnalysis ? 'completed' : 'error',
    error_message: aiAnalysis ? null : 'DeepSeek generation failed',
  })
  .eq('id', reportId);
```

`MyReports.jsx` (`src/pages/athlete/MyReports.jsx`) requires a matching read-side change: its `.select()` gains `ai_analysis_athlete_safe`, and both `ReportCard` (`report.ai_analysis`) and `ReportDetail` (`report.ai_analysis`) switch to `report.ai_analysis_athlete_safe || report.ai_analysis`. The `|| report.ai_analysis` fallback is required, not optional cleanup: it covers `WIDE_CONTEXT_ENABLED=false` runs (the single `ai_analysis` produced is already narrow) and every historical row written before this fix deployed (also never widened, since D2's widening and D8's fix ship in the same change — there is no window where a row could be widened without also having `ai_analysis_athlete_safe` populated, but defensive fallback costs nothing and protects against any future flag/rollback state where `ai_analysis_athlete_safe` could legitimately be `null` while `ai_analysis` is populated, e.g. the athlete-safe call itself failed independently).

**Found during apply, not in the original D8 write-up**: `ReportDetail`'s "Descargar PDF" button calls `generateAIReportPDF({report, athleteName})` (`src/lib/pdfExport.js`), whose `mapReportToDocProps` reads `report?.ai_analysis` directly — a second exposure of the exact same self-read surface, in PDF form. `generateAIReportPDF` has exactly one call site in the codebase (this button; confirmed by grep), so `mapReportToDocProps` gets the identical `report.ai_analysis_athlete_safe || report.ai_analysis` fallback. If a future coach-facing caller of `generateAIReportPDF` is ever added, it must pass a `report` whose `ai_analysis_athlete_safe` is either absent or intentionally set to the coach-facing analysis — this fallback always prefers `ai_analysis_athlete_safe` when present.

**Superseded by D9 below**: this app-layer fallback (`ai_analysis_athlete_safe || ai_analysis`, wherever it appears in the frontend) does NOT close the exposure it was written to close. It changes what the APP queries; it never changes what the DATABASE permits an athlete's own JWT to `SELECT` directly. D9 replaces this fallback with database-layer masking and removes the fallback from the frontend entirely.

### Decision (D9, found by `sdd-verify` post-Phase-6, blocking archive): the athlete-safe guarantee must be enforced at the database layer — a masked view plus `REVOKE`, not an app-layer query convention

`sdd-verify` found, and the orchestrator confirmed live against production via `information_schema.column_privileges`, that D8's fix does not hold. Postgres RLS is **row-level only**: the existing RLS SELECT policy on `weekly_ai_reports` (`(select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id`) controls WHICH ROWS an athlete can see. Once their own row is visible, Supabase's default schema-wide bootstrap grant (`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon` — not tracked in this repo's migrations, set at project bootstrap) lets the athlete `SELECT` **any column** of that row directly via PostgREST — `GET /rest/v1/weekly_ai_reports?select=ai_analysis,summary` — completely bypassing whichever column `MyReports.jsx` (D8's fix) chooses to query. The live check found `authenticated` **and** `anon` both hold unrestricted `SELECT` on every column of `weekly_ai_reports`, with zero column-level `REVOKE` anywhere in this codebase before this decision.

| Option | Tradeoff | Verdict |
|---|---|---|
| Do nothing further — D8's `ai_analysis_athlete_safe` column plus the app's own fallback | The column exists and is correctly populated, but is not the enforcement point: any client bypassing `MyReports.jsx`'s own query (devtools, a leaked JWT, a future careless component) reads the wide `ai_analysis` directly. An app-layer convention is not a privacy guarantee — the exact anti-pattern D8 itself rejected for the *prompt* layer, still present one layer up, at the *query* layer | **Rejected — the finding that blocks archive** |
| Add a coach-only RLS policy path and drop the athlete's own-row SELECT policy entirely, forcing all athlete reads through a `SECURITY DEFINER` RPC | Correct in principle, but rewrites the pre-existing (legitimate) athlete self-read policy and every existing caller (`MyReports.jsx`'s direct Supabase client query) would need to be rewritten to call an RPC instead of `.from().select()` — much larger blast radius than the actual problem (masking two columns) | Rejected |
| **A masked VIEW (`weekly_ai_reports_for_role`) that aliases `ai_analysis`/`summary` via `CASE WHEN (select auth.uid()) = coach_id THEN <wide> ELSE <athlete_safe> END`, plus `REVOKE SELECT` on the base table from `authenticated`/`anon`, `GRANT SELECT` on the view to `authenticated`** | The standard Postgres/Supabase pattern for column-level masking (Postgres has no native column-level RLS). Requires `FORCE ROW LEVEL SECURITY` on the base table to avoid the view accidentally bypassing row-level filtering (see "View Security Semantics" below) and requires every frontend reader to switch `.from('weekly_ai_reports')` → `.from('weekly_ai_reports_for_role')` — a small, mechanical, and now REQUIRED change (not optional cleanup) for `MyReports.jsx`, `AIReports.jsx` (via `aiReportService.js`), and `pdfExport.js`'s only call site | **Chosen** |

**`summary_athlete_safe`, added by the same migration**: D8's narrow `callDeepSeek` call already produces an `aiAnalysisAthleteSafe`-shaped object whose own `.resumen` field IS the athlete-safe summary text. `index.ts` extracts it inline (`aiAnalysisAthleteSafe?.resumen ?? null`), mirroring the existing `summary` extraction one line above — not promoted to a `logic.js` pure function, since it is a one-line field read with no branching logic to unit-test, unlike `buildNarrowWeekData`. No third Gemini call.

**View Security Semantics** (this is the load-bearing part of the design, and the part `sdd-apply` cannot verify without live Supabase access — flagged explicitly for the orchestrator's live-verification step, same practice as every RLS-sensitive change this session):

- Postgres views are, by default (`security_invoker = false`), executed with the **view owner's** privileges for the object-level access check. This is what lets `weekly_ai_reports_for_role` satisfy the `SELECT` permission check against the base table even though `authenticated` itself no longer holds that grant — the view owner's own grant covers it. If the view were instead created `security_invoker = true`, the calling role would need its OWN `SELECT` grant on the base table for the query to even parse, which would defeat the `REVOKE` entirely. The view is therefore deliberately **not** `security_invoker`.
- `auth.uid()` does not depend on which SQL role is executing the query — it reads a per-request session GUC (`request.jwt.claims`) that PostgREST sets from the actual CALLING user's JWT. This means the view's `CASE` expression correctly reflects the real querying user's identity (coach vs. athlete) regardless of the view's `security_invoker` setting.
- Row-level filtering (WHICH rows are returned at all) still comes from the pre-existing, unchanged RLS SELECT policy — but only if it actually gets evaluated. Table owners bypass RLS by default; if the view's owner is also the table's owner (the typical case for migration-created objects), a plain view would silently return **every** row to **every** caller with `SELECT` on the view, unless `ALTER TABLE weekly_ai_reports FORCE ROW LEVEL SECURITY` is set — this is what re-applies the row-scoping policy to the view owner's own underlying query. This is the single most important statement in the migration; omitting it would turn "masked, but row-scoped" into "masked, but visible to every coach and every athlete" — a materially worse regression than the hole this decision closes.
- This assumes the migration-running role (commonly `postgres` in Supabase Cloud) does not carry the `BYPASSRLS` role attribute (only `service_role` does in Supabase's default bootstrap). If it does, `FORCE ROW LEVEL SECURITY` has no effect and a different, non-`BYPASSRLS` view-owning role would be required — sdd-apply has no way to confirm this live and states it as an assumption in the migration's own header comment, per the explicit instruction to do so.

```sql
-- weekly_ai_reports_for_role — see the full migration for the complete
-- column list and header comment documenting these assumptions.
CREATE OR REPLACE VIEW public.weekly_ai_reports_for_role
AS
SELECT
  id, coach_id, athlete_id, week_start, week_end, alert_level,
  sessions_planned, sessions_done, planned_km, actual_km, acwr, tsb,
  avg_rpe, internal_load, status, error_message, report_data, created_at,
  CASE WHEN (select auth.uid()) = coach_id THEN ai_analysis
       ELSE ai_analysis_athlete_safe END AS ai_analysis,
  CASE WHEN (select auth.uid()) = coach_id THEN summary
       ELSE summary_athlete_safe END AS summary
FROM public.weekly_ai_reports;

GRANT SELECT ON public.weekly_ai_reports_for_role TO authenticated;
-- authenticated/anon SELECT is REVOKEd on the base table; service_role
-- (the Edge Function) is untouched.
```

The view deliberately does **not** expose the raw `ai_analysis_athlete_safe`/`summary_athlete_safe` columns — no client needs to see both the wide and narrow value for the same row.

**Frontend consequence — Phase 6's fallback is removed, not extended**: because the view resolves `ai_analysis`/`summary` to the correctly-masked value transparently, `MyReports.jsx` and `pdfExport.js`'s `ai_analysis_athlete_safe || ai_analysis` expressions revert to a plain `report.ai_analysis` / `report.summary` read — the masking moved from the app layer (D8) to the database layer (D9), which is the actual point of this fix. `AIReports.jsx` (via `aiReportService.js`'s `getCoachWeeklyReports`/`getCoachReportWeeks`) also switches to the view: after the `REVOKE`, the coach — who authenticates as `authenticated`, not `service_role` — would otherwise lose base-table read access entirely. The view resolves `ai_analysis`/`summary` to the WIDE value for the report's own coach (`auth.uid() = coach_id`), so nothing is lost for that caller.

**Superseded by D10 below**: the view itself, as designed above, does not actually hold in this project — see D10. The `CASE`-based column masking logic shown here is correct and is preserved verbatim inside D10's replacement function; only the row-visibility mechanism (a view relying on `FORCE ROW LEVEL SECURITY`) is wrong and is replaced.

### Decision (D10, found live by the orchestrator, blocking the Phase 7 migration's actual deployment): the "View Security Semantics" assumption above does not hold in this project — `postgres` has `rolbypassrls=true`; the fix is a `SECURITY DEFINER` function with an explicit `WHERE`-clause row-filter, not a view

D9's own "View Security Semantics" note (above) flagged, honestly, that it could not be verified without live Supabase access and stated its assumption explicitly: *"this assumes the migration-running role... does not carry the `BYPASSRLS` role attribute... If it does, `FORCE ROW LEVEL SECURITY` has no effect."* The orchestrator verified this live, in production, before applying the migration for real (rolled-back transactions, `2026-09-03`): `SELECT rolname, rolbypassrls FROM pg_roles` confirms `postgres` — the role that owns `weekly_ai_reports` and would own `weekly_ai_reports_for_role` — **has `rolbypassrls = true`** in this project. D9's assumption does not hold here. `FORCE ROW LEVEL SECURITY` does not override an explicit `BYPASSRLS` role attribute — this is documented, intended Postgres behavior — so the view, exactly as D9 designed it, returned **every row to every caller** holding `SELECT` on it, completely bypassing the `CASE`-based masking's row-visibility precondition (the masking logic itself, i.e. which value each row's `ai_analysis` resolves to, was correct; the bug was that every row was visible to every caller in the first place).

| Option | Tradeoff | Verdict |
|---|---|---|
| Find and use a non-`BYPASSRLS` role to own the view | Requires creating/managing a new dedicated role in this project purely to own one view — a new piece of infrastructure and a new thing to keep correctly permissioned forever, for a problem a function solves with zero new roles | Rejected |
| `ALTER VIEW weekly_ai_reports_for_role SET (security_invoker = true)` | Live-tested by the orchestrator and confirmed to fail **differently**: `security_invoker` requires the CALLING role (`authenticated`) to hold its own direct `SELECT` grant on the base table for the query to even parse — which is exactly what D9's `REVOKE SELECT ... FROM authenticated` removes. Dead end, not a fix | Rejected |
| **A `SECURITY DEFINER` function (`get_weekly_ai_reports`) with the row-filter written explicitly in its own `WHERE` clause** — `WHERE ((select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id)` — inside the function body, never relying on RLS being "applied" to the definer at all | One new function to maintain instead of one view; callers switch `.from(view)` to `.rpc(fn, params)` — small, mechanical | **Chosen — live-verified** |

**Live verification the orchestrator ran before choosing this fix** (rolled-back transactions, 3 real scenarios, `2026-09-03`):
1. A coach querying for their own athlete's report → gets the WIDE `ai_analysis`/`summary`.
2. That SAME athlete querying their OWN report → gets the NARROW `*_athlete_safe` content under the `ai_analysis`/`summary` names.
3. An unrelated user querying for that report → gets ZERO rows.
4. Direct base-table access as `authenticated` → still denied (D9's `REVOKE` is untouched by D10 and remains the enforcement point for "no bypassing the masked surface at all").

This confirms the function is not merely theoretically correct but behaves exactly as D9's own never-verified "View Security Semantics" note intended the view to behave — the mechanism changed, the guarantee did not.

**Why a function and not a different view-ownership trick**: a `SECURITY DEFINER` function's row-filter is literal SQL evaluated by the function body itself on every call, regardless of whether the function owner carries `BYPASSRLS` — there is no analogous "does the owner bypass RLS" failure mode for an explicit `WHERE` clause the way there is for a view's implicit reliance on RLS being re-applied via `FORCE ROW LEVEL SECURITY`. This is the more robust default pattern for any future per-row-masked read surface in this project, not a one-off workaround.

`get_weekly_ai_reports(p_coach_id, p_athlete_id, p_week_start, p_status)` — `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER`, `SET search_path = public` — reuses D9's exact `CASE`-based masking expressions for `ai_analysis`/`summary`, adds the explicit row-filter `WHERE`, and accepts optional filter parameters mirroring the real `.eq()` filters `aiReportService.js` (`getCoachWeeklyReports`, `getCoachReportWeeks`) and `MyReports.jsx` already use — no invented parameter. `REVOKE ALL ... FROM PUBLIC` / `GRANT EXECUTE ... TO authenticated` mirrors this project's established `SECURITY DEFINER` RPC convention (`apply_plan_adjustment`, `upsert_engagement_alert`). Full DDL in migration `20260903140000_weekly_ai_reports_masking_rpc.sql`.

**The flawed view is dropped, not left neutralized.** The orchestrator had already run `REVOKE SELECT ON weekly_ai_reports_for_role FROM authenticated` live to neutralize it pre-emptively (nothing in deployed code queried it from a browser session, so there was no real-world exposure window) before this fix was designed — but a neutralized, still-broken view left in the schema is a trap for a future migration to accidentally re-grant. Migration `20260903140000`'s `UP` script drops it after creating the function.

**Frontend consequence**: `aiReportService.js`'s `getCoachWeeklyReports`/`getCoachReportWeeks` and `MyReports.jsx`'s report query all switch from `.from('weekly_ai_reports_for_role')` to `.rpc('get_weekly_ai_reports', {...})` — chaining the same `.select()`/`.order()`/`.limit()` filters PostgREST already supports on any set-returning resource (table, view, or a `STABLE` function). Zero change to what each caller reads or how the returned rows are shaped; only the resource name and the call form (`.from()` → `.rpc()`) change. `pdfExport.js` needs no functional change — it only ever reads `report.ai_analysis` from whatever its caller (`MyReports.jsx`) already resolved, so its existing plain read (established in D9, no fallback) stays correct unmodified; its explanatory comment is updated to name the RPC instead of the view for accuracy.

## Data Flow

```
pg_cron (Monday) ──x-supabase-cron-job: true──► weekly-ai-reports  {}
coach "regenerar" ──user JWT──────────────────► weekly-ai-reports  {coach_id}[, week_start, week_end]
                                                        │
                                        mode absent ⇒ 'sweep'  (unchanged default)
                                        D5: user JWT ⇒ coach_id required AND == user.id
                                                        │
                                        week window: existing UTC last-Mon..Sun block, untouched
                                                        │
                                        coach_athlete_relationship (status='active')
                                          [+ .eq('coach_id', targetCoachId) if given]
                                                        ▼
                                            batches of 5 ─► processAthlete(mode='sweep')

REACTIVE:  engagement-monitor.processCandidate
             upsert_engagement_alert → {alert_id, is_new, escalated}
               shouldTriggerWeeklyReport(finding, upserted)
                 finding.alertType === 'engagement_silence'
                 && finding.severity === 'danger'          ← NOT metrics.zone (no such key here)
                 && (is_new || escalated)                  ← RPC-derived, race-safe
                   └─ EdgeRuntime.waitUntil(fetch weekly-ai-reports
                        Bearer SERVICE_ROLE_KEY            ← NOT CRON_SECRET (see Interfaces)
                        {mode:'athlete', athlete_id, coach_id, alert_id})
                                                        │
                        WEEKLY_REPORT_REACTIVE_ENABLED === false
                          └─► log + {skipped:'reactive_disabled'}   [0 reads, 0 Gemini]
                                                        │ true
                        week window: Monday(Europe/Madrid today) .. today
                        relationship query + .eq('athlete_id', athleteId)
                          no active relationship ⇒ 0 rows ⇒ no report  (independent-athlete gate)
                                                        ▼
                                            processAthlete(mode='athlete')

processAthlete:
   [mode==='athlete'] SELECT weekly_ai_reports (athlete_id, week_start)
       status==='completed' ⇒ RETURN {skipped:'already_reported_this_week'}   [0 Gemini]
       MUST precede the upsert — see the guard's placement note
                                │
   Promise.all([ …8 existing reads…,
                 9. athlete_engagement_alerts (status='open')          ] gated on
                 10. plan_adjustment_suggestions (pending OR ≤28d)     ] WIDE_CONTEXT
                                │
   alertLevelFromOpenAlerts(loadAlerts, engagementAlerts, planSuggestions)
       engagement 'danger' → 'critical' ;  'warning' → 'warning'
       pending suggestion  → 'warning'  ;  decided → no tier contribution
                                │
   upsert weekly_ai_reports (status='generating')  ◄── onConflict 'athlete_id,week_start'
                                │
   callDeepSeek → nivel_alerta
       [WIDE_CONTEXT] finalAlertLevel = higherTier(deterministic, nivel_alerta)   ← floor
       [!WIDE_CONTEXT] finalAlertLevel = nivel_alerta                             ← today's exact
                                │
   update status='completed' | 'error'
                                ▼
   coachSummary (skipped runs excluded) → notifyCoach → push + notifications → /dashboard/ai-reports
```

## Migration Plan

**Amended (D9, post-Phase-6, blocking archive): a second migration — grant restructuring, not just
another additive column.** D8 (below) added one additive column. D9 adds a second additive column
(`summary_athlete_safe`) PLUS `FORCE ROW LEVEL SECURITY`, a `REVOKE SELECT` on the base table from
`authenticated`/`anon`, a new masked view (`weekly_ai_reports_for_role`), and a `GRANT SELECT` on
that view to `authenticated`. This is the first schema change in this agent's diff that is not a
plain additive column — see the "View Security Semantics" note in the D9 Architecture Decision
above before reading the rollback below. The base table itself keeps every existing column; nothing
is dropped or renamed. Rollback (`_rollback.sql`) drops the view and restores the base table's
pre-migration grants — but doing so **reopens the exact exposure this migration exists to close**;
see the rollback file's own header comment.

**Amended again (D10): a THIRD migration, replacing the view with a function — D9's own migration
is already live and is NOT edited.** `20260903130000` (D9, above) is already applied in production.
Live verification found its view-based mechanism does not actually enforce row-level filtering in
this project (`postgres` has `rolbypassrls=true` — see D10's Architecture Decision). A new migration,
`20260903140000_weekly_ai_reports_masking_rpc.sql`, creates `get_weekly_ai_reports(...)` (a
`SECURITY DEFINER` function with an explicit `WHERE`-clause row-filter, reusing D9's exact
`CASE`-based column-masking expressions) and drops the now-superseded `weekly_ai_reports_for_role`
view. It does NOT touch D9's `FORCE ROW LEVEL SECURITY`, the base-table `REVOKE`, or the
`summary_athlete_safe` column — those stay exactly as D9 left them; only the read surface changes
from a view to a function. Rollback (`20260903140000_..._rollback.sql`) drops the function and the
view (defensively, in case it was ever recreated) and re-`GRANT`s base-table `SELECT` back to
`authenticated`/`anon`, so that rolling back this migration alone — without also rolling back D9's —
restores a working (if not database-enforced-masked) read path rather than a broken one; see that
file's own header for why it duplicates part of D9's own rollback intent.

**D8 (post-Phase-5, superseded in enforcement approach by D9, but still the source of the narrow
Gemini call D9's `summary_athlete_safe` extracts from): one additive column.**
`ALTER TABLE weekly_ai_reports ADD COLUMN IF NOT EXISTS
ai_analysis_athlete_safe jsonb`, nullable, no default beyond `null`. No new table, no new index, no
new RPC, no new `pg_cron` job, no RLS policy change (the pre-existing self-select RLS policy is
untouched by D8 itself — D9 is what changes the base table's grants around that policy). Rollback is
`DROP COLUMN IF EXISTS ai_analysis_athlete_safe` — no data-loss concern beyond the narrow-view rows
themselves, which are regenerable on the next run.

The original claim below ("no table, no column...") described the pre-D8 design and is retained
verbatim for its still-true parts (no table, no index, no RPC, no cron job, no RLS change); only
"no column" no longer holds.

The three things a schema change would normally buy are already present:

| Need | Existing mechanism | Why no column is needed |
|---|---|---|
| Same-week reactive dedup | `weekly_ai_reports` unique `(athlete_id, week_start)` backing the existing `upsert(..., {onConflict:'athlete_id,week_start'})` | A "did we already report this athlete this week" flag would be a denormalised copy of a key that already exists and is already enforced. The report row **is** the ledger. |
| Distinguishing a reactive row from a digest row | Nothing — deliberately | They are not different kinds of row. A reactive row is a report for the current week; the following Monday's digest legitimately upserts over it with the completed week (D1). A `source` column would invite consumers to branch on a distinction that must not exist, and `AIReports.jsx` would have to learn it. |
| Carrying engagement / plan-adjustment findings | `weekly_ai_reports.report_data` (jsonb) and `ai_analysis` (jsonb) | Additive jsonb keys, exactly as `report_data.training_load_alerts` already works. No reader change; no consumer breaks on keys it does not read. |

Two consequences worth stating because they are what the empty diff protects: there is **nothing
to reverse** in the rollback plan, and no `_rollback.sql` / `_verify.sql` sibling to write.

**Pre-deploy read-only verification** (no migration, but two live checks the proposal's
Dependencies call for):

- `weekly_ai_reports` RLS on the coach read path — this change adds no new reader, but the
  reactive path makes rows appear at times a coach did not ask for one, so confirm the existing
  policy before, not after.
- `select * from information_schema.triggers where event_object_table = 'weekly_ai_reports'` —
  this repo has a documented history of undocumented triggers (`trg_push_acwr_alert` flooding a
  coach's phone ~50× during a backfill). The reactive path is a *new* unattended writer to this
  table; confirm nothing else fires on insert/update before enabling it.

## Interfaces / Contracts

### `supabase/functions/weekly-ai-reports/logic.js` — new, zero imports

```js
/**
 * weekly-ai-reports — pure alert-tier arithmetic.
 *
 * Kept free of Deno/Supabase I/O so it runs unmodified under `node --test`,
 * exactly like training-load-monitor/logic.js and engagement-monitor/logic.js.
 * `index.ts` performs all I/O and prompt assembly.
 */

// The report's display tiers, weakest first. Index = severity rank.
export const TIER_ORDER = ['ok', 'attention', 'critical'];

/**
 * Bridge Agent 2's severity vocabulary into this report's.
 * athlete_engagement_alerts.severity is CHECK'd to ('warning','danger');
 * training_load_alerts.severity is CHECK'd to ('warning','critical').
 * Same bridge alertFeedService.mapEngagementAlert already performs client-side.
 */
export function normalizeEngagementSeverity(severity) {
  return severity === 'danger' ? 'critical' : severity;
}

/**
 * Derive the report's 3-tier display level from every agent's open findings.
 * Recomputes NO threshold — each source's rulebook already classified its own
 * row; this only maps and maxes.
 *
 * @param {Array<{severity:string}>} loadAlerts        open training_load_alerts
 * @param {Array<{severity:string}>} engagementAlerts  open athlete_engagement_alerts
 * @param {Array<{status:string}>}   planSuggestions   plan_adjustment_suggestions
 * @returns {'critical'|'attention'|'ok'}
 */
export function alertLevelFromOpenAlerts(loadAlerts, engagementAlerts = [], planSuggestions = []) {
  const severities = [
    ...(loadAlerts || []).map((a) => a.severity),
    ...(engagementAlerts || []).map((a) => normalizeEngagementSeverity(a.severity)),
    // A pending suggestion is an unmet coach decision, never independent
    // evidence: it is downstream of a training_load_alerts row already counted
    // above. Decided rows (approved/rejected/expired/superseded) are narrative
    // context only and contribute no tier.
    ...(planSuggestions || []).filter((s) => s.status === 'pending').map(() => 'warning'),
  ];
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('warning')) return 'attention';
  return 'ok';
}

/**
 * Max of two report tiers. The LLM's nivel_alerta may raise the deterministic
 * level but never lower it (see design.md, "the deterministic alert level
 * becomes a floor"). Unknown/absent values fall back to the floor.
 */
export function higherTier(floorTier, candidateTier) {
  const f = TIER_ORDER.indexOf(floorTier);
  const c = TIER_ORDER.indexOf(candidateTier);
  if (f < 0) return TIER_ORDER.includes(candidateTier) ? candidateTier : 'ok';
  return c > f ? candidateTier : floorTier;
}
```

`alertLevelFromOpenAlerts(openAlerts)` called with one argument returns exactly today's value —
the two new parameters default to `[]`. That is what keeps the `WIDE_CONTEXT=false` path
identical without a second code path.

### `weekly-ai-reports/index.ts` — the diff, region by region

**1. Imports and module constants** (after line 3):

```ts
import { alertLevelFromOpenAlerts, higherTier } from './logic.js';

// Kill switches (D7). Note the deliberately asymmetric idioms — each matches
// the house pattern for its default:
//   default-true  → `!== 'false'`  (training-load-monitor's ALERTS_ENABLED)
//   default-false → `=== 'true'`   (engagement-monitor's ALERTS_ENABLED)
const WIDE_CONTEXT_ENABLED =
  (Deno.env.get('WEEKLY_REPORT_WIDE_CONTEXT_ENABLED') ?? 'true').toLowerCase() !== 'false';
const REACTIVE_ENABLED =
  (Deno.env.get('WEEKLY_REPORT_REACTIVE_ENABLED') ?? 'false').toLowerCase() === 'true';

// Lookback for "recently decided" plan adjustments. 28 days deliberately
// matches chronic_load_28, the window this report already reasons over —
// the narrative window and the physiology window are the same window.
const PLAN_ADJUSTMENT_LOOKBACK_DAYS = 28;
const PLAN_ADJUSTMENT_MAX_ROWS = 10;

// Europe/Madrid local date. New code only — the existing last-week block at
// the bottom of the handler stays on UTC, unchanged (see design.md).
function todayLocalStr(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
}

// Pure UTC-anchored math on an already-resolved 'YYYY-MM-DD' string — not the
// ambient-clock anti-pattern (same shape as engagement-monitor's addDaysISO).
function isoWeekStartLocal(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
  return d.toISOString().slice(0, 10);
}

function daysBetweenISO(fromStr: string, toStr: string): number {
  return Math.round(
    (new Date(`${toStr}T00:00:00Z`).getTime() - new Date(`${fromStr}T00:00:00Z`).getTime()) / 86400000
  );
}

function logEvent(event: string, payload: Record<string, unknown> = {}) {
  try { console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...payload })); } catch { /* no-op */ }
}
```

**2. `alertLevelFromOpenAlerts` is deleted from `index.ts`** (lines 29-33) and imported from
`logic.js`. The explanatory comment block at lines 21-27 moves with it, extended with the
engagement/plan-adjustment mapping rationale.

**3. Two new reads in `processAthlete`'s existing `Promise.all`** — appended as elements 9 and 10,
so all eight existing destructured names keep their positions:

```ts
const planAdjustmentSince = `${(() => {
  const d = new Date(`${weekEnd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - PLAN_ADJUSTMENT_LOOKBACK_DAYS);
  return d.toISOString().slice(0, 10);
})()}T00:00:00Z`;

const [
  sessionsRes, activitiesRes, pmcRes, alertsRes, microRes, athleteRes, compRes, diaryRes,
  engagementRes, planAdjRes,               // NEW
] = await Promise.all([
  /* …1-8 unchanged… */

  // 9. Open engagement alerts (Agent 2). Coach-facing churn risk; severity is
  //    CHECK'd to ('warning','danger') and normalized to this report's tiers
  //    in logic.js. metrics carries {variant, lastSignalAt, lastSignalSource,
  //    plannedInWindow} — there is no `zone` key here.
  WIDE_CONTEXT_ENABLED
    ? supabase
        .from('athlete_engagement_alerts')
        .select('alert_type, severity, silence_days, message_es, metrics, metric_date')
        .eq('athlete_id', athleteId)
        .eq('status', 'open')
    : Promise.resolve({ data: [], error: null }),

  // 10. Plan adjustments (Agent 3): every pending row regardless of age (the
  //     partial unique index caps that at one per athlete) plus anything
  //     created in the last 28 days, whatever its status — a rejected deload
  //     from two weeks ago is the causal context the narrative needs.
  WIDE_CONTEXT_ENABLED
    ? supabase
        .from('plan_adjustment_suggestions')
        .select('finding_source, patch_type, status, message_es, metrics, earliest_target_date, created_at, decided_at')
        .eq('athlete_id', athleteId)
        .or(`status.eq.pending,created_at.gte.${planAdjustmentSince}`)
        .order('created_at', { ascending: false })
        .limit(PLAN_ADJUSTMENT_MAX_ROWS)
    : Promise.resolve({ data: [], error: null }),
]);
```

`Promise.resolve({ data: [], error: null })` (rather than omitting the element) keeps the
destructuring positional and the array length constant across both flag states — the flag changes
what is *fetched*, never the shape of the code that consumes it.

Accepted limitation of the `.or(...)`: a suggestion created >28 days ago, still pending then,
decided yesterday is not returned once it leaves `pending`. Date-based expiry
(`expire_stale_plan_adjustments`) plus `earliest_target_date` bound pending lifetime well under 28
days, and the row was visible on every run while it was pending. Filtering on `decided_at` as well
would add a third `.or()` term that is `NULL` for the pending, expired and superseded majority;
not worth the query complexity.

Then, alongside the existing derivations:

```ts
const engagementAlerts = engagementRes.data ?? [];
const planAdjustments  = planAdjRes.data ?? [];
const alertLevel = alertLevelFromOpenAlerts(openAlerts, engagementAlerts, planAdjustments);
```

and inside the `weekData` object literal (which is persisted verbatim to `report_data`, so these
keys are additive jsonb — no column, no reader change):

```ts
  training_load_alerts: openAlerts,       // existing
  engagement_alerts: engagementAlerts,    // NEW
  plan_adjustments: planAdjustments,      // NEW
  wide_context: WIDE_CONTEXT_ENABLED,     // NEW — drives prompt assembly + the floor
  week_partial: mode === 'athlete',       // NEW
  week_elapsed_days: mode === 'athlete' ? daysBetweenISO(weekStart, weekEnd) + 1 : 7,  // NEW
```

**4. Same-week dedup guard (D4)** — the first statement in `processAthlete`, before the
`Promise.all`:

```ts
async function processAthlete(
  coachId: string,
  athleteId: string,
  athleteName: string,
  weekStart: string,
  weekEnd: string,
  mode: 'sweep' | 'athlete' = 'sweep',     // NEW, defaulted so the sweep call site is unchanged
) {
  // D4 — at most one reactive Gemini call per athlete per week.
  //
  // This MUST run before the upsert further down. Two reasons, both hard:
  //   1. The upsert sets status='generating', so any check made after it can
  //      never observe the pre-existing 'completed' status — and `.select('id')`
  //      returns the post-write row, so widening it to `.select('id, status')`
  //      would read 'generating' every time and never skip.
  //   2. Upserting first and skipping second would leave a previously COMPLETED
  //      report stranded at status='generating' with its summary intact but its
  //      status lying, until the next Monday digest repaired it.
  //
  // status 'error' or 'generating' deliberately fall through to a regenerate:
  // a failed report deserves the retry, and a 'generating' row means a
  // concurrent run whose worst case is one duplicated Gemini call landing on
  // the same upsert key.
  if (mode === 'athlete') {
    const { data: existing } = await supabase
      .from('weekly_ai_reports')
      .select('id, status, alert_level')
      .eq('athlete_id', athleteId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (existing?.status === 'completed') {
      logEvent('weekly_ai_reports.reactive_skipped', {
        athlete_id: athleteId, week_start: weekStart, reason: 'already_reported_this_week',
      });
      return {
        reportId: existing.id,
        alertLevel: existing.alert_level ?? 'ok',
        athleteName,
        skipped: 'already_reported_this_week',
      };
    }
  }
  /* …existing body… */
```

`.maybeSingle()` is safe: the unique key backing the existing `onConflict: 'athlete_id,week_start'`
guarantees at most one row.

**5. The alert-level floor** (replacing lines 392-399's overwrite):

```ts
try {
  aiAnalysis = await callDeepSeek(athleteName, weekData, competitionDays);
  const modelLevel = aiAnalysis?.nivel_alerta as string | undefined;
  if (modelLevel && ['critical', 'attention', 'ok'].includes(modelLevel)) {
    // With wide context on, the rulebooks' output is a FLOOR the model may
    // raise (on evidence only it can see, e.g. diary pain_notes) but never
    // lower. With it off, today's exact "model wins" semantics are preserved,
    // byte-for-byte.
    finalAlertLevel = WIDE_CONTEXT_ENABLED ? higherTier(alertLevel, modelLevel) : modelLevel;
  }
} catch (err) {
  console.error(`DeepSeek error for athlete ${athleteId}:`, err);
}
```

The `catch` and the deterministic `summary` fallback below it are untouched: a bad Gemini response
still yields `status: 'error'` with a usable row, and — now — with the rulebooks' alert level
intact rather than defaulted.

`callDeepSeek` and the `'DeepSeek generation failed'` string are **not renamed** (proposal Out of
Scope).

**6. Prompt additions in `callDeepSeek`.** Three interpolations, each evaluating to `''` when
`weekData.wide_context` is false, so the assembled prompt string is byte-identical to today.

```ts
const engagementAlerts = weekData.engagement_alerts as Array<Record<string, unknown>> || [];
const planAdjustments  = weekData.plan_adjustments  as Array<Record<string, unknown>> || [];

const engagementBlock = engagementAlerts.length > 0
  ? engagementAlerts.map((a) => {
      const m = (a.metrics ?? {}) as Record<string, unknown>;
      const variante = m.variant === 'never_started'
        ? 'nunca llego a empezar'
        : `ultima senal de vida: ${m.lastSignalAt ?? 'desconocida'} (${m.lastSignalSource ?? 'sin fuente'})`;
      return `- [${a.severity}] ${a.message_es} — ${a.silence_days} dias sin senal de vida; ${variante}; sesiones planificadas en la ventana: ${m.plannedInWindow ?? 0}`;
    }).join('\n')
  : '- Sin alertas de inactividad: el atleta ha dado senales de vida recientemente';

const planBlock = planAdjustments.length > 0
  ? planAdjustments.map((p) => {
      const decidido = p.decided_at
        ? `decidido el ${(p.decided_at as string).slice(0, 10)}`
        : 'PENDIENTE de decision del entrenador';
      return `- [${p.status}] ${p.patch_type} (origen: ${p.finding_source}; propuesto el ${(p.created_at as string).slice(0, 10)}; ${decidido}): ${p.message_es}`;
    }).join('\n')
  : '- Ningun ajuste de plan propuesto ni decidido en los ultimos 28 dias';

const partialWeekNote = weekData.week_partial
  ? `\nATENCION — SEMANA EN CURSO: este informe se genera a mitad de semana, no al cerrarla. Cubre solo del ${weekData.week_start} al ${weekData.week_end} (${weekData.week_elapsed_days} de 7 dias). Las sesiones y los km planificados listados son SOLO los de esos dias transcurridos: NO interpretes el total semanal como incumplido ni proyectes la adherencia de la semana completa a partir de esta muestra parcial.`
  : '';

const wideContextBlocks = weekData.wide_context
  ? `
SENALES DE ADHERENCIA (agente de deteccion de inactividad; vocabulario: severidad 'danger' equivale a 'critical' en este informe, 'warning' equivale a 'attention'):
${engagementBlock}

AJUSTES DE PLAN PROPUESTOS POR EL SISTEMA (ultimos 28 dias):
${planBlock}${partialWeekNote}`
  : '';

const crossAgentInstructions = weekData.wide_context
  ? `
8. SINTESIS CRUZADA (obligatoria): las ALERTAS ACTIVAS de carga, las SENALES DE ADHERENCIA y los AJUSTES DE PLAN son tres vistas del MISMO atleta en el MISMO periodo, no tres temas. Cuando haya senales en dos o mas de esas fuentes, el "resumen" debe explicarlas como UNA sola cadena causal — que ocurrio primero, que provoco que, y que decision sigue pendiente — y no como una lista de tres observaciones independientes. Si dos fuentes se contradicen, di explicitamente cual y por que. Si solo hay senales de una fuente, no inventes conexiones con las demas.
9. "nivel_alerta" NUNCA puede ser menos grave que la fuente mas grave listada arriba: una alerta de carga 'critical' o una de adherencia 'danger' obligan a "critical"; cualquier 'warning', o un ajuste de plan PENDIENTE, obligan como minimo a "attention". Puedes subir el nivel si el resto de los datos lo justifica; nunca bajarlo.`
  : '';
```

Insertion points, both chosen so the empty-string case leaves the surrounding whitespace exactly
as it is today:

- `${wideContextBlocks}` goes immediately after the existing `competitionDays` ternary
  (`index.ts:111-115`) and before the blank line preceding `INSTRUCCIONES DE ANALISIS:`. The block
  string opens with a newline, mirroring the competition ternary's own `\n`-prefixed style, and
  carries no trailing newline.
- `${crossAgentInstructions}` goes immediately after instruction item 7's text
  (`index.ts:124`), before the blank line preceding `IMPORTANTE — INTERPRETACION DE KM…`. Same
  leading-newline / no-trailing-newline shape.

Instruction 9 is a guardrail line rather than a second synthesis instruction: it states in Spanish
the same rule `higherTier` enforces in code, so the model and the floor agree instead of the floor
silently overriding the model on every escalation. The code remains the enforcement point.

Output-size risk is unchanged: the JSON schema at the end of the prompt is untouched, so the
growth is entirely on the input side and `maxOutputTokens: 4000` is not under new pressure.

**7. Request-body handling** (replacing `index.ts:465-476`):

```ts
let weekStart: string;
let weekEnd: string;
let targetCoachId: string | null = null;
let mode: 'sweep' | 'athlete' = 'sweep';      // NEW — absent mode ⇒ sweep, so the cron body {}
let targetAthleteId: string | null = null;    //       and triggerWeeklyReports are unchanged
let alertId: string | null = null;            // log correlation only; never read as behaviour

try {
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (body.week_start) weekStart = body.week_start;
    if (body.week_end) weekEnd = body.week_end;
    if (body.coach_id) targetCoachId = body.coach_id;
    if (body.mode !== undefined) {
      // Explicit validation, NOT `mode = body.mode ?? 'sweep'`: a typo'd
      // {mode:'athelete'} must not silently degrade into a full-roster sweep.
      // Mirrors engagement-monitor's own `{error:'invalid mode'}` response.
      if (body.mode !== 'sweep' && body.mode !== 'athlete') {
        return new Response(JSON.stringify({ error: 'invalid mode' }), {
          status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      mode = body.mode;
    }
    if (body.athlete_id) targetAthleteId = body.athlete_id;
    if (body.alert_id) alertId = body.alert_id;
  }
} catch { /* ignore */ }

if (mode === 'athlete' && !targetAthleteId) {
  return new Response(JSON.stringify({ error: 'athlete_id required for mode:athlete' }), {
    status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
```

`week_start` / `week_end` parsing is untouched; in `mode:'athlete'` they are overridden by the
week-window block below rather than rejected, so a caller that sets them gets the current week and
no error.

**8. Authorization (D5)** — the existing block (`index.ts:447-463`) changes in exactly two ways:
`isServiceRole` is hoisted to a named constant, and the already-fetched `user.id` is **retained**
instead of discarded. Retaining it is the whole fix; today the identity is looked up and thrown
away, which is why any logged-in user can spend an arbitrary coach's Gemini budget.

```ts
const isCron = req.headers.get('x-supabase-cron-job') === 'true';
const authHeader = req.headers.get('Authorization');
const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;   // NEW: named, reused below
let jwtUserId: string | null = null;                               // NEW

if (!isCron && !isServiceRole) {
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  jwtUserId = user.id;                                             // NEW
}

const isTrusted = isCron || isServiceRole;                         // NEW
```

The scope check needs the parsed body, so it sits immediately **after** the body-parsing block
above, not inside the auth block:

```ts
// D5 — narrow authorization tightening. Nothing else about auth changes: the
// three accepted credentials (cron header, service-role Bearer, user JWT) are
// unchanged; only what a user JWT is permitted to ASK FOR is narrowed.
if (!isTrusted) {
  // (a) mode:'athlete' is a server-to-server path only. Its cost guard is
  //     per-athlete-per-week, so exposing it to user JWTs would let a caller
  //     walk a roster one athlete at a time and defeat that bound.
  if (mode === 'athlete') {
    logEvent('weekly_ai_reports.forbidden', { reason: 'athlete_mode_requires_service_role', user_id: jwtUserId });
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  // (b) A user JWT may only sweep its OWN roster. coach_id is REQUIRED here,
  //     not merely matched: omitting it leaves the relationship query
  //     unfiltered and sweeps every coach's roster through Gemini — the worst
  //     case of the hole this closes. triggerWeeklyReports always sends it.
  if (!targetCoachId || targetCoachId !== jwtUserId) {
    logEvent('weekly_ai_reports.forbidden', { reason: 'coach_id_mismatch', user_id: jwtUserId, requested: targetCoachId });
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

// D7 — the reactive kill switch, evaluated before any read or Gemini call.
// While disabled this branch is the mandated dry-run instrument: every
// would-have-fired reactive run is logged and counted at zero cost.
if (mode === 'athlete' && !REACTIVE_ENABLED) {
  logEvent('weekly_ai_reports.reactive_disabled_noop', { athlete_id: targetAthleteId, coach_id: targetCoachId, alert_id: alertId });
  return new Response(JSON.stringify({ ok: true, mode: 'athlete', skipped: 'reactive_disabled' }), {
    status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
```

**9. Week window** (replacing the `if (!weekStart!)` block at `index.ts:478-488`):

```ts
if (mode === 'athlete') {
  // CURRENT, in-progress week in Europe/Madrid — deliberately NOT the sweep
  // default's completed-last-week window, and deliberately NOT UTC: between
  // 00:00 and 02:00 Madrid on a Monday, UTC still reports Sunday, so a UTC
  // week start would land this partial report on top of the completed digest
  // row the cron job wrote hours earlier. Any caller-supplied week_start /
  // week_end is overridden here on purpose (see design.md).
  const today = todayLocalStr();
  weekStart = isoWeekStartLocal(today);
  weekEnd = today;                          // Monday..today, not Monday..Sunday
} else if (!weekStart!) {
  /* …existing UTC last-Monday..last-Sunday block, BYTE-UNCHANGED… */
}
```

**10. Relationship query** (`index.ts:490-497`), one added filter:

```ts
if (targetCoachId) query = query.eq('coach_id', targetCoachId);
if (mode === 'athlete') query = query.eq('athlete_id', targetAthleteId);   // NEW
```

`.eq('status', 'active')` is untouched and remains the sole independent-athlete gate — in
`mode:'athlete'`, an athlete with no active relationship yields zero rows, hence zero reports, with
no separate check. The `coach_id` and `athlete_id` filters AND together, so a reactive call whose
`coach_id` disagrees with the live relationship also yields zero rows: the path fails closed.

**11. Result plumbing** — `processAthlete` receives `mode`, and skipped runs are excluded from the
push summary so a deduped reactive run sends no notification:

```ts
return processAthlete(rel.coach_id, rel.athlete_id, athleteName, weekStart, weekEnd, mode)
  .then(result => ({
    coachId: rel.coach_id, athleteId: rel.athlete_id,
    alertLevel: result.alertLevel, skipped: result.skipped ?? null, success: true,
  }))
  .catch(err => { /* …unchanged… */ });

// …in the accumulation loop:
for (const r of batchResults) {
  results.push(r);
  if (r.skipped) continue;                 // NEW — a skipped run is not a new finding
  if (!coachSummary[r.coachId]) coachSummary[r.coachId] = { critical: 0, attention: 0 };
  /* …unchanged… */
}
```

`notifyCoach` is **not modified**. Its copy ("Informes semanales listos") reads oddly for a
mid-week single-athlete run; D6 nonetheless mandates reusing it verbatim because its URL is
already `/dashboard/ai-reports` and that is the whole delivery story. Mode-aware copy is recorded
as an Open Question, not implemented.

### `engagement-monitor/logic.js` — one added pure function

```js
/**
 * Reactive weekly-report handoff gate (engagement-agent-runtime delta:
 * "Reactive Report Trigger"). Pure decision only — `index.ts` performs the
 * actual fire-and-forget call when this returns true; a `false` here must
 * never delay or affect this function's own alert creation or delivery.
 *
 * Gates on `finding.severity === 'danger'`, which is CORRECT HERE and is
 * deliberately NOT the shape of training-load-monitor's
 * `shouldTriggerReactivePlanning`. That function must read
 * `finding.metrics.zone` because `training_load_alerts.severity` is
 * CHECK-constrained to ('warning','critical') with no 'danger' value.
 * `athlete_engagement_alerts.severity` IS CHECK-constrained to
 * ('warning','danger') (supabase/migrations/20260901100000_athlete_engagement_
 * alerts.sql), and this capability's `metrics` carries
 * {variant, lastSignalAt, lastSignalSource, plannedInWindow} — there is no
 * `zone` key at all. "Harmonising" this gate to metrics.zone would make it
 * dead code that never fires.
 *
 * danger-only by design (proposal D3): `warning` (10 days) already reaches the
 * coach through this agent's own in-app + push delivery. The narrative is what
 * Agent 4 adds, and a Gemini call is justified at escalation, not at first
 * observation.
 *
 * Reuses the exact `is_new || escalated` race-safe gate the push-delivery
 * decision already uses (the upsert RPC's own atomic result, computed under
 * FOR UPDATE at write time — never `evaluateForSweep`'s pre-write `decision`,
 * which can be stale under a concurrent invocation). A same-severity refresh
 * of an already-open danger episode must NOT re-fire.
 *
 * Dry runs need no check here: `processCandidate` returns before the upsert
 * when `effectiveDryRun`, so `upsertResult` is never produced and this gate is
 * never reached.
 *
 * @param {{alertType?:string, severity?:string}|null} finding
 * @param {{alert_id?:string, is_new?:boolean, escalated?:boolean}|null} upsertResult
 * @returns {boolean}
 */
export function shouldTriggerWeeklyReport(finding, upsertResult) {
  if (!finding || finding.alertType !== 'engagement_silence') return false;
  if (finding.severity !== 'danger') return false;
  if (!upsertResult) return false;
  return !!(upsertResult.is_new || upsertResult.escalated);
}
```

The `alertType` check is redundant today — the column is `CHECK (alert_type IN
('engagement_silence'))` — and is kept deliberately: if a second engagement alert type is ever
added, the default must be "does not fire a Gemini call", not "fires silently".

### `engagement-monitor/index.ts` — the outbound call site

Import (line 3) gains `shouldTriggerWeeklyReport`. The call goes in `processCandidate`,
immediately after the existing push gate:

```ts
  if (upserted && shouldDeliverPush(upserted)) {
    await deliverPush(supabase, candidate.coachId!, result.finding.messageEs);
  }

  // Reactive handoff to weekly-ai-reports: danger tier only, on creation or
  // warning→danger escalation. Fire-and-forget — zero awaits on the alerting
  // path; its failure must not affect alert creation or delivery
  // (engagement-agent-runtime delta: "Reactive Report Trigger").
  if (shouldTriggerWeeklyReport(result.finding, upserted)) {
    triggerWeeklyReport(candidate.athleteId!, candidate.coachId!, upserted?.alert_id ?? null);
  }
```

```ts
// Mirrors chainNextSweepPage / training-load-monitor's triggerPlanningAgent
// shape verbatim: `.then/.catch` attached BEFORE the promise is handed to
// EdgeRuntime.waitUntil inside a try/catch, so an unhandled rejection can
// never tear down the isolate and no await ever appears on the alerting path.
function triggerWeeklyReport(athleteId: string, coachId: string, alertId: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // CRITICAL — do NOT copy triggerPlanningAgent's `Bearer ${cronSecret || serviceRoleKey}`.
  // `weekly-ai-reports` does not accept CRON_SECRET at all: its auth is the
  // `x-supabase-cron-job: true` header, OR a service-role Bearer, OR a valid
  // user JWT. A Bearer CRON_SECRET falls into the JWT branch, fails
  // supabase.auth.getUser(), and 401s — silently, in a fire-and-forget call
  // nobody is awaiting. (Same failure class as the documented CRON_SECRET
  // rotation that left cleanup-gym-files 401ing unnoticed.) Service-role only.
  const task = fetch(`${supabaseUrl}/functions/v1/weekly-ai-reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    // alert_id is passed for log correlation only; weekly-ai-reports parses it
    // and never branches on it.
    body: JSON.stringify({ mode: "athlete", athlete_id: athleteId, coach_id: coachId, alert_id: alertId }),
  })
    .then(() => {
      logEvent("engagement_monitor.weekly_report_triggered", { athlete_id: athleteId, alert_id: alertId });
    })
    .catch((err) => {
      logEvent("engagement_monitor.weekly_report_trigger_failed", {
        athlete_id: athleteId, alert_id: alertId, error: String(err),
      });
    });

  try {
    // @ts-ignore EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(task);
  } catch {
    // Fall-through: promise still runs in background
  }
}
```

`engagement-monitor` reads **no new env var**: `WEEKLY_REPORT_REACTIVE_ENABLED` is enforced at the
receiver.

### Request contract summary — `POST /functions/v1/weekly-ai-reports`

| Caller | Credential | Body | Week window |
|---|---|---|---|
| `weekly-ai-reports-monday` cron | `x-supabase-cron-job: true` | `{}` | last Mon–Sun (UTC), unchanged |
| Coach "regenerar" | user JWT | `{coach_id}` — **required, must equal `user.id`** | last Mon–Sun (UTC), unchanged |
| Coach, explicit week | user JWT | `{coach_id, week_start, week_end}` | as given, unchanged |
| `engagement-monitor` reactive | `Bearer SERVICE_ROLE_KEY` | `{mode:'athlete', athlete_id, coach_id, alert_id}` | **this Mon → today (Europe/Madrid)** |

Responses: `400 {error:'invalid mode'}`, `400 {error:'athlete_id required for mode:athlete'}`,
`403 {error:'Forbidden'}` (D5), `200 {ok:true, mode:'athlete', skipped:'reactive_disabled'}` (D7),
`200 {ok, week_start, week_end, processed, results[]}` where `results[]` items gain a nullable
`skipped` field. The **report** JSON (`ai_analysis`) gains no key at all — D2's hard constraint.

## Frontend

**Amended (D10, supersedes D9's "three files now query the view"): the same files now call the RPC
instead — same masked shape, different resource name and call form.**

| File | Why unchanged / what changed |
|---|---|
| `src/pages/dashboard/AIReports.jsx` | **Modified (D9, was "Unchanged" under D8; unaffected by D10).** The report JSON schema is still untouched (D2) — no direct edit to this file's own logic — but its data source (`aiReportService.js`) now calls `get_weekly_ai_reports` instead of the base table, required because the D9 `REVOKE` removes the coach's own `authenticated`-role base-table `SELECT` too. The RPC resolves `ai_analysis`/`summary` to the WIDE value for the report's own coach, so this page's rendering is unaffected in practice — only its data source moved (view under D9, function under D10). |
| `src/services/alertFeedService.js` | Unchanged. D6 — a weekly report has no `read_at`/`dismissed_at` and no open/resolved lifecycle, and its content is a synthesis of the very alerts already in the feed. A fourth `source` would duplicate its own inputs one row above itself. |
| `src/components/shared/TrainingLoadAlertFeed.jsx` | Unchanged. Same; no fourth source, no new `SEVERITY_CLASSES` entry. |
| `src/services/aiReportService.js` | **Modified (D9, then D10 — D10 swaps `.from('weekly_ai_reports_for_role')` for `.rpc('get_weekly_ai_reports', {...})`).** `getCoachWeeklyReports`/`getCoachReportWeeks` call the RPC, chaining the same `.select()`/`.order()`/`.limit()` filters as before. `triggerWeeklyReports` itself (the POST to the Edge Function) is unaffected by either D9 or D10 — D5's auth tightening remains satisfied without an edit there — **verify live after deploy** (the regenerate button is the one path the tightening could break, unrelated to this read-path change). |
| `src/pages/athlete/MyReports.jsx` | **Modified (D8, then D9, then D10 — the D10 shape supersedes D9's).** Now calls `get_weekly_ai_reports`; `ReportCard`/`ReportDetail` still read `report.ai_analysis`/`report.summary` directly (D9's shape, unchanged by D10), since the RPC already resolves them to the correctly-masked value. D8's `ai_analysis_athlete_safe \|\| ai_analysis` fallback stays removed (D9) — the RPC does not expose that raw column either, same as the view didn't. |
| `src/lib/pdfExport.js` | **Modified (D8, then D9; comment-only update under D10).** `mapReportToDocProps` reads `report?.ai_analysis` directly — same reasoning as `MyReports.jsx`, its only call site (re-confirmed by grep during the D10 batch). No functional change under D10, since this file never queried the view/RPC directly — its explanatory comment is updated to name the RPC for accuracy. |

The only file outside the proposal's Affected Areas table is `package.json`, gaining
`"supabase/functions/weekly-ai-reports/**/*.test.js"` to the `test:core` glob. Test wiring, not
behaviour.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `alertLevelFromOpenAlerts([], [{severity:'danger'}], [])` ⇒ `'critical'` — the proposal's headline criterion, with **zero** `training_load_alerts` | `node --test` over `weekly-ai-reports/logic.test.js`, `npm run test:core` |
| Unit | `normalizeEngagementSeverity`: `danger→critical`, `warning→warning`; the full 2×3 cross-vocabulary matrix through `alertLevelFromOpenAlerts` | table-driven |
| Unit | `alertLevelFromOpenAlerts(openAlerts)` with one argument returns today's value for all three tiers — the byte-identity guarantee expressed as a test | direct assertion |
| Unit | A `pending` suggestion alone ⇒ `'attention'`, never `'critical'`; `approved`/`rejected`/`expired`/`superseded` alone ⇒ `'ok'` | table-driven |
| Unit | `higherTier`: LLM raises (`attention`→`critical` kept), LLM lowers (`critical` floor holds against `ok`), unknown/absent candidate falls back to the floor | table-driven |
| Unit | `shouldTriggerWeeklyReport`: `danger`+`is_new` ⇒ true; `danger`+`escalated` ⇒ true; `danger` refresh (neither flag) ⇒ false; `warning` in every flag combination ⇒ false; `null` finding / `null` result ⇒ false; a hypothetical second `alertType` ⇒ false | `engagement-monitor/logic.test.js`, glob already in `test:core` |
| Integration | `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=false`: capture the assembled prompt string and the response JSON for a fixed athlete, diff against a pre-change capture ⇒ **byte-identical** | manual capture, both bundles, same athlete/week |
| Integration | Second `danger` escalation for the same athlete in the same week ⇒ zero additional Gemini calls, `{skipped:'already_reported_this_week'}`, and the existing `completed` row's `status` and `summary` are **unchanged** (the stranded-`generating` failure mode) | live, reactive enabled |
| Integration | Monday digest after a mid-week reactive row: same `(athlete_id, week_start)` row, `week_end` corrected to Sunday, full-week numbers | live, across a week boundary |
| Integration | Forced failure of the reactive `fetch` (bad URL / revoked key) leaves the `athlete_engagement_alerts` row created, escalated and push-delivered, and the sweep's response unchanged | live, temporary env break |
| Manual | `mode:'athlete'` with a plain user JWT ⇒ 403; user JWT with another coach's `coach_id` ⇒ 403; user JWT with **no** `coach_id` ⇒ 403; the coach's own regenerate button still 200s | three JWTs, curl |
| Manual | `WEEKLY_REPORT_REACTIVE_ENABLED=false` ⇒ `reactive_disabled_noop` logged, zero Supabase reads, zero Gemini spend; the log count over 30 days of `danger` escalations **is** the mandated pre-enable dry-run review | log query, proposal-mandated gate |
| Manual | An independent athlete (no active relationship) forced through `mode:'athlete'` ⇒ `processed: 0`, no row written | curl with service-role |
| Manual | `information_schema.triggers` on `weekly_ai_reports`, and `weekly_ai_reports` RLS on the coach read path, reviewed before enabling reactive | pre-deploy gate |
| Review | First live widened Monday digest for an athlete with signals from ≥2 agents: is the `resumen` one causal chain or three stapled observations? | human read, blocks enabling reactive |
| Grep | `supabase/migrations/` diff is empty; `AIReports.jsx`, `alertFeedService.js`, `TrainingLoadAlertFeed.jsx` diffs are empty; no `chat_messages` / `training_sessions` write and no `send-email` call anywhere in this change | CI-checkable |

## Rollout / Rollback

1. **Slice 1 — read-only widening, reactive unreachable.** `logic.js` + unit tests,
   `weekly-ai-reports/index.ts` (reads, prompt, floor, `mode`, week window, dedup guard, D5),
   deployed with `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true` and
   `WEEKLY_REPORT_REACTIVE_ENABLED=false`. No new caller exists yet; the only behaviour change is
   a richer Monday digest at identical spend. Verify the regenerate button and the 403 matrix live.
2. **Slice 2 — reactive wired, still no-op.** `engagement-monitor` `logic.js` gate + call site
   deployed. Every `danger` creation/escalation now reaches `weekly-ai-reports` and returns
   `reactive_disabled`. Let it run; the accumulating `reactive_disabled_noop` log lines are the
   dry-run evidence D7 requires.
3. **Slice 3 — flip the switch.** Review the first widened digest (step 1) *and* the 30-day
   would-have-fired count (step 2), then set `WEEKLY_REPORT_REACTIVE_ENABLED=true` on
   `weekly-ai-reports` only.

Rollback maps 1:1 to the proposal, in increasing cost:

1. `WEEKLY_REPORT_REACTIVE_ENABLED=false` — instant, already the default, and the reactive path
   returns to a logged no-op. No redeploy.
2. `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=false` — the prompt, the two reads and the alert-level
   floor all degrade to today's exact behaviour in one env change. No redeploy, no data change.
3. Redeploy the previous `weekly-ai-reports` and `engagement-monitor` bundles.

**Amended (D9, then D10): there ARE now three migrations to reverse if a full rollback is ever
needed** — D8's additive column, D9's view/grant restructuring (already live), and D10's
function-based replacement of D9's view, each with its own `_rollback.sql`. Rolling back D9's or
D10's migration specifically **reopens the exposure they exist to close** (restores `authenticated`/
`anon` base-table `SELECT`) — see each migration's own rollback file header; D10's rollback is
deliberately self-contained (it re-`GRANT`s base-table `SELECT` itself rather than depending on D9's
rollback also being run) so that rolling back only the newest migration does not strand the product
in a broken, fail-closed-to-everyone state. Rolling back D8/D9/D10 does not require reverting the
frontend or `weekly-ai-reports/index.ts` unless you also intend to stop generating the narrow
analysis — a partially-rolled-back state (columns/function/view gone, code still writing/reading
them) fails safe (`null` values, the frontend's RPC call erroring rather than silently exposing wide
content), not open.

**Original text, still true for D1-D8's own diff**: no table drop, no cron job to unschedule, and no
frontend commit to revert *for the pre-D9 parts of this change*. Already-generated widened reports
stay in place: they are valid rows in the unchanged schema, shape-indistinguishable from pre-change
rows. Neither kill switch can disable the Monday digest — a hard invariant of this change, asserted
by the "`false`/`false` still produces the digest" integration test.

**D9/D10 deployment ordering**: since D9's migration is already live, the D10 migration
(`get_weekly_ai_reports` function + drop of the flawed view) should deploy in the SAME step as the
`MyReports.jsx`/`AIReports.jsx`/`aiReportService.js` frontend changes that switch from
`.from('weekly_ai_reports_for_role')` to `.rpc('get_weekly_ai_reports', ...)`, not before it and not
after — deploying the migration (which drops the view) before the frontend switch would break every
report page that still queries the view; deploying the frontend switch before the migration would
have those calls hit a function that does not exist yet. Both must land together. Unlike D9's own
original ordering note, there is no re-opened exposure window either way this time: D9's `REVOKE` on
the base table and `FORCE ROW LEVEL SECURITY` are already live and untouched by D10, so at every
point during this deploy the base table itself stays closed to `authenticated`/`anon` — the only
question is which masked resource (view or function) is momentarily missing.

## Open Questions

- [ ] **`notifyCoach` copy for a reactive run.** "Informes semanales listos / 1 atleta requiere
      atencion urgente" is factually true but reads like a Monday digest on a Wednesday. D6
      mandates reusing `notifyCoach` verbatim and this design does; mode-aware copy is a
      deliberate non-goal here. Revisit after the first live reactive runs.
- [ ] **Verify live before deploy: does every `triggerWeeklyReports(coachId, …)` call site pass the
      session user's own id?** `aiReportService.js` reads `getSession()` for the token but takes
      `coachId` as an argument; a component passing a viewed coach's id would start 403-ing under
      D5. Cheap grep + one live click.
- [ ] **Verify live before deploy: `weekly_ai_reports` RLS on the coach read path**, and
      `information_schema.triggers` on that table. This change adds no new reader but does add a
      new unattended writer, and this repo has a documented undocumented-trigger incident.
- [ ] **28-day plan-adjustment lookback is a judgment call**, justified by matching
      `chronic_load_28`. Revisit once there is real approve/reject volume; the constant is named
      (`PLAN_ADJUSTMENT_LOOKBACK_DAYS`) precisely so it is one edit.
- [ ] **The alert-level floor is a behaviour change the proposal does not name.** It is required
      for the proposal's own `danger ⇒ critical` success criterion to be deterministic rather than
      a sampling outcome, and it is gated so `WIDE_CONTEXT=false` preserves today's semantics — but
      it should be reflected in the `weekly-report-synthesis` capability as an explicit
      requirement, not left as a design-only decision.
