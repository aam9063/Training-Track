import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FINDING_SOURCES,
  FINDING_PRIORITY,
  DELOAD_FACTOR,
  DELOAD_WINDOW_DAYS,
  RECOVERY_WINDOW_DAYS,
  MIN_SESSIONS_PER_WEEK,
  VOLUME_FIELDS,
  PATCHABLE_FIELDS,
  SNAPSHOT_FIELDS,
  REST_TYPE,
  countAvailableDays,
  daysBetween,
  eligibleSessions,
  ruleDeloadVolume,
  ruleInsertRecovery,
  ruleReduceFrequency,
  resolveFinding,
  evaluateAdjustment,
} from './planAdjustmentCore.js';

// ============================================================
// Constants sanity
// ============================================================

test('constants are exported with the design-specified values', () => {
  assert.deepEqual(FINDING_SOURCES, ['acwr_zone', 'tsb_critical', 'low_completion']);
  assert.deepEqual(FINDING_PRIORITY, ['acwr_zone', 'tsb_critical', 'low_completion']);
  assert.equal(DELOAD_FACTOR, 0.7);
  assert.equal(DELOAD_WINDOW_DAYS, 7);
  assert.equal(RECOVERY_WINDOW_DAYS, 3);
  assert.equal(MIN_SESSIONS_PER_WEEK, 2);
  assert.deepEqual(VOLUME_FIELDS, ['estimated_duration_minutes']);
  assert.deepEqual(PATCHABLE_FIELDS, [
    'estimated_duration_minutes',
    'training_type',
    'title',
    'description',
  ]);
  assert.deepEqual(SNAPSHOT_FIELDS, [
    'scheduled_date',
    'status',
    'training_type',
    'estimated_duration_minutes',
    'title',
  ]);
  assert.equal(REST_TYPE, 'rest');
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

  test('same-day returns zero', () => {
    assert.equal(daysBetween('2026-01-01', '2026-01-01'), 0);
  });

  test('computes across a DST transition boundary unaffected by local time', () => {
    assert.equal(daysBetween('2026-03-25', '2026-04-02'), 8);
  });
});

// ============================================================
// countAvailableDays — jsonb day-flag map -> int | null
// ============================================================

describe('countAvailableDays', () => {
  test('absent (undefined) yields null', () => {
    assert.equal(countAvailableDays(undefined), null);
  });

  test('null yields null', () => {
    assert.equal(countAvailableDays(null), null);
  });

  test('empty object yields null', () => {
    assert.equal(countAvailableDays({}), null);
  });

  test('all-false map yields 0 (not null — keys exist, none truthy)', () => {
    assert.equal(countAvailableDays({ L: false, M: false, X: false, J: false, V: false, S: false, D: false }), 0);
  });

  test('mixed map counts only truthy keys', () => {
    assert.equal(countAvailableDays({ L: true, M: false, X: true, J: false, V: true, S: false, D: false }), 3);
  });

  test('fully truthy map counts all seven', () => {
    assert.equal(countAvailableDays({ L: true, M: true, X: true, J: true, V: true, S: true, D: true }), 7);
  });
});

// ============================================================
// eligibleSessions
// ============================================================

