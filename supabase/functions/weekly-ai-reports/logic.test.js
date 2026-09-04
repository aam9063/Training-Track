import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER_ORDER,
  normalizeEngagementSeverity,
  alertLevelFromOpenAlerts,
  higherTier,
  buildNarrowWeekData,
} from './logic.js';

// ============================================================
// normalizeEngagementSeverity — bridges athlete_engagement_alerts'
// ('warning'|'danger') vocabulary into this report's tiers, mirroring
// alertFeedService.mapEngagementAlert's client-side bridge.
// ============================================================

describe('normalizeEngagementSeverity', () => {
  test('danger normalizes to critical', () => {
    assert.equal(normalizeEngagementSeverity('danger'), 'critical');
  });

  test('warning stays warning', () => {
    assert.equal(normalizeEngagementSeverity('warning'), 'warning');
  });
});

// ============================================================
// alertLevelFromOpenAlerts — widened to three sources (training_load_alerts,
// athlete_engagement_alerts, plan_adjustment_suggestions). Headline proposal
// success criterion: a `danger` engagement alert alone (zero load alerts)
// yields 'critical'.
// ============================================================

describe('alertLevelFromOpenAlerts', () => {
  test('an open danger engagement alert alone (zero training_load_alerts) yields critical', () => {
    const result = alertLevelFromOpenAlerts([], [{ severity: 'danger' }], []);
    assert.equal(result, 'critical');
  });

  test('an open warning engagement alert alone yields attention, not critical', () => {
    const result = alertLevelFromOpenAlerts([], [{ severity: 'warning' }], []);
    assert.equal(result, 'attention');
  });

  test('an open critical load alert alone yields critical', () => {
    const result = alertLevelFromOpenAlerts([{ severity: 'critical' }], [], []);
    assert.equal(result, 'critical');
  });

  test('an open warning load alert alone yields attention', () => {
    const result = alertLevelFromOpenAlerts([{ severity: 'warning' }], [], []);
    assert.equal(result, 'attention');
  });

  test('no open alerts from any source yields ok', () => {
    assert.equal(alertLevelFromOpenAlerts([], [], []), 'ok');
  });

  // Cross-vocabulary matrix: load alert severities x engagement severities x
  // plan-suggestion statuses. Any 'critical'-contributing source (load
  // 'critical' or engagement 'danger') dominates; else any 'warning'
  // contributor (load 'warning', engagement 'warning', or a pending
  // suggestion) yields 'attention'; else 'ok'.
  const matrix = [
    { load: 'critical', engagement: 'danger', suggestion: 'pending', expected: 'critical' },
    { load: 'critical', engagement: null, suggestion: null, expected: 'critical' },
    { load: null, engagement: 'danger', suggestion: null, expected: 'critical' },
    { load: 'warning', engagement: 'danger', suggestion: null, expected: 'critical' },
    { load: 'warning', engagement: 'warning', suggestion: null, expected: 'attention' },
    { load: null, engagement: 'warning', suggestion: null, expected: 'attention' },
    { load: null, engagement: null, suggestion: 'pending', expected: 'attention' },
    { load: 'warning', engagement: null, suggestion: 'approved', expected: 'attention' },
    { load: null, engagement: null, suggestion: 'approved', expected: 'ok' },
    { load: null, engagement: null, suggestion: 'rejected', expected: 'ok' },
    { load: null, engagement: null, suggestion: 'expired', expected: 'ok' },
    { load: null, engagement: null, suggestion: 'superseded', expected: 'ok' },
    { load: null, engagement: null, suggestion: null, expected: 'ok' },
  ];

  matrix.forEach(({ load, engagement, suggestion, expected }, i) => {
    test(`matrix[${i}]: load=${load} engagement=${engagement} suggestion=${suggestion} -> ${expected}`, () => {
      const loadAlerts = load ? [{ severity: load }] : [];
      const engagementAlerts = engagement ? [{ severity: engagement }] : [];
      const planSuggestions = suggestion ? [{ status: suggestion }] : [];
      assert.equal(alertLevelFromOpenAlerts(loadAlerts, engagementAlerts, planSuggestions), expected);
    });
  });

  test('a pending plan-adjustment suggestion alone yields attention, never critical', () => {
    assert.equal(alertLevelFromOpenAlerts([], [], [{ status: 'pending' }]), 'attention');
  });

  test('an approved suggestion alone contributes no tier (ok)', () => {
    assert.equal(alertLevelFromOpenAlerts([], [], [{ status: 'approved' }]), 'ok');
  });

  test('a rejected suggestion alone contributes no tier (ok)', () => {
    assert.equal(alertLevelFromOpenAlerts([], [], [{ status: 'rejected' }]), 'ok');
  });

  test('an expired suggestion alone contributes no tier (ok)', () => {
    assert.equal(alertLevelFromOpenAlerts([], [], [{ status: 'expired' }]), 'ok');
  });

  test('a superseded suggestion alone contributes no tier (ok)', () => {
    assert.equal(alertLevelFromOpenAlerts([], [], [{ status: 'superseded' }]), 'ok');
  });

  // Byte-identity guarantee: called with ONE argument (today's call shape),
  // the two new params default to [] and the function returns exactly
  // today's value for all three tiers. This is what keeps the
  // WIDE_CONTEXT_ENABLED=false degraded path identical to pre-change output
  // without a second code path.
  describe('single-argument call (WIDE_CONTEXT_ENABLED=false byte-identity guarantee)', () => {
    test('critical load alert, called with one argument -> critical', () => {
      assert.equal(alertLevelFromOpenAlerts([{ severity: 'critical' }]), 'critical');
    });

    test('warning load alert, called with one argument -> attention', () => {
      assert.equal(alertLevelFromOpenAlerts([{ severity: 'warning' }]), 'attention');
    });

    test('no load alerts, called with one argument -> ok', () => {
      assert.equal(alertLevelFromOpenAlerts([]), 'ok');
    });
  });
});

