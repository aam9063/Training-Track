import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiLoader } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import {
  formatStravaActivity,
  getStravaActivityDetail,
} from '../../services/stravaService';
import { getCachedActivityByStravaId } from '../../services/stravaCacheService';
import StravaActivityDetail from '../../components/common/StravaActivityDetail';

/**
 * Full-page Strava activity detail for athletes (dependent + independent
 * both route here from /athlete/activity/:activityId). The :activityId
 * param is the Strava bigint id (`strava_id`) — same value exposed as
 * `activity.id` by `formatStravaActivity`.
 */
export default function ActivityDetailPage() {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!profile?.id || !activityId) return;
      setLoading(true);
      setNotFound(false);

      try {
        // 1) Base row from cache — gives us internal_id (UUID) which the
        // streams chart needs.
        const cached = await getCachedActivityByStravaId(profile.id, activityId);
        if (!cached) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        const baseFormatted = formatStravaActivity(cached);
        if (!cancelled) setActivity({ ...baseFormatted, loading: true });

        // 2) Detail from Strava API proxy.
        const { data, error } = await getStravaActivityDetail(activityId);
        if (cancelled) return;

        if (error) {
          // Even without detail we can render the core stats from cache.
          setActivity({ ...baseFormatted, loading: false });
        } else {
          setActivity({
            ...baseFormatted,
            loading: false,
            laps: data.laps || [],
            splits_metric: data.splits_metric || [],
            segment_efforts: data.segment_efforts || [],
            description: data.description,
            calories: data.calories,
            device_name: data.device_name,
            polyline: data.map?.polyline || data.map?.summary_polyline,
          });
        }
      } catch (err) {
        console.error('Error loading activity detail:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, activityId]);

  const handleBack = () => navigate(-1);

  if (loading && !activity) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiLoader className="w-8 h-8 animate-spin text-orange-500" />
        <span className="ml-3 text-ath-text-muted">Cargando actividad...</span>
      </div>
    );
  }

  if (notFound || !activity) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <h2 className="text-lg font-semibold text-ath-text-primary mb-2">
          Actividad no encontrada
        </h2>
        <p className="text-sm text-ath-text-muted mb-6">
          No se pudo cargar esta actividad. Puede que no exista o que no tengas
          permisos para verla.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <StravaActivityDetail
      activity={activity}
      athleteId={profile?.id}
      theme="athlete"
      canBackfillStreams
      onBack={handleBack}
    />
  );
}
