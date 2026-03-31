import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
  FiCheckSquare,
  FiStar,
  FiAward,
  FiWatch,
  FiCheckCircle,
} from 'react-icons/fi';
import useGamificationData from '../../hooks/useGamificationData';
import { toLocalDateStr } from '../../lib/dateUtils';
import WellnessForm from '../../components/athlete/WellnessForm';
import ReadinessScore from '../../components/athlete/ReadinessScore';
import WeeklyDiaryForm from '../../components/athlete/WeeklyDiaryForm';
import useAthleteProfile from '../../hooks/useAthleteProfile';
import OnboardingWizard from '../../components/athlete/OnboardingWizard';
import CompetitionCountdown from '../../components/athlete/CompetitionCountdown';
import useAthleteDashboardData from '../../hooks/useAthleteDashboardData';

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

const StatCard = ({ icon: Icon, label, value, sub, accent, iconBg, iconColor }) => (
  <div className={`rounded-2xl p-4 flex flex-col gap-2 border ${
    accent
      ? 'bg-ath-accent border-ath-border-accent text-ath-on-accent'
      : 'bg-ath-surface border-ath-border'
  }`}>
    <div className="flex items-center justify-between">
      <span className={`text-xs font-medium ${accent ? 'text-ath-on-accent/80' : 'text-ath-text-muted'}`}>
        {label}
      </span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        accent ? 'bg-white/20' : (iconBg || 'bg-ath-accent-surface')
      }`}>
        <Icon className={`w-4 h-4 ${accent ? 'text-ath-on-accent' : (iconColor || 'text-ath-accent-text')}`} />
      </div>
    </div>
    <div className={`text-3xl font-bold tracking-tight font-mono ${accent ? 'text-ath-on-accent' : 'text-ath-text-primary'}`}>
      {value}
    </div>
    {sub && (
      <div className={`text-[11px] ${accent ? 'text-ath-on-accent/70' : 'text-ath-text-muted'}`}>{sub}</div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Dashboard principal
// ---------------------------------------------------------------------------

const AthleteDashboard = () => {
  const { user, profile, isIndependent } = useAuth();
  const [wellnessRefreshKey, setWellnessRefreshKey] = useState(0);
  const isSunday = new Date().getDay() === 0;

  const {
    loading,
    weekStats,
    streak,
    upcomingSessions,
    upcomingCompetitions,
    hasDiaryThisWeek,
    setHasDiaryThisWeek,
    nextCompetition: independentNextCompetition,
    weeklyRpeAvg,
    hasActivePlan,
  } = useAthleteDashboardData(profile?.id, isIndependent);

  // Gamification data (independent athletes only — skip for coached athletes to avoid extra queries)
  const { achievements, dailyStreak: gamificationDailyStreak, weeklyStreak } = useGamificationData(
    isIndependent ? user?.id : null
  );

  // For coached athletes, resolve competition from upcomingCompetitions
  // For independent athletes, the hook already fetches nextCompetition with daysUntil
  const nextCompetition = isIndependent
    ? independentNextCompetition
    : (() => {
        if (!upcomingCompetitions?.[0]) return null;
        const c = upcomingCompetitions[0];
        const eventDate = new Date(c.event_date + 'T00:00:00');
        const daysUntil = Math.max(0, Math.ceil((eventDate - new Date().setHours(0, 0, 0, 0)) / 86400000));
        return { ...c, daysUntil };
      })();

  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Atleta';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiLoader className="w-8 h-8 animate-spin text-ath-accent" />
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
    <div className="bg-ath-base">

      <div className="px-4 lg:px-8 py-5 lg:py-8 space-y-5">

        {/* GREETING */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ath-text-primary tracking-tight">
            ¡Hola, {displayName}! <span role="img" aria-label="saludo">👋</span>
          </h1>
          <p className="text-sm text-ath-text-muted mt-1">
            Aquí está tu resumen de entrenamiento
          </p>
        </div>

        {/* STATS 2×2 mobile / 4 cols desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard
            accent
            icon={FiActivity}
            label="Planificado"
            value={`${weekStats.totalKm} km`}
            sub={`${weekStats.sessions} entrenamientos`}
          />
          <StatCard
            icon={FiCheckCircle}
            label="Completado"
            value={weekStats.completedKm > 0 ? `${weekStats.completedKm} km` : '0 km'}
            sub={weekStats.completedTime !== '0h 0m' ? weekStats.completedTime : 'Sin actividad aún'}
            iconBg="bg-ath-accent-surface"
            iconColor="text-ath-accent-text"
          />
          <StatCard
            icon={FiTrendingUp}
            label="Racha"
            value={streak > 0 ? `${streak}d` : '—'}
            sub={streak >= 3 ? '¡Sigue así!' : streak > 0 ? 'días seguidos' : 'Sin racha aún'}
            iconBg="bg-ath-accent-surface"
            iconColor="text-ath-accent-text"
          />
          <StatCard
            icon={FiCalendar}
            label="Sesiones"
            value={weekStats.sessions}
            sub={pendingSessions > 0 ? `${pendingSessions} pendiente${pendingSessions > 1 ? 's' : ''}` : 'Planificadas'}
            iconBg="bg-ath-accent-surface"
            iconColor="text-ath-accent-text"
          />
        </div>

        {/* INDEPENDENT ATHLETE: weekly progress + RPE summary + plan CTA */}
        {isIndependent && (
          <div className="grid grid-cols-1 gap-3">
            {/* Weekly progress bar */}
            <div className="bg-ath-surface rounded-2xl border border-ath-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ath-text-muted flex items-center gap-1.5">
                  <FiCheckSquare className="w-3.5 h-3.5 text-ath-accent" />
                  Progreso semanal
                </span>
                <span className="text-xs font-bold text-ath-text-secondary">
                  {weekStats.completed}/{weekStats.sessions} sesiones
                </span>
              </div>
              <div className="w-full h-2 bg-ath-inset rounded-full overflow-hidden">
                <div
                  className="h-2 bg-ath-accent rounded-full transition-all duration-500"
                  style={{ width: weekStats.sessions > 0 ? `${Math.round((weekStats.completed / weekStats.sessions) * 100)}%` : '0%' }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-ath-text-muted">
                  {weekStats.completedKm > 0 ? `${weekStats.completedKm}` : '0'} / {weekStats.totalKm} km
                </span>
                {weeklyRpeAvg != null && (
                  <span className="text-[11px] text-ath-text-muted flex items-center gap-1">
                    <FiStar className="w-3 h-3 text-orange-400" />
                    RPE medio: {weeklyRpeAvg}
                  </span>
                )}
              </div>
            </div>

            {/* Generate plan CTA — only if no active plan */}
            {!hasActivePlan && (
              <Link
                to="/athlete/my-plan"
                className="flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-4 text-white hover:from-green-700 hover:to-emerald-600 transition-all"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FiZap className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">Generar mi plan de entrenamiento</p>
                  <p className="text-xs text-white/70 mt-0.5">IA personalizada según tu perfil</p>
                </div>
                <FiArrowRight className="w-4 h-4 ml-auto flex-shrink-0 text-white/80" />
              </Link>
            )}
          </div>
        )}

        {/* Wellness + Diary — both athlete types */}
        {isSunday && !hasDiaryThisWeek && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
            <span className="text-lg" role="img" aria-label="calendario">📅</span>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Es domingo — rellena tu diario semanal</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{isIndependent ? 'Hermes IA lo tendrá en cuenta para mejorar tus planes.' : 'Tu entrenador lo tendrá en cuenta en el informe del lunes.'}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <WellnessForm compact onSaved={() => setWellnessRefreshKey(k => k + 1)} />
          <ReadinessScore onRefresh={wellnessRefreshKey} />
        </div>

        <WeeklyDiaryForm
          compact
          onSaved={() => setHasDiaryThisWeek(true)}
        />

        {/* IA CARD — for coached athletes only */}
        {!isIndependent && (
          <Link to="/athlete/my-reports" className="relative bg-slate-900 rounded-2xl p-4 overflow-hidden flex gap-3 hover:bg-slate-800 transition-colors">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 bg-[radial-gradient(circle,_#16a34a,_transparent)]" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0 z-10">
              <FiZap className="w-4 h-4 text-white" />
            </div>
            <div className="z-10 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-green-400 font-semibold">Hermes · IA</p>
              <p className="text-sm text-white font-semibold mt-0.5 leading-snug">
                Análisis de tu carga semanal disponible
              </p>
              <p className="text-xs text-slate-400 mt-1">Ver mis informes →</p>
            </div>
          </Link>
        )}

        {/* INDEPENDENT ATHLETE: AI assistant card */}
        {isIndependent && (
          <Link to="/athlete/ai-assistant" className="relative bg-slate-900 rounded-2xl p-4 overflow-hidden flex gap-3 hover:bg-slate-800 transition-colors">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 bg-[radial-gradient(circle,_#16a34a,_transparent)]" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0 z-10">
              <FiZap className="w-4 h-4 text-white" />
            </div>
            <div className="z-10 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-green-400 font-semibold">Asistente IA</p>
              <p className="text-sm text-white font-semibold mt-0.5 leading-snug">
                Pregunta a tu entrenador virtual
              </p>
              <p className="text-xs text-slate-400 mt-1">Consejo personalizado →</p>
            </div>
          </Link>
        )}

        {/* ENTRENAMIENTOS DE LA SEMANA */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-base font-bold text-ath-text-primary">
              <FiActivity className="w-4 h-4" />
              Entrenamientos de la semana
            </div>
            <Link to={isIndependent ? '/athlete/my-plan' : '/athlete/training'} className="text-xs font-medium text-ath-accent-text flex items-center gap-1">
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
                    to={isIndependent ? '/athlete/my-plan' : '/athlete/training'}
                    className="flex items-center gap-3 bg-ath-surface rounded-xl p-3 border border-ath-border"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                      <FiActivity className={`w-4 h-4 ${s.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ath-text-primary truncate">{session.title}</p>
                      <p className="text-xs text-ath-text-muted truncate">
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
            <div className="text-center py-10 bg-ath-surface rounded-2xl border border-ath-border">
              <FiCalendar className="w-10 h-10 text-ath-text-muted mx-auto mb-2" />
              <p className="text-sm text-ath-text-muted">No hay entrenamientos esta semana</p>
            </div>
          )}
        </section>

        {/* DOS COLUMNAS: Competiciones + Acceso Rápido */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* PRÓXIMAS COMPETICIONES */}
          <section className="flex flex-col">
            {isIndependent ? (
              <CompetitionCountdown competition={nextCompetition} />
            ) : upcomingCompetitions.length > 0 ? (() => {
              const competition = upcomingCompetitions[0];
              const eventDate = new Date(competition.event_date + 'T00:00:00');
              const daysUntil = Math.ceil((eventDate - new Date().setHours(0,0,0,0)) / 86400000);
              const progressPct = Math.min(100, Math.max(5, (90 - daysUntil) / 90 * 100));
              return (
                <div className="relative rounded-2xl overflow-hidden flex-1 bg-gradient-to-br from-ath-accent to-ath-accent-hover">
                  {/* Decorative circles */}
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 bg-white" />
                  <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10 bg-white" />

                  <div className="relative p-5">
                    {/* Header label */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/70"><span role="img" aria-label="trofeo">🏆</span> Próxima Competición</span>
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
              <div className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-center py-10 text-center bg-gradient-to-br from-ath-accent to-ath-accent-hover">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 bg-white" />
                <FiFlag className="w-10 h-10 text-white/40 mb-2" />
                <p className="text-sm text-white/70 font-medium">No hay competiciones programadas</p>
              </div>
            )}
          </section>

          {/* ACCESO RÁPIDO */}
          <section className="bg-ath-surface rounded-2xl p-4 border border-ath-border flex flex-col">
            <div className="flex items-center gap-2 text-base font-bold text-ath-text-primary mb-3">
              <FiBarChart2 className="w-4 h-4 text-ath-accent-text" />
              Acceso Rápido
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Link to="/athlete/metrics" className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-800/30 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:shadow-md transition-all group">
                <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <FiBarChart2 className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-semibold text-ath-text-primary">Mis Métricas</p>
                <p className="text-[11px] text-ath-text-muted mt-0.5">Ritmos, progreso</p>
              </Link>
              {isIndependent ? (
                <Link to="/athlete/my-plan" className="p-3.5 rounded-xl border border-green-100 dark:border-green-800/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:shadow-md transition-all group">
                  <div className="w-9 h-9 bg-green-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <FiZap className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-ath-text-primary">Mi Plan</p>
                  <p className="text-[11px] text-ath-text-muted mt-0.5">Plan generado por IA</p>
                </Link>
              ) : (
                <Link to="/athlete/devices" className="p-3.5 rounded-xl border border-green-100 dark:border-green-800/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:shadow-md transition-all group">
                  <div className="w-9 h-9 bg-green-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <FiSmartphone className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-ath-text-primary">Dispositivos</p>
                  <p className="text-[11px] text-ath-text-muted mt-0.5">Conecta tus dispositivos</p>
                </Link>
              )}
              {isIndependent ? (
                <Link to="/athlete/competitions" className="p-3.5 rounded-xl border border-yellow-100 dark:border-yellow-800/30 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 hover:shadow-md transition-all group">
                  <div className="w-9 h-9 bg-yellow-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <FiFlag className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-ath-text-primary">Competiciones</p>
                  <p className="text-[11px] text-ath-text-muted mt-0.5">Gestiona tus carreras</p>
                </Link>
              ) : (
                <Link to="/athlete/messages" className="p-3.5 rounded-xl border border-yellow-100 dark:border-yellow-800/30 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 hover:shadow-md transition-all group">
                  <div className="w-9 h-9 bg-yellow-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <FiMessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-ath-text-primary">Mensajes</p>
                  <p className="text-[11px] text-ath-text-muted mt-0.5">Chat con tu entrenador</p>
                </Link>
              )}
              {isIndependent ? (
                <Link to="/athlete/devices" className="p-3.5 rounded-xl border border-orange-100 dark:border-orange-800/30 bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 hover:shadow-md transition-all group">
                  <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <FiWatch className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-ath-text-primary">Dispositivos</p>
                  <p className="text-[11px] text-ath-text-muted mt-0.5">Conecta tu reloj</p>
                </Link>
              ) : (
                <Link to="/athlete/calendar" className="p-3.5 rounded-xl border border-orange-100 dark:border-orange-800/30 bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 hover:shadow-md transition-all group">
                  <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <FiCalendar className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-ath-text-primary">Calendario</p>
                  <p className="text-[11px] text-ath-text-muted mt-0.5">Vista mensual completa</p>
                </Link>
              )}
            </div>
          </section>

        </div>

        {/* ACHIEVEMENTS — hidden until redesign with Strava-style records */}
        {false && isIndependent && achievements.length > 0 && (
          <section className="bg-ath-surface rounded-2xl p-4 border border-ath-border">
            <div className="flex items-center gap-2 text-base font-bold text-ath-text-primary mb-3">
              <FiAward className="w-4 h-4 text-yellow-500" />
              Mis Logros
              <span className="ml-auto text-xs font-medium text-ath-text-muted">
                {achievements.length} desbloqueado{achievements.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {achievements.slice(0, 6).map(a => (
                <div
                  key={a.id}
                  title={a.description}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/30"
                >
                  <span className="text-2xl" role="img" aria-label={a.title}>{a.icon}</span>
                  <p className="text-[10px] font-semibold text-center text-ath-text-secondary leading-tight line-clamp-2">
                    {a.title}
                  </p>
                </div>
              ))}
            </div>
            {/* Weekly streak badge */}
            {weeklyStreak >= 2 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 font-medium">
                <span role="img" aria-label="racha semanal">🔥</span>
                <span>{weeklyStreak} semanas activas seguidas</span>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Wrapper with onboarding gate
// ---------------------------------------------------------------------------

const AthleteDashboardWithGate = () => {
  const { user } = useAuth();
  const { profile: athleteProfile, loading: profileLoading, refresh: refreshProfile } = useAthleteProfile(user?.id);

  // Show loading spinner while checking for athlete profile
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <FiLoader className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  // No profile yet — show onboarding wizard
  if (!athleteProfile) {
    return <OnboardingWizard onComplete={refreshProfile} />;
  }

  // Profile exists — show normal dashboard
  return <AthleteDashboard />;
};

export default AthleteDashboardWithGate;
