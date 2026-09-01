# Competitions Specification

## Purpose

Define self-managed competition CRUD, countdown display, and goal tracking for independent athletes.

## DB Schema Changes

| Change | Table | Column/Detail |
|--------|-------|---------------|
| ADD column | `competitions` | `goal_time_minutes NUMERIC NULL` |
| ADD column | `competitions` | `actual_time_minutes NUMERIC NULL` |
| ADD column | `competitions` | `position INTEGER NULL` |
| MODIFY RLS | `competitions` | Independent athlete can INSERT/SELECT/UPDATE/DELETE where `athlete_id = auth.uid() AND coach_id IS NULL` |

## Requirements

### Requirement: Competition CRUD

Independent athletes MUST be able to create, read, update, and delete their own competitions at `/athlete/competitions`. Required fields: nombre, fecha, distancia (km). Optional: ubicacion, notas, tiempo objetivo. `coach_id` MUST be NULL; `athlete_id` MUST be `auth.uid()`.

#### Scenario: Create competition

- GIVEN an independent athlete on the competitions page
- WHEN they click "Nueva Competicion" and fill nombre="Media Maraton Valencia", fecha=2026-05-10, distancia=21.1, tiempo objetivo=95 min
- THEN a competition row is inserted with `coach_id=NULL`, `athlete_id=auth.uid()`

#### Scenario: Edit competition

- GIVEN an existing competition owned by the athlete
- WHEN they update the goal time to 90 minutes
- THEN the competition record is updated

#### Scenario: Delete competition

- GIVEN an existing competition owned by the athlete
- WHEN they delete it
- THEN the row is removed from the database

### Requirement: Competition Countdown

The competitions page and the Inicio dashboard MUST display a countdown (days remaining) to the next upcoming competition. If the competition is today, it SHOULD show "Hoy".

#### Scenario: Countdown on dashboard

- GIVEN an independent athlete has a competition on 2026-05-10 and today is 2026-04-25
- WHEN they view Inicio
- THEN a countdown shows "15 dias para Media Maraton Valencia"

#### Scenario: Competition is today

- GIVEN the competition date matches today
- WHEN the countdown renders
- THEN it displays "Hoy" instead of a day count

### Requirement: Past Competition Results

After a competition date passes, the athlete SHOULD be able to record results: actual time and position. Past competitions MUST be displayed in a separate "Anteriores" section sorted by date descending.

#### Scenario: Record result

- GIVEN a competition whose date has passed
- WHEN the athlete enters actual_time=92 min, position=145
- THEN those fields are saved on the competition record

### Requirement: Target Time Display

If a competition has a `goal_time_minutes`, it MUST be displayed alongside the competition details as "Objetivo: Xh Ym".

#### Scenario: Goal time formatting

- GIVEN a competition with goal_time_minutes=95
- WHEN it renders
- THEN it shows "Objetivo: 1h 35m"
