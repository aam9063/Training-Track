import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALC_VERSION,
  ALERT_TYPES,
  tssForActivity,
  buildDailySeries,
  computeLoadSeries,
  isoWeekStart,
  isoWeekEnd,
  summarizeWeekSessions,
  evaluateLoad,
  acwrFromComponents,
} from './trainingLoadCore.js';

// ============================================================
// Constants sanity
// ============================================================

test('CALC_VERSION and ALERT_TYPES are exported', () => {
  assert.equal(typeof CALC_VERSION, 'number');
  assert.deepEqual(
    [...ALERT_TYPES].sort(),
    ['acwr_zone', 'high_rpe', 'low_completion', 'tsb_critical'].sort(),
  );
});

// ============================================================
// tssForActivity — fallback chain: rTSS -> hrTSS -> duration
// ============================================================

describe('tssForActivity', () => {
  test('uses rTSS when threshold pace is available', () => {
    const activity = { moving_time: 3600, distance: 10000 }; // 10km in 1h = 360 s/km
    const profile = { lactate_threshold_pace: 300 }; // 5:00/km
    const tss = tssForActivity(activity, profile);
    assert.ok(tss > 0);
    // intensityFactor = 300/360 = 0.8333; tss = (3600 * 0.8333^2 / 3600) * 100 ~= 69
    assert.equal(tss, Math.round((300 / 360) ** 2 * 100));
  });

  test('falls back to hrTSS when no threshold pace but HR + LTHR available', () => {
    const activity = { moving_time: 3600, distance: 10000, average_heartrate: 150 };
    const profile = { lactate_threshold_hr: 170 };
    const tss = tssForActivity(activity, profile);
    const expected = Math.round((3600 * (150 / 170) ** 2) / 3600 * 100);
    assert.equal(tss, expected);
  });

  test('falls back to duration-only estimate when no threshold data', () => {
    const activity = { moving_time: 3600, distance: 10000 };
    const tss = tssForActivity(activity, {});
    assert.equal(tss, 60); // 1 hour easy ~= 60 TSS
  });

  test('returns 0 for activities with no distance or duration', () => {
    assert.equal(tssForActivity({ moving_time: 0, distance: 10000 }, {}), 0);
    assert.equal(tssForActivity({ moving_time: 3600, distance: 0 }, {}), 0);
  });
});

// ============================================================
// buildDailySeries — activity filtering + calendar gap-filling
// ============================================================

describe('buildDailySeries', () => {
  test('fills gaps with zero-tss days across the requested window', () => {
    const activities = [
      { type: 'Run', start_date_local: '2026-01-01T08:00:00', moving_time: 1800, distance: 5000 },
    ];
    const series = buildDailySeries(activities, {}, '2026-01-01', '2026-01-03');
    assert.equal(series.length, 3);
    assert.equal(series[0].date, '2026-01-01');
    assert.ok(series[0].count === 1);
    assert.equal(series[1].date, '2026-01-02');
    assert.equal(series[1].tss, 0);
    assert.equal(series[1].count, 0);
    assert.equal(series[2].date, '2026-01-03');
  });

  test('ignores non-running activity types', () => {
    const activities = [
      { type: 'Ride', start_date_local: '2026-01-01T08:00:00', moving_time: 3600, distance: 30000 },
    ];
    const series = buildDailySeries(activities, {}, '2026-01-01', '2026-01-01');
    assert.equal(series[0].count, 0);
    assert.equal(series[0].tss, 0);
  });

  test('accumulates multiple activities on the same day', () => {
    const activities = [
      { type: 'Run', start_date_local: '2026-01-01T07:00:00', moving_time: 1800, distance: 5000 },
      { type: 'TrailRun', start_date_local: '2026-01-01T18:00:00', moving_time: 1800, distance: 4000 },
    ];
    const series = buildDailySeries(activities, {}, '2026-01-01', '2026-01-01');
    assert.equal(series[0].count, 2);
  });
});

// ============================================================
// computeLoadSeries — CTL/ATL/TSB byte-parity vs. the pre-extraction
// trainingMetrics.js formula (calculatePMC). ACWR intentionally differs.
// ============================================================

