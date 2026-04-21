import { useEffect, useMemo, useState } from 'react';
import {
  FiChevronLeft,
  FiLoader,
  FiMapPin,
  FiActivity,
  FiTrendingUp,
  FiFlag,
  FiExternalLink,
  FiBarChart2,
} from 'react-icons/fi';
import { SiStrava } from 'react-icons/si';
import {
  formatDuration,
  calculatePace,
  getActivityTypeLabel,
} from '../../services/stravaService';
import useMapbox from '../../hooks/useMapbox';
import useActivityStreams from '../../hooks/useActivityStreams';
import { getAthleteHrZones } from '../../services/athleteService';
import ActivityStreamChart from './ActivityStreamChart';
import { CHART_COLORS } from '../../lib/chartColors';

// --------------------------------------------------------------------------
// Theme tables — same as the former StravaActivityModal so the same JSX
// renders cleanly in both coach (/dashboard/*) and athlete (/athlete/*)
// layouts.
// --------------------------------------------------------------------------

const THEMES = {
  athlete: {
    surface: 'bg-ath-surface',
    inset: 'bg-ath-inset',
    border: 'border-ath-border',
    textPrimary: 'text-ath-text-primary',
    textSecondary: 'text-ath-text-secondary',
    textMuted: 'text-ath-text-muted',
    hover: 'hover:bg-ath-inset',
    divide: 'divide-ath-border',
    headerBg: 'bg-ath-base/80 supports-[backdrop-filter]:bg-ath-base/70 backdrop-blur-md',
    sportPill: 'bg-ath-inset text-ath-text-secondary',
  },
  coach: {
    surface: 'bg-coach-surface',
    inset: 'bg-coach-inset',
    border: 'border-coach-border',
    textPrimary: 'text-coach-text-primary',
    textSecondary: 'text-coach-text-secondary',
    textMuted: 'text-coach-text-muted',
    hover: 'hover:bg-coach-inset',
    divide: 'divide-coach-border',
    headerBg: 'bg-coach-base/80 supports-[backdrop-filter]:bg-coach-base/70 backdrop-blur-md',
    sportPill: 'bg-coach-inset text-coach-text-secondary',
  },
};

// Convert m/s (Strava velocity_smooth) to pace seconds per km.
// Returns null when velocity is too low (walking / standing still).
const velocityToPaceSec = (mps) => {
  const v = Number(mps);
  if (!Number.isFinite(v) || v <= 0.3) return null;
  return 1000 / v;
};

const formatPaceFromSec = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const isRunning = (type) => type === 'Run' || type === 'TrailRun' || type === 'VirtualRun';

/**
 * Full-page activity detail view. Replaces the old modal
 * (StravaActivityModal) — same content, no overlay / backdrop.
 *
 * Props:
 * - activity: Strava activity object (formatted). If null/undefined the
 *   component renders nothing (parent should show its own loader).
 * - athleteId: owner athlete id — needed to backfill streams & fetch HR zones.
 * - theme: 'athlete' | 'coach' (default 'athlete').
 * - canBackfillStreams: whether the current user can trigger the
 *   strava-fetch-streams edge function (athletes: true, coach: false).
 * - onBack: () => void — invoked by the "← Volver" header button.
 */
