# Proposal: Communication Agent (Agent 4)

## Intent

Agents 1, 2 and 3 each answer one question. None answers the coach's actual question. A coach opening an athlete today can see an ACWR danger alert, a 21-day silence alert and a pending volume cut — three rows, three vocabularies, no story. Nothing in the product says *this athlete is in trouble, and here is why the three signals are the same event*.

Agent 4 produces that story. It is **coach-facing synthesis only**: it never drafts and never sends a message to an athlete on any channel. Scope is **coach-supervised athletes only**.

It does this by **widening an already-shipped feature**, not by building a fourth Edge Function. `weekly-ai-reports` already performs Gemini-based weekly per-athlete synthesis into `weekly_ai_reports`, already runs on a versioned Monday `pg_cron` job, and already delivers to the coach via push + `notifications`. Its input is the gap: it reads `training_load_alerts` and nothing from Agents 2 or 3.

These four decisions are settled input, not open questions: synthesis/explanation only; coach-supervised only; extend `weekly-ai-reports`; hybrid trigger (weekly digest + reactive).

## Decisions

### D1 — Verified corrections to the exploration's assumptions

Read live from `supabase/functions/weekly-ai-reports/index.ts` (2026-09-03). Four findings change the design:

| Finding | Consequence |
|---|---|
| The function accepts `coach_id`, `week_start`, `week_end` — **there is no `athlete_id` param**. No single-athlete invocation path exists. | The reactive path must add one. Small: one `.eq('athlete_id', …)` on the relationships query. |
| With no body params it computes **last week** (previous Mon–Sun), by design for a Monday digest. | A naive reactive call mid-week would produce a report about *last* week. The reactive path MUST pass the **current** week window explicitly. |
| The row is upserted on `(athlete_id, week_start)`. | A current-week reactive row and the Monday digest row are **different rows**; the following Monday's digest legitimately upserts over the reactive row with the completed week. Dedup falls out of the existing key — no new table, no new column. |
| Auth is `x-supabase-cron-job: true` **or** service-role Bearer **or** *any valid user JWT* — **not** `CRON_SECRET` (documented in migration `20260819146000`). There is no check that the JWT user equals the requested `coach_id`. | Pre-existing: any logged-in user can burn a whole roster's Gemini budget for an arbitrary coach. See D5. |

Also noted, not scoped: `callDeepSeek()` and the `'DeepSeek generation failed'` error string are stale names — the function calls Gemini.

### D2 — The widening is input-only; the report JSON contract is unchanged

Two reads are added to `processAthlete`'s existing parallel query block: open `athlete_engagement_alerts` and pending/recently-applied `plan_adjustment_suggestions`. They enter the prompt as two new context blocks alongside the existing `ALERTAS ACTIVAS`, and the prompt gains one instruction: *cross the three agents' signals into one causal explanation rather than listing them*.

**No new top-level key is added to the response JSON.** Engagement and plan-adjustment findings surface through the existing `resumen`, `alertas[]` and `recomendaciones[]`. Consequence: **this change touches zero frontend files and zero migrations.** `AIReports.jsx` renders richer strings in the same shape.

`alertLevelFromOpenAlerts` widens to all three sources and MUST normalize engagement's `danger` to the report's `critical` tier — the same vocabulary bridge `alertFeedService.mapEngagementAlert` already performs.

### D3 — Reactive fires on `engagement_silence` **danger** only, never `warning`

Verified against `openspec/specs/athlete-engagement-alerts/spec.md`: `warning` is 10+ days, `danger` is 21+ days. Agent 3's brief cited "10+ days" — that is the warning tier.

Reactive fires on `danger` creation **and** on the `warning → danger` escalation, mirroring Agent 3's `acwr_zone` danger-only rule and Agent 2's own observation-vs-intervention tier split. `warning` is deliberately excluded: the coach is *already* told promptly at 10 days by Agent 2's own in-app + push delivery in the merged feed. What Agent 4 adds is the narrative, and paying a Gemini call for it is justified at escalation, not at first observation.

