# Training Load Metrics Specification

## Purpose

Canonical, pure computation of TSS/CTL/ATL/TSB/ACWR from raw activity data, and the versioned persistence contract for `daily_training_load`. This module is the single source of truth consumed by the rest of the system — it replaces the two divergent implementations in `src/lib/trainingMetrics.js` and `supabase/functions/weekly-ai-reports/index.ts`.

## Requirements

### Requirement: Canonical Formula Set

The core module MUST compute TSS per activity using the existing rTSS/hrTSS/duration-fallback logic, CTL as a 42-day EWMA of TSS, ATL as a 7-day EWMA of TSS, and TSB as `CTL - ATL`. ACWR MUST be computed as `ewma7(tss) / ewma28(tss)`, using a chronic window (`chronic_load_28`) that is independent of, and NOT derived from, the 42-day CTL series.

#### Scenario: ACWR uses the 28-day chronic window, not CTL

- GIVEN an athlete with 60 days of TSS history
- WHEN the core module computes today's row
- THEN `acwr = ewma7(tss) / chronic_load_28`
- AND `chronic_load_28` is stored separately from `ctl`

#### Scenario: CTL/ATL/TSB constants unchanged

- GIVEN the same raw activity series processed before and after this change
- WHEN CTL, ATL, and TSB are computed
- THEN the values are numerically identical to the pre-change client formula (only ACWR's value changes)

### Requirement: Single Source of Truth

The core module MUST have zero imports from Supabase, React, or any UI code. It MUST be the only producer of `daily_training_load` rows used anywhere in the system. `src/lib/trainingMetrics.js` MUST delegate to it rather than reimplement it, and `weekly-ai-reports` MUST read stored values instead of recomputing ACWR/TSB inline.

#### Scenario: No duplicate implementation remains

- GIVEN the repository after this change is applied
- WHEN searching for CTL/ATL/TSB/ACWR formula logic outside the core module
- THEN no other implementation of these formulas exists in `src/` or `supabase/functions/`

### Requirement: EWMA Warm-up Reporting

The core module MUST report, as part of its computation output, whether the athlete has at least 126 days of raw activity history available (EWMA warm-up complete). This flag is required input for alert suppression in the alerts capability.

#### Scenario: Warm-up incomplete

- GIVEN an athlete with 40 days of raw activity history
- WHEN the core module computes today's row
- THEN the output reports warm-up as incomplete

#### Scenario: Warm-up complete

- GIVEN an athlete with 200 days of raw activity history
- WHEN the core module computes today's row
- THEN the output reports warm-up as complete

### Requirement: `daily_training_load` Persistence Contract

`daily_training_load` MUST be fully described by a versioned migration, including existing columns (`date, tss, ctl, atl, tsb, intensity_factor, total_distance_m, activity_count, ramp_rate, source`) and new columns `chronic_load_28` and `calc_version`. RLS MUST allow self-select via `(select auth.uid()) = athlete_id`, coach-select via an active `coach_athlete_relationship`, and full access for `service_role`.

#### Scenario: Independent athlete self-select

- GIVEN an independent athlete with no coach
- WHEN they query their own `daily_training_load` rows
- THEN the rows are returned

#### Scenario: Coach with active relationship can select

- GIVEN a coach with an active `coach_athlete_relationship` to an athlete
- WHEN the coach queries that athlete's `daily_training_load` rows
- THEN the rows are returned

#### Scenario: Coach with inactive relationship is denied

- GIVEN a coach whose `coach_athlete_relationship` to an athlete is not active
- WHEN the coach queries that athlete's `daily_training_load` rows
- THEN no rows are returned

### Requirement: Deterministic Backfill via `calc_version`

Each row MUST be tagged with `calc_version`. Rows with a stale `calc_version` MUST be re-derived deterministically from raw activity data by recomputation, never by patching stored values in place. The migration adding `chronic_load_28` and `calc_version` MUST be idempotent (`ADD COLUMN IF NOT EXISTS`) and additive/nullable so existing rows remain readable without a prior backfill.

#### Scenario: Stale row is recomputed, not migrated

- GIVEN a `daily_training_load` row with `calc_version` older than current
- WHEN the row is next processed by the agent
- THEN its values are recomputed from raw activities and `calc_version` is updated

#### Scenario: Migration is a safe no-op on re-run

- GIVEN the migration has already been applied
- WHEN it is applied again
- THEN no error occurs and no data is altered
