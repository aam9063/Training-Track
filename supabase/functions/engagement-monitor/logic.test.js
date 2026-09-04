import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  isAuthorized,
  mapCandidateRow,
  classifyCandidate,
  evaluateForSweep,
  shouldDeliverPush,
  shouldTriggerWeeklyReport,
  summarizeSweep,
} from './logic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, 'index.ts');

// ============================================================
// Auth — unauthorized sweep rejected (engagement-agent-runtime:
// "Unauthorized sweep request is rejected")
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
// mapCandidateRow — snake_case RPC row -> camelCase engagementCore input
// ============================================================

describe('mapCandidateRow', () => {
  test('maps get_engagement_candidates row shape to evaluateEngagement candidate shape', () => {
    const row = {
      athlete_id: 'athlete-1',
      coach_id: 'coach-9',
      start_date: '2026-08-01',
      last_session_completed_at: '2026-08-10T12:00:00Z',
      last_wellness_date: '2026-08-15',
      last_strava_at: null,
      last_athlete_message_at: null,
      planned_in_window: 3,
    };
    assert.deepEqual(mapCandidateRow(row), {
      athleteId: 'athlete-1',
      coachId: 'coach-9',
      startDate: '2026-08-01',
      plannedInWindow: 3,
      lastSessionCompletedAt: '2026-08-10T12:00:00Z',
      lastWellnessDate: '2026-08-15',
      lastStravaAt: null,
      lastAthleteMessageAt: null,
    });
  });
});

// ============================================================
// classifyCandidate — reason tracking for gates that evaluateEngagement
// collapses to null, needed for the dry-run suppressed-reasons breakdown
// ============================================================

describe('classifyCandidate', () => {
  const today = '2026-09-01';

  test('past-warm-up candidate silent 25 days -> finding present, no suppression reason', () => {
    const candidate = {
      athleteId: 'a1',
      startDate: '2026-07-01',
      plannedInWindow: 4,
      lastSessionCompletedAt: '2026-08-07',
    };
    const { finding, reason } = classifyCandidate(candidate, today);
    assert.ok(finding, 'expected a finding');
    assert.equal(finding.severity, 'danger');
    assert.equal(reason, null);
  });

  test('not past warm-up -> suppressed with reason "warmup"', () => {
    const candidate = { athleteId: 'a2', startDate: '2026-08-25', plannedInWindow: 4 };
    const { finding, reason } = classifyCandidate(candidate, today);
    assert.equal(finding, null);
    assert.equal(reason, 'warmup');
  });

  test('past warm-up but zero sessions planned in window -> suppressed with reason "zero_planned"', () => {
    const candidate = {
      athleteId: 'a3',
      startDate: '2026-07-01',
      plannedInWindow: 0,
      lastSessionCompletedAt: '2026-08-01',
    };
    const { finding, reason } = classifyCandidate(candidate, today);
    assert.equal(finding, null);
    assert.equal(reason, 'zero_planned');
  });

  test('past warm-up, sessions planned, but silence below the warning floor -> suppressed with reason "below_threshold"', () => {
    const candidate = {
      athleteId: 'a4',
      startDate: '2026-07-01',
      plannedInWindow: 4,
      lastSessionCompletedAt: '2026-08-28', // 4 days silent
    };
    const { finding, reason } = classifyCandidate(candidate, today);
    assert.equal(finding, null);
    assert.equal(reason, 'below_threshold');
  });

  test('never-started variant surfaces as a finding, not a suppression reason', () => {
    const candidate = { athleteId: 'a5', startDate: '2026-08-01', plannedInWindow: 2 };
    const { finding, reason } = classifyCandidate(candidate, today);
    assert.ok(finding);
    assert.equal(finding.metrics.variant, 'never_started');
    assert.equal(reason, null);
  });
});

// ============================================================
// evaluateForSweep — combines classification with new/escalate/refresh
// decision against an existing open alert, for dry-run reporting
// ============================================================

describe('evaluateForSweep', () => {
  const today = '2026-09-01';
  const silentCandidate = {
    athleteId: 'a1',
    startDate: '2026-07-01',
    plannedInWindow: 4,
    lastSessionCompletedAt: '2026-08-07', // 25 days silent -> danger
  };

  test('no finding -> decision "suppressed" with the classify reason', () => {
    const candidate = { athleteId: 'a2', startDate: '2026-08-25', plannedInWindow: 4 };
    const result = evaluateForSweep(candidate, null, today);
    assert.deepEqual(result, { finding: null, decision: 'suppressed', reason: 'warmup' });
  });

  test('finding present, no open alert -> decision "new"', () => {
    const result = evaluateForSweep(silentCandidate, null, today);
    assert.equal(result.decision, 'new');
    assert.equal(result.finding.severity, 'danger');
  });

  test('finding danger, open alert is warning -> decision "escalate"', () => {
    const openAlert = { severity: 'warning' };
    const result = evaluateForSweep(silentCandidate, openAlert, today);
    assert.equal(result.decision, 'escalate');
  });

  test('finding danger, open alert already danger -> decision "refresh" (no redeliver)', () => {
    const openAlert = { severity: 'danger' };
    const result = evaluateForSweep(silentCandidate, openAlert, today);
    assert.equal(result.decision, 'refresh');
  });
});

