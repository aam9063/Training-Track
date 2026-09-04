/**
 * Alert Feed Merge Service
 * Normalizes `training_load_alerts` (four physiological signals),
 * `athlete_engagement_alerts` (multi-week silence/churn-risk, Agent 2), and
 * `plan_adjustment_suggestions` (coach-actionable plan-change proposals,
 * Agent 3) into one source-agnostic view-model so the UI never forks on
 * which table an item came from — see design.md's "UI Feed Generalization"
 * section.
 *
 * View-model shape:
 *   { id, source: 'training_load' | 'engagement' | 'plan_suggestion',
 *     label, tone: 'warning' | 'critical' | 'action',
 *     messageEs, createdAt, readAt, dismissedAt, payload? }
 *
 * `tone: 'action'` is Agent 3-specific and distinct from the two
 * information-only tones ('warning'/'critical') — a `plan_suggestion` row
 * needs a coach decision (approve/reject), not just an acknowledgement, so
 * it gets its own visual treatment in TrainingLoadAlertFeed.jsx rather than
 * being folded into 'warning'. `payload` is populated ONLY for
 * `plan_suggestion` items (the raw suggestion row, incl. `patch`/
 * `snapshot`) — the review modal derives its diff view client-side from
 * this, never by re-querying `training_sessions` (design.md's drift-guard
 * rationale).
 *
 * For a supervised athlete, `getEngagementAlerts`/`getPlanAdjustments`
 * return `[]` (no self-select RLS policy on either table) — no role
 * branching is needed here, the merge is unconditional for any caller.
 */
import { getAlerts, markRead as markTrainingLoadRead, dismiss as dismissTrainingLoad } from './trainingLoadAlertsService';
import {
  getEngagementAlerts,
  markRead as markEngagementRead,
  dismiss as dismissEngagement,
} from './athleteEngagementAlertsService';
import {
  getPlanAdjustments,
  markRead as markPlanSuggestionRead,
  reject as rejectPlanSuggestion,
} from './planAdjustmentService';

// plan_adjustment_suggestions.patch_type -> human label fragment, used to
// build the feed row's label ("Ajuste de plan: <fragment>"). Kept in this
// file (not exported/shared) mirroring TRAINING_LOAD_LABELS/
// ENGAGEMENT_LABELS below — each consumer of a raw DB vocabulary owns its
// own translation, same convention as the rest of this file.
const PATCH_TYPE_LABELS = {
  deload_volume: 'reducir volumen',
  insert_recovery: 'día de recuperación',
  reduce_frequency: 'reducir frecuencia',
};

// training_load_alerts.alert_type -> label (training-load-alerts spec's
// "Alert Type Taxonomy" — exactly these four, never blended).
const TRAINING_LOAD_LABELS = {
  acwr_zone: 'Carga (ACWR)',
  tsb_critical: 'Forma (TSB)',
  low_completion: 'Cumplimiento semanal',
  high_rpe: 'Esfuerzo (RPE)',
};

// athlete_engagement_alerts.severity -> label (D1's tier labels).
const ENGAGEMENT_LABELS = {
  warning: 'Inactividad',
  danger: 'Riesgo de abandono',
};

const mapTrainingLoadAlert = (alert) => ({
  id: alert.id,
  source: 'training_load',
  label: TRAINING_LOAD_LABELS[alert.alert_type] || TRAINING_LOAD_LABELS.acwr_zone,
  tone: alert.severity === 'critical' ? 'critical' : 'warning',
  messageEs: alert.message_es,
  createdAt: alert.created_at,
  readAt: alert.read_at,
  dismissedAt: alert.dismissed_at,
});

const mapEngagementAlert = (alert) => ({
  id: alert.id,
  source: 'engagement',
  label: ENGAGEMENT_LABELS[alert.severity] || ENGAGEMENT_LABELS.warning,
  // engagement severity vocabulary is ('warning','danger'), not
  // ('warning','critical') — normalize 'danger' to the shared 'critical'
  // tone so the UI's SEVERITY_CLASSES map never has to know either
  // table's raw vocabulary.
  tone: alert.severity === 'danger' ? 'critical' : 'warning',
  messageEs: alert.message_es,
  createdAt: alert.created_at,
  readAt: alert.read_at,
  dismissedAt: alert.dismissed_at,
});

const mapPlanSuggestion = (suggestion) => ({
  id: suggestion.id,
  source: 'plan_suggestion',
  label: `Ajuste de plan: ${PATCH_TYPE_LABELS[suggestion.patch_type] || 'sugerido'}`,
  // 'action' — not 'warning'/'critical' — this is a coach decision to make
  // (approve/reject), not a plain physiological/engagement observation.
  tone: 'action',
  messageEs: suggestion.message_es,
  createdAt: suggestion.created_at,
  readAt: suggestion.read_at,
  dismissedAt: null, // suggestions have no dismissed_at column — terminal
  // status transitions (approved/rejected/expired/superseded) are what
  // remove a row from the 'pending' query this service issues, not a
  // separate dismiss timestamp.
  payload: suggestion, // raw row (patch/snapshot/metrics/…) for the review modal
});

/**
 * Get the merged, sorted (created_at desc) alert feed for one athlete.
 * @param {string} athleteId
 * @returns {Promise<Array>}
 */
export const getMergedAlerts = async (athleteId) => {
  if (!athleteId) return [];

  const [trainingLoadAlerts, engagementAlerts, planSuggestions] = await Promise.all([
    getAlerts(athleteId, { status: 'open' }),
    getEngagementAlerts(athleteId, { status: 'open' }),
    getPlanAdjustments(athleteId, { status: 'pending' }),
  ]);

  return [
    ...trainingLoadAlerts.map(mapTrainingLoadAlert),
    ...engagementAlerts.map(mapEngagementAlert),
    ...planSuggestions.map(mapPlanSuggestion),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Mark a merged-feed item as read, dispatching to the correct backing
 * table by `item.source`.
 * @param {{id: string, source: 'training_load'|'engagement'|'plan_suggestion'}} item
 */
export const markRead = async (item) => {
  if (item.source === 'engagement') return markEngagementRead(item.id);
  if (item.source === 'plan_suggestion') return markPlanSuggestionRead(item.id);
  return markTrainingLoadRead(item.id);
};

/**
 * Dismiss a merged-feed item, dispatching to the correct backing table by
 * `item.source`. For `plan_suggestion` this maps to `reject` — a
 * suggestion has no separate "dismissed" state, only its terminal
 * lifecycle (design.md's Frontend table: "dismiss on a suggestion maps to
 * reject"). NOTE: this dispatcher exists for API completeness/any future
 * generic caller, but TrainingLoadAlertFeed.jsx deliberately does NOT wire
 * its row-level dismiss (×) button to `plan_suggestion` items — rejecting
 * a plan change is a decision that should go through
 * PlanAdjustmentReviewModal (where the coach sees the diff first), not a
 * one-click X on the feed row.
 * @param {{id: string, source: 'training_load'|'engagement'|'plan_suggestion'}} item
 */
export const dismiss = async (item) => {
  if (item.source === 'engagement') return dismissEngagement(item.id);
  if (item.source === 'plan_suggestion') return rejectPlanSuggestion(item.id);
  return dismissTrainingLoad(item.id);
};
