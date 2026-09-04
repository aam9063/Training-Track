# Explore: Communication Agent (Agent 4)

Fourth and last Fase-1 agent of the planned multi-agent system (Fase 1: Monitorización → [[training-load-monitoring-agent]] shipped; Adherencia → [[adherence-detection-agent]] shipped; Planificación continua → [[continuous-planning-agent]] shipped; Comunicación → this exploration; Fase 2 eventual MCP/SDK extraction explicitly deferred, not started).

## Current State

No dedicated "communication agent" exists. Four separate, non-integrated communication surfaces exist today:

1. **In-app chat** — `src/services/chatService.js` + `chat_messages` table, UI at `src/pages/dashboard/Messages.jsx` / `src/pages/athlete/Messages.jsx`. Manual, human-to-human only. Agent 2 reads athlete-sent messages only as a signal to *resolve* engagement alerts — never writes to it.
2. **Push notifications** — `send_push_notification` RPC + `src/lib/pushNotifications.js` + `notifications` table. All 3 prior agents use this for system alert delivery, not conversational messaging.
3. **Email (Resend)** — `supabase/functions/send-email/` + `src/services/emailService.js`. Templates are 100% transactional/billing/onboarding (`welcome-coach`, `welcome-athlete`, `coach-invite`, `trial-ending`, `payment-failed`). Zero athlete-progress or coach-nudge templates.
4. **AI chat (`athlete-ai-chat`)** — Gemini 2.5 Flash, coach-asking-about-athlete and independent-athlete "Hermes" branches. Purely reactive/on-demand, session-based (`ai_chat_sessions`), rate-limited 40 msg/hr.

**Adjacent existing capability worth flagging**: `supabase/functions/weekly-ai-reports/index.ts` already does LLM-based (same Gemini key) weekly per-athlete synthesis into `weekly_ai_reports`, notifying the coach via push + `notifications`. It's most of a "narrative synthesis of Agents 1-3's signals" already — but only reads `training_load_alerts` today, not `athlete_engagement_alerts`/`plan_adjustment_suggestions`, and produces a report page, not a feed item or sendable message.

**Direct precedent found in Agent 3's own proposal** (`openspec/changes/archive/2026-09-03-continuous-planning-agent/proposal.md`, D2 excluded-findings table): *"engagement_silence — an athlete who has been silent 10+ days needs the coach to contact them, not a rewritten plan... This is Agent 4's territory."* This is the one explicit textual handoff pointing at Agent 4's mandate, but it names only the trigger, not channel/autonomy/scope.

## Affected Areas (if Agent 4 proceeds)

- `src/services/alertFeedService.js`, `src/components/shared/TrainingLoadAlertFeed.jsx` — likely discovery surface, precedent from Agents 2/3
- `supabase/functions/_shared/*Core.js` convention — a new `communicationCore.js` would need to fit the zero-import pattern, but drafting is inherently LLM-based, breaking the "pure deterministic" pattern the other three cores share
- `supabase/functions/weekly-ai-reports/index.ts`, `src/services/aiReportService.js` — potential overlap/extension point
- `supabase/functions/send-email/`, `src/services/emailService.js`, `react-email-starter/emails/` — if email becomes a channel
- `src/services/chatService.js` — if agent-authored chat messages become a channel

## Approaches Considered (not decided — for proposal phase)

1. **Coach-facing synthesis/explainer only (no outbound message)** — extend `weekly-ai-reports`' pattern to include Agents 2-3's data. Pros: lowest risk, reuses proven LLM-JSON pattern. Cons: risks reading as "Agent 1.5" rather than a distinct agent. Effort: Low-Medium.
2. **Coach-approved draft outbound message (chat/push/email)**, mirroring Agent 3's suggestion-only precedent. Pros: directly closes the "detect→detect→adjust→communicate" loop from the original brief. Cons: reintroduces LLM-in-hot-path cost/latency Agent 3 deliberately avoided; new tone/liability/audit questions. Effort: Medium-High.
3. **Coach-facing suggested talking points only, never sent to the athlete on any channel.** Middle ground. Pros: no athlete-facing liability, smaller surface than option 2. Cons: overlaps conceptually with option 1. Effort: Low-Medium.

Not resolved here by design — the fork between "synthesis-only" and "drafts outbound messages" is exactly the kind of business/product decision the proposal-phase question round should resolve with the user, mirroring how Agents 2 and 3 were scoped.

## Open Questions for Proposal Phase (deliberately unresolved here)

1. **Central fork**: outbound-message-drafting vs. synthesis-only.
2. If outbound: which channel(s) — chat, push, email, or coach-only talking points?
3. Trigger model — reactive per alert type (from Agents 1-3), a scheduled digest, or hybrid?
4. Independent-athlete scope boundary — this would be the FIRST agent in the system to potentially cross the coach-supervised-only boundary all 3 prior agents share. Does "communication" have a legitimate independent-athlete angle (e.g., helping an athlete without a coach), or does it stay coach-supervised-only like its predecessors?
5. LLM cost/latency tradeoff — any AI-drafted message likely needs a Gemini call, unlike Agent 3's deliberately-no-LLM-in-the-hot-path design. Synchronous per-trigger vs. batched into an existing digest cadence?
6. Overlap/reconciliation with `weekly-ai-reports` — extend it, replace it, or keep them distinct?
7. Naming — `communication-agent` doesn't match the `{noun}-{noun-action}-agent` pattern the other three follow (training-load-monitoring, adherence-detection, continuous-planning). Candidates like `athlete-communication-agent` or `engagement-outreach-agent` depend on which approach is chosen.

## Risks

- **Scope creep/overlap with `weekly-ai-reports`** — a real, already-existing, adjacent LLM-synthesis feature that could be silently duplicated instead of extended.
- **First potential crossing of the coach-supervised-only boundary** all 3 prior agents share (independent-athlete angle).
- **LLM cost/latency/determinism re-enters the picture** after Agent 3 deliberately kept it out of its hot path.
- **New liability/tone questions** for AI-drafted content that could reach an athlete directly (not just a coach-facing suggestion).
- **No message audit/versioning/provenance infrastructure exists** for agent-authored content — Agent 3's `adjusted_by_agent`/`last_adjustment_id` is the closest analog, but it's scoped to structured session-field patches, not free text.

## Ready for Proposal

Yes — recommend resolving open question #1 first via a dedicated question round with the user before `sdd-propose` drafts decisions, matching the pattern used for Agents 2 and 3.
