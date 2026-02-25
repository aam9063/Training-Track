import { useState, useEffect, useCallback } from 'react';
import {
  isStravaConnected,
  getStravaAthleteStats,
  getStoredAthlete,
  loadStravaTokens,
  calculateStravaMetrics,
  extractBestEfforts,
} from '../services/stravaService';
import { syncPersonalBests, updateAthleteVdot } from '../services/trainingLoadService';
import { getCachedActivities } from '../services/stravaCacheService';
import { incrementalSync } from '../services/stravaSyncService';
import { supabase } from '../lib/supabase';

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
        // Incremental sync: fetch only new activities
        await incrementalSync(profileId);

        // Read time-filtered activities for period metrics (charts, weekly stats)
        const weeksAgo = new Date();
        weeksAgo.setDate(weeksAgo.getDate() - weekFilter * 7);
        const filteredActivities = await getCachedActivities(profileId, { after: weeksAgo });

        // Read ALL cached activities for all-time stats (longestRun, fastestPace, bestEfforts)
        const allActivities = await getCachedActivities(profileId);

        if (filteredActivities.length > 0 || allActivities.length > 0) {
          // Use filtered activities for period-specific metrics
          const periodMetrics = calculateStravaMetrics(filteredActivities);

          // Use ALL activities for all-time records
          const allTimeMetrics = calculateStravaMetrics(allActivities);

          // Merge: period metrics for totals/charts, all-time for records
          const mergedMetrics = {
            ...periodMetrics,
            longestRun: allTimeMetrics.longestRun,
            fastestPace: allTimeMetrics.fastestPace,
          };

          setRawActivities(filteredActivities);
          setStravaMetrics(mergedMetrics);

          // Best efforts from ALL activities (not just filtered)
          setBestEfforts(extractBestEfforts(allActivities));

          // Auto-sync: update VDOT, PBs, and max HR from all cached data
          try {
            const allEfforts = allActivities.flatMap((a) => a.best_efforts || []);
            const promises = [];
            if (allEfforts.length > 0) {
              promises.push(
                updateAthleteVdot(profileId, allEfforts),
                syncPersonalBests(profileId, allEfforts),
              );
            }
            // Auto-detect max HR from activities
            const observedMaxHR = Math.max(
              ...allActivities.filter(a => a.max_heartrate).map(a => a.max_heartrate)
            );
            if (observedMaxHR > 0 && isFinite(observedMaxHR)) {
              promises.push(
                supabase
                  .from('athletes')
                  .select('max_heart_rate')
                  .eq('id', profileId)
                  .single()
                  .then(({ data }) => {
                    if (!data?.max_heart_rate || observedMaxHR > data.max_heart_rate) {
                      return supabase
                        .from('athletes')
                        .update({ max_heart_rate: observedMaxHR })
                        .eq('id', profileId);
                    }
                  })
              );
            }
            await Promise.all(promises);
          } catch (syncErr) {
            console.error('Auto-sync error (non-critical):', syncErr);
          }
        }

        // Get athlete stats (lightweight API call, no cache needed)
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
