import TrainingLoadAlertFeed from '../shared/TrainingLoadAlertFeed';

/**
 * Coach-dashboard entry point for the merged alert feed (training-load
 * signals + engagement/churn-risk silence, Agent 2 + plan-adjustment
 * suggestions, Agent 3). Kept as its own file under
 * src/components/dashboard/ (this feature's expected file location,
 * mirroring TeamHealthTable.jsx), but delegates all rendering to the
 * cross-context TrainingLoadAlertFeed — the same component
 * src/pages/athlete/Dashboard.jsx renders for an athlete's own view — so
 * there is exactly one markup implementation, not two forks that could
 * drift. `athleteName` is coach-view-only context (shown in
 * PlanAdjustmentReviewModal's header) — the athlete's own Dashboard.jsx
 * never passes it, and never needs to: plan_suggestion rows never reach
 * that RLS-scoped self-query in the first place.
 */
const AthleteLoadAlerts = ({ athleteId, title = 'Alertas', athleteName }) => (
  <TrainingLoadAlertFeed athleteId={athleteId} title={title} athleteName={athleteName} />
);

export default AthleteLoadAlerts;