describe('eligibleSessions', () => {
  const TODAY = '2026-02-15';

  test('excludes completed sessions', () => {
    const sessions = [
      { id: 's1', status: 'completed', scheduled_date: '2026-02-16' },
      { id: 's2', status: 'planned', scheduled_date: '2026-02-16' },
    ];
    const result = eligibleSessions(sessions, TODAY, 'acwr_zone');
    assert.deepEqual(result.map((s) => s.id), ['s2']);
  });

  test('excludes skipped sessions', () => {
    const sessions = [
      { id: 's1', status: 'skipped', scheduled_date: '2026-02-16' },
      { id: 's2', status: 'planned', scheduled_date: '2026-02-16' },
    ];
    const result = eligibleSessions(sessions, TODAY, 'acwr_zone');
    assert.deepEqual(result.map((s) => s.id), ['s2']);
  });

  test('excludes in_progress sessions', () => {
    const sessions = [{ id: 's1', status: 'in_progress', scheduled_date: '2026-02-16' }];
    assert.deepEqual(eligibleSessions(sessions, TODAY, 'acwr_zone'), []);
  });

  test('excludes sessions dated today (must be strictly after today)', () => {
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: TODAY }];
    assert.deepEqual(eligibleSessions(sessions, TODAY, 'acwr_zone'), []);
  });

  test('excludes sessions in the past', () => {
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-14' }];
    assert.deepEqual(eligibleSessions(sessions, TODAY, 'acwr_zone'), []);
  });

  test('includes a future planned session', () => {
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-16' }];
    assert.deepEqual(eligibleSessions(sessions, TODAY, 'acwr_zone').map((s) => s.id), ['s1']);
  });

  test('excludes a session already agent-adjusted for the SAME finding source (D4 anti-undo)', () => {
    const sessions = [
      {
        id: 's1',
        status: 'planned',
        scheduled_date: '2026-02-16',
        adjustedByAgent: true,
        lastAdjustmentSource: 'acwr_zone',
      },
    ];
    assert.deepEqual(eligibleSessions(sessions, TODAY, 'acwr_zone'), []);
  });

  test('includes a session agent-adjusted for a DIFFERENT finding source', () => {
    const sessions = [
      {
        id: 's1',
        status: 'planned',
        scheduled_date: '2026-02-16',
        adjustedByAgent: true,
        lastAdjustmentSource: 'tsb_critical',
      },
    ];
    assert.deepEqual(eligibleSessions(sessions, TODAY, 'acwr_zone').map((s) => s.id), ['s1']);
  });
});

// ============================================================
// ruleDeloadVolume — acwr_zone danger
// ============================================================

describe('ruleDeloadVolume', () => {
  const TODAY = '2026-02-15';
  const finding = { alertId: 'a1', alertType: 'acwr_zone', severity: 'critical', metrics: { acwr: 1.8, zone: 'danger' } };

  test('scales three eligible sessions within 7 days by x0.7', () => {
    const sessions = [
      { id: 's1', status: 'planned', scheduled_date: '2026-02-16', estimated_duration_minutes: 60 },
      { id: 's2', status: 'planned', scheduled_date: '2026-02-18', estimated_duration_minutes: 90 },
      { id: 's3', status: 'planned', scheduled_date: '2026-02-20', estimated_duration_minutes: 120 },
    ];
    const result = ruleDeloadVolume(finding, sessions, { todayLocal: TODAY });
    assert.ok(result);
    assert.equal(result.patch.sessions.s1.estimated_duration_minutes, 42);
    assert.equal(result.patch.sessions.s2.estimated_duration_minutes, 63);
    assert.equal(result.patch.sessions.s3.estimated_duration_minutes, 84);
    assert.deepEqual(Object.keys(result.patch.sessions).sort(), ['s1', 's2', 's3']);
    assert.deepEqual(Object.keys(result.snapshot.sessions).sort(), ['s1', 's2', 's3']);
  });

  test('a session exactly 7 days out is included (inclusive boundary)', () => {
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-22', estimated_duration_minutes: 60 }];
    const result = ruleDeloadVolume(finding, sessions, { todayLocal: TODAY });
    assert.ok(result);
    assert.ok('s1' in result.patch.sessions);
  });

  test('a session 8 days out is excluded from the window', () => {
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-23', estimated_duration_minutes: 60 }];
    const result = ruleDeloadVolume(finding, sessions, { todayLocal: TODAY });
    assert.equal(result, null);
  });

  test('empty eligible set produces no patch', () => {
    assert.equal(ruleDeloadVolume(finding, [], { todayLocal: TODAY }), null);
  });

  test('snapshot captures SNAPSHOT_FIELDS for every target', () => {
    const sessions = [
      {
        id: 's1',
        status: 'planned',
        scheduled_date: '2026-02-16',
        training_type: 'running',
        estimated_duration_minutes: 60,
        title: 'Tempo run',
      },
    ];
    const result = ruleDeloadVolume(finding, sessions, { todayLocal: TODAY });
    assert.deepEqual(result.snapshot.sessions.s1, {
      scheduled_date: '2026-02-16',
      status: 'planned',
      training_type: 'running',
      estimated_duration_minutes: 60,
      title: 'Tempo run',
    });
  });
});

