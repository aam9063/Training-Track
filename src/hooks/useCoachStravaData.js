import { useState, useEffect } from 'react';
import {
  getAthleteStravaConnection,
  getAthleteStravaActivities,
  getAthleteStravaActivityDetail,
} from '../services/athleteService';
import {
  formatStravaActivity,
  calculateStravaMetrics,
  extractBestEfforts,
} from '../services/stravaService';
import { getActivitiesRPE } from '../services/rpeService';
import { getCachedActivities } from '../services/stravaCacheService';

export default function useCoachStravaData(athleteId) {
  const [stravaActivities, setStravaActivities] = useState([]);
  const [stravaLoading, setStravaLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [visibleActivities, setVisibleActivities] = useState(5);
  const [stravaMetrics, setStravaMetrics] = useState(null);
  const [stravaBestEfforts, setStravaBestEfforts] = useState([]);
  const [activitiesRPE, setActivitiesRPE] = useState({});
  const [rpeDetailActivity, setRpeDetailActivity] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);

  useEffect(() => {
    const loadStravaData = async () => {
      if (!athleteId) return;

      setStravaLoading(true);
      try {
        const { data: connection } = await getAthleteStravaConnection(athleteId);
        setStravaConnected(!!connection);

        if (connection) {
          // Try cached activities first (fast, from Supabase)
          let activities = await getCachedActivities(athleteId, { limit: 30 });

          // Fallback: if cache is empty, fetch from Strava API via athlete's tokens
          if (activities.length === 0) {
            const { data: apiActivities } = await getAthleteStravaActivities(athleteId, {
              per_page: 30,
            });
            activities = apiActivities || [];
          }

          if (activities.length > 0) {
            const formatted = activities.slice(0, 15).map(formatStravaActivity);
            setStravaActivities(formatted);
            setStravaMetrics(calculateStravaMetrics(activities));
            setStravaBestEfforts(extractBestEfforts(activities));

            const ids = formatted.map((a) => String(a.id));
            const { data: rpeMap } = await getActivitiesRPE(athleteId, ids);
            setActivitiesRPE(rpeMap || {});
          } else {
            setStravaActivities([]);
            setStravaMetrics(null);
            setStravaBestEfforts([]);
          }
        }
      } catch (error) {
        console.error('Error loading Strava data:', error);
      } finally {
        setStravaLoading(false);
      }
    };

    loadStravaData();
  }, [athleteId]);

  const loadActivityDetail = async (activity) => {
    setSelectedActivity({ ...activity, loading: true });
    try {
      const { data, error } = await getAthleteStravaActivityDetail(athleteId, activity.id);
      if (error) throw error;
      setSelectedActivity({
        ...activity,
        loading: false,
        laps: data.laps || [],
        splits_metric: data.splits_metric || [],
        segment_efforts: data.segment_efforts || [],
        description: data.description,
        calories: data.calories,
        device_name: data.device_name,
        polyline: data.map?.polyline || data.map?.summary_polyline,
      });
    } catch (error) {
      console.error('Error loading activity details:', error);
      setSelectedActivity({ ...activity, loading: false, error: true });
    }
  };

  const showMoreActivities = () =>
    setVisibleActivities((v) => Math.min(v + 5, stravaActivities.length));

  return {
    stravaActivities,
    stravaLoading,
    stravaConnected,
    visibleActivities,
    stravaMetrics,
    stravaBestEfforts,
    activitiesRPE,
    rpeDetailActivity,
    setRpeDetailActivity,
    selectedActivity,
    setSelectedActivity,
    loadActivityDetail,
    showMoreActivities,
  };
}
