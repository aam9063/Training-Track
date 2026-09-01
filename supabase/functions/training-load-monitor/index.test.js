import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  isAuthorized,
  resolveRecipientId,
  daysBetween,
  reconcileFinding,
  planReconciliation,
} from './logic.js';
import { ALERT_TYPES, evaluateLoad } from '../_shared/trainingLoadCore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_SOURCE = readFileSync(join(__dirname, 'index.ts'), 'utf8');

// ============================================================
// Auth — unauthorized sweep rejected
// ============================================================

describe('isAuthorized', () => {
  test('accepts a matching CRON_SECRET bearer token', () => {
    assert.equal(
      isAuthorized('Bearer secret-abc', { cronSecret: 'secret-abc', serviceRoleKey: 'srv-key' }),
      true,
    );
  });

  test('accepts a matching SERVICE_ROLE_KEY bearer token', () => {
    assert.equal(
      isAuthorized('Bearer srv-key', { cronSecret: 'secret-abc', serviceRoleKey: 'srv-key' }),
      true,
    );
  });

  test('rejects a request with no Authorization header', () => {
    assert.equal(isAuthorized(null, { cronSecret: 'secret-abc', serviceRoleKey: 'srv-key' }), false);
  });

  test('rejects a request with a wrong token', () => {
    assert.equal(
      isAuthorized('Bearer wrong-token', { cronSecret: 'secret-abc', serviceRoleKey: 'srv-key' }),
      false,
    );
  });

  test('rejects when neither secret is configured', () => {
    assert.equal(isAuthorized('Bearer anything', {}), false);
  });
});

// ============================================================
// Delivery routing — independent vs coached athlete
// ============================================================

describe('resolveRecipientId', () => {
  test('routes to the active coach when a relationship exists', () => {
    assert.equal(resolveRecipientId('athlete-1', 'coach-9'), 'coach-9');
  });

  test('routes to the athlete themself when no active coach exists (independent athlete)', () => {
    assert.equal(resolveRecipientId('athlete-1', null), 'athlete-1');
  });
});

// ============================================================
// Insufficient history recomputes without alerting
// ============================================================

describe('insufficient-history athlete', () => {
  test('low-confidence row + no sessions planned yields zero findings (recompute persists, no alert)', () => {
    const loadRow = { acwr: 1.6, tsb: -35, lowConfidence: true };
    const findings = evaluateLoad(loadRow, null);
    assert.deepEqual(findings, []);
  });
});

// ============================================================
// Session-only athlete (no Strava data) still evaluates
// low_completion/high_rpe
// ============================================================

describe('session-only athlete (no Strava data)', () => {
  test('null loadRow still yields low_completion/high_rpe findings', () => {
    const weekSummary = { planned: 6, completed: 2, completionRate: 2 / 6, avgRpe: 9.0, ratedCount: 2 };
    const findings = evaluateLoad(null, weekSummary);
    const types = findings.map((f) => f.alertType).sort();
    assert.deepEqual(types, ['high_rpe', 'low_completion']);
  });
});

// ============================================================
// daysBetween — pure date math backing the 2-day hysteresis
// ============================================================

describe('daysBetween', () => {
  test('same day is zero', () => {
    assert.equal(daysBetween('2026-08-17', '2026-08-17'), 0);
  });

  test('one day apart', () => {
    assert.equal(daysBetween('2026-08-16', '2026-08-17'), 1);
  });

  test('two days apart', () => {
    assert.equal(daysBetween('2026-08-15', '2026-08-17'), 2);
  });
});

// ============================================================
// reconcileFinding — insert / escalate / refresh / hysteresis / resolve / noop
// ============================================================

