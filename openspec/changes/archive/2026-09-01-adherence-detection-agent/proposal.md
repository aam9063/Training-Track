# Proposal: Adherence Detection Agent (Agent 2)

## Intent

Nothing in TrainingTrack notices when a supervised athlete goes quiet. A coach with 20 athletes discovers churn retroactively, by scrolling a dashboard and thinking "wait, when did I last hear from her?". The mandate for Agent 2 is to close that gap: detect an athlete who has stopped feeding the system — no sessions, no wellness, no Strava, no messages — and warn the coach *before* the relationship dies. Like Agent 1, this agent **only proposes**: it writes no `training_sessions`, sends the athlete nothing, and takes no corrective action. The coach decides.

**Scope is coach-supervised athletes only.** Independent athletes are excluded by decision (see Out of Scope).

## Decisions

### D1 — Vocabulary: "adherencia" is retired as a product term

The word currently means two different things. `training_load_alerts.alert_type='low_completion'` ships today labeled **"Adherencia"** in `TrainingLoadAlertFeed.jsx`, but it measures *one week's* `completed / planned` ratio. Agent 2 measures multi-week silence. Shipping both under "Adherencia" would read as a duplicate feature.

| Option | Verdict |
|---|---|
| Keep "Adherencia" for `low_completion`, invent a new word for Agent 2 | Rejected. The existing label is the *less* accurate use of the word; grandfathering the wrong one and working around it compounds the debt. |
| Use "Adherencia" for Agent 2, rename `low_completion` | Rejected. Still ambiguous — "adherencia" reasonably describes both, so the collision survives the rename. |
| **Chosen: neither signal uses the word.** `low_completion` → **"Cumplimiento semanal"**; Agent 2 ships under **"Inactividad"** / **"Riesgo de abandono"**. | Each label states its own measurement horizon, so the two are distinguishable without a glossary. |

Consequence: the SDD change keeps the name `adherence-detection-agent` for traceability to the original multi-agent brief, but **no shipped artifact** — table, `alert_type`, capability, or UI string — uses "adherence"/"adherencia". Code and schema use *engagement*.

### D2 — New dedicated table `athlete_engagement_alerts`, not a 5th `training_load_alerts` type

| Option | Verdict |
|---|---|
| 5th `alert_type` on `training_load_alerts` | Rejected. Every `training_load_alerts` row today is derived from training physiology (`daily_training_load` + `training_sessions`). Engagement is derived from the *absence* of four unrelated sources. It also needs different lifecycle semantics (see below), and it would force a MODIFIED delta into an already-archived, shipped spec — turning its "exactly four values" taxonomy requirement into a junk drawer that every future agent widens. |
| **Chosen: new table + own capability set, mirroring Agent 1's proven patterns** | Agent 1's proposal explicitly valued agents being "reasonably decoupled" for eventual Phase 2 MCP/SDK extraction. Four agents each owning their own bounded table extracts cleanly; four agents sharing one table does not. |

The "duplicate scaffolding" cost is real but bounded, and mitigated deliberately: RLS is a line-for-line copy of a policy already proven in production, and the UI is **not** forked — `TrainingLoadAlertFeed` is generalized into a source-agnostic feed that renders a merged, `created_at`-sorted view over both tables.

Lifecycle differs materially and justifies the split: a load alert resolves on a 2-day hysteresis (physiology is noisy). An engagement alert resolves **immediately and reactively** the moment any signal of life arrives — the condition is definitionally over.

### D3 — Detection rule: OR-blended "signal of life", tiered by days of silence

**Signal of life** = the most recent of:

| Source | Column | Coverage |
|---|---|---|
| Session marked completed/skipped | `training_sessions.completed_at` | All |
| Wellness check-in | `wellness_log` | All |
| Strava activity | `strava_activities.start_date_local` | Strava-connected |
| Message **sent by the athlete** | `chat_messages` | All supervised |

`silence_days = today − max(all four)`. OR-blending is chosen over weighted blending precisely *because* coverage is uneven: a missing source can only fail to rescue a genuinely silent athlete (false negative), never manufacture a false positive. A weighted blend would penalise athletes for not using Strava.

This also settles "dejan de responder" from the mandate: inbound chat counts as a signal, so an injured athlete messaging their coach daily is correctly *not* flagged, and a standalone `unanswered_coach` alert is unnecessary (deferred — coaches send plenty of messages that need no reply).

**Thresholds**, anchored to the training microcycle rather than round numbers:

| Tier | `silence_days` | Rationale |
|---|---|---|
| `warning` | ≥ 10 | One full microcycle (7d) plus a 3-day grace for weekend/travel edges. Cannot be tripped by a single planned rest or taper week. |
| `danger` | ≥ 21 | Three microcycles. Past this point athletes rarely self-restart without direct coach contact — this is the intervention point, not the observation point. |