// ============================================================
// higherTier — the floor: the model's nivel_alerta may raise the
// deterministic level but never lower it.
// ============================================================

describe('higherTier', () => {
  test('TIER_ORDER is ok < attention < critical', () => {
    assert.deepEqual(TIER_ORDER, ['ok', 'attention', 'critical']);
  });

  test('LLM raises the level: deterministic attention, model critical -> critical', () => {
    assert.equal(higherTier('attention', 'critical'), 'critical');
  });

  test('LLM lowers the level: floor holds — deterministic critical, model ok -> critical', () => {
    assert.equal(higherTier('critical', 'ok'), 'critical');
  });

  test('LLM matches the level: deterministic attention, model attention -> attention', () => {
    assert.equal(higherTier('attention', 'attention'), 'attention');
  });

  test('unknown/absent candidate tier falls back to the floor', () => {
    assert.equal(higherTier('attention', undefined), 'attention');
    assert.equal(higherTier('critical', 'not-a-tier'), 'critical');
    assert.equal(higherTier('ok', null), 'ok');
  });

  test('unknown/absent floor tier falls back to a valid candidate', () => {
    assert.equal(higherTier(undefined, 'critical'), 'critical');
    assert.equal(higherTier('not-a-tier', 'attention'), 'attention');
  });

  test('unknown/absent floor AND invalid/absent candidate falls back to ok', () => {
    assert.equal(higherTier(undefined, undefined), 'ok');
    assert.equal(higherTier('not-a-tier', 'also-not-a-tier'), 'ok');
  });
});

// ============================================================
// buildNarrowWeekData — communication-agent D8 (amended post-Phase-5). Builds
// the narrow, pre-widening weekData view fed to the SECOND callDeepSeek call
// that produces ai_analysis_athlete_safe. The security boundary is that this
// function's OUTPUT is what gets sent to Gemini — never a post-hoc redaction
// of the wide call's output, and never a prompt instruction. Reuses the
// existing narrow-mode shape callDeepSeek already produces byte-identically
// for a WIDE_CONTEXT_ENABLED=false run — no second prompt template.
// ============================================================

describe('buildNarrowWeekData', () => {
  const wideWeekData = {
    week_start: '2026-09-01',
    week_end: '2026-09-03',
    wide_context: true,
    week_partial: true,
    engagement_alerts: [{ severity: 'danger', message_es: 'silencio prolongado' }],
    plan_adjustments: [{ status: 'pending', patch_type: 'reduce_volume' }],
    training_load_alerts: [{ alert_type: 'acwr_zone', severity: 'critical' }],
    sessions_planned: 5,
    sessions_done: 2,
  };

  test('forces wide_context to false regardless of input', () => {
    const narrow = buildNarrowWeekData(wideWeekData);
    assert.equal(narrow.wide_context, false);
  });

  test('forces engagement_alerts to an empty array regardless of input', () => {
    const narrow = buildNarrowWeekData(wideWeekData);
    assert.deepEqual(narrow.engagement_alerts, []);
  });

  test('forces plan_adjustments to an empty array regardless of input', () => {
    const narrow = buildNarrowWeekData(wideWeekData);
    assert.deepEqual(narrow.plan_adjustments, []);
  });

  test('preserves every other key unchanged', () => {
    const narrow = buildNarrowWeekData(wideWeekData);
    assert.equal(narrow.week_start, wideWeekData.week_start);
    assert.equal(narrow.week_end, wideWeekData.week_end);
    assert.equal(narrow.week_partial, wideWeekData.week_partial);
    assert.deepEqual(narrow.training_load_alerts, wideWeekData.training_load_alerts);
    assert.equal(narrow.sessions_planned, wideWeekData.sessions_planned);
    assert.equal(narrow.sessions_done, wideWeekData.sessions_done);
  });

  test('returns a new object, not the same reference', () => {
    const narrow = buildNarrowWeekData(wideWeekData);
    assert.notEqual(narrow, wideWeekData);
  });

  test('does NOT mutate the original weekData argument', () => {
    const original = {
      wide_context: true,
      engagement_alerts: [{ severity: 'danger' }],
      plan_adjustments: [{ status: 'pending' }],
    };
    const snapshotBefore = JSON.stringify(original);
    buildNarrowWeekData(original);
    assert.equal(JSON.stringify(original), snapshotBefore);
    assert.equal(original.wide_context, true);
    assert.equal(original.engagement_alerts.length, 1);
    assert.equal(original.plan_adjustments.length, 1);
  });

  test('called on an already-narrow weekData is a no-op on the three forced keys', () => {
    const alreadyNarrow = { wide_context: false, engagement_alerts: [], plan_adjustments: [], week_start: '2026-08-25' };
    const narrow = buildNarrowWeekData(alreadyNarrow);
    assert.equal(narrow.wide_context, false);
    assert.deepEqual(narrow.engagement_alerts, []);
    assert.deepEqual(narrow.plan_adjustments, []);
    assert.equal(narrow.week_start, '2026-08-25');
  });
});
