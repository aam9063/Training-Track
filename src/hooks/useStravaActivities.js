import { useState, useEffect } from 'react';
import {
  isStravaConnected,
  getStravaActivities,
  getStravaActivityDetail,
  formatStravaActivity,
  loadStravaTokens,
} from '../services/stravaService';
import { getActivitiesRPE, saveActivityRPE } from '../services/rpeService';

export default function useStravaActivities(profileId) {
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [loadingStrava, setLoadingStrava] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [visibleActivities, setVisibleActivities] = useState(5);
  const [activitiesRPE, setActivitiesRPE] = useState({});
  const [editRpeActivity, setEditRpeActivity] = useState(null);

  useEffect(() => {
    const checkStrava = async () => {
      if (!profileId) return;
      const { connected } = await loadStravaTokens(profileId);
      const isConnected = connected || isStravaConnected();
      setStravaConnected(isConnected);

      if (isConnected) {
        setLoadingStrava(true);
        try {
          const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
          const { data: activities, error: activitiesError } = await getStravaActivities({
            after: thirtyDaysAgo,
            per_page: 50,
          });
          if (!activitiesError && activities) {
            const sorted = activities
              .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
              .map(formatStravaActivity);
            setStravaActivities(sorted);

            const ids = sorted.map((a) => String(a.id));
            const { data: rpeMap } = await getActivitiesRPE(profileId, ids);
            setActivitiesRPE(rpeMap || {});
          }
        } catch (err) {
          console.error('Error loading Strava activities:', err);
        }
        setLoadingStrava(false);
      }
    };
    checkStrava();
  }, [profileId]);

  const loadActivityDetail = async (activity) => {
    setSelectedActivity({ ...activity, loading: true });
    try {
      const { data, error: detailError } = await getStravaActivityDetail(activity.id);
      if (detailError) throw detailError;
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
    } catch (err) {
      console.error('Error loading activity details:', err);
      setSelectedActivity({ ...activity, loading: false, error: true });
    }
  };

  const handleEditRPESave = async (score, notes) => {
    if (!editRpeActivity || !profileId) return;
    await saveActivityRPE(profileId, String(editRpeActivity.id), score, notes);
    setActivitiesRPE((prev) => ({ ...prev, [String(editRpeActivity.id)]: { score, notes } }));
    setEditRpeActivity(null);
  };

  const showMoreActivities = () => setVisibleActivities((v) => v + 5);

  return {
    stravaConnected,
    stravaActivities,
    loadingStrava,
    selectedActivity,
    setSelectedActivity,
    visibleActivities,
    activitiesRPE,
    editRpeActivity,
    setEditRpeActivity,
    loadActivityDetail,
    handleEditRPESave,
    showMoreActivities,
  };
}
