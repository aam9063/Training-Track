# Engagement Agent Runtime Specification

## Purpose

Defines the scheduled sweep, reactive resolve triggers, alert delivery routing, and coach-supervised-only scope boundary for the `engagement-monitor` Edge Function. The agent only detects and resolves engagement alerts — it never writes `training_sessions` and never contacts the athlete directly.

## Requirements

### Requirement: Scheduled Daily Sweep

A daily `pg_cron` job, declared in a versioned migration and secured by the `CRON_SECRET` Bearer-token pattern, MUST invoke `engagement-monitor`'s sweep path to evaluate every coach-supervised athlete eligible per `athlete-engagement-signals` (past warm-up, has planned sessions in the observation window).

#### Scenario: Daily sweep evaluates eligible athletes

- GIVEN an eligible, silent athlete
- WHEN the daily `pg_cron` sweep runs
- THEN `engagement-monitor` evaluates that athlete and persists any resulting alert per `athlete-engagement-alerts`

#### Scenario: Unauthorized sweep request is rejected

- GIVEN a request to the sweep endpoint without a valid `CRON_SECRET` Bearer token
- WHEN the request is received
- THEN the function returns an authorization error and evaluates no athletes

### Requirement: Reactive Resolve Triggers

`engagement-monitor` (or the calling function) MUST expose a resolve path invoked from each of the four signal-producing write paths: session completion, wellness check-in creation, `strava-webhook` activity ingestion (via `EdgeRuntime.waitUntil`, fire-and-forget), and athlete-sent chat message creation. Each invocation MUST resolve any open `engagement_silence` alert for that athlete per `athlete-engagement-alerts`.

#### Scenario: Strava webhook triggers resolve without blocking ingestion

- GIVEN `strava-webhook` successfully processes a new activity for an athlete with an open engagement alert
- WHEN processing completes
- THEN the resolve call is invoked via `EdgeRuntime.waitUntil`, and its failure or delay does not affect the webhook's response to Strava

#### Scenario: Session completion triggers resolve

- GIVEN a session is marked completed for an athlete with an open engagement alert
- WHEN the completion is persisted
- THEN the resolve path is invoked for that athlete

#### Scenario: Wellness check-in triggers resolve

- GIVEN a wellness log entry is created for an athlete with an open engagement alert
- WHEN the entry is persisted
- THEN the resolve path is invoked for that athlete

#### Scenario: Athlete-sent chat message triggers resolve

- GIVEN an athlete with an open engagement alert sends a chat message
- WHEN the message is persisted
- THEN the resolve path is invoked for that athlete

### Requirement: Coach-Supervised-Only Routing

The agent MUST only evaluate and deliver alerts for coach-supervised athletes with an active `coach_athlete_relationship`. Independent athletes MUST NOT be included in the sweep and MUST NOT receive any delivery from this agent.

#### Scenario: Independent athletes excluded from the sweep

- GIVEN a mix of coach-supervised and independent athletes in the database
- WHEN the daily sweep runs
- THEN only coach-supervised athletes are evaluated

### Requirement: Alert Delivery Routing

Engagement alerts MUST be delivered to the athlete's active coach only, never to the athlete. In-app alert record creation MUST always occur when an alert is created or escalated; push delivery is best-effort and its failure MUST NOT prevent the in-app row from being created or updated.

#### Scenario: Alert delivered to the coach

- GIVEN a coach-supervised athlete triggers a `warning` engagement alert
- WHEN the alert is created
- THEN the athlete's active coach receives it in-app and via best-effort push

#### Scenario: Push failure does not block alert creation

- GIVEN the push delivery call fails or times out
- WHEN an alert is otherwise eligible for creation
- THEN the `athlete_engagement_alerts` row is still created

### Requirement: Agent Scope Boundary

The agent MUST NOT write to `training_sessions` under any trigger path, and MUST NOT create, modify, or trigger regeneration of any training plan or send any message to the athlete. Its only writes are to `athlete_engagement_alerts`.

#### Scenario: No writes to training_sessions

- GIVEN the repository after this change is applied
- WHEN searching `supabase/functions/engagement-monitor/` for writes to `training_sessions`
- THEN no such write exists

### Requirement: Dry-Run Mode Before Enabling Delivery

Before delivery is switched on in production, the sweep MUST support a dry-run mode that evaluates all eligible athletes and reports resulting alert counts and severities without writing any `athlete_engagement_alerts` row or sending any delivery.

#### Scenario: Dry-run reports counts without side effects

- GIVEN the sweep is invoked in dry-run mode
- WHEN it evaluates the full eligible athlete population
- THEN it reports the alert volume that would have been produced
- AND no row is written to `athlete_engagement_alerts` and no delivery is sent