describe('reconcileFinding', () => {
  const finding = (severity) => ({
    alertType: 'acwr_zone',
    severity,
    messageEs: 'msg',
    metrics: { acwr: 1.6, zone: severity === 'critical' ? 'danger' : 'caution' },
  });

  test('finding present, no open episode -> insert, always deliver', () => {
    const decision = reconcileFinding(finding('critical'), null, '2026-08-17');
    assert.deepEqual(decision, { action: 'upsert', deliver: true, escalated: false });
  });

  test('finding present, open episode same severity -> refresh only, no redeliver', () => {
    const openEpisode = { severity: 'critical', lastSeenOn: '2026-08-16' };
    const decision = reconcileFinding(finding('critical'), openEpisode, '2026-08-17');
    assert.deepEqual(decision, { action: 'upsert', deliver: false, escalated: false });
  });

  test('finding present, open episode escalates warning->critical -> redeliver', () => {
    const openEpisode = { severity: 'warning', lastSeenOn: '2026-08-16' };
    const decision = reconcileFinding(finding('critical'), openEpisode, '2026-08-17');
    assert.deepEqual(decision, { action: 'upsert', deliver: true, escalated: true });
  });

  test('finding present, open episode de-escalates critical->warning -> refresh only, no redeliver', () => {
    const openEpisode = { severity: 'critical', lastSeenOn: '2026-08-16' };
    const decision = reconcileFinding(finding('warning'), openEpisode, '2026-08-17');
    assert.deepEqual(decision, { action: 'upsert', deliver: false, escalated: false });
  });

  test('finding absent, open episode only 1 clear day -> noop (no re-fire while ongoing)', () => {
    const openEpisode = { severity: 'critical', lastSeenOn: '2026-08-16' };
    const decision = reconcileFinding(null, openEpisode, '2026-08-17');
    assert.deepEqual(decision, { action: 'noop', deliver: false, escalated: false });
  });

  test('finding absent, open episode 2 consecutive clear days -> resolve', () => {
    const openEpisode = { severity: 'critical', lastSeenOn: '2026-08-15' };
    const decision = reconcileFinding(null, openEpisode, '2026-08-17');
    assert.deepEqual(decision, { action: 'resolve', deliver: false, escalated: false });
  });

  test('finding absent, no open episode -> noop', () => {
    const decision = reconcileFinding(null, null, '2026-08-17');
    assert.deepEqual(decision, { action: 'noop', deliver: false, escalated: false });
  });

  test('single-severity signal (tsb_critical) never escalates -> refresh only', () => {
    const tsbFinding = { alertType: 'tsb_critical', severity: 'critical', messageEs: 'm', metrics: { tsb: -35 } };
    const openEpisode = { severity: 'critical', lastSeenOn: '2026-08-16' };
    const decision = reconcileFinding(tsbFinding, openEpisode, '2026-08-17');
    assert.equal(decision.escalated, false);
    assert.equal(decision.deliver, false);
  });
});

// ============================================================
// Concurrency: two open alert types reconcile independently (task 3.5)
// ============================================================

describe('planReconciliation — concurrent alert types do not collide', () => {
  test('an open acwr_zone episode and an open low_completion episode progress independently', () => {
    const findings = [
      { alertType: 'acwr_zone', severity: 'critical', messageEs: 'm1', metrics: { acwr: 1.6, zone: 'danger' } },
      // low_completion has cleared today (no finding) — its episode should
      // move toward resolution while acwr_zone's episode simply refreshes.
    ];
    const openEpisodesByType = {
      acwr_zone: { severity: 'warning', lastSeenOn: '2026-08-16' }, // will escalate
      low_completion: { severity: 'critical', lastSeenOn: '2026-08-15' }, // 2 clear days -> resolve
    };

    const plan = planReconciliation(findings, openEpisodesByType, '2026-08-17');

    assert.deepEqual(Object.keys(plan).sort(), [...ALERT_TYPES].sort());

    // acwr_zone escalates and redelivers, independent of low_completion.
    assert.equal(plan.acwr_zone.action, 'upsert');
    assert.equal(plan.acwr_zone.escalated, true);
    assert.equal(plan.acwr_zone.deliver, true);

    // low_completion resolves, independent of acwr_zone's escalation.
    assert.equal(plan.low_completion.action, 'resolve');
    assert.equal(plan.low_completion.deliver, false);

    // The two other signal types have no finding and no open episode -> noop,
    // proving all 4 types are evaluated independently in the same pass.
    assert.equal(plan.tsb_critical.action, 'noop');
    assert.equal(plan.high_rpe.action, 'noop');
  });

  test('4 concurrent open episodes of different types never share a dedup slot', () => {
    const findings = [
      { alertType: 'acwr_zone', severity: 'critical', messageEs: 'm', metrics: {} },
      { alertType: 'tsb_critical', severity: 'critical', messageEs: 'm', metrics: {} },
      { alertType: 'low_completion', severity: 'critical', messageEs: 'm', metrics: {} },
      { alertType: 'high_rpe', severity: 'critical', messageEs: 'm', metrics: {} },
    ];
    const openEpisodesByType = {}; // none open yet — all 4 should insert independently

    const plan = planReconciliation(findings, openEpisodesByType, '2026-08-17');

    for (const alertType of ALERT_TYPES) {
      assert.equal(plan[alertType].action, 'upsert', `${alertType} should insert`);
      assert.equal(plan[alertType].deliver, true, `${alertType} should deliver on first insert`);
    }
  });
});

