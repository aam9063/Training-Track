import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_TYPES,
  SILENCE_WARNING_DAYS,
  SILENCE_DANGER_DAYS,
  WARMUP_DAYS,
  SUPPRESSION_WINDOW_DAYS,
  resolveLastSignal,
  daysBetween,
  isPastWarmUp,
  tierFor,
  evaluateEngagement,
} from './engagementCore.js';

// ============================================================
// Constants sanity
// ============================================================

test('constants are exported with the design-specified values', () => {
  assert.deepEqual(ALERT_TYPES, ['engagement_silence']);
  assert.equal(SILENCE_WARNING_DAYS, 10);
  assert.equal(SILENCE_DANGER_DAYS, 21);
  assert.equal(WARMUP_DAYS, 21);
  assert.equal(SUPPRESSION_WINDOW_DAYS, 10);
});

// ============================================================
// resolveLastSignal — OR-blend across the four sources
// ============================================================

describe('resolveLastSignal', () => {
  test('all-null signals produce a null last-seen', () => {
    const result = resolveLastSignal({
      lastSessionCompletedAt: null,
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    });
    assert.deepEqual(result, { at: null, source: null });
  });

  test('each source alone wins when it is the only one present — session', () => {
    const result = resolveLastSignal({
      lastSessionCompletedAt: '2026-01-10T08:00:00Z',
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    });
    assert.deepEqual(result, { at: '2026-01-10', source: 'session' });
  });

  test('each source alone wins when it is the only one present — wellness', () => {
    const result = resolveLastSignal({
      lastSessionCompletedAt: null,
      lastWellnessDate: '2026-01-12',
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    });
    assert.deepEqual(result, { at: '2026-01-12', source: 'wellness' });
  });

  test('each source alone wins when it is the only one present — strava', () => {
    const result = resolveLastSignal({
      lastSessionCompletedAt: null,
      lastWellnessDate: null,
      lastStravaAt: '2026-01-14T18:30:00Z',
      lastAthleteMessageAt: null,
    });
    assert.deepEqual(result, { at: '2026-01-14', source: 'strava' });
  });

  test('each source alone wins when it is the only one present — chat', () => {
    const result = resolveLastSignal({
      lastSessionCompletedAt: null,
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: '2026-01-16T09:00:00Z',
    });
    assert.deepEqual(result, { at: '2026-01-16', source: 'chat' });
  });

  test('the most recent source wins when multiple sources have data', () => {
    // session 5 days before wellness's 3 days — wellness must win.
    const result = resolveLastSignal({
      lastSessionCompletedAt: '2026-02-05T08:00:00Z',
      lastWellnessDate: '2026-02-07',
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    });
    assert.deepEqual(result, { at: '2026-02-07', source: 'wellness' });
  });

  test('mixed date-only and full-timestamp inputs compare correctly', () => {
    // wellness is a bare date, strava is a full ISO timestamp on a later day.
    const result = resolveLastSignal({
      lastSessionCompletedAt: null,
      lastWellnessDate: '2026-01-20',
      lastStravaAt: '2026-01-25T23:59:00Z',
      lastAthleteMessageAt: null,
    });
    assert.deepEqual(result, { at: '2026-01-25', source: 'strava' });
  });

  test('a missing source never manufactures a false positive (absence is excluded, not zero)', () => {
    // Only strava has data, 40 days ago — the athlete is NOT silent despite
    // three sources being entirely absent.
    const result = resolveLastSignal({
      lastSessionCompletedAt: null,
      lastWellnessDate: null,
      lastStravaAt: '2026-01-01',
      lastAthleteMessageAt: null,
    });
    assert.equal(result.at, '2026-01-01');
    assert.equal(result.source, 'strava');
  });
});

// ============================================================
// daysBetween — pure string -> int, UTC-anchored (no ambient clock)
// ============================================================

describe('daysBetween', () => {
  test('computes whole days between two dates in the same month', () => {
    assert.equal(daysBetween('2026-02-03', '2026-02-15'), 12);
  });

  test('computes across a month boundary', () => {
    assert.equal(daysBetween('2026-01-25', '2026-02-05'), 11);
  });

  test('computes across a year boundary', () => {
    assert.equal(daysBetween('2025-12-20', '2026-01-05'), 16);
  });

  test('computes across a DST transition boundary unaffected by local time', () => {
    // Europe/Madrid DST starts 2026-03-29 — UTC-anchored math must not
    // perturb the day count by this transition.
    assert.equal(daysBetween('2026-03-25', '2026-04-02'), 8);
  });

  test('same-day returns zero', () => {
    assert.equal(daysBetween('2026-01-01', '2026-01-01'), 0);
  });
});

// ============================================================
// isPastWarmUp
// ============================================================

describe('isPastWarmUp', () => {
  test('null start_date is never evaluable', () => {
    assert.equal(isPastWarmUp(null, '2026-02-15'), false);
  });

  test('exactly at the 21-day boundary is past warm-up', () => {
    assert.equal(isPastWarmUp('2026-01-25', '2026-02-15'), true);
  });

  test('one day short of the boundary (20 days) is not past warm-up', () => {
    assert.equal(isPastWarmUp('2026-01-26', '2026-02-15'), false);
  });
});

// ============================================================
// tierFor — boundaries 9/10/20/21
// ============================================================

describe('tierFor', () => {
  test('9 days is below the warning threshold', () => {
    assert.equal(tierFor(9), null);
  });

  test('10 days is warning', () => {
    assert.equal(tierFor(10), 'warning');
  });

  test('20 days is still warning', () => {
    assert.equal(tierFor(20), 'warning');
  });

  test('21 days is danger', () => {
    assert.equal(tierFor(21), 'danger');
  });
});

