import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  FiActivity,
  FiTrendingUp,
  FiCalendar,
  FiArrowRight,
  FiClock,
  FiLoader,
  FiFlag,
  FiBarChart2,
  FiMapPin,
  FiSmartphone,
  FiMessageSquare,
  FiZap,
} from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { toLocalDateStr } from '../../lib/dateUtils';
import { getWeekStartDate } from '../../services/weeklyTrainingService';
import { parseKmFromDescription } from '../../hooks/useWeeklyTrainings';
import { getAthleteCompetitions } from '../../services/athleteService';
import { getCachedActivities } from '../../services/stravaCacheService';
import WellnessForm from '../../components/athlete/WellnessForm';
import ReadinessScore from '../../components/athlete/ReadinessScore';

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

const StatCard = ({ icon: Icon, label, value, sub, accent, iconBg, iconColor }) => (
  <div className={`rounded-2xl p-4 flex flex-col gap-2 border ${
    accent
      ? 'bg-green-600 border-green-600 text-white'
      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
  }`}>
    <div className="flex items-center justify-between">
      <span className={`text-xs font-medium ${accent ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
        {label}
      </span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        accent ? 'bg-white/20' : (iconBg || 'bg-green-50 dark:bg-green-900/30')
      }`}>
        <Icon className={`w-4 h-4 ${accent ? 'text-white' : (iconColor || 'text-green-600 dark:text-green-400')}`} />
      </div>
    </div>
    <div className={`text-3xl font-bold tracking-tight font-mono ${accent ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
      {value}
    </div>
    {sub && (
      <div className={`text-[11px] ${accent ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{sub}</div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Dashboard principal
// ---------------------------------------------------------------------------

const AthleteDashboard = () => {
  const { user, profile } = useAuth();
  const [wellnessRefreshKey, setWellnessRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weekStats, setWeekStats] = useState({
    totalKm: 0,
    totalTime: '0h 0m',
    sessions: 0,
    avgPace: '-',
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [upcomingCompetitions, setUpcomingCompetitions] = useState([]);

  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Atleta';

  const loadDashboardData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const weekStart = getWeekStartDate();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const { data: weekSessions, error: weekError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('athlete_id', profile.id)
        .gte('scheduled_date', toLocalDateStr(weekStart))
        .lte('scheduled_date', toLocalDateStr(weekEnd))
        .order('scheduled_date', { ascending: true });

      if (weekError) throw weekError;

      const { data: upcomingData, error: upcomingError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('athlete_id', profile.id)
        .gte('scheduled_date', toLocalDateStr(weekStart))
        .neq('training_type', 'rest')
        .order('scheduled_date', { ascending: true })
        .limit(10);

      if (upcomingError) throw upcomingError;

      let weekSessionsWithExercises = weekSessions || [];
      if (weekSessions?.length > 0) {
        const sessionIds = weekSessions.map(s => s.id);
        const { data: exercises } = await supabase
          .from('training_session_exercises')
          .select('*')
          .in('session_id', sessionIds);

        weekSessionsWithExercises = weekSessions.map(session => ({
          ...session,
          exercises: exercises?.filter(e => e.session_id === session.id) || [],
        }));
      }

      const stravaActivities = await getCachedActivities(profile.id, {
        after: weekStart,
        before: new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000),
      });

      let stravaDistanceMeters = 0;
      let stravaMovingTimeSeconds = 0;
      stravaActivities.forEach((a) => {
        stravaDistanceMeters += a.distance || 0;
        stravaMovingTimeSeconds += a.moving_time || 0;
      });

      let plannedDistanceMeters = 0;
      let plannedDurationMinutes = 0;
      weekSessionsWithExercises.forEach((session) => {
        if (session.training_type !== 'rest') {
          if (session.estimated_duration_minutes) {
            plannedDurationMinutes += session.estimated_duration_minutes;
          }
          let sessionDistance = 0;
          session.exercises?.forEach((ex) => {
            if (ex.planned_distance_meters) {
              const sets = ex.planned_sets || 1;
              const reps = ex.planned_reps || 1;
              sessionDistance += ex.planned_distance_meters * sets * reps;
            }
          });
          if (sessionDistance === 0 && session.description) {
            const parsedKm = parseKmFromDescription(session.description);
            if (parsedKm > 0) sessionDistance = parsedKm * 1000;
          }
          plannedDistanceMeters += sessionDistance;
        }
      });

      const hasStrava = stravaActivities.length > 0;
      const totalDistanceMeters = hasStrava ? stravaDistanceMeters : plannedDistanceMeters;
      const totalDurationMinutes = hasStrava
        ? Math.round(stravaMovingTimeSeconds / 60)
        : plannedDurationMinutes;

      const totalKm = (totalDistanceMeters / 1000).toFixed(1);
      const hours = Math.floor(totalDurationMinutes / 60);
      const minutes = totalDurationMinutes % 60;
      const totalTime = `${hours}h ${minutes}m`;

      let avgPace = '-';
      if (hasStrava && stravaDistanceMeters > 0 && stravaMovingTimeSeconds > 0) {
        const paceMinPerKm = (stravaMovingTimeSeconds / 60) / (stravaDistanceMeters / 1000);
        const paceMin = Math.floor(paceMinPerKm);
        const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
        avgPace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
      } else if (!hasStrava && totalDistanceMeters > 0 && totalDurationMinutes > 0) {
        const paceMinPerKm = totalDurationMinutes / (totalDistanceMeters / 1000);
        const paceMin = Math.floor(paceMinPerKm);
        const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
        avgPace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
      }

      setWeekStats({
        totalKm: parseFloat(totalKm),
        totalTime,
        sessions: weekSessionsWithExercises.filter(s => s.training_type !== 'rest').length,
        avgPace,
      });

      const upcoming = (upcomingData || []).map(session => ({
        id: session.id,
        title: session.title || 'Entrenamiento',
        date: session.scheduled_date,
        time: session.scheduled_time || '',
        type: session.training_type,
        status: session.status,
      }));
      setUpcomingSessions(upcoming.slice(0, 4));

      const { data: competitions } = await getAthleteCompetitions(profile.id);
      setUpcomingCompetitions((competitions || []).slice(0, 1));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiLoader className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const todayStr = toLocalDateStr(new Date());
  const pendingSessions = upcomingSessions.filter(s => s.status !== 'completed').length;

  const getSessionStyle = (type) => {
    if (type === 'running') return { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Carrera' };
    if (type === 'gym') return { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', label: 'Gimnasio' };
    return { bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'Cross' };
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900">

      <div className="px-4 lg:px-8 py-5 lg:py-8 space-y-5">

        {/* GREETING */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            ¡Hola, {displayName}! 👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Aquí está tu resumen de entrenamiento
          </p>
        </div>

        {/* WELLNESS + READINESS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WellnessForm compact onSaved={() => setWellnessRefreshKey(k => k + 1)} />
          <ReadinessScore onRefresh={wellnessRefreshKey} />
        </div>

        {/* STATS 2×2 mobile / 4 cols desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard
            accent
            icon={FiActivity}
            label="Esta semana"
            value={`${weekStats.totalKm} km`}
            sub={`${weekStats.sessions} entrenamientos`}
          />
          <StatCard
            icon={FiClock}
            label="Tiempo total"
            value={weekStats.totalTime}
            sub="Esta semana"
            iconBg="bg-purple-50 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <StatCard
            icon={FiTrendingUp}
            label="Ritmo promedio"
            value={weekStats.avgPace}
            sub="min/km"
            iconBg="bg-green-50 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            icon={FiCalendar}
            label="Sesiones"
            value={weekStats.sessions}
            sub={pendingSessions > 0 ? `${pendingSessions} pendiente${pendingSessions > 1 ? 's' : ''}` : 'Planificadas'}
            iconBg="bg-orange-50 dark:bg-orange-900/30"
            iconColor="text-orange-500 dark:text-orange-400"
          />
        </div>

        {/* IA CARD */}
        <div className="relative bg-slate-900 rounded-2xl p-4 overflow-hidden flex gap-3">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #16a34a, transparent)' }} />
          </div>
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0 z-10">
            <FiZap className="w-4 h-4 text-white" />
          </div>
          <div className="z-10 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-green-400 font-semibold">IA · Tu entrenador dice</p>
            <p className="text-sm text-white font-semibold mt-0.5 leading-snug">
              Análisis de tu carga semanal disponible
            </p>
            <p className="text-xs text-slate-400 mt-1">Ver plan completo →</p>
          </div>
        </div>

        {/* ENTRENAMIENTOS DE LA SEMANA */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <FiActivity className="w-4 h-4" />
              Entrenamientos de la semana
            </div>
            <Link to="/athlete/training" className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
              Ver todos <FiArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {upcomingSessions.length > 0 ? (
            <div className="space-y-2">
              {upcomingSessions.map((session) => {
                const s = getSessionStyle(session.type);
                const isToday = session.date === todayStr;
                return (
                  <Link
                    key={session.id}
                    to="/athlete/training"
                    className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                      <FiActivity className={`w-4 h-4 ${s.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{session.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {isToday ? 'Hoy' : new Date(session.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {isToday && ` · ${new Date(session.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`}
                      </p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      session.status === 'completed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : s.badge
                    }`}>
                      {session.status === 'completed' ? '✓ Hecho' : (isToday ? 'Pendiente' : s.label)}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <FiCalendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay entrenamientos esta semana</p>
            </div>
          )}
        </section>

        {/* DOS COLUMNAS: Competiciones + Acceso Rápido */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* PRÓXIMAS COMPETICIONES */}
          <section className="flex flex-col">
            {upcomingCompetitions.length > 0 ? (() => {
              const competition = upcomingCompetitions[0];
              const eventDate = new Date(competition.event_date + 'T00:00:00');
              const daysUntil = Math.ceil((eventDate - new Date().setHours(0,0,0,0)) / 86400000);
              const progressPct = Math.min(100, Math.max(5, (90 - daysUntil) / 90 * 100));
              return (
                <div className="relative rounded-2xl overflow-hidden flex-1" style={{ background: 'linear-gradient(135deg, #1A6BFF 0%, #0f4fcf 100%)' }}>
                  {/* Decorative circles */}
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 bg-white" />
                  <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10 bg-white" />

                  <div className="relative p-5">
                    {/* Header label */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">🏆 Próxima Competición</span>
                      {competition.priority && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                          Prioridad {competition.priority}
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <h3 className="text-xl font-bold text-white leading-tight mb-3">
                      {competition.name}
                    </h3>

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-sm text-white/75 mb-5">
                      {competition.location && (
                        <span className="flex items-center gap-1">
                          <FiMapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{competition.location}</span>
                        </span>
                      )}
                      {competition.distance_km && (
                        <span className="flex-shrink-0">{competition.distance_km} km</span>
                      )}
                    </div>

                    {/* Days counter + progress */}
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <span className="text-5xl font-bold text-white leading-none">{daysUntil}</span>
                        <span className="text-sm text-white/70 ml-1.5">días</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/60 mb-1">
                          {eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-white/60 mb-1.5">
                        <span>Plan completado</span>
                        <span>{Math.round(progressPct)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-700"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-center py-10 text-center" style={{ background: 'linear-gradient(135deg, #1A6BFF 0%, #0f4fcf 100%)' }}>
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 bg-white" />
                <FiFlag className="w-10 h-10 text-white/40 mb-2" />
                <p className="text-sm text-white/70 font-medium">No hay competiciones programadas</p>
              </div>
            )}
          </section>

          {/* ACCESO RÁPIDO */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white mb-3">
              <FiBarChart2 className="w-4 h-4 text-green-600" />
              Acceso Rápido
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Link to="/athlete/metrics" className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-800/30 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:shadow-md transition-all group">
                <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <FiBarChart2 className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Mis Métricas</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">VO2max, ritmos, progreso</p>
              </Link>
              <Link to="/athlete/devices" className="p-3.5 rounded-xl border border-green-100 dark:border-green-800/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:shadow-md transition-all group">
                <div className="w-9 h-9 bg-green-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <FiSmartphone className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Dispositivos</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Conecta tus dispositivos</p>
              </Link>
              <Link to="/athlete/messages" className="p-3.5 rounded-xl border border-yellow-100 dark:border-yellow-800/30 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 hover:shadow-md transition-all group">
                <div className="w-9 h-9 bg-yellow-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <FiMessageSquare className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Mensajes</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Chat con tu entrenador</p>
              </Link>
              <Link to="/athlete/calendar" className="p-3.5 rounded-xl border border-orange-100 dark:border-orange-800/30 bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 hover:shadow-md transition-all group">
                <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <FiCalendar className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Calendario</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Vista mensual completa</p>
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default AthleteDashboard;