describe('computeLoadSeries — CTL/ATL/TSB parity', () => {
  // Inline copy of trainingMetrics.js's pre-change calculatePMC()/updateCtl()/
  // updateAtl()/calculateTsb() — this is the fixture we assert byte-parity
  // against, NOT an import (trainingMetrics.js delegates to this same core
  // as of task 1.14, which would make an import circular/tautological).
  const legacyUpdateCtl = (ctlYesterday, tssToday, timeConstant = 42) =>
    ctlYesterday + (tssToday - ctlYesterday) * (1 / timeConstant);
  const legacyUpdateAtl = (atlYesterday, tssToday, timeConstant = 7) =>
    atlYesterday + (tssToday - atlYesterday) * (1 / timeConstant);
  const legacyCalculateTsb = (ctl, atl) => ctl - atl;
  const legacyCalculatePMC = (dailyTssArray, initialCtl = 0, initialAtl = 0) => {
    let ctl = initialCtl;
    let atl = initialAtl;
    let prevCtl = initialCtl;
    return dailyTssArray.map((day, index) => {
      const tss = day.tss || 0;
      ctl = legacyUpdateCtl(ctl, tss);
      atl = legacyUpdateAtl(atl, tss);
      const tsb = legacyCalculateTsb(ctl, atl);
      let rampRate = null;
      if (index >= 7) rampRate = Math.round((ctl - prevCtl) * 10) / 10;
      if (index % 7 === 0) prevCtl = ctl;
      return {
        date: day.date,
        tss: Math.round(tss * 10) / 10,
        ctl: Math.round(ctl * 10) / 10,
        atl: Math.round(atl * 10) / 10,
        tsb: Math.round(tsb * 10) / 10,
        rampRate,
      };
    });
  };

  // Fixture: 40 days of varied TSS.
  const fixture = Array.from({ length: 40 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    tss: (i % 5) * 20 + (i % 3 === 0 ? 40 : 0),
  }));

  test('CTL/ATL/TSB/rampRate are byte-identical to the legacy formula', () => {
    const legacy = legacyCalculatePMC(fixture);
    const core = computeLoadSeries(fixture);
    assert.equal(core.length, legacy.length);
    for (let i = 0; i < legacy.length; i += 1) {
      assert.equal(core[i].ctl, legacy[i].ctl, `ctl mismatch at index ${i}`);
      assert.equal(core[i].atl, legacy[i].atl, `atl mismatch at index ${i}`);
      assert.equal(core[i].tsb, legacy[i].tsb, `tsb mismatch at index ${i}`);
      assert.equal(core[i].rampRate, legacy[i].rampRate, `rampRate mismatch at index ${i}`);
    }
  });

  test('ACWR intentionally differs from the legacy atl/ctl formula (uses chronic_load_28)', () => {
    const core = computeLoadSeries(fixture);
    const last = core[core.length - 1];
    const legacyAcwr = last.ctl > 0 ? Math.round((last.atl / last.ctl) * 100) / 100 : 0;
    const newAcwr = last.chronicLoad28 > 0 ? Math.round((last.atl / last.chronicLoad28) * 100) / 100 : 0;
    assert.equal(last.acwr, newAcwr);
    // With varied non-trivial TSS, the 28d and 42d chronic windows diverge,
    // so the two formulas should not coincide for this fixture.
    assert.notEqual(last.acwr, legacyAcwr);
  });
});

describe('computeLoadSeries — EWMA warm-up flag', () => {
  test('flags lowConfidence at 40 days of history', () => {
    const series = Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, tss: 50 }));
    const result = computeLoadSeries(series);
    assert.equal(result[result.length - 1].lowConfidence, true);
  });

  test('clears lowConfidence at 200 days of history', () => {
    const series = Array.from({ length: 200 }, (_, i) => ({ date: `d${i}`, tss: 50 }));
    const result = computeLoadSeries(series);
    assert.equal(result[result.length - 1].lowConfidence, false);
  });

  test('warm-up boundary is exactly 126 days', () => {
    const series125 = Array.from({ length: 125 }, (_, i) => ({ date: `d${i}`, tss: 50 }));
    const series126 = Array.from({ length: 126 }, (_, i) => ({ date: `d${i}`, tss: 50 }));
    assert.equal(computeLoadSeries(series125).at(-1).lowConfidence, true);
    assert.equal(computeLoadSeries(series126).at(-1).lowConfidence, false);
  });
});

// ============================================================
// isoWeekStart — Sunday/Monday/month/year boundaries + DST transition
// ============================================================

