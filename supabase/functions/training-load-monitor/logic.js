/**
 * training-load-monitor — pure reconciliation/auth/routing logic.
 *
 * Kept free of Deno/Supabase I/O (only imports the zero-dependency core
 * module) so this file runs unmodified under `node --test`, exactly like
 * `_shared/trainingLoadCore.js`. `index.ts` performs all actual I/O and
 * calls into these pure functions for every decision that has a testable
 * shape.
 *
 * See: openspec/changes/training-load-monitoring-agent/design.md
 *      ("Decision: Four independent signals, four independent episode
 *      streams" has the authoritative reconciliation rules).
 */

import { ALERT_TYPES } from '../_shared/trainingLoadCore.js';

const SEVERITY_RANK = { warning: 0, critical: 1 };

/**
 * True when the bearer token in `authHeader` matches CRON_SECRET or
 * SERVICE_ROLE_KEY. Matches the `cleanup-gym-files` Bearer-secret pattern.
 *
 * @param {string|null|undefined} authHeader - raw `Authorization` header value
 * @param {{cronSecret?:string, serviceRoleKey?:string}} secrets
 * @returns {boolean}
 */
export function isAuthorized(authHeader, secrets) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const { cronSecret, serviceRoleKey } = secrets || {};
  return (!!cronSecret && token === cronSecret) || (!!serviceRoleKey && token === serviceRoleKey);
}

/**
 * Delivery routing (training-load-agent-runtime: Alert Delivery Routing):
 * active coach if the relationship exists, else the athlete themself.
 *
 * @param {string} athleteId
 * @param {string|null} activeCoachId
 * @returns {string}
 */
export function resolveRecipientId(athleteId, activeCoachId) {
  return activeCoachId || athleteId;
}

/**
 * Whole-day difference `b - a` between two 'YYYY-MM-DD' strings, pure UTC
 * date math (inputs are already resolved calendar-date strings, not the
 * `toISOString().split('T')[0]` ambient-clock anti-pattern).
 *
 * @param {string} aStr
 * @param {string} bStr
 * @returns {number}
 */
export function daysBetween(aStr, bStr) {
  const a = Date.parse(`${aStr}T00:00:00Z`);
  const b = Date.parse(`${bStr}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/**
 * Reconcile ONE alert_type's episode state for the current evaluation.
 * Pure decision only — the caller (index.ts) is responsible for making the
 * DB writes atomic (the `upsert_training_load_alert` RPC for 'upsert', a
 * conditional UPDATE for 'resolve').
 *
 * Rules (design.md, "Four independent signals, four independent episode
 * streams"):
 *   - finding present, no open episode          -> insert, always deliver
 *   - finding present, open episode exists       -> refresh last_seen_on/
 *     metrics/severity always; deliver ONLY when severity escalates
 *     (only acwr_zone caution->danger can escalate; the other three
 *     signals are single-severity, so escalation is a permanent no-op)
 *   - finding absent, open episode exists        -> resolve only after 2
 *     consecutive clear days (last_seen_on < metric_date - 1), else noop
 *     (stays open, no re-fire while ongoing)
 *   - finding absent, no open episode            -> noop
 *
 * @param {{alertType:string, severity:'warning'|'critical', messageEs:string, metrics:Object}|null} finding
 * @param {{severity:'warning'|'critical', lastSeenOn:string}|null} openEpisode
 * @param {string} todayLocalStr - 'YYYY-MM-DD'
 * @returns {{action:'upsert'|'resolve'|'noop', deliver:boolean, escalated:boolean}}
 */
export function reconcileFinding(finding, openEpisode, todayLocalStr) {
  if (finding) {
    if (!openEpisode) {
      return { action: 'upsert', deliver: true, escalated: false };
    }
    const escalated = SEVERITY_RANK[finding.severity] > SEVERITY_RANK[openEpisode.severity];
    return { action: 'upsert', deliver: escalated, escalated };
  }

  if (openEpisode) {
    const gap = daysBetween(openEpisode.lastSeenOn, todayLocalStr);
    if (gap >= 2) {
      return { action: 'resolve', deliver: false, escalated: false };
    }
    return { action: 'noop', deliver: false, escalated: false };
  }

  return { action: 'noop', deliver: false, escalated: false };
}

/**
 * Reconcile ALL 4 alert types independently for one athlete/day. Each
 * type's decision depends ONLY on its own finding + its own open episode —
 * this is what proves the `(athlete_id, alert_type)` dedup key lets
 * concurrent types (e.g. an open `acwr_zone` episode and an open
 * `low_completion` episode at once) progress independently without
 * colliding.
 *
 * @param {Array<{alertType:string, severity:string, messageEs:string, metrics:Object}>} findings
 * @param {Record<string, {severity:string, lastSeenOn:string}|undefined>} openEpisodesByType
 * @param {string} todayLocalStr
 * @returns {Record<string, {action:string, deliver:boolean, escalated:boolean, finding:Object|null}>}
 */
export function planReconciliation(findings, openEpisodesByType, todayLocalStr) {
  const plan = {};
  for (const alertType of ALERT_TYPES) {
    const finding = (findings || []).find((f) => f.alertType === alertType) || null;
    const openEpisode = (openEpisodesByType && openEpisodesByType[alertType]) || null;
    plan[alertType] = { ...reconcileFinding(finding, openEpisode, todayLocalStr), finding };
  }
  return plan;
}
