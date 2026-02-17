import { useState, useEffect, useCallback } from 'react';
import {
  isStravaConnected,
  getStravaActivities,
  getStravaAthleteStats,
  getStoredAthlete,
  loadStravaTokens,
  calculateStravaMetrics,
  extractBestEfforts,
} from '../services/stravaService';
import { syncPersonalBests, updateAthleteVdot } from '../services/trainingLoadService';

export default function useStravaMetrics(profileId) {
  const [loading, setLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaMetrics, setStravaMetrics] = useState(null);
  const [bestEfforts, setBestEfforts] = useState([]);
  const [stravaStats, setStravaStats] = useState(null);
  const [weekFilter, setWeekFilter] = useState(8);
  const [rawActivities, setRawActivities] = useState([]);

  const loadStravaMetrics = useCallback(async () => {
    if (!profileId) return;

    setLoading(true);
    try {
      const { connected: dbConnected } = await loadStravaTokens(profileId);
      const connected = dbConnected || isStravaConnected();
      setStravaConnected(connected);

      if (connected) {
        const weeksAgo = Math.floor(Date.now() / 1000) - weekFilter * 7 * 24 * 60 * 60;
        const { data: activities } = await getStravaActivities({
          after: weeksAgo,
          per_page: 100,
        });

        if (activities?.length > 0) {
          setRawActivities(activities);
          setStravaMetrics(calculateStravaMetrics(activities));
          setBestEfforts(extractBestEfforts(activities));

          // Auto-sync: update VDOT and PBs from Strava best efforts
          try {
            const allEfforts = activities.flatMap(a => a.best_efforts || []);
            if (allEfforts.length > 0) {
              await Promise.all([
                updateAthleteVdot(profileId, allEfforts),
                syncPersonalBests(profileId, allEfforts),
              ]);
            }
          } catch (syncErr) {
            console.error('Auto-sync error (non-critical):', syncErr);
          }
        }

        // Get athlete stats
        const athlete = getStoredAthlete();
        if (athlete?.id) {
          const { data: stats } = await getStravaAthleteStats(athlete.id);
          if (stats) setStravaStats(stats);
        }
      }
    } catch (error) {
      console.error('Error loading Strava metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId, weekFilter]);

  useEffect(() => {
    loadStravaMetrics();
  }, [loadStravaMetrics]);

  return {
    loading,
    stravaConnected,
    stravaMetrics,
    bestEfforts,
    stravaStats,
    weekFilter,
    setWeekFilter,
    rawActivities,
  };
}