// ============================================================
// ruleInsertRecovery — tsb_critical
// ============================================================

describe('ruleInsertRecovery', () => {
  const TODAY = '2026-02-15';
  const finding = { alertId: 'a2', alertType: 'tsb_critical', severity: 'critical', metrics: { tsb: -35 } };

  test('the higher-volume session within 3 days becomes rest; the lower-volume one is untouched', () => {
    const sessions = [
      { id: 's1', status: 'planned', scheduled_date: '2026-02-16', estimated_duration_minutes: 40 },
      { id: 's2', status: 'planned', scheduled_date: '2026-02-17', estimated_duration_minutes: 90 },
    ];
    const result = ruleInsertRecovery(finding, sessions, { todayLocal: TODAY });
    assert.ok(result);
    assert.deepEqual(Object.keys(result.patch.sessions), ['s2']);
    assert.equal(result.patch.sessions.s2.training_type, 'rest');
    assert.equal(result.patch.sessions.s2.estimated_duration_minutes, 0);
    assert.equal(result.patch.sessions.s2.title, 'Descanso');
  });

  test('no eligible session within 3 days produces no patch', () => {
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-25', estimated_duration_minutes: 60 }];
    assert.equal(ruleInsertRecovery(finding, sessions, { todayLocal: TODAY }), null);
  });

  test('a session exactly 3 days out is included (inclusive boundary)', () => {
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-18', estimated_duration_minutes: 60 }];
    const result = ruleInsertRecovery(finding, sessions, { todayLocal: TODAY });
    assert.ok(result);
    assert.ok('s1' in result.patch.sessions);
  });

  test('a session 4 days out is excluded from the window', () => {
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-19', estimated_duration_minutes: 60 }];
    assert.equal(ruleInsertRecovery(finding, sessions, { todayLocal: TODAY }), null);
  });

  test('empty eligible set produces no patch', () => {
    assert.equal(ruleInsertRecovery(finding, [], { todayLocal: TODAY }), null);
  });
});

// ============================================================
// ruleReduceFrequency — low_completion
// ============================================================

describe('ruleReduceFrequency', () => {
  const TODAY = '2026-02-15';
  const finding = {
    alertId: 'a3',
    alertType: 'low_completion',
    severity: 'critical',
    metrics: { plannedToDate: 7, completedToDate: 3, completionRate: 0.42 },
  };

  function upcomingWeek() {
    return [
      { id: 's1', status: 'planned', scheduled_date: '2026-02-16', estimated_duration_minutes: 60 },
      { id: 's2', status: 'planned', scheduled_date: '2026-02-17', estimated_duration_minutes: 60 },
      { id: 's3', status: 'planned', scheduled_date: '2026-02-18', estimated_duration_minutes: 60 },
      { id: 's4', status: 'planned', scheduled_date: '2026-02-19', estimated_duration_minutes: 60 },
      { id: 's5', status: 'planned', scheduled_date: '2026-02-20', estimated_duration_minutes: 60 },
    ];
  }

  test('trailing sessions dropped to match completed count (3 of 7, 5 eligible -> drop 2, leaving 3)', () => {
    const result = ruleReduceFrequency(finding, upcomingWeek(), {
      todayLocal: TODAY,
      completedThisWeek: 3,
      availableDays: null,
    });
    assert.ok(result);
    // trailing = latest two by date: s4, s5
    assert.deepEqual(Object.keys(result.patch.sessions).sort(), ['s4', 's5']);
    assert.equal(result.patch.sessions.s4.training_type, 'rest');
    assert.equal(result.patch.sessions.s5.training_type, 'rest');
  });

  test('floor of 2 is never crossed when completed=0 and available-days is unset', () => {
    const result = ruleReduceFrequency(finding, upcomingWeek(), {
      todayLocal: TODAY,
      completedThisWeek: 0,
      availableDays: null,
    });
    assert.ok(result);
    // 5 eligible, floor=2 -> drop 3, leaving exactly 2 (s1, s2) planned
    assert.equal(Object.keys(result.patch.sessions).length, 3);
    assert.deepEqual(Object.keys(result.patch.sessions).sort(), ['s3', 's4', 's5']);
  });

  test('available-day count raises the floor above 2 when higher (completed=1, 3 available days)', () => {
    const result = ruleReduceFrequency(finding, upcomingWeek(), {
      todayLocal: TODAY,
      completedThisWeek: 1,
      availableDays: 3,
    });
    assert.ok(result);
    // floor = max(2,3) = 3; target = max(1,3) = 3; drop 5-3=2 -> s4, s5
    assert.deepEqual(Object.keys(result.patch.sessions).sort(), ['s4', 's5']);
  });

  test('exactly at the floor (2 eligible sessions, completed=0) drops nothing', () => {
    const sessions = upcomingWeek().slice(0, 2);
    const result = ruleReduceFrequency(finding, sessions, {
      todayLocal: TODAY,
      completedThisWeek: 0,
      availableDays: null,
    });
    assert.equal(result, null);
  });

  test('completed count at or above eligible count drops nothing', () => {
    const result = ruleReduceFrequency(finding, upcomingWeek(), {
      todayLocal: TODAY,
      completedThisWeek: 5,
      availableDays: null,
    });
    assert.equal(result, null);
  });
});