// ============================================================
// Static shape checks on index.ts (grep-based, per task 3.7)
// ============================================================

describe('training-load-monitor/index.ts — scope boundary (static checks)', () => {
  test('no writes to training_sessions anywhere in the function', () => {
    // The agent MUST NOT write to training_sessions under any trigger path
    // (training-load-agent-runtime: Agent Scope Boundary). Read-only
    // `.from("training_sessions")` usage is fine; this asserts no write
    // verb (`.insert(`, `.update(`, `.upsert(`, `.delete(`) is ever chained
    // off a training_sessions query in this file.
    const trainingSessionsBlocks = INDEX_SOURCE
      .split('\n')
      .filter((line) => line.includes('training_sessions'));
    assert.ok(trainingSessionsBlocks.length > 0, 'expected at least one training_sessions read');

    const writeVerbs = ['.insert(', '.update(', '.upsert(', '.delete('];
    // Scan a window after each training_sessions reference for a write verb
    // on the same Supabase query chain (heuristic: within the next 4 lines,
    // which covers this file's `.from(...).select(...)` chain style).
    const lines = INDEX_SOURCE.split('\n');
    lines.forEach((line, idx) => {
      if (!line.includes('training_sessions')) return;
      const window = lines.slice(idx, idx + 5).join('\n');
      for (const verb of writeVerbs) {
        assert.ok(!window.includes(verb), `unexpected write verb "${verb}" near a training_sessions reference`);
      }
    });
  });

  test('does not create/modify training_plan, mesocycle, or microcycle rows', () => {
    for (const table of ['training_plan', 'mesocycle', 'microcycle']) {
      assert.ok(!INDEX_SOURCE.includes(`"${table}"`) && !INDEX_SOURCE.includes(`'${table}'`));
    }
  });

  test('week window is derived via isoWeekStart, not getUTCDay()', () => {
    assert.ok(INDEX_SOURCE.includes('isoWeekStart'));
    assert.ok(!INDEX_SOURCE.includes('getUTCDay('));
  });

  test('local date is derived via Intl.DateTimeFormat sv-SE Europe/Madrid, not toISOString().split', () => {
    assert.ok(INDEX_SOURCE.includes("Intl.DateTimeFormat(\"sv-SE\""));
    assert.ok(!INDEX_SOURCE.includes(".toISOString().split(\"T\")[0]"));
    assert.ok(!INDEX_SOURCE.includes(".toISOString().split('T')[0]"));
  });

  test('auth requires CRON_SECRET or SERVICE_ROLE_KEY, verify_jwt-style shared secret', () => {
    assert.ok(INDEX_SOURCE.includes('CRON_SECRET'));
    assert.ok(INDEX_SOURCE.includes('SUPABASE_SERVICE_ROLE_KEY'));
    assert.ok(INDEX_SOURCE.includes('isAuthorized'));
  });
});