Mechanically: `mode: 'sweep' | 'athlete'` on the request body, defaulting to `sweep` when absent so the existing cron body `{}` and `triggerWeeklyReports` keep working unchanged. `engagement-monitor` invokes `mode: 'athlete'` fire-and-forget via `EdgeRuntime.waitUntil` — its failure MUST NOT affect alert creation (Agent 2's own `strava-webhook` precedent).

### D4 — Cost guard: at most one reactive Gemini call per athlete per week

Before calling Gemini in `mode: 'athlete'`, the function checks for an existing `weekly_ai_reports` row at `(athlete_id, current week_start)` with `status = 'completed'`. If present it returns `{ skipped: 'already_reported_this_week' }` without a Gemini call. The existing upsert row *is* the dedup ledger.

Worst case is therefore bounded at **2× the current weekly budget** (one digest + one reactive per athlete), with a second independent bound upstream: a `danger` escalation happens once per silence episode, not daily.

**Amended (D8):** each `processAthlete` invocation (digest OR reactive) now costs up to **2 Gemini calls**, not 1, when `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true` — the existing wide-context call plus D8's new narrow athlete-safe call. `WIDE_CONTEXT_ENABLED=false` is unaffected (still 1 call; no second call is ever made). Combined with the digest+reactive bound above, the true worst case per athlete per week is now up to **4 Gemini calls** (2 for the digest + 2 for a reactive run) when both `WIDE_CONTEXT_ENABLED` and `WEEKLY_REPORT_REACTIVE_ENABLED` are `true`, not the 2 calls (1+1) this document originally stated as the worst case. See the Risks table.

### D5 — Narrow authorization fix, because this change adds the lever

Agent 3's precedent is "do not smuggle unrelated fixes into an agent PR" (`assignPlanToAthletes`). This is not that case: the D1 auth hole is in the exact handler this change extends, and this change adds an `athlete_id` param and a new invocation mode to it — adding a lever to a known-broken lock.

Scoped minimally: when the caller is a user JWT (not cron, not service-role), the request's `coach_id` MUST equal the authenticated user, and `mode: 'athlete'` MUST be reachable only by cron/service-role. Nothing else about the auth block changes.

### D6 — The narrative stays on `/dashboard/ai-reports`; the merged feed gets nothing

The merged feed's contract is *open items awaiting acknowledgement or decision* — every item carries `read_at`/`dismissed_at` and an open/resolved or pending/terminal lifecycle. A weekly report has none of those: it is per-athlete-per-week reference material, and its content is a synthesis of the very alerts already in the feed. A fourth `source` would need an invented lifecycle and would duplicate its own inputs one row above itself.

Agent 2's "one place to look" principle is honoured differently: the reactive path reuses the existing `notifyCoach` push, whose URL is already `/dashboard/ai-reports`. The coach is told promptly and lands on the narrative. **`alertFeedService.js` and `TrainingLoadAlertFeed.jsx` are not modified by this change.**

### D7 — Two kill switches, because the two behaviours have different risk

The house rule from Agent 3's D5 ("read-only may default enabled; mutating defaults disabled") does not discriminate here — neither behaviour mutates athlete data. This proposal extends the rule on the axis that actually applies:

> Read-only agents may default enabled; agents that mutate athlete data, **or that introduce a new unattended invocation path carrying per-call external-API cost**, default disabled until a reviewed dry-run.

| Gate | Default | Justification |
|---|---|---|
| `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED` | `true` | Read-only, no new spend — the same one Gemini call per athlete, with a longer prompt. Degrades to today's exact behaviour when `false`. |
| `WEEKLY_REPORT_REACTIVE_ENABLED` | `false` | New unattended trigger and new Gemini spend. Enabled only after a dry-run reports how many reactive runs the last 30 days of `danger` escalations would have produced. |

Neither gate can disable the shipped Monday digest. That is a hard invariant of this change.

### D8 — A pre-existing athlete self-select RLS policy exposes the wide-context synthesis; the fix is a second, narrow-input Gemini call, never a prompt instruction

Found live by the orchestrator after Phase 5 completed, before deploy. `weekly_ai_reports` carries a **pre-existing** RLS SELECT policy — `(select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id` — so an athlete can already read their own row. `src/pages/athlete/MyReports.jsx` ("Mis Informes IA") is a live, shipped page that does exactly this: it queries `weekly_ai_reports` as the athlete and renders `ai_analysis.resumen`, `ai_analysis.alertas[].descripcion` and `ai_analysis.recomendaciones[]` verbatim.

D2's widening and D3's `SINTESIS CRUZADA` instruction write into that SAME `ai_analysis` column — the one column D6 already assumed stayed off the athlete-visible surface. Once a `WIDE_CONTEXT_ENABLED=true` report lands, an athlete opening `MyReports.jsx` would see the coach-facing "why is this athlete flagged" narrative, including content like *"your coach is considering reducing your volume due to inactivity signals"* — directly undoing the athlete-self-select exclusion Agents 2 and 3 both deliberately built into their own alert tables, and contradicting D6's own premise.

**The fix, confirmed by the user and non-negotiable**: the security boundary is *what data was ever sent to Gemini for a given stored output*, never a prompt instruction telling the model what to omit for an audience — an LLM is not a reliable enforcement boundary for a privacy guarantee. When `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true`, `processAthlete` makes a **second** `callDeepSeek` call with a narrow `weekData` view (`wide_context: false`, `engagement_alerts: []`, `plan_adjustments: []` — reusing the exact narrow-mode code path `callDeepSeek` already has for `WIDE_CONTEXT_ENABLED=false`, never a second prompt template) and persists its output into a new `ai_analysis_athlete_safe` jsonb column. `MyReports.jsx` reads `ai_analysis_athlete_safe`, falling back to `ai_analysis` only when it is `null` — which covers `WIDE_CONTEXT_ENABLED=false` runs (already narrow, nothing to duplicate) and every historical row from before this fix (never widened in the first place, safe to fall back on). When `WIDE_CONTEXT_ENABLED=false`, no second call is made at all.

Two consequences that correct earlier claims in this document:

- **"Zero migrations" is no longer true.** One additive migration adds `weekly_ai_reports.ai_analysis_athlete_safe jsonb`, nullable, no default beyond `null`. See the corrected Affected Areas row below.
- **D2's "no new top-level key" referred to the HTTP wrapper response's top-level shape** (`{ok, week_start, week_end, processed, results}`), not the stored row's columns. Clarified here since the stored row DOES gain one new column — that is correct and necessary under D8, not a violation of D2's original intent.

Cost impact (also folded into D4 below): each `processAthlete` invocation that has `WIDE_CONTEXT_ENABLED=true` now costs up to **2** Gemini calls (the existing wide-context call, plus D8's narrow athlete-safe call) instead of 1. The second call's own failure MUST NOT fail the primary (coach-facing) report — it is independently try/caught, logs, and leaves `ai_analysis_athlete_safe` `null` on failure.

### D9 — D8 was necessary but not sufficient: Postgres RLS is row-level, not column-level; the actual fix is a masked view plus a `REVOKE`, not an app-layer query convention

Found live by the orchestrator during `sdd-verify` after Phase 6, **CRITICAL, blocking archive**. Confirmed against production (`information_schema.column_privileges`): the `authenticated` role — and, worse, `anon` — hold **unrestricted `SELECT`** on every column of `weekly_ai_reports`, including the wide, coach-facing `ai_analysis` and `summary` columns, with **zero column-level `REVOKE` anywhere in this codebase**. This is Supabase's default schema-wide bootstrap grant (`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon`), not something this change introduced — but D8's fix did not close it.

D8's premise was that `MyReports.jsx` reading `ai_analysis_athlete_safe` instead of `ai_analysis` closes the exposure. It does not: Postgres RLS is **row-level only**. The existing RLS SELECT policy (`(select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id`, `supabase/add_missing_rls_policies.sql:193-202`) controls WHICH ROWS an athlete can see — once their own row is visible, the athlete can `SELECT ai_analysis, summary` directly via PostgREST (`GET /rest/v1/weekly_ai_reports?select=ai_analysis,summary`), bypassing whatever column the app chooses to query entirely. D8 changed what the APP asks for; it never changed what the DATABASE permits. An athlete curious enough to open devtools and hit the REST endpoint directly — or any third party who obtains a valid athlete JWT — could always read the full coach-facing synthesis, regardless of D8 shipping.

**Also found in the same pass, not previously flagged**: `weekly_ai_reports.summary` (set from `aiAnalysis.resumen` whenever `WIDE_CONTEXT_ENABLED=true`) has the identical exposure, and had no `summary_athlete_safe` counterpart until this fix.

**The fix, confirmed by the user and non-negotiable**: a masked VIEW with conditional columns based on who is asking, plus `REVOKE`ing direct base-table `SELECT` from `authenticated` (and `anon`) — the standard Postgres/Supabase pattern for column-level masking, since Postgres has no native column-level RLS. Concretely (see design.md's matching Architecture Decision for the full DDL and its documented assumptions about view-ownership/RLS-bypass semantics):

- Add `weekly_ai_reports.summary_athlete_safe text` (additive, nullable) — the narrow, athlete-safe Gemini call D8 already makes has its own `.resumen` field, which IS the athlete-safe summary. Free: no third Gemini call.
- `ALTER TABLE weekly_ai_reports FORCE ROW LEVEL SECURITY` — required so the view (owned by a privileged, non-`BYPASSRLS` role) does not accidentally bypass RLS and leak every row to every caller.
- `REVOKE SELECT ON weekly_ai_reports FROM authenticated, anon` — closes the actual hole. `service_role` is untouched; the Edge Function is unaffected.
- A new view, `weekly_ai_reports_for_role`, exposing every existing column except `ai_analysis`/`summary`, which are aliased via `CASE WHEN (select auth.uid()) = coach_id THEN <wide> ELSE <athlete_safe> END` — so `MyReports.jsx`, `AIReports.jsx`, and `aiReportService.js` query `ai_analysis`/`summary` on the VIEW and transparently get the correctly-masked value with **zero app-layer branching**. This lets Phase 6's `ai_analysis_athlete_safe || ai_analysis` fallback in the frontend be **removed**, not extended — the enforcement point moved to the database, where it belongs.
- `GRANT SELECT ON weekly_ai_reports_for_role TO authenticated` only — not `anon`.

This corrects the Success Criteria and Affected Areas below, and supersedes D8's implicit "the app-layer fallback is sufficient" framing. The actual enforceable guarantee is: an athlete's session, querying the database **directly** (not just through the app), cannot retrieve `ai_analysis`/`summary` for a row where they are not `coach_id` — verifiable only by a live RLS/grant test with a simulated JWT, never by reading application source.

### D10 — D9's migration was already applied live, and its own stated assumption turned out false for this project: `postgres` has `rolbypassrls=true`, so the masked VIEW leaked every row to every caller; the fix is a `SECURITY DEFINER` function with an explicit row-filter

D9's own "View Security Semantics" note was honest about what it could not verify without live Supabase access: it explicitly assumed the migration-running role does not carry `BYPASSRLS`, and flagged that if it does, `FORCE ROW LEVEL SECURITY` has no effect. The orchestrator applied D9's migration to production, then live-tested it (rolled-back transactions, real simulated JWTs) and found that assumption **false**: `SELECT rolname, rolbypassrls FROM pg_roles` confirms `postgres` — the role that owns `weekly_ai_reports` and owns `weekly_ai_reports_for_role` — has `rolbypassrls = true` in this project. `FORCE ROW LEVEL SECURITY` does not override an explicit `BYPASSRLS` role attribute — documented Postgres behavior, not a bug — so the view returned **every row to every caller** holding `SELECT` on it, completely bypassing row-level filtering (the column-masking `CASE` logic itself was correct; only row visibility was broken).

The orchestrator also tried `ALTER VIEW weekly_ai_reports_for_role SET (security_invoker = true)` and confirmed it fails **differently**: it requires the calling role (`authenticated`) to hold its own direct `SELECT` grant on the base table, which D9's own `REVOKE SELECT ... FROM authenticated` (correct, and unchanged by this decision) makes impossible. Dead end.

**The fix, live-verified by the orchestrator** (rolled-back transactions, 3 real scenarios): a `SECURITY DEFINER` function, `get_weekly_ai_reports(...)`, with the row-filter written explicitly in its own `WHERE` clause — `WHERE ((select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id)` — inside the function body. This works regardless of the definer's `BYPASSRLS` status, because the filter is literal SQL evaluated by the function itself, never something that depends on RLS being "applied" to the definer at all. Confirmed live: (a) a coach querying for their own athlete's report gets the WIDE `ai_analysis`/`summary`; (b) that same athlete querying their own report gets the NARROW `*_athlete_safe` content; (c) an unrelated user gets ZERO rows; (d) direct base-table access as `authenticated` is still denied (D9's `REVOKE` is untouched and remains the enforcement point).

D9's migration (`20260903130000`) is **already live** and is not edited. A new migration (`20260903140000`) creates the function, reusing D9's exact column-masking `CASE` expressions, and drops the now-superseded `weekly_ai_reports_for_role` view (already neutralized by the orchestrator running `REVOKE SELECT ON weekly_ai_reports_for_role FROM authenticated` pre-emptively, so there was no real-world exposure window — nothing in deployed code ever queried it from a browser session). `aiReportService.js` and `MyReports.jsx` switch from `.from('weekly_ai_reports_for_role')` to `.rpc('get_weekly_ai_reports', {...})`.

**Reusable lesson for this project**: a masking VIEW's correctness depends entirely on whether the view owner carries `BYPASSRLS`. `FORCE ROW LEVEL SECURITY` on the base table is NOT sufficient to guarantee row-scoping through a view if the view owner is a `BYPASSRLS` role (true for `postgres` here) — always verify `rolbypassrls` for the actual owning role before relying on this pattern. A `SECURITY DEFINER` function with an explicit `WHERE`-clause row-filter has no equivalent failure mode and is the safer default for any future column-masking-via-view design in this project.

## Scope

### In Scope

- `weekly-ai-reports/index.ts`: two added reads (`athlete_engagement_alerts`, `plan_adjustment_suggestions`) into `processAthlete`'s existing parallel block
- Prompt widening + cross-agent causal-narrative instruction; response JSON schema unchanged (D2)
- `alertLevelFromOpenAlerts` widened to three sources with `danger → critical` normalization
- `mode: 'sweep' | 'athlete'` + `athlete_id` param, defaulting to `sweep`; current-week window for `mode: 'athlete'` (D1/D3)
- Same-week dedup guard on the existing upsert key (D4)
- Narrow authorization tightening (D5)
- `engagement-monitor`: fire-and-forget reactive invocation on `danger` creation/escalation (D3)
- Two env-var gates and a dry-run reporting path (D7)
- One additive migration: `weekly_ai_reports.ai_analysis_athlete_safe` jsonb, nullable (D8)
- A second, narrow-input Gemini call per athlete when `WIDE_CONTEXT_ENABLED=true`, persisted to `ai_analysis_athlete_safe` (D8)
- **A second migration (D9, already live)**: `weekly_ai_reports.summary_athlete_safe` text (additive, nullable), `FORCE ROW LEVEL SECURITY`, `REVOKE SELECT` from `authenticated`/`anon`, a new masked view `weekly_ai_reports_for_role`, `GRANT SELECT` on the view to `authenticated`
- **A third migration (D10)**: `get_weekly_ai_reports(...)`, a `SECURITY DEFINER` function with an explicit row-filter `WHERE` clause, replacing D9's view (which does not actually enforce row-level filtering in this project — `postgres` has `rolbypassrls=true`); drops the now-superseded `weekly_ai_reports_for_role` view
- `MyReports.jsx`, `AIReports.jsx`, `aiReportService.js`: call `get_weekly_ai_reports` via `.rpc()` instead of querying the view or the base table; `MyReports.jsx`/`pdfExport.js` read `ai_analysis`/`summary` directly (unchanged since D9) — the RPC masks them, D8's app-layer fallback stays removed (D9/D10)

### Out of Scope

- **Any outbound message to an athlete** on chat, push or email — the settled central decision. No `chatService.js`, `send-email/`, `emailService.js` or `react-email-starter/` change.
- **A new `_shared/communicationCore.js` and a fourth Edge Function** — explicitly rejected in favour of extending a shipped feature. Agents 1–3's pure-core convention does not apply: there is no deterministic rulebook here, only prompt assembly.
- **Independent athletes** — same exclusion as Agents 2 and 3. `weekly-ai-reports` is already gated on active `coach_athlete_relationship`.
- **Reactive on `engagement_silence` warning, or on any Agent 1/Agent 3 finding** (D3). Those reach the coach through the merged feed and the Monday digest.
- **Any frontend change**, including a merged-feed row (D6) and any `AIReports.jsx` edit.
- **Retro-specifying the whole existing `weekly-ai-reports` feature** — PMC/Strava/diary reads, competition prediction, batching, the full prompt. See Capabilities.
- **Renaming `callDeepSeek` / the `'DeepSeek generation failed'` string** — cosmetic, unrelated regression surface.
- **MCP/SDK extraction (Fase 2)** — remains deferred and not started across all four agents. Agent 4 completes Fase 1.

## Capabilities

### New Capabilities

- `weekly-report-synthesis`: the cross-agent synthesis contract — the three input sources a report MUST include, the causal-narrative requirement, alert-level derivation across all three severity vocabularies, `sweep`/`athlete` invocation modes and their week windows, the same-week dedup guard, both kill switches and dry-run, coach-supervised-only scope, and the invariant that the agent produces no athlete-facing output on any channel.

`openspec/specs/` has **zero** coverage for `weekly-ai-reports` today. This capability documents the behaviour this change owns and the existing shape it plugs into (upsert key, week window, delivery), deliberately not the prompt's physiological content — that is a retro-spec with no relationship to this change's risk.

### Modified Capabilities

- `engagement-agent-runtime`: its "Agent Scope Boundary" requirement currently reads as an exhaustive list of what `engagement-monitor` may do. A delta adds a **Reactive Report Trigger** requirement — `danger` creation/escalation invokes `weekly-ai-reports` in `mode: 'athlete'` fire-and-forget, and that invocation's failure or delay MUST NOT affect alert creation or delivery. Same pattern as the delta Agent 2 merged into `training-load-alerts`.

## Approach

Widen the input of a function that already produces the right artifact. `processAthlete` gains two reads and the prompt gains two context blocks and one instruction; its output schema is untouched, so no consumer changes. A `mode` discriminator adds a single-athlete path that computes the current (in-progress) week rather than the digest's completed-last-week window, so a mid-week reactive run explains *now*. `engagement-monitor` calls it fire-and-forget when a silence alert reaches `danger`. The existing `(athlete_id, week_start)` upsert key does double duty: it is the same-week dedup guard, and it lets the next Monday digest cleanly supersede a mid-week reactive row with the completed week's report. Delivery is the function's existing coach push to `/dashboard/ai-reports`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `supabase/functions/weekly-ai-reports/index.ts` | Modified | Two reads, prompt widening, `alertLevelFromOpenAlerts`, `mode`/`athlete_id`, dedup guard, auth tightening, two gates |
| `supabase/functions/engagement-monitor/index.ts` | Modified | Fire-and-forget reactive call on `danger` creation/escalation |
| `supabase/migrations/` | **Three additive migrations** (D8 + D9 + D10, amended) | D8: `weekly_ai_reports.ai_analysis_athlete_safe jsonb`, nullable. D9 (already live): `weekly_ai_reports.summary_athlete_safe text` (nullable), `FORCE ROW LEVEL SECURITY`, `REVOKE SELECT` on the base table from `authenticated`/`anon`, a view `weekly_ai_reports_for_role` — later found not to actually enforce row-level filtering in this project (`postgres` has `rolbypassrls=true`). D10: `get_weekly_ai_reports(...)`, a `SECURITY DEFINER` function with an explicit row-filter, replacing that view (which D10 drops); no other change to D9's grants/RLS. No table drop, no new cron job. |
| `src/services/aiReportService.js` | **Modified** (D9, then D10, amended — was "Unchanged") | `getCoachWeeklyReports`/`getCoachReportWeeks` now call `get_weekly_ai_reports` via `.rpc()`, not the base table or the (now-dropped) view — the base table no longer grants `SELECT` to `authenticated` at all, regardless of columns requested. `triggerWeeklyReports` itself is unaffected; the D5 auth tightening is unrelated to this read-path change. |
| `src/services/alertFeedService.js`, `src/components/shared/TrainingLoadAlertFeed.jsx` | Unchanged | Explicitly NOT touched — see D6 |
| `src/pages/dashboard/AIReports.jsx` | **Modified** (D9, amended — was "Unchanged"; unaffected by D10) | Coach-facing; reads `ai_analysis` only, but now (via `aiReportService.js`) via the RPC — required because the D9 `REVOKE` would otherwise 0-row every coach query too, since the coach also authenticates as `authenticated`, not `service_role`. The RPC resolves `ai_analysis` to the WIDE value for the report's own coach, so nothing is lost for this caller. |
| `src/pages/athlete/MyReports.jsx` | **Modified** (D8 + D9 + D10, amended) | Now calls `get_weekly_ai_reports` via `.rpc()` and reads `ai_analysis`/`summary` directly (unchanged since D9) — the RPC masks them server-side, so D8's `ai_analysis_athlete_safe \|\| ai_analysis` app-layer fallback stays removed. The pre-existing athlete self-select RLS on the base table is irrelevant to this page's own exposure, since the page has no base-table `SELECT` at all. |
| `src/lib/pdfExport.js` | **Modified** (D9, amended; comment-only under D10) | `mapReportToDocProps` reads `report.ai_analysis` directly — same reasoning as `MyReports.jsx`, its only call site. No functional change under D10 (this file never queried the view/RPC directly), comment updated for accuracy. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A reactive run overwrites a completed weekly report | Low | Different `week_start` (current vs previous week) → different row; the Monday digest superseding a reactive row is intended (D1) |
| Reactive path causes uncontrolled Gemini spend | Medium | Same-week dedup guard (D4) + `danger`-only trigger (D3) + `WEEKLY_REPORT_REACTIVE_ENABLED=false` default (D7) |
| The longer prompt exceeds `maxOutputTokens: 4000` or degrades JSON validity | Medium | Input grows, not output; schema unchanged. The existing `catch` already falls back to a deterministic `summary` and `status: 'error'` — a bad Gemini response never blocks the row |
| Widened prompt makes the narrative vaguer, not sharper | Medium | The instruction demands one causal explanation, not a longer list; review the first live digest before enabling reactive |
| Engagement `danger` vocabulary silently maps to the report's `attention` tier | Medium | Explicit `danger → critical` normalization is a success criterion, mirroring `alertFeedService` |
| Reactive call slows or breaks `engagement-monitor` | Low | `EdgeRuntime.waitUntil` fire-and-forget; failure must not fail alert creation (spec delta) |
| The auth tightening breaks the coach's manual "regenerate" button | Low | `triggerWeeklyReports` already sends the caller's own `coach_id`; verify live after deploy |
| The Monday digest is accidentally gated off | Low | Hard invariant (D7): neither gate may disable the shipped digest — asserted as a success criterion |
| `weekly_ai_reports` RLS not verified for the coach-only read path | Medium | Verify live before deploy; this change adds no new reader |
| No staging Supabase branch | — | Deploy straight to production and verify live after each step, same as Agents 1–3 |
| Pre-existing athlete self-select RLS on `weekly_ai_reports` exposes the widened, coach-facing `ai_analysis` to the athlete via the live `MyReports.jsx` page | **Was High, now Low, then re-opened, now Low again** (D8 → D9, amended) | D8's app-layer fix (`ai_analysis_athlete_safe` column + `MyReports.jsx` fallback) did NOT close the exposure — Postgres RLS is row-level only, and `authenticated`/`anon` retained unrestricted column-level `SELECT` on the base table (confirmed live, `information_schema.column_privileges`). D9 is the actual fix: `REVOKE SELECT` on the base table plus a masked view (`weekly_ai_reports_for_role`) granted to `authenticated` only — verifiable at the database layer, not just by reading application source |
| `WIDE_CONTEXT_ENABLED=true` now costs up to 2× Gemini calls per `processAthlete` invocation (D8's athlete-safe second call), not 1× | Medium | Second call reuses the already-cheap narrow prompt shape (today's exact input, unchanged size); its failure is independent and never blocks the primary report; still bounded by the same danger-only/dedup guards as the primary call |
| `anon` held unrestricted `SELECT` on `weekly_ai_reports` alongside `authenticated` — worse than the athlete-self-select finding, since it required no valid session at all | **Was present, now closed** (D9) | Same `REVOKE`/view fix as the athlete-self-select finding closes this too; `anon` is granted nothing on either the base table or the view |
| The D9 `FORCE ROW LEVEL SECURITY` + view-owner assumption is unverified against this project's actual Postgres role/ownership graph | **Was Medium, materialized true, now closed** (D10) | D9's assumption was explicitly flagged and then found FALSE by the orchestrator's live verification: `postgres` has `rolbypassrls=true` in this project, so D9's view leaked every row to every caller — `FORCE ROW LEVEL SECURITY` does not override `BYPASSRLS`. D10 replaces the view with a `SECURITY DEFINER` function whose row-filter is explicit `WHERE`-clause SQL, immune to this failure mode regardless of the definer's `BYPASSRLS` status — live-verified with 3 real scenarios (rolled-back transactions) before being treated as fixed |

## Rollback Plan

1. Set `WEEKLY_REPORT_REACTIVE_ENABLED=false` — the reactive path stops. Already the default.
2. Set `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=false` — the prompt degrades to today's exact `training_load_alerts`-only input. No code revert, no data change.
3. Redeploy the previous `weekly-ai-reports` and `engagement-monitor` bundles. **There is no migration to reverse, no table to drop, no cron job to unschedule, and no frontend commit to revert.**
4. Already-generated widened reports are left in place: they are valid `weekly_ai_reports` rows in the unchanged schema and are indistinguishable in shape from pre-change rows.

## Dependencies

- `weekly-ai-reports` deployed and its `weekly-ai-reports-monday` `pg_cron` job live (migration `20260819146000`)
- `athlete_engagement_alerts` (Agent 2) and `plan_adjustment_suggestions` (Agent 3) in production — both confirmed shipped and archived
- `GEMMA4_API_KEY` and its Gemini 2.5 Flash quota
- `engagement-monitor` reachable server-to-server with the service-role key
- Live verification of `weekly_ai_reports` RLS and of the `x-supabase-cron-job` auth path before deploy
- No staging branch: production deploys verified live after each step
- Fase 2 (MCP/SDK extraction across all four agents) remains explicitly deferred and is not a prerequisite

## Success Criteria

- [ ] A generated report's `ai_analysis.resumen` for an athlete with signals from two or more agents references all of them in one causal explanation, not as three separate observations
- [ ] `processAthlete` reads `athlete_engagement_alerts` and `plan_adjustment_suggestions` for every athlete, in the existing parallel query block (verifiable by diff)
- [ ] An athlete with an open `danger` engagement alert and no `training_load_alerts` yields report `alert_level = 'critical'`, not `'ok'` (the pre-change result)
- [ ] The response JSON has no new top-level key, and `AIReports.jsx`, `alertFeedService.js` and `TrainingLoadAlertFeed.jsx` are byte-identical after this change (verifiable by diff)
- [ ] This change adds **exactly one** file to `supabase/migrations/` (amended, D8: `ai_analysis_athlete_safe`, additive, nullable jsonb) — no other schema change (verifiable by diff)
- [ ] A `warning → danger` escalation produces a report for the **current** week within minutes, without waiting for Monday
- [ ] A second `danger` escalation for the same athlete in the same week triggers **zero** additional Gemini calls
- [ ] An `engagement_silence` alert at `warning` tier triggers no reactive run
- [ ] A forced failure of the reactive invocation leaves the `athlete_engagement_alerts` row created and delivered unchanged
- [ ] With `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=false` and `WEEKLY_REPORT_REACTIVE_ENABLED=false`, the Monday digest produces output byte-equivalent in shape to a pre-change run
- [ ] No independent athlete generates a report from either mode
- [ ] `mode: 'athlete'` is unreachable with a plain user JWT; a user JWT requesting another coach's `coach_id` is rejected
- [ ] No code path in this change writes `training_sessions`, `chat_messages`, or calls `send-email` (verifiable by grep)
- [ ] The enabling dry-run reported how many reactive runs the last 30 days of `danger` escalations would have produced, and was reviewed before `WEEKLY_REPORT_REACTIVE_ENABLED` was set to `true`
- [ ] (D8, amended) An athlete's own `MyReports.jsx` view of a report generated with `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true` never contains any `athlete_engagement_alerts` or `plan_adjustment_suggestions` content — verified by confirming the athlete-safe analysis (`ai_analysis_athlete_safe`) was generated from a `callDeepSeek` invocation whose `weekData` never included those two sources at all (`wide_context: false`, both arrays empty), not by inspecting the output text for their absence — presence-of-input is the only reliable proof for a privacy guarantee
- [ ] (D9, amended) The guarantee above holds at the DATABASE layer, not just the app layer: an athlete's session, querying `weekly_ai_reports` **directly** (not through `MyReports.jsx`, not through any app code) — e.g. `GET /rest/v1/weekly_ai_reports?select=ai_analysis,summary` with the athlete's own JWT — MUST NOT return the wide `ai_analysis`/`summary` for a row where they are not `coach_id`. Expected result is a permission error (base table `SELECT` revoked), not row-filtered data. The SAME athlete querying `weekly_ai_reports_for_role` (the view) for their own row MUST receive the narrow, athlete-safe content under the `ai_analysis`/`summary` names — verifiable only by a live test with a simulated athlete JWT, never by reading application source, since D8 alone demonstrated that an app-layer convention is not verifiable proof of a database-level guarantee
- [ ] (D9) `anon` (no session at all) MUST receive a permission error querying either `weekly_ai_reports` or `weekly_ai_reports_for_role` — zero anonymous read of this table in any form
- [ ] (D10) The database-layer guarantee above (D9's two Success Criteria) MUST actually hold in this project's live Postgres role/ownership graph, not merely be assumed correct by the migration's own SQL — verified by the orchestrator via `SELECT rolname, rolbypassrls FROM pg_roles` (confirming which roles bypass RLS) AND by 3 live, rolled-back-transaction scenarios against `get_weekly_ai_reports` (coach sees wide, that athlete sees narrow, an unrelated user sees zero rows) AND a 4th confirming direct base-table access as `authenticated` is still denied — not by re-trusting a view-based mechanism's own documented assumptions a second time

## Proposal question round

The four foundational decisions came from a prior round. These were decided here on judgment against live code — flag before `sdd-spec` if you disagree:

1. **Reactive fires on `danger` (21 days) only, not `warning` (10 days)** (D3). Agent 3's brief said "10+ days", which is the warning tier. If the 10-day mark is where a coach actually wants the narrative, this changes the trigger and roughly multiplies the reactive Gemini budget.
2. **The narrative stays on `/dashboard/ai-reports` and never enters the merged feed** (D6). If you want a `critical` report to appear as a feed row, that needs an invented read/dismiss lifecycle and accepts duplicating its own inputs.
3. **The auth tightening is in scope** (D5), against Agent 3's "no unrelated fixes" precedent. Justified because this change adds a cost-amplifying param to the same handler — but it is still a security change riding in an agent PR.
4. **One new capability scoped to the delta, not a retro-spec of `weekly-ai-reports`** — the feature has zero existing spec coverage, so "only the delta" leaves the shipped prompt/PMC/Strava behaviour formally undocumented.
5. **Two gates instead of one**, with the house kill-switch rule extended to cover per-call external-API cost (D7). Simpler alternative: a single gate defaulting `false`, at the price of holding the harmless read-only widening hostage to the risky reactive path.