// ============================================================
// resolveFinding — priority resolution + zone-gated acwr_zone
// ============================================================

describe('resolveFinding', () => {
  const acwrDanger = { alertId: 'a1', alertType: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } };
  const acwrCaution = { alertId: 'a1b', alertType: 'acwr_zone', severity: 'warning', metrics: { zone: 'caution' } };
  const acwrUndertraining = {
    alertId: 'a1c',
    alertType: 'acwr_zone',
    severity: 'warning',
    metrics: { zone: 'undertraining' },
  };
  const tsb = { alertId: 'a2', alertType: 'tsb_critical', severity: 'critical', metrics: { tsb: -35 } };
  const lowCompletion = {
    alertId: 'a3',
    alertType: 'low_completion',
    severity: 'critical',
    metrics: { completedToDate: 2, plannedToDate: 7, completionRate: 0.28 },
  };
  const highRpe = { alertId: 'a4', alertType: 'high_rpe', severity: 'critical', metrics: { avgRpe: 9 } };
  const engagementSilence = { alertId: 'a5', alertType: 'engagement_silence', severity: 'danger', metrics: {} };

  test('acwr_zone danger outranks tsb_critical', () => {
    const winner = resolveFinding([tsb, acwrDanger]);
    assert.equal(winner.alertType, 'acwr_zone');
  });

  test('tsb_critical outranks low_completion', () => {
    const winner = resolveFinding([lowCompletion, tsb]);
    assert.equal(winner.alertType, 'tsb_critical');
  });

  test('acwr_zone caution does not qualify — tsb_critical wins instead', () => {
    const winner = resolveFinding([acwrCaution, tsb]);
    assert.equal(winner.alertType, 'tsb_critical');
  });

  test('high_rpe alone yields no winner', () => {
    assert.equal(resolveFinding([highRpe]), null);
  });

  test('engagement_silence alone yields no winner', () => {
    assert.equal(resolveFinding([engagementSilence]), null);
  });

  test('acwr_zone caution alone yields no winner', () => {
    assert.equal(resolveFinding([acwrCaution]), null);
  });

  test('acwr_zone undertraining alone yields no winner', () => {
    assert.equal(resolveFinding([acwrUndertraining]), null);
  });

  test('empty findings array yields no winner', () => {
    assert.equal(resolveFinding([]), null);
  });

  test('all three actionable findings co-firing still yields exactly the acwr_zone winner', () => {
    const winner = resolveFinding([lowCompletion, tsb, acwrDanger]);
    assert.equal(winner.alertType, 'acwr_zone');
    assert.equal(winner.alertId, 'a1');
  });
});

// ============================================================
// evaluateAdjustment — the entry point
// ============================================================

