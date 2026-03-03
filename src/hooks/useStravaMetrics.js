import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isStravaConnected,
  getStravaAthleteStats,
  getStoredAthlete,
  loadStravaTokens,
  calculateStravaMetrics,
  extractBestEfforts,
  calculatePace,
} from '../services/stravaService';
import { syncPersonalBests, updateAthleteVdot } from '../services/trainingLoadService';
import { getCachedActivities, getAthleteAllTimeStats } from '../services/stravaCacheService';
import { incrementalSync } from '../services/stravaSyncService';
import { supabase } from '../lib/supabase';

// Minimum ms between incremental syncs to avoid hammering on every page visit
const SYNC_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const lastSyncTime = {}; // keyed by athleteId, persists across re-renders (module-level)

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
        // Throttled incremental sync: only run if last sync was > 5 min ago
        const now = Date.now();
        if (!lastSyncTime[profileId] || now - lastSyncTime[profileId] > SYNC_THROTTLE_MS) {
          await incrementalSync(profileId);
          lastSyncTime[profileId] = now;
        }

        // 1. Fetch period-filtered activities for charts & period totals
        const weeksAgo = new Date();
        weeksAgo.setDate(weeksAgo.getDate() - weekFilter * 7);
        const filteredActivities = await getCachedActivities(profileId, { after: weeksAgo });

        // 2. Fetch all-time aggregate stats from DB (single query, no full table scan to client)
        const allTimeStats = await getAthleteAllTimeStats(profileId);

        if (filteredActivities.length > 0 || allTimeStats) {
          // Period metrics from filtered activities
          const periodMetrics = calculateStravaMetrics(filteredActivities);

          // Merge period metrics with all-time records from the DB aggregation
          const mergedMetrics = {
            ...periodMetrics,
            longestRun: allTimeStats?.longestRun
              ? {
                  distance: allTimeStats.longestRun.distance,
                  distanceKm: (allTimeStats.longestRun.distance / 1000).toFixed(2),
                  date: allTimeStats.longestRun.start_date_local,
                  name: null,
                }
              : periodMetrics.longestRun,
            fastestPace: allTimeStats?.fastestPace
              ? {
                  // fastestPace is seconds/km; calculatePace(seconds, meters) → "m:ss /km"
                  pace: calculatePace(allTimeStats.fastestPace, 1000),
                  date: null,
                  name: null,
                }
              : periodMetrics.fastestPace,
          };

          setRawActivities(filteredActivities);
          setStravaMetrics(mergedMetrics);

          // Best efforts from the DB aggregation (last 500 runs, no full download)
          if (allTimeStats?.bestEfforts?.length) {
            setBestEfforts(extractBestEfforts(
              // extractBestEfforts expects activity objects with best_efforts arrays
              [{ best_efforts: allTimeStats.bestEfforts }]
            ));
          } else {
            setBestEfforts(extractBestEfforts(filteredActivities));
          }

          // Auto-sync VDOT, PBs, and max HR — only when we just ran a fresh sync
          // (i.e. lastSyncTime was updated this call, not throttled)
          const justSynced = lastSyncTime[profileId] && (Date.now() - lastSyncTime[profileId] < 10000);
          if (justSynced) {
            try {
              const promises = [];
              if (allTimeStats?.bestEfforts?.length) {
                promises.push(
                  updateAthleteVdot(profileId, allTimeStats.bestEfforts),
                  syncPersonalBests(profileId, allTimeStats.bestEfforts),
                );
              }
              if (allTimeStats?.observedMaxHR) {
                promises.push(
                  supabase
                    .from('athletes')
                    .select('max_heart_rate')
                    .eq('id', profileId)
                    .single()
                    .then(({ data }) => {
                      if (!data?.max_heart_rate || allTimeStats.observedMaxHR > data.max_heart_rate) {
                        return supabase
                          .from('athletes')
                          .update({ max_heart_rate: allTimeStats.observedMaxHR })
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
        }

        // Athlete stats (lightweight Strava API call)
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
