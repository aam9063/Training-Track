# Delta for Engagement Agent Runtime

## ADDED Requirements

### Requirement: Reactive Report Trigger on Engagement Danger

After `engagement-monitor` persists an `engagement_silence` alert at severity `danger` — either created directly at `danger` or escalated from an open `warning` row per `athlete-engagement-alerts`' Escalation Reuses the Same Row requirement — it MUST invoke `weekly-ai-reports` in `mode: 'athlete'` with that athlete's `athlete_id`, via `EdgeRuntime.waitUntil` (fire-and-forget). Severity `warning` alone, created or left unescalated, MUST NOT trigger this call; the coach is already told promptly at `warning` through the merged feed's in-app and push delivery, and the reactive narrative is reserved for escalation. A failure or slow response from `weekly-ai-reports` MUST NOT delay, fail, or otherwise affect the creation or delivery of the `athlete_engagement_alerts` row, consistent with the existing Agent Scope Boundary requirement.

#### Scenario: Danger creation triggers a reactive call to weekly-ai-reports

- GIVEN `engagement-monitor` creates an `engagement_silence` alert directly at severity `danger` (no prior open `warning` row)
- WHEN the alert row is persisted
- THEN `engagement-monitor` invokes `weekly-ai-reports` in `mode: 'athlete'` for that athlete via `EdgeRuntime.waitUntil`

#### Scenario: Warning-to-danger escalation triggers a reactive call

- GIVEN an open `warning` `engagement_silence` alert for an athlete
- WHEN the next evaluation escalates that same row's severity to `danger`
- THEN `engagement-monitor` invokes `weekly-ai-reports` in `mode: 'athlete'` for that athlete via `EdgeRuntime.waitUntil`

#### Scenario: Warning alone does not trigger the reactive call

- GIVEN `engagement-monitor` creates or refreshes an `engagement_silence` alert at severity `warning`, with no escalation to `danger`
- WHEN the alert row is persisted
- THEN no reactive call to `weekly-ai-reports` is made

#### Scenario: weekly-ai-reports invocation failure does not affect alert delivery

- GIVEN the reactive call to `weekly-ai-reports` fails or times out
- WHEN `engagement-monitor` has already persisted and delivered the `danger` `engagement_silence` alert
- THEN the alert record and its delivery to the coach are unaffected by that failure

#### Scenario: The handoff itself sends nothing to the athlete

- GIVEN `engagement-monitor` invokes `weekly-ai-reports` reactively
- WHEN the invocation completes or fails
- THEN no message, push, or email is sent to the athlete as part of that invocation, per `weekly-report-synthesis`'s No Athlete-Facing Output requirement
