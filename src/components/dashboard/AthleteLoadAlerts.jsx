import TrainingLoadAlertFeed from '../shared/TrainingLoadAlertFeed';

/**
 * Coach-dashboard entry point for the training-load alert feed. Kept as
 * its own file under src/components/dashboard/ (this feature's expected
 * file location, mirroring TeamHealthTable.jsx), but delegates all
 * rendering to the cross-context TrainingLoadAlertFeed — the same
 * component src/pages/athlete/Dashboard.jsx renders for an athlete's own
 * view — so there is exactly one markup implementation, not two forks
 * that could drift.
 */
const AthleteLoadAlerts = ({ athleteId, title = 'Alertas de carga' }) => (
  <TrainingLoadAlertFeed athleteId={athleteId} title={title} />
);

export default AthleteLoadAlerts;
