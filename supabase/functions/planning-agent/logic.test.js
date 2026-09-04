import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  isAuthorized,
  computeEffectiveDryRun,
  mapAlertRow,
  groupCandidatesByAthlete,
  buildFindingSourceMap,
  mapSessionRow,
  planSuggestion,
  summarizeSweep,
} from './logic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, 'index.ts');
const LOGIC_PATH = join(__dirname, 'logic.js');

// ============================================================
// Auth — unauthorized sweep/reactive request rejected
// (planning-agent-runtime is silent about this by omission but mirrors
// training-load-monitor/engagement-monitor's isAuthorized exactly)
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
// computeEffectiveDryRun — kill-switch semantics (planning-agent-runtime:
// "Kill Switch Defaults False, OR'd with Dry Run")
// ============================================================

describe('computeEffectiveDryRun', () => {
  test('kill switch off (unset -> false), no dryRun param -> effectiveDryRun true', () => {
    assert.equal(computeEffectiveDryRun(false, undefined), true);
  });

  test('kill switch off, dryRun explicitly false -> still true (kill switch always wins)', () => {
    assert.equal(computeEffectiveDryRun(false, false), true);
  });

  test('kill switch on, no dryRun param -> effectiveDryRun false', () => {
    assert.equal(computeEffectiveDryRun(true, undefined), false);
  });

  test('kill switch on, dryRun=true -> effectiveDryRun true', () => {
    assert.equal(computeEffectiveDryRun(true, true), true);
  });
});

// ============================================================
// mapAlertRow — normalizes both get_planning_candidates rows (alert_id)
// and raw training_load_alerts rows (id) to the same {alertId, alertType,
// severity, metrics} finding shape evaluateAdjustment/resolveFinding expect.
// ============================================================

describe('mapAlertRow', () => {
  test('maps a get_planning_candidates row (alert_id field)', () => {
    const row = { alert_id: 'alert-1', alert_type: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } };
    assert.deepEqual(mapAlertRow(row), {
      alertId: 'alert-1',
      alertType: 'acwr_zone',
      severity: 'critical',
      metrics: { zone: 'danger' },
    });
  });

  test('maps a raw training_load_alerts row (id field, reactive mode)', () => {
    const row = { id: 'alert-2', alert_type: 'tsb_critical', severity: 'warning', metrics: { tsb: -25 } };
    assert.deepEqual(mapAlertRow(row), {
      alertId: 'alert-2',
      alertType: 'tsb_critical',
      severity: 'warning',
      metrics: { tsb: -25 },
    });
  });

  test('defaults metrics to {} when absent', () => {
    const row = { id: 'alert-3', alert_type: 'low_completion', severity: 'warning' };
    assert.deepEqual(mapAlertRow(row).metrics, {});
  });
});

// ============================================================
// groupCandidatesByAthlete — co-fire grouping, no split across pagination
// ============================================================

describe('groupCandidatesByAthlete', () => {
  test('groups multiple alert rows for the same athlete into one candidate, order preserved', () => {
    const rows = [
      { athlete_id: 'a1', coach_id: 'c1', alert_id: 'al-1', alert_type: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } },
      { athlete_id: 'a1', coach_id: 'c1', alert_id: 'al-2', alert_type: 'tsb_critical', severity: 'warning', metrics: { tsb: -22 } },
    ];
    const groups = groupCandidatesByAthlete(rows);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].athleteId, 'a1');
    assert.equal(groups[0].coachId, 'c1');
    assert.equal(groups[0].openFindings.length, 2);
    assert.equal(groups[0].openFindings[0].alertType, 'acwr_zone');
    assert.equal(groups[0].openFindings[1].alertType, 'tsb_critical');
  });

  test('two different athletes produce two groups in first-seen order', () => {
    const rows = [
      { athlete_id: 'a1', coach_id: 'c1', alert_id: 'al-1', alert_type: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } },
      { athlete_id: 'a2', coach_id: 'c2', alert_id: 'al-2', alert_type: 'low_completion', severity: 'warning', metrics: {} },
    ];
    const groups = groupCandidatesByAthlete(rows);
    assert.deepEqual(groups.map((g) => g.athleteId), ['a1', 'a2']);
  });

  test('empty rows -> empty array', () => {
    assert.deepEqual(groupCandidatesByAthlete([]), []);
  });

  test('dropTrailingPartial true drops the last group entirely (page-splitting avoidance)', () => {
    const rows = [
      { athlete_id: 'a1', coach_id: 'c1', alert_id: 'al-1', alert_type: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } },
      { athlete_id: 'a2', coach_id: 'c2', alert_id: 'al-2', alert_type: 'low_completion', severity: 'warning', metrics: {} },
      { athlete_id: 'a3', coach_id: 'c3', alert_id: 'al-3', alert_type: 'tsb_critical', severity: 'warning', metrics: {} },
    ];
    const groups = groupCandidatesByAthlete(rows, { dropTrailingPartial: true });
    assert.deepEqual(groups.map((g) => g.athleteId), ['a1', 'a2']);
  });

  test('dropTrailingPartial false (default) keeps every group including the trailing one', () => {
    const rows = [
      { athlete_id: 'a1', coach_id: 'c1', alert_id: 'al-1', alert_type: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } },
    ];
    const groups = groupCandidatesByAthlete(rows, { dropTrailingPartial: false });
    assert.equal(groups.length, 1);
  });

  test('dropTrailingPartial true on a single-group page drops it to empty (fully deferred to next page)', () => {
    const rows = [
      { athlete_id: 'a1', coach_id: 'c1', alert_id: 'al-1', alert_type: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } },
    ];
    const groups = groupCandidatesByAthlete(rows, { dropTrailingPartial: true });
    assert.deepEqual(groups, []);
  });
});