describe('evaluateAdjustment', () => {
  const TODAY = '2026-02-15';

  test('returns null when no findings are open', () => {
    const candidate = { athleteId: 'ath1', coachId: 'coach1', openFindings: [] };
    assert.equal(evaluateAdjustment(candidate, [], { diasDisponibles: null }, TODAY), null);
  });

  test('returns null when the resolved finding is not actionable (high_rpe only)', () => {
    const candidate = {
      athleteId: 'ath1',
      coachId: 'coach1',
      openFindings: [{ alertId: 'a4', alertType: 'high_rpe', severity: 'critical', metrics: {} }],
    };
    assert.equal(evaluateAdjustment(candidate, [], { diasDisponibles: null }, TODAY), null);
  });

  test('returns null (not an empty patch) when the winning finding produces zero eligible targets', () => {
    const candidate = {
      athleteId: 'ath1',
      coachId: 'coach1',
      openFindings: [
        { alertId: 'a1', alertType: 'acwr_zone', severity: 'critical', metrics: { acwr: 1.8, zone: 'danger' } },
      ],
    };
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-03-01', estimated_duration_minutes: 60 }];
    assert.equal(evaluateAdjustment(candidate, sessions, { diasDisponibles: null }, TODAY), null);
  });

  test('acwr_zone danger produces a full deload_volume adjustment shape', () => {
    const candidate = {
      athleteId: 'ath1',
      coachId: 'coach1',
      openFindings: [
        { alertId: 'alert-1', alertType: 'acwr_zone', severity: 'critical', metrics: { acwr: 1.8, zone: 'danger' } },
      ],
    };
    const sessions = [
      { id: 's1', status: 'planned', scheduled_date: '2026-02-18', estimated_duration_minutes: 60 },
      { id: 's2', status: 'planned', scheduled_date: '2026-02-16', estimated_duration_minutes: 90 },
    ];
    const result = evaluateAdjustment(candidate, sessions, { diasDisponibles: null }, TODAY);
    assert.ok(result);
    assert.equal(result.findingSource, 'acwr_zone');
    assert.equal(result.patchType, 'deload_volume');
    assert.equal(result.triggeringAlertId, 'alert-1');
    assert.equal(result.earliestTargetDate, '2026-02-16');
    assert.equal(typeof result.messageEs, 'string');
    assert.ok(result.messageEs.length > 0);
    assert.deepEqual(result.metrics, { acwr: 1.8, zone: 'danger' });
  });

  test('tsb_critical produces an insert_recovery adjustment', () => {
    const candidate = {
      athleteId: 'ath1',
      coachId: 'coach1',
      openFindings: [{ alertId: 'alert-2', alertType: 'tsb_critical', severity: 'critical', metrics: { tsb: -35 } }],
    };
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-16', estimated_duration_minutes: 60 }];
    const result = evaluateAdjustment(candidate, sessions, { diasDisponibles: null }, TODAY);
    assert.ok(result);
    assert.equal(result.findingSource, 'tsb_critical');
    assert.equal(result.patchType, 'insert_recovery');
    assert.equal(result.triggeringAlertId, 'alert-2');
  });

  test('low_completion produces a reduce_frequency adjustment using completedToDate and dias_disponibles', () => {
    const candidate = {
      athleteId: 'ath1',
      coachId: 'coach1',
      openFindings: [
        {
          alertId: 'alert-3',
          alertType: 'low_completion',
          severity: 'critical',
          metrics: { plannedToDate: 7, completedToDate: 1, completionRate: 0.14 },
        },
      ],
    };
    const sessions = [
      { id: 's1', status: 'planned', scheduled_date: '2026-02-16', estimated_duration_minutes: 60 },
      { id: 's2', status: 'planned', scheduled_date: '2026-02-17', estimated_duration_minutes: 60 },
      { id: 's3', status: 'planned', scheduled_date: '2026-02-18', estimated_duration_minutes: 60 },
      { id: 's4', status: 'planned', scheduled_date: '2026-02-19', estimated_duration_minutes: 60 },
      { id: 's5', status: 'planned', scheduled_date: '2026-02-20', estimated_duration_minutes: 60 },
    ];
    // floor = max(2, countAvailableDays)=max(2,3)=3; target=max(completed=1,floor=3)=3;
    // 5 eligible -> drop trailing 2 (s4, s5)
    const result = evaluateAdjustment(
      candidate,
      sessions,
      { diasDisponibles: { L: true, M: true, X: true, J: false, V: false, S: false, D: false } },
      TODAY,
    );
    assert.ok(result);
    assert.equal(result.findingSource, 'low_completion');
    assert.equal(result.patchType, 'reduce_frequency');
    assert.deepEqual(Object.keys(result.patch.sessions).sort(), ['s4', 's5']);
  });

  test('co-firing findings resolve to exactly one patch (acwr_zone danger wins over tsb_critical)', () => {
    const candidate = {
      athleteId: 'ath1',
      coachId: 'coach1',
      openFindings: [
        { alertId: 'alert-1', alertType: 'acwr_zone', severity: 'critical', metrics: { acwr: 1.8, zone: 'danger' } },
        { alertId: 'alert-2', alertType: 'tsb_critical', severity: 'critical', metrics: { tsb: -35 } },
      ],
    };
    const sessions = [{ id: 's1', status: 'planned', scheduled_date: '2026-02-16', estimated_duration_minutes: 60 }];
    const result = evaluateAdjustment(candidate, sessions, { diasDisponibles: null }, TODAY);
    assert.ok(result);
    assert.equal(result.findingSource, 'acwr_zone');
    assert.equal(result.patchType, 'deload_volume');
  });
});