// ============================================================
// shouldDeliverPush — race-safe delivery decision from the RPC's own
// atomic result, mirroring training-load-monitor's documented rationale
// (a plan computed from a stale pre-write SELECT is not race-safe;
// is_new/escalated from the RPC's RETURNING clause is).
// ============================================================

describe('shouldDeliverPush', () => {
  test('delivers on a brand-new alert (is_new: true)', () => {
    assert.equal(shouldDeliverPush({ is_new: true, escalated: false }), true);
  });

  test('delivers on an escalation (escalated: true)', () => {
    assert.equal(shouldDeliverPush({ is_new: false, escalated: true }), true);
  });

  test('does not deliver on a same-severity refresh', () => {
    assert.equal(shouldDeliverPush({ is_new: false, escalated: false }), false);
  });

  test('does not deliver when result is null (RPC error)', () => {
    assert.equal(shouldDeliverPush(null), false);
  });
});

// ============================================================
// summarizeSweep — dry-run aggregate counts (evaluated / new / escalate /
// refresh / suppressed-by-reason), the mechanism behind the proposal's
// mandatory pre-enable dry run
// ============================================================

describe('summarizeSweep', () => {
  test('aggregates a mixed page into new/escalate/refresh + suppressed-by-reason counts', () => {
    const today = '2026-09-01';
    const results = [
      evaluateForSweep(
        { athleteId: 'a1', startDate: '2026-07-01', plannedInWindow: 4, lastSessionCompletedAt: '2026-08-07' },
        null,
        today,
      ), // new (danger)
      evaluateForSweep(
        { athleteId: 'a2', startDate: '2026-07-01', plannedInWindow: 4, lastSessionCompletedAt: '2026-08-07' },
        { severity: 'warning' },
        today,
      ), // escalate
      evaluateForSweep(
        { athleteId: 'a3', startDate: '2026-07-01', plannedInWindow: 4, lastSessionCompletedAt: '2026-08-07' },
        { severity: 'danger' },
        today,
      ), // refresh
      evaluateForSweep({ athleteId: 'a4', startDate: '2026-08-25', plannedInWindow: 4 }, null, today), // suppressed: warmup
      evaluateForSweep({ athleteId: 'a5', startDate: '2026-07-01', plannedInWindow: 0 }, null, today), // suppressed: zero_planned
    ];

    const summary = summarizeSweep(results);
    assert.deepEqual(summary, {
      evaluated: 5,
      findings: { new: 1, escalate: 1, refresh: 1 },
      suppressed: { warmup: 1, zero_planned: 1, below_threshold: 0 },
    });
  });

  test('an all-clean page (no findings, no suppressions) reports zero everywhere', () => {
    const summary = summarizeSweep([]);
    assert.deepEqual(summary, {
      evaluated: 0,
      findings: { new: 0, escalate: 0, refresh: 0 },
      suppressed: { warmup: 0, zero_planned: 0, below_threshold: 0 },
    });
  });
});

// ============================================================
// shouldTriggerWeeklyReport — reactive handoff to weekly-ai-reports
// (communication-agent Phase 3 / engagement-agent-runtime delta: "Reactive
// Report Trigger on Engagement Danger")
// ============================================================

describe('shouldTriggerWeeklyReport', () => {
  const dangerFinding = { alertType: 'engagement_silence', severity: 'danger' };
  const warningFinding = { alertType: 'engagement_silence', severity: 'warning' };
  const newResult = { alert_id: 'a1', is_new: true, escalated: false };
  const escalatedResult = { alert_id: 'a1', is_new: false, escalated: true };
  const refreshResult = { alert_id: 'a1', is_new: false, escalated: false };

  test('(a) engagement_silence at danger + is_new triggers the call', () => {
    assert.equal(shouldTriggerWeeklyReport(dangerFinding, newResult), true);
  });

  test('(a) engagement_silence at danger + escalated triggers the call', () => {
    assert.equal(shouldTriggerWeeklyReport(dangerFinding, escalatedResult), true);
  });

  test('(d) engagement_silence at danger but neither new nor escalated (duplicate/refresh) does NOT trigger the call', () => {
    assert.equal(shouldTriggerWeeklyReport(dangerFinding, refreshResult), false);
  });

  test('(b) engagement_silence at warning does NOT trigger the call, in every flag combination', () => {
    assert.equal(shouldTriggerWeeklyReport(warningFinding, newResult), false);
    assert.equal(shouldTriggerWeeklyReport(warningFinding, escalatedResult), false);
    assert.equal(shouldTriggerWeeklyReport(warningFinding, refreshResult), false);
  });

  test('(c) a hypothetical non-engagement_silence alertType does NOT trigger the call, even at danger', () => {
    const otherFinding = { alertType: 'some_other_alert', severity: 'danger' };
    assert.equal(shouldTriggerWeeklyReport(otherFinding, newResult), false);
  });

  test('null finding -> false, never throws', () => {
    assert.equal(shouldTriggerWeeklyReport(null, newResult), false);
  });

  test('null upsertResult -> false, never throws', () => {
    assert.equal(shouldTriggerWeeklyReport(dangerFinding, null), false);
  });
});