// ============================================================
// buildFindingSourceMap — {id, finding_source}[] -> {id: finding_source}
// (used to resolve mapSessionRow's lastAdjustmentSource via
// training_sessions.last_adjustment_id -> plan_adjustment_suggestions.id)
// ============================================================

describe('buildFindingSourceMap', () => {
  test('builds an id -> finding_source lookup', () => {
    const rows = [
      { id: 'sug-1', finding_source: 'acwr_zone' },
      { id: 'sug-2', finding_source: 'low_completion' },
    ];
    assert.deepEqual(buildFindingSourceMap(rows), { 'sug-1': 'acwr_zone', 'sug-2': 'low_completion' });
  });

  test('empty/absent input -> {}', () => {
    assert.deepEqual(buildFindingSourceMap([]), {});
    assert.deepEqual(buildFindingSourceMap(undefined), {});
  });
});

// ============================================================
// mapSessionRow — snake_case training_sessions row -> camelCase
// planAdjustmentCore session shape
// ============================================================

describe('mapSessionRow', () => {
  test('maps a plain session row with no prior adjustment', () => {
    const row = {
      id: 's1',
      scheduled_date: '2026-09-05',
      status: 'planned',
      training_type: 'running',
      estimated_duration_minutes: 60,
      title: 'Tirada larga',
      description: null,
      adjusted_by_agent: false,
      last_adjustment_id: null,
    };
    assert.deepEqual(mapSessionRow(row), {
      id: 's1',
      scheduled_date: '2026-09-05',
      status: 'planned',
      training_type: 'running',
      estimated_duration_minutes: 60,
      title: 'Tirada larga',
      description: null,
      adjustedByAgent: false,
      lastAdjustmentSource: null,
    });
  });

  test('resolves lastAdjustmentSource from the findingSourceById map when last_adjustment_id is set', () => {
    const row = {
      id: 's2',
      scheduled_date: '2026-09-06',
      status: 'planned',
      training_type: 'running',
      estimated_duration_minutes: 45,
      title: 'Rodaje',
      description: null,
      adjusted_by_agent: true,
      last_adjustment_id: 'sug-1',
    };
    const mapped = mapSessionRow(row, { 'sug-1': 'acwr_zone' });
    assert.equal(mapped.adjustedByAgent, true);
    assert.equal(mapped.lastAdjustmentSource, 'acwr_zone');
  });

  test('last_adjustment_id set but missing from the map -> lastAdjustmentSource null (defensive)', () => {
    const row = {
      id: 's3',
      scheduled_date: '2026-09-06',
      status: 'planned',
      adjusted_by_agent: true,
      last_adjustment_id: 'sug-missing',
    };
    const mapped = mapSessionRow(row, {});
    assert.equal(mapped.lastAdjustmentSource, null);
  });
});