// ============================================================
// evaluateEngagement — gate order: warm-up -> zero-planned suppression ->
// never-started -> tiering
// ============================================================

describe('evaluateEngagement', () => {
  const TODAY = '2026-02-15';

  test('gate 1: not past warm-up short-circuits regardless of silence', () => {
    const candidate = {
      athleteId: 'a1',
      coachId: 'c1',
      startDate: '2026-02-05', // 10 days ago, not past warm-up
      plannedInWindow: 3,
      lastSessionCompletedAt: null,
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    };
    assert.equal(evaluateEngagement(candidate, TODAY), null);
  });

  test('gate 2: zero planned sessions suppresses even 40 days of silence', () => {
    const candidate = {
      athleteId: 'a2',
      coachId: 'c1',
      startDate: '2026-01-01', // well past warm-up
      plannedInWindow: 0,
      lastSessionCompletedAt: '2026-01-06T00:00:00Z',
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    };
    assert.equal(evaluateEngagement(candidate, TODAY), null);
  });

  test('gate 3: never-started variant anchors silenceDays to start_date and always lands danger', () => {
    const candidate = {
      athleteId: 'a3',
      coachId: 'c1',
      startDate: '2026-01-25', // exactly 21 days ago (warm-up boundary)
      plannedInWindow: 2,
      lastSessionCompletedAt: null,
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    };
    const result = evaluateEngagement(candidate, TODAY);
    assert.ok(result);
    assert.equal(result.alertType, 'engagement_silence');
    assert.equal(result.severity, 'danger');
    assert.equal(result.silenceDays, 21);
    assert.equal(result.metrics.variant, 'never_started');
    assert.equal(result.metrics.lastSignalAt, null);
    assert.equal(result.metrics.lastSignalSource, null);
    assert.equal(result.metrics.plannedInWindow, 2);
    assert.match(result.messageEs, /nunca/i);
  });

  test('an athlete with at least one lifetime signal is never flagged never-started', () => {
    const candidate = {
      athleteId: 'a3b',
      coachId: 'c1',
      startDate: '2026-01-01',
      plannedInWindow: 2,
      lastSessionCompletedAt: null,
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: '2026-01-06T00:00:00Z', // one message 40 days ago
    };
    const result = evaluateEngagement(candidate, TODAY);
    assert.ok(result);
    assert.equal(result.metrics.variant, 'silence');
    assert.equal(result.silenceDays, 40);
  });

  test('gate 4/5: ordinary silence below the warning boundary (9 days) returns null', () => {
    const candidate = {
      athleteId: 'a4',
      coachId: 'c1',
      startDate: '2026-01-01',
      plannedInWindow: 2,
      lastSessionCompletedAt: '2026-02-06T00:00:00Z', // 9 days ago
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    };
    assert.equal(evaluateEngagement(candidate, TODAY), null);
  });

  test('warning tier at exactly 10 days of silence', () => {
    const candidate = {
      athleteId: 'a5',
      coachId: 'c1',
      startDate: '2026-01-01',
      plannedInWindow: 2,
      lastSessionCompletedAt: null,
      lastWellnessDate: '2026-02-05', // 10 days ago
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    };
    const result = evaluateEngagement(candidate, TODAY);
    assert.ok(result);
    assert.equal(result.severity, 'warning');
    assert.equal(result.silenceDays, 10);
    assert.equal(result.metrics.variant, 'silence');
    assert.equal(result.metrics.lastSignalAt, '2026-02-05');
    assert.equal(result.metrics.lastSignalSource, 'wellness');
  });

  test('danger tier at exactly 21 days of silence', () => {
    const candidate = {
      athleteId: 'a6',
      coachId: 'c1',
      startDate: '2026-01-01',
      plannedInWindow: 2,
      lastSessionCompletedAt: null,
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: '2026-01-25T00:00:00Z', // 21 days ago
    };
    const result = evaluateEngagement(candidate, TODAY);
    assert.ok(result);
    assert.equal(result.severity, 'danger');
    assert.equal(result.silenceDays, 21);
  });

  test('a Strava-less athlete training consistently on other sources is never flagged', () => {
    const candidate = {
      athleteId: 'a7',
      coachId: 'c1',
      startDate: '2026-01-01',
      plannedInWindow: 5,
      lastSessionCompletedAt: '2026-02-14T00:00:00Z', // yesterday
      lastWellnessDate: null,
      lastStravaAt: null, // never connected — must not count against them
      lastAthleteMessageAt: null,
    };
    assert.equal(evaluateEngagement(candidate, TODAY), null);
  });

  test('returned finding shape matches the design contract', () => {
    const candidate = {
      athleteId: 'a8',
      coachId: 'c1',
      startDate: '2026-01-01',
      plannedInWindow: 1,
      lastSessionCompletedAt: '2026-02-04T00:00:00Z', // 11 days ago
      lastWellnessDate: null,
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    };
    const result = evaluateEngagement(candidate, TODAY);
    assert.deepEqual(Object.keys(result).sort(), [
      'alertType',
      'messageEs',
      'metrics',
      'severity',
      'silenceDays',
    ].sort());
    assert.deepEqual(Object.keys(result.metrics).sort(), [
      'lastSignalAt',
      'lastSignalSource',
      'plannedInWindow',
      'variant',
    ].sort());
  });
});