Suppressed when the athlete has **zero planned sessions** in the window: that is the coach going quiet, not the athlete. Thresholds live as named constants in the pure core module so they are calibratable without a schema change (Agent 1's precedent: hardcoded v1 values, per-coach configuration deferred).

### D4 — `users.last_login` stays dead; explicitly out of scope

It is not silently ignored — it is rejected. Reviving it needs a new client write path (`AuthContext.jsx`), and it is the weakest available signal: an app-open with zero data entry is not engagement, and PWA/service-worker session restores make it unreliable as a human-intent signal. Every stronger signal is already covered by D3. If a future engagement-*trend* agent needs it, that agent owns the write path.

### D5 — New-athlete exclusion: 21-day warm-up from `coach_athlete_relationship.start_date`

An athlete must have been supervised for at least one full danger window before becoming evaluable; otherwise the first sweep flags every new signup. 21 days is proposed here (not deferred to design) so the rule is symmetric with the danger threshold and needs no second justification.

Edge case handled in the same rule: an athlete past warm-up with **zero lifetime signals** has never started rather than churned. Same alert type, `silence_days` anchored to `start_date` instead of a null max, distinct Spanish copy ("nunca ha registrado actividad") because the coach action is onboarding, not re-engagement.

## Scope

### In Scope

- Migration: `athlete_engagement_alerts` (+ `_rollback.sql` sibling, CHECK constraints not ENUM) — RLS coach-select via active `coach_athlete_relationship` + `service_role` all, **no self-select** (corrected 2026-09-02: the athlete themselves must never see their own churn-risk assessment — see `specs/athlete-engagement-alerts/spec.md`'s RLS Visibility requirement for the reasoning); partial unique dedup index on `(athlete_id, alert_type) WHERE status='open'`
- `supabase/functions/_shared/engagementCore.js` — pure, zero-import: signal-of-life resolution, silence tiering, eligibility/suppression rules
- `engagement-monitor` Edge Function: daily `pg_cron` sweep (versioned in a migration, `CRON_SECRET` Bearer auth) → evaluate → persist deduplicated alert → deliver in-app + best-effort push
- Reactive **auto-resolve**: an incoming signal of life closes any open engagement alert for that athlete
- UI: generalize `TrainingLoadAlertFeed` into a source-agnostic merged feed; rename the `low_completion` label per D1; surface the silence tier on `TeamHealthTable`'s existing `LastSessionBadge`

### Out of Scope

- **Independent athletes** — "warn the coach before churn" has no coach in the loop; a self-directed motivational nudge is a different product with different copy, consent, and tone. Deferred entirely.
- Reviving `users.last_login` (D4)
- `unanswered_coach` as its own alert type (D3)
- Multi-week engagement *trend/decline* detection — distinct from silence, and deliberately withheld so it does not re-collide with `low_completion`
- Per-coach configurable thresholds; any auto-message, auto-replan, or write to `training_sessions`
- MCP/SDK extraction (Phase 2). Only constraint honoured now: the core module imports nothing from Supabase or the UI.

## Capabilities

### New Capabilities

- `athlete-engagement-signals`: signal-of-life definition, OR-blend across four sources, silence computation, warm-up and zero-planned-sessions eligibility rules
- `athlete-engagement-alerts`: alert types, severity tiers, deduplication, reactive-resolve lifecycle, RLS visibility for `athlete_engagement_alerts`
- `engagement-agent-runtime`: scheduled sweep, reactive resolve, alert delivery, coach-supervised-only routing

### Modified Capabilities

- `training-load-alerts`: terminology-only delta pinning `low_completion` to *single-week completion rate* and explicitly disclaiming engagement/churn semantics; user-facing label becomes "Cumplimiento semanal". No behavioural, threshold, or schema change.

## Approach

Mirror Agent 1's shape with one deliberate omission. A pure core module computes the signal-of-life max and tiers the silence; an Edge Function invoked by a versioned daily `pg_cron` sweep evaluates every athlete with an active `coach_athlete_relationship`, writes a deduplicated alert row, and delivers it in-app plus via the existing push RPC. Agent 1's *reactive* invocation half-transfers — there is no event for "nothing happened" — so the reactive path is inverted: incoming signals (session completion, wellness entry, Strava webhook, chat message) **resolve** open alerts rather than raise them, which keeps the coach's feed honest between sweeps. The frontend merges two alert sources into one feed rather than growing a second one.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `supabase/migrations/` | New | `athlete_engagement_alerts` + RLS + dedup/lookup indexes; `pg_cron` job; `_rollback.sql` sibling |
| `supabase/functions/_shared/engagementCore.js` | New | Pure signal/tier/eligibility logic, no Supabase or UI imports |
| `supabase/functions/engagement-monitor/` | New | Sweep → evaluate → persist → deliver |
| `supabase/functions/strava-webhook/index.ts` | Modified | Fire-and-forget resolve call (`EdgeRuntime.waitUntil`) |
| `src/components/shared/TrainingLoadAlertFeed.jsx` | Modified | Generalize to source-agnostic merged feed; `low_completion` label rename |
| `src/services/trainingLoadAlertsService.js` | Modified | Add engagement reads; merged, sorted query |
| `src/components/dashboard/AthleteLoadAlerts.jsx`, `src/pages/dashboard/AthleteProfile.jsx` | Modified | Consume merged feed |
| `src/components/dashboard/TeamHealthTable.jsx` | Modified | `LastSessionBadge` surfaces silence tier |
| `openspec/specs/training-load-alerts/spec.md` | Modified | Terminology delta (D1) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
~~Agent 1's frontend is untracked in git~~ — **RESOLVED, this claim was stale when written.** Verified live: `TrainingLoadAlertFeed.jsx`, `trainingLoadAlertsService.js`, and `AthleteLoadAlerts.jsx` are all tracked (`git ls-files` confirms) and already deployed to production (`master`, trainingtrack.es) as of 2026-09-01. No dependency blocks Agent 2's UI work. | N/A | N/A |
| First sweep alert-storms across the whole athlete base | High | Warm-up exclusion (D5) plus a one-off dry-run that logs counts without writing rows, reviewed before enabling delivery |
| Push flood via the documented legacy trigger/payload defects | Medium | Never copy the broken payload shape; push is best-effort and MUST NOT block the in-app row; verify `information_schema.triggers` on the new table before any backfill |
| Two alert tables make the coach's feed feel duplicated | Medium | Single merged feed component (D2 mitigation), distinct labels per D1 |
| 10/21-day thresholds mis-calibrated for this user base | Medium | Named constants in the core module; revisit after one month of production alert volume |
| Coaches ignore the alert and it becomes noise | Medium | Two tiers only, one alert per athlete at a time via the dedup index, immediate auto-resolve |
| `teamHealthService.js` dead `'pending'` status filter is copied into new queries | Low | Documented in explore; use `planned`/`completed` only |

## Rollback Plan

1. Unschedule the `pg_cron` job — the agent goes silent immediately, no data loss, no code revert needed.
2. Remove the `strava-webhook` resolve call (fire-and-forget; its absence only slows resolution, it never breaks ingestion).
3. `athlete_engagement_alerts` is a new isolated table with no FKs pointing at it — apply `_rollback.sql` to drop it.
4. Revert the UI commit. The merged feed degrades to the single-source feed; the label rename is cosmetic and independently revertible.
5. The `training-load-alerts` spec delta is terminology-only — non-destructive and safe to leave in place even on full rollback.

## Dependencies

- `pg_cron` + `pg_net` (confirmed active by Agent 1)
- `coach_athlete_relationship` with a reliable `start_date` for both warm-up exclusion and coach-side RLS
- `send_push_notification` RPC / `send-push` function for best-effort delivery
- `chat_messages` sender attribution sufficient to distinguish athlete-sent from coach-sent messages

## Success Criteria

- [ ] A supervised athlete silent for 10 days across all four sources produces exactly one `warning` alert visible to their coach and to no other coach
- [ ] The same athlete escalating past 21 days produces a `danger` alert, not a second `warning`
- [ ] Any single signal of life (session, wellness, Strava, athlete chat message) resolves the open alert without waiting for the next sweep
- [ ] An athlete supervised for fewer than 21 days is never evaluated
- [ ] An athlete with zero planned sessions in the window is never alerted
- [ ] An athlete training consistently but with no Strava connection is never alerted
- [ ] No independent athlete ever receives or generates an engagement alert
- [ ] The word "adherencia" appears in zero shipped strings, column names, or `alert_type` values
- [ ] The coach sees one merged alert feed, not two
- [ ] `training_sessions` is never written by this change (verifiable by grep)
- [ ] `engagementCore.js` has no import from Supabase, React, or any UI code
- [ ] The enabling dry-run reports the alert volume the first live sweep would have produced, and it was reviewed before delivery was switched on

## Proposal question round

Decided here on judgment; flag if you disagree before `sdd-spec`:

1. **10 / 21-day thresholds** — anchored to one and three microcycles. Do your coaches consider 10 days already too late, or still too noisy for this population?
2. **21-day warm-up** — chosen for symmetry with the danger tier. A shorter window (e.g. 14 days) would catch failed onboarding sooner at the cost of more first-week noise.
3. **`unanswered_coach` dropped** — inbound chat counts as a signal of life instead of being its own alert. If "the athlete ignores my messages" is a signal coaches actively want surfaced on its own, it comes back into scope.