// ============================================================
// planSuggestion — thin wrapper over planAdjustmentCore.evaluateAdjustment,
// exercising the real priority-resolution pipeline end to end (the
// "reactive mode re-evaluates co-firing alerts and picks by priority"
// requirement from tasks.md 3.4).
// ============================================================

describe('planSuggestion', () => {
  const today = '2026-09-01';
  const futureSession = (overrides = {}) => ({
    id: 's1',
    scheduled_date: '2026-09-04',
    status: 'planned',
    training_type: 'running',
    estimated_duration_minutes: 60,
    title: 'Tirada',
    description: null,
    adjustedByAgent: false,
    lastAdjustmentSource: null,
    ...overrides,
  });

  test('acwr_zone danger co-firing with tsb_critical -> acwr wins (deload_volume)', () => {
    const candidate = {
      athleteId: 'a1',
      coachId: 'c1',
      openFindings: [
        mapAlertRow({ alert_id: 'al-1', alert_type: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } }),
        mapAlertRow({ alert_id: 'al-2', alert_type: 'tsb_critical', severity: 'warning', metrics: { tsb: -22 } }),
      ],
    };
    const { athleteId, coachId, suggestion } = planSuggestion(candidate, [futureSession()], { diasDisponibles: null }, today);
    assert.equal(athleteId, 'a1');
    assert.equal(coachId, 'c1');
    assert.ok(suggestion);
    assert.equal(suggestion.findingSource, 'acwr_zone');
    assert.equal(suggestion.patchType, 'deload_volume');
    assert.equal(suggestion.triggeringAlertId, 'al-1');
  });

  test('acwr_zone CAUTION (not danger) co-firing with tsb_critical -> tsb_critical wins (insert_recovery)', () => {
    const candidate = {
      athleteId: 'a2',
      coachId: 'c2',
      openFindings: [
        mapAlertRow({ alert_id: 'al-3', alert_type: 'acwr_zone', severity: 'warning', metrics: { zone: 'caution' } }),
        mapAlertRow({ alert_id: 'al-4', alert_type: 'tsb_critical', severity: 'warning', metrics: { tsb: -22 } }),
      ],
    };
    const { suggestion } = planSuggestion(candidate, [futureSession({ id: 's2', scheduled_date: '2026-09-03' })], { diasDisponibles: null }, today);
    assert.ok(suggestion);
    assert.equal(suggestion.findingSource, 'tsb_critical');
    assert.equal(suggestion.patchType, 'insert_recovery');
    assert.equal(suggestion.triggeringAlertId, 'al-4');
  });

  test('no eligible sessions -> suggestion is null', () => {
    const candidate = {
      athleteId: 'a3',
      coachId: 'c3',
      openFindings: [mapAlertRow({ alert_id: 'al-5', alert_type: 'acwr_zone', severity: 'critical', metrics: { zone: 'danger' } })],
    };
    const { suggestion } = planSuggestion(candidate, [], { diasDisponibles: null }, today);
    assert.equal(suggestion, null);
  });

  test('no open findings -> suggestion is null', () => {
    const candidate = { athleteId: 'a4', coachId: 'c4', openFindings: [] };
    const { suggestion } = planSuggestion(candidate, [futureSession({ id: 's4' })], { diasDisponibles: null }, today);
    assert.equal(suggestion, null);
  });
});

// ============================================================
// summarizeSweep — dry-run/live per-rule counts, the mechanism behind
// design's "Dry-run sweep counts per rule reviewed before
// PLANNING_SUGGESTIONS_ENABLED=true" manual gate
// ============================================================

describe('summarizeSweep', () => {
  test('aggregates evaluated / per-patchType suggested / persisted / skipped counts', () => {
    const results = [
      { athleteId: 'a1', patchType: 'deload_volume', persisted: true },
      { athleteId: 'a2', patchType: 'insert_recovery', persisted: false }, // dry-run: suggested but not persisted
      { athleteId: 'a3', patchType: 'reduce_frequency', persisted: true },
      { athleteId: 'a4', patchType: null, persisted: false }, // no patch produced
    ];
    assert.deepEqual(summarizeSweep(results), {
      evaluated: 4,
      suggested: { deload_volume: 1, insert_recovery: 1, reduce_frequency: 1 },
      persisted: 2,
      skipped: 1,
    });
  });

  test('an all-skipped page reports zero suggested/persisted, skipped = length', () => {
    const results = [
      { athleteId: 'a1', patchType: null, persisted: false },
      { athleteId: 'a2', patchType: null, persisted: false },
    ];
    assert.deepEqual(summarizeSweep(results), {
      evaluated: 2,
      suggested: { deload_volume: 0, insert_recovery: 0, reduce_frequency: 0 },
      persisted: 0,
      skipped: 2,
    });
  });

  test('empty page -> all zero', () => {
    assert.deepEqual(summarizeSweep([]), {
      evaluated: 0,
      suggested: { deload_volume: 0, insert_recovery: 0, reduce_frequency: 0 },
      persisted: 0,
      skipped: 0,
    });
  });
});