describe('isoWeekStart', () => {
  test('a Monday maps to itself', () => {
    assert.equal(isoWeekStart('2026-01-05'), '2026-01-05'); // 2026-01-05 is a Monday
  });

  test('a Sunday maps to the preceding Monday', () => {
    assert.equal(isoWeekStart('2026-01-11'), '2026-01-05'); // Sunday of that week
  });

  test('a mid-week date maps to that week\'s Monday', () => {
    assert.equal(isoWeekStart('2026-01-08'), '2026-01-05'); // Thursday
  });

  test('crosses a month boundary correctly', () => {
    // 2026-02-01 is a Sunday; the week's Monday is in January.
    assert.equal(isoWeekStart('2026-02-01'), '2026-01-26');
  });

  test('crosses a year boundary correctly', () => {
    // 2027-01-01 is a Friday; Monday of that week is in 2026.
    assert.equal(isoWeekStart('2027-01-01'), '2026-12-28');
  });

  test('is stable across a DST transition date (Europe/Madrid switches late March)', () => {
    // 2026-03-29 (Sunday, DST change day in Europe) — pure string/UTC math
    // must not be affected by any local-timezone DST shift.
    assert.equal(isoWeekStart('2026-03-29'), '2026-03-23');
  });

  test('isoWeekEnd returns the Sunday of the week starting on weekStart', () => {
    assert.equal(isoWeekEnd('2026-01-05'), '2026-01-11');
  });
});

// ============================================================
// summarizeWeekSessions — whole-week denominator, no floor
// ============================================================

describe('summarizeWeekSessions', () => {
  const weekStart = '2026-01-05';
  const weekEnd = '2026-01-11';

  test('completionRate is completed/planned over the WHOLE week (no elapsed-to-date truncation)', () => {
    const sessions = [
      { scheduled_date: '2026-01-05', status: 'completed', rpe_score: 6 },
      { scheduled_date: '2026-01-06', status: 'planned' },
      { scheduled_date: '2026-01-07', status: 'planned' },
      { scheduled_date: '2026-01-08', status: 'planned' },
      { scheduled_date: '2026-01-09', status: 'planned' },
      { scheduled_date: '2026-01-10', status: 'planned' },
    ];
    // Evaluated as of e.g. Tuesday: only 1/6 done, but denominator is the
    // WHOLE week (6), not elapsed days — no suppression floor.
    const summary = summarizeWeekSessions(sessions, weekStart, weekEnd);
    assert.equal(summary.planned, 6);
    assert.equal(summary.completed, 1);
    assert.equal(summary.completionRate, 1 / 6);
  });

  test('completionRate is null ONLY when planned === 0', () => {
    const summary = summarizeWeekSessions([], weekStart, weekEnd);
    assert.equal(summary.planned, 0);
    assert.equal(summary.completionRate, null);
  });

  test('avgRpe is averaged over rated COMPLETED sessions only', () => {
    const sessions = [
      { scheduled_date: '2026-01-05', status: 'completed', rpe_score: 8 },
      { scheduled_date: '2026-01-06', status: 'completed', rpe_score: 6 },
      { scheduled_date: '2026-01-07', status: 'completed' }, // unrated, excluded
      { scheduled_date: '2026-01-08', status: 'planned', rpe_score: 10 }, // not completed, excluded
    ];
    const summary = summarizeWeekSessions(sessions, weekStart, weekEnd);
    assert.equal(summary.ratedCount, 2);
    assert.equal(summary.avgRpe, 7);
  });

  test('avgRpe is null when no completed session has a rating', () => {
    const sessions = [{ scheduled_date: '2026-01-05', status: 'completed' }];
    const summary = summarizeWeekSessions(sessions, weekStart, weekEnd);
    assert.equal(summary.avgRpe, null);
  });

  test('ignores sessions outside the requested week window', () => {
    const sessions = [
      { scheduled_date: '2025-12-29', status: 'completed' }, // previous week
      { scheduled_date: '2026-01-12', status: 'planned' }, // next week
    ];
    const summary = summarizeWeekSessions(sessions, weekStart, weekEnd);
    assert.equal(summary.planned, 0);
  });
});

// ============================================================
// evaluateLoad — argument asymmetry (the warm-up spec scenario)
// ============================================================