// ============================================================
// Static shape checks on index.ts (grep-based, per task 3.3's own
// "grep-based check for zero training_sessions writes" requirement and
// the runtime spec's kill-switch / local-date / scope-boundary contracts)
// ============================================================

describe('engagement-monitor/index.ts — scope boundary + contract (static checks)', () => {
  test('index.ts exists', () => {
    assert.ok(existsSync(INDEX_PATH), 'expected supabase/functions/engagement-monitor/index.ts to exist');
  });

  test('reactive weekly-report handoff is gated by shouldTriggerWeeklyReport and fire-and-forget via EdgeRuntime.waitUntil', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('shouldTriggerWeeklyReport'));
    assert.ok(source.includes('triggerWeeklyReport'));
    assert.ok(source.includes('mode: "athlete"') || source.includes("mode: 'athlete'"));
    assert.ok(source.includes('/functions/v1/weekly-ai-reports'));
    assert.ok(source.includes('EdgeRuntime.waitUntil'));
  });

  test('the reactive weekly-report handoff call site never awaits triggerWeeklyReport (fire-and-forget)', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(!source.includes('await triggerWeeklyReport'));
  });

  test('triggerWeeklyReport authenticates as service-role Bearer, never CRON_SECRET', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    const start = source.indexOf('function triggerWeeklyReport');
    assert.ok(start >= 0, 'expected a triggerWeeklyReport function definition');
    const end = source.indexOf('\n}', start);
    const body = source.slice(start, end);
    assert.ok(body.includes('SUPABASE_SERVICE_ROLE_KEY'));
    // Check the actual Authorization header line, not the explanatory
    // comment above it (which legitimately mentions CRON_SECRET as a
    // warning against copying training-load-monitor's pattern).
    const authLine = body.split('\n').find((line) => line.includes('Authorization:'));
    assert.ok(authLine, 'expected an Authorization header line in triggerWeeklyReport');
    assert.ok(authLine.includes('serviceRoleKey'));
    assert.ok(!authLine.includes('cronSecret'));
    assert.ok(!authLine.includes('CRON_SECRET'));
  });

  test('no writes to training_sessions anywhere in the function (Agent Scope Boundary)', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    const writeVerbs = ['.insert(', '.update(', '.upsert(', '.delete('];
    const lines = source.split('\n');
    lines.forEach((line, idx) => {
      if (!line.includes('training_sessions')) return;
      const window = lines.slice(idx, idx + 5).join('\n');
      for (const verb of writeVerbs) {
        assert.ok(!window.includes(verb), `unexpected write verb "${verb}" near a training_sessions reference`);
      }
    });
  });

  test('local date is derived via Intl.DateTimeFormat sv-SE Europe/Madrid, not toISOString().split', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('Intl.DateTimeFormat("sv-SE"'));
    assert.ok(!source.includes('.toISOString().split("T")[0]'));
    assert.ok(!source.includes(".toISOString().split('T')[0]"));
  });

  test('auth requires CRON_SECRET or SERVICE_ROLE_KEY via isAuthorized', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('CRON_SECRET'));
    assert.ok(source.includes('SUPABASE_SERVICE_ROLE_KEY'));
    assert.ok(source.includes('isAuthorized'));
  });

  test('kill switch ENGAGEMENT_ALERTS_ENABLED defaults to false', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('ENGAGEMENT_ALERTS_ENABLED'));
    // The default fallback must resolve to the string "false" when unset.
    assert.ok(/ENGAGEMENT_ALERTS_ENABLED["'`]?\)\s*\?\?\s*["'`]false["'`]/.test(source));
  });

  test('self-chains the next sweep page via EdgeRuntime.waitUntil', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('EdgeRuntime.waitUntil'));
    assert.ok(source.includes('mode: "sweep"') || source.includes("mode: 'sweep'"));
  });

  test('does not create/modify training_plan, mesocycle, or microcycle rows', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    for (const table of ['training_plan', 'mesocycle', 'microcycle']) {
      assert.ok(!source.includes(`"${table}"`) && !source.includes(`'${table}'`));
    }
  });
});