// ============================================================
// Static shape checks on index.ts / logic.js (grep-based, per task 3.4's
// "grep-based assertion that index.ts/logic.js never write
// training_sessions" and the runtime spec's write-boundary / kill-switch /
// local-date contracts). Mirrors engagement-monitor/logic.test.js's
// pattern exactly.
// ============================================================

describe('planning-agent — scope boundary + contract (static checks)', () => {
  test('index.ts exists', () => {
    assert.ok(existsSync(INDEX_PATH), 'expected supabase/functions/planning-agent/index.ts to exist');
  });

  test('logic.js exists and imports only ../_shared/planAdjustmentCore.js', () => {
    assert.ok(existsSync(LOGIC_PATH), 'expected supabase/functions/planning-agent/logic.js to exist');
    const source = readFileSync(LOGIC_PATH, 'utf8');
    const importLines = source.split('\n').filter((line) => /^\s*import\s/.test(line));
    assert.ok(importLines.length > 0, 'expected at least one import');
    for (const line of importLines) {
      assert.ok(
        line.includes('../_shared/planAdjustmentCore.js'),
        `unexpected import in logic.js (must import only planAdjustmentCore.js): ${line}`,
      );
    }
  });

  test('no writes to training_sessions anywhere in index.ts or logic.js (training_sessions Write Boundary requirement)', () => {
    for (const path of [INDEX_PATH, LOGIC_PATH]) {
      const source = readFileSync(path, 'utf8');
      const writeVerbs = ['.insert(', '.update(', '.upsert(', '.delete('];
      const lines = source.split('\n');
      lines.forEach((line, idx) => {
        if (!line.includes('training_sessions')) return;
        const window = lines.slice(idx, idx + 5).join('\n');
        for (const verb of writeVerbs) {
          assert.ok(!window.includes(verb), `unexpected write verb "${verb}" near a training_sessions reference in ${path}`);
        }
      });
    }
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

  test('kill switch PLANNING_SUGGESTIONS_ENABLED defaults to false', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('PLANNING_SUGGESTIONS_ENABLED'));
    assert.ok(/PLANNING_SUGGESTIONS_ENABLED["'`]?\)\s*\?\?\s*["'`]false["'`]/.test(source));
  });

  test('effectiveDryRun is computed via computeEffectiveDryRun, not an ad-hoc inline check', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('computeEffectiveDryRun'));
  });

  test('self-chains the next sweep page via EdgeRuntime.waitUntil on a full page', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('EdgeRuntime.waitUntil'));
    assert.ok(source.includes('mode: "sweep"') || source.includes("mode: 'sweep'"));
  });

  test('sweep mode calls expire_stale_plan_adjustments before get_planning_candidates', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    const sweepStart = source.indexOf('async function runSweep');
    assert.ok(sweepStart !== -1, 'expected a runSweep function');
    const sweepBody = source.slice(sweepStart);
    const expireIdx = sweepBody.indexOf('await expireStale(');
    const candidatesIdx = sweepBody.indexOf('get_planning_candidates');
    assert.ok(expireIdx !== -1, 'expected a call to expireStale() inside runSweep');
    assert.ok(candidatesIdx !== -1, 'expected a call to get_planning_candidates inside runSweep');
    assert.ok(expireIdx < candidatesIdx, 'expire_stale_plan_adjustments must run before get_planning_candidates');
  });

  test('persistence only happens via upsert_plan_adjustment_suggestion, guarded by effectiveDryRun', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('upsert_plan_adjustment_suggestion'));
    assert.ok(source.includes('effectiveDryRun'));
  });

  test('reactive mode is wired (mode === "reactive")', () => {
    const source = readFileSync(INDEX_PATH, 'utf8');
    assert.ok(source.includes('"reactive"') || source.includes("'reactive'"));
  });
});