// ============================================================
// Reduction-only invariant — property-style across the full rule matrix
// ============================================================

describe('reduction-only invariant', () => {
  const TODAY = '2026-02-15';

  test('no rule in the matrix ever proposes an upward volume change, an added session, or an earlier date', () => {
    const acwrFinding = {
      alertId: 'a1',
      alertType: 'acwr_zone',
      severity: 'critical',
      metrics: { acwr: 1.8, zone: 'danger' },
    };
    const tsbFinding = { alertId: 'a2', alertType: 'tsb_critical', severity: 'critical', metrics: { tsb: -35 } };
    const lowCompletionFinding = {
      alertId: 'a3',
      alertType: 'low_completion',
      severity: 'critical',
      metrics: { completedToDate: 1, plannedToDate: 7, completionRate: 0.14 },
    };

    const sessions = [
      { id: 's1', status: 'planned', scheduled_date: '2026-02-16', estimated_duration_minutes: 60 },
      { id: 's2', status: 'planned', scheduled_date: '2026-02-17', estimated_duration_minutes: 90 },
      { id: 's3', status: 'planned', scheduled_date: '2026-02-18', estimated_duration_minutes: 45 },
      { id: 's4', status: 'planned', scheduled_date: '2026-02-19', estimated_duration_minutes: 70 },
      { id: 's5', status: 'planned', scheduled_date: '2026-02-20', estimated_duration_minutes: 30 },
    ];

    const results = [
      ruleDeloadVolume(acwrFinding, sessions, { todayLocal: TODAY }),
      ruleInsertRecovery(tsbFinding, sessions, { todayLocal: TODAY }),
      ruleReduceFrequency(lowCompletionFinding, sessions, {
        todayLocal: TODAY,
        completedThisWeek: 1,
        availableDays: null,
      }),
    ];

    for (const result of results) {
      if (!result) continue;
      for (const [id, fields] of Object.entries(result.patch.sessions)) {
        const original = sessions.find((s) => s.id === id);
        assert.ok(original, `patched session ${id} must exist in the original set (no session added)`);
        for (const field of VOLUME_FIELDS) {
          if (field in fields) {
            assert.ok(
              fields[field] <= (original[field] ?? 0),
              `${field} on ${id} must never increase (${fields[field]} <= ${original[field]})`,
            );
          }
        }
        assert.ok(!('scheduled_date' in fields), `patch for ${id} must never move scheduled_date`);
        // every patched id must also be present in the snapshot
        assert.ok(id in result.snapshot.sessions, `patched session ${id} missing from snapshot`);
      }
    }
  });
});