export default function StravaActivityDetail({
  activity,
  athleteId = null,
  theme = 'athlete',
  canBackfillStreams = true,
  onBack,
}) {
  const t = THEMES[theme] || THEMES.athlete;

  // Scroll reset when landing on this view.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { mapContainerRef } = useMapbox(
    activity?.polyline || null,
    activity?.loading
  );

  // NOTE: `activity.id` coming from cached rows is the Strava bigint id.
  // The `strava_activity_streams.activity_id` column is a UUID FK to
  // `strava_activities.id`. We must pass the internal UUID here, not the
  // Strava id, or PostgREST errors with "invalid input syntax for type uuid".
  const { streams, loading: streamsLoading, error: streamsError } = useActivityStreams(
    activity && !activity.loading ? activity.internal_id : null,
    { athleteId, canBackfill: canBackfillStreams }
  );

  const [hrZones, setHrZones] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!athleteId) {
      setHrZones(null);
      return undefined;
    }
    (async () => {
      const { data } = await getAthleteHrZones(athleteId);
      if (!cancelled) setHrZones(data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  // Derived — pace stream in sec/km and cadence adjusted for running.
  const paceSeries = useMemo(() => {
    if (!streams?.velocity_smooth) return null;
    return streams.velocity_smooth.map(velocityToPaceSec);
  }, [streams]);

  const cadenceSeries = useMemo(() => {
    if (!streams?.cadence) return null;
    if (isRunning(activity?.type)) {
      return streams.cadence.map((c) => (Number.isFinite(Number(c)) ? Number(c) * 2 : null));
    }
    return streams.cadence;
  }, [streams, activity?.type]);

  const distanceKmSeries = useMemo(() => {
    if (!streams?.distance) return null;
    return streams.distance.map((d) => {
      const n = Number(d);
      return Number.isFinite(n) ? n / 1000 : null;
    });
  }, [streams]);

  const hasTemp = useMemo(
    () => Array.isArray(streams?.temp) && streams.temp.some((v) => v !== null && Number.isFinite(Number(v))),
    [streams]
  );

  if (!activity) return null;

  return (
    <div className="w-full">
      {/* Sticky header — glass, back button + title/meta grouped left */}
      <div className={`sticky top-0 z-20 border-b ${t.border} ${t.headerBg}`}>
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={onBack}
              className={`self-start inline-flex items-center gap-1 -ml-2 px-2.5 py-2 rounded-lg ${t.hover} ${t.textSecondary} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ath-accent`}
              aria-label="Volver"
            >
              <FiChevronLeft className="w-5 h-5" aria-hidden="true" />
              <span className="text-sm font-medium">Volver</span>
            </button>
            <div className="min-w-0 flex-1">
              <h1
                className={`text-base sm:text-lg font-semibold leading-tight truncate ${t.textPrimary}`}
                title={activity.name}
              >
                {activity.name}
              </h1>
              <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${t.textMuted}`}>
                <span>
                  {new Date(activity.date).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
                <span aria-hidden="true">·</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${t.sportPill}`}>
                  {getActivityTypeLabel(activity.type)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6">
        {activity.loading ? (
          <div className="flex items-center justify-center py-12">
            <FiLoader className="w-8 h-8 animate-spin text-orange-500" />
            <span className={`ml-3 ${t.textMuted}`}>Cargando detalles...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {activity.distanceKm}
                </p>
                <p className="text-xs text-blue-500">km</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {activity.formattedTime}
                </p>
                <p className="text-xs text-purple-500">tiempo</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {activity.pace}
                </p>
                <p className="text-xs text-green-500">ritmo medio</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {activity.average_heartrate || '-'}
                </p>
                <p className="text-xs text-red-500">bpm medio</p>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <div className={`${t.inset} rounded-lg p-3 text-center`}>
                <p className={`font-semibold ${t.textPrimary}`}>
                  {activity.total_elevation_gain || 0}m
                </p>
                <p className={`text-xs ${t.textMuted}`}>desnivel+</p>
              </div>
              <div className={`${t.inset} rounded-lg p-3 text-center`}>
                <p className={`font-semibold ${t.textPrimary}`}>
                  {activity.max_heartrate || '-'}
                </p>
                <p className={`text-xs ${t.textMuted}`}>FC max</p>
              </div>
              <div className={`${t.inset} rounded-lg p-3 text-center`}>
                <p className={`font-semibold ${t.textPrimary}`}>
                  {activity.calories || '-'}
                </p>
                <p className={`text-xs ${t.textMuted}`}>kcal</p>
              </div>
              <div className={`${t.inset} rounded-lg p-3 text-center`}>
                <p className={`font-semibold ${t.textPrimary}`}>
                  {activity.suffer_score || '-'}
                </p>
                <p className={`text-xs ${t.textMuted}`}>esfuerzo</p>
              </div>
              <div className={`${t.inset} rounded-lg p-3 text-center`}>
                <p className={`font-semibold ${t.textPrimary}`}>
                  {activity.kudos_count || 0}
                </p>
                <p className={`text-xs ${t.textMuted}`}>kudos</p>
              </div>
              <div className={`${t.inset} rounded-lg p-3 text-center`}>
                <p className={`font-semibold ${t.textPrimary}`}>
                  {activity.achievement_count || 0}
                </p>
                <p className={`text-xs ${t.textMuted}`}>logros</p>
              </div>
            </div>

            {/* Charts — streams section */}
            <div>
              <h3 className={`font-semibold ${t.textPrimary} mb-3 flex items-center`}>
                <FiBarChart2 className="w-4 h-4 mr-2 text-purple-500" />
                Gráficas
              </h3>

              {streamsLoading && (
                <div className={`rounded-xl ${t.inset} p-6 flex items-center justify-center gap-2 ${t.textMuted}`}>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Cargando gráficas…</span>
                </div>
              )}

              {!streamsLoading && streamsError && (
                <div className={`rounded-xl ${t.inset} p-4 text-center text-sm ${t.textMuted}`}>
                  {streamsError.code === 'unauthorized' && !canBackfillStreams ? (
                    <p>
                      Streams no sincronizados. Pídele al atleta que abra esta actividad
                      para sincronizarlos.
                    </p>
                  ) : (
                    <p>Esta actividad no tiene datos detallados.</p>
                  )}
                </div>
              )}

              {!streamsLoading && !streamsError && streams && (
                <div className="space-y-4">
                  {streams.heartrate && distanceKmSeries && (
                    <ActivityStreamChart
                      title="Frecuencia cardíaca"
                      xData={distanceKmSeries}
                      yData={streams.heartrate}
                      color={CHART_COLORS.fatigue}
                      fillColor={CHART_COLORS.fatigueFill}
                      yFormatter={(v) => `${Math.round(Number(v))} bpm`}
                      xLabel="Distancia (km)"
                      yLabel="bpm"
                      zones={hrZones}
                    />
                  )}

                  {paceSeries && distanceKmSeries && (
                    <ActivityStreamChart
                      title="Ritmo"
                      xData={distanceKmSeries}
                      yData={paceSeries}
                      color={CHART_COLORS.fitness}
                      fillColor={CHART_COLORS.fitnessFill}
                      yFormatter={(v) => `${formatPaceFromSec(Number(v))} /km`}
                      xLabel="Distancia (km)"
                      yLabel="min/km"
                    />
                  )}

                  {streams.altitude && distanceKmSeries && (
                    <ActivityStreamChart
                      title="Elevación"
                      xData={distanceKmSeries}
                      yData={streams.altitude}
                      color={CHART_COLORS.form}
                      fillColor={CHART_COLORS.formFill}
                      yFormatter={(v) => `${Math.round(Number(v))} m`}
                      xLabel="Distancia (km)"
                      yLabel="m"
                    />
                  )}

                  {cadenceSeries && distanceKmSeries && (
                    <ActivityStreamChart
                      title={isRunning(activity.type) ? 'Cadencia (spm)' : 'Cadencia (rpm)'}
                      xData={distanceKmSeries}
                      yData={cadenceSeries}
                      color={CHART_COLORS.gym}
                      fillColor={CHART_COLORS.gymFill}
                      yFormatter={(v) =>
                        `${Math.round(Number(v))} ${
                          isRunning(activity.type) ? 'spm' : 'rpm'
                        }`
                      }
                      xLabel="Distancia (km)"
                      yLabel={isRunning(activity.type) ? 'spm' : 'rpm'}
                    />
                  )}

                  {hasTemp && distanceKmSeries && (
                    <ActivityStreamChart
                      title="Temperatura"
                      xData={distanceKmSeries}
                      yData={streams.temp}
                      color={CHART_COLORS.cycling}
                      fillColor={CHART_COLORS.cyclingFill}
                      yFormatter={(v) => `${Math.round(Number(v))} °C`}
                      xLabel="Distancia (km)"
                      yLabel="°C"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Map */}
            {activity.polyline && (
              <div className={`${t.inset} rounded-xl p-4`}>
                <h3 className={`font-semibold ${t.textPrimary} mb-3 flex items-center`}>
                  <FiMapPin className="w-4 h-4 mr-2 text-orange-500" />
                  Recorrido
                </h3>
                <div
                  ref={mapContainerRef}
                  className="h-64 rounded-lg overflow-hidden"
                  style={{ minHeight: '256px' }}
                />
              </div>
            )}

            {/* Laps */}
            {activity.laps && activity.laps.length > 0 && (
              <div>
                <h3 className={`font-semibold ${t.textPrimary} mb-3 flex items-center`}>
                  <FiActivity className="w-4 h-4 mr-2 text-blue-500" />
                  Vueltas ({activity.laps.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={t.inset}>
                        <th className={`px-3 py-2 text-left ${t.textSecondary}`}>#</th>
                        <th className={`px-3 py-2 text-right ${t.textSecondary}`}>
                          Distancia
                        </th>
                        <th className={`px-3 py-2 text-right ${t.textSecondary}`}>
                          Tiempo
                        </th>
                        <th className={`px-3 py-2 text-right ${t.textSecondary}`}>
                          Ritmo
                        </th>
                        <th className={`px-3 py-2 text-right ${t.textSecondary}`}>
                          FC
                        </th>
                        <th className={`px-3 py-2 text-right ${t.textSecondary}`}>
                          Cadencia
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${t.divide}`}>
                      {activity.laps.map((lap, index) => (
                        <tr key={lap.id || index} className={t.hover}>
                          <td className={`px-3 py-2 font-medium ${t.textPrimary}`}>
                            {lap.name || `Vuelta ${index + 1}`}
                          </td>
                          <td className={`px-3 py-2 text-right ${t.textSecondary}`}>
                            {(lap.distance / 1000).toFixed(2)} km
                          </td>
                          <td className={`px-3 py-2 text-right ${t.textSecondary}`}>
                            {formatDuration(lap.moving_time)}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono ${t.textPrimary}`}>
                            {calculatePace(lap.moving_time, lap.distance)}
                          </td>
                          <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                            {lap.average_heartrate ? `${Math.round(lap.average_heartrate)}` : '-'}
                          </td>
                          <td className={`px-3 py-2 text-right ${t.textSecondary}`}>
                            {lap.average_cadence ? `${Math.round(lap.average_cadence * 2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Splits per KM */}
            {activity.splits_metric && activity.splits_metric.length > 0 && (
              <div>
                <h3 className={`font-semibold ${t.textPrimary} mb-3 flex items-center`}>
                  <FiTrendingUp className="w-4 h-4 mr-2 text-green-500" />
                  Parciales por Kilómetro
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {activity.splits_metric.map((split, index) => {
                    const pace = calculatePace(split.moving_time, split.distance);
                    const isGoodPace =
                      split.average_heartrate &&
                      split.average_heartrate < (activity.average_heartrate || 150);
                    return (
                      <div
                        key={index}
                        className={`p-2 rounded-lg text-center ${
                          isGoodPace
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : t.inset
                        }`}
                      >
                        <p className={`text-xs ${t.textMuted} mb-1`}>km {index + 1}</p>
                        <p className={`font-mono text-sm font-bold ${t.textPrimary}`}>
                          {pace}
                        </p>
                        {split.average_heartrate && (
                          <p className="text-xs text-red-500 mt-1">
                            {Math.round(split.average_heartrate)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Segments */}
            {activity.segment_efforts && activity.segment_efforts.length > 0 && (
              <div>
                <h3 className={`font-semibold ${t.textPrimary} mb-2 flex items-center gap-2 text-sm`}>
                  <FiFlag className="w-4 h-4 mr-2 text-yellow-500" />
                  Segmentos ({activity.segment_efforts.length})
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {activity.segment_efforts.slice(0, 10).map((effort) => {
                    const distKm = (
                      (effort.segment?.distance || effort.distance || 0) / 1000
                    ).toFixed(3);
                    return (
                      <div
                        key={effort.id}
                        className={`flex items-center gap-3 px-3 py-2.5 ${t.inset} rounded-xl ${t.hover} transition-colors`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <FiFlag className="w-3.5 h-3.5 text-[#FC4C02]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${t.textPrimary} truncate`}>
                            {effort.segment?.name || effort.name}
                          </p>
                          <p className={`text-xs ${t.textMuted}`}>{distKm} km</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono font-semibold text-[#FC4C02]">
                            {formatDuration(effort.moving_time || effort.elapsed_time)}
                          </p>
                          {effort.pr_rank === 1 && (
                            <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold">
                              PR
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {activity.segment_efforts.length > 10 && (
                    <p className={`text-center text-sm ${t.textMuted}`}>
                      +{activity.segment_efforts.length - 10} segmentos más
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {activity.description && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                  Descripción
                </h3>
                <p className={`${t.textSecondary} text-sm`}>{activity.description}</p>
              </div>
            )}

            {/* Device */}
            {activity.device_name && (
              <p className={`text-xs ${t.textMuted} text-center`}>
                Registrado con {activity.device_name}
              </p>
            )}

            {/* Strava link */}
            <a
              href={`https://www.strava.com/activities/${activity.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl transition-colors font-medium text-sm"
            >
              <SiStrava className="w-4 h-4 text-[#FC4C02]" />
              <span>Ver en Strava</span>
              <FiExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
