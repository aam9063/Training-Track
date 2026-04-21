import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiLoader } from 'react-icons/fi';
import { formatStravaActivity } from '../../services/stravaService';
import { getCachedActivityByStravaId } from '../../services/stravaCacheService';
import { getAthleteStravaActivityDetail } from '../../services/athleteService';
import StravaActivityDetail from '../../components/common/StravaActivityDetail';

/**
 * Full-page Strava activity detail for the coach, scoped to a specific
 * athlete (`/dashboard/athletes/:athleteId/activity/:activityId`).
 *
 * The :activityId param is the Strava bigint id. Coach cannot trigger
 * stream backfill (canBackfillStreams=false), and the detail fetch goes
 * through the server-side proxy in `athleteService`.
 */
export default function CoachActivityDetailPage() {
  const { athleteId, activityId } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!athleteId || !activityId) return;
      setLoading(true);
      setNotFound(false);

      try {
        const cached = await getCachedActivityByStravaId(athleteId, activityId);
        if (!cached) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        const baseFormatted = formatStravaActivity(cached);
        if (!cancelled) setActivity({ ...baseFormatted, loading: true });

        const { data, error } = await getAthleteStravaActivityDetail(
          athleteId,
          activityId
        );
        if (cancelled) return;

        if (error) {
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
  }, [athleteId, activityId]);

  const handleBack = () => navigate(-1);

  if (loading && !activity) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiLoader className="w-8 h-8 animate-spin text-orange-500" />
        <span className="ml-3 text-coach-text-muted">Cargando actividad...</span>
      </div>
    );
  }

  if (notFound || !activity) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <h2 className="text-lg font-semibold text-coach-text-primary mb-2">
          Actividad no encontrada
        </h2>
        <p className="text-sm text-coach-text-muted mb-6">
          No se pudo cargar esta actividad. Puede que no exista o que el atleta
          aún no la haya sincronizado.
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
      athleteId={athleteId}
      theme="coach"
      canBackfillStreams={false}
      onBack={handleBack}
    />
  );
}