describe('evaluateLoad — argument asymmetry', () => {
  test('evaluateLoad(null, summary) still yields session alerts', () => {
    const summary = { planned: 6, completed: 2, completionRate: 2 / 6, avgRpe: null, ratedCount: 0 };
    const findings = evaluateLoad(null, summary);
    assert.deepEqual(
      findings.map((f) => f.alertType).sort(),
      ['low_completion'],
    );
  });

  test('evaluateLoad(lowConfidenceRow, summary) yields session alerts only (EWMA suppressed)', () => {
    const lowConfidenceRow = { acwr: 1.9, tsb: -40, lowConfidence: true };
    const summary = { planned: 6, completed: 5, completionRate: 5 / 6, avgRpe: 9, ratedCount: 5 };
    const findings = evaluateLoad(lowConfidenceRow, summary);
    assert.deepEqual(
      findings.map((f) => f.alertType).sort(),
      ['high_rpe'],
    );
  });

  test('evaluateLoad(row, null) yields load alerts only', () => {
    const row = { acwr: 1.6, tsb: 0, lowConfidence: false };
    const findings = evaluateLoad(row, null);
    assert.deepEqual(
      findings.map((f) => f.alertType).sort(),
      ['acwr_zone'],
    );
  });

  test('danger ACWR zone is alert-eligible at critical severity', () => {
    const row = { acwr: 1.6, lowConfidence: false };
    const findings = evaluateLoad(row, null);
    const finding = findings.find((f) => f.alertType === 'acwr_zone');
    assert.equal(finding.severity, 'critical');
    assert.equal(finding.metrics.zone, 'danger');
  });

  test('caution ACWR zone is alert-eligible at warning severity', () => {
    const row = { acwr: 1.4, lowConfidence: false };
    const findings = evaluateLoad(row, null);
    const finding = findings.find((f) => f.alertType === 'acwr_zone');
    assert.equal(finding.severity, 'warning');
    assert.equal(finding.metrics.zone, 'caution');
  });

  test('optimal ACWR zone is not alert-eligible', () => {
    const row = { acwr: 1.0, lowConfidence: false };
    const findings = evaluateLoad(row, null);
    assert.equal(findings.some((f) => f.alertType === 'acwr_zone'), false);
  });

  test('tsb_critical fires below -30', () => {
    const row = { tsb: -35, lowConfidence: false };
    const findings = evaluateLoad(row, null);
    assert.equal(findings.some((f) => f.alertType === 'tsb_critical'), true);
  });

  test('two independent signals on the same day produce two independent, non-blended rows', () => {
    const row = { acwr: 1.6, tsb: -35, lowConfidence: false };
    const findings = evaluateLoad(row, null);
    const types = findings.map((f) => f.alertType).sort();
    assert.deepEqual(types, ['acwr_zone', 'tsb_critical']);
    assert.equal(findings.find((f) => f.alertType === 'acwr_zone').severity, 'critical');
    assert.equal(findings.find((f) => f.alertType === 'tsb_critical').severity, 'critical');
  });

  test('evaluateLoad(null, null) yields no findings', () => {
    assert.deepEqual(evaluateLoad(null, null), []);
  });
});

// ============================================================
// acwrFromComponents — single formula, consumed by weekly-ai-reports
// (task 4.3) instead of a stored `acwr` column (daily_training_load only
// stores atl/chronic_load_28, never a precomputed ratio).
// ============================================================

describe('acwrFromComponents', () => {
  test('matches computeLoadSeries\' acwr for the same atl/chronicLoad28 pair', () => {
    const series = computeLoadSeries([
      { date: '2026-01-01', tss: 80 },
      { date: '2026-01-02', tss: 40 },
      { date: '2026-01-03', tss: 100 },
    ]);
    const last = series[series.length - 1];
    assert.equal(acwrFromComponents(last.atl, last.chronicLoad28), last.acwr);
  });

  test('returns null when chronicLoad28 is 0 (cold start, matches computeLoadSeries\' 0-fallback semantics minus the false-zero)', () => {
    assert.equal(acwrFromComponents(50, 0), null);
  });

  test('returns null when chronicLoad28 is null/undefined (row not yet recomputed)', () => {
    assert.equal(acwrFromComponents(50, null), null);
    assert.equal(acwrFromComponents(50, undefined), null);
  });

  test('returns null when atl is not a number', () => {
    assert.equal(acwrFromComponents(null, 40), null);
  });

  test('rounds to 2 decimals like the core formula', () => {
    assert.equal(acwrFromComponents(33.333, 25), 1.33);
  });
});
