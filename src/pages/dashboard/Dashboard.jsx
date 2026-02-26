import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers,
  FiActivity,
  FiCheck,
  FiCheckCircle,
  FiX,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiFlag,
  FiMapPin,
  FiPlus,
  FiClock,
  FiZap,
  FiStar,
} from 'react-icons/fi';
import CreateCompetitionModal from '../../components/dashboard/CreateCompetitionModal';
import { toLocalDateStr } from '../../lib/dateUtils';
import useCoachDashboard from '../../hooks/useCoachDashboard';
import { getWeekStartDate } from '../../services/weeklyTrainingService';
import { addAthletesToCompetition } from '../../services/athleteService';
import { getCoachAthletesList } from '../../services/planningService';
import { showSuccess, showError } from '../../lib/toast';

// ---------------------------------------------------------------------------
// Sub-componentes inline
// ---------------------------------------------------------------------------

const StatCardNew = ({ accent, icon: Icon, label, value, sub, trend, trendUp, linkTo }) => {
  const card = (
    <div
      className={`rounded-2xl p-4 flex flex-col gap-2 border h-full ${
        accent
          ? 'bg-[#1A6BFF] border-[#1A6BFF] text-white'
          : 'bg-white dark:bg-gray-800 border-[#E2E8F0] dark:border-gray-700'
      } ${linkTo ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${accent ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            accent ? 'bg-white/20' : 'bg-[#E8F0FF] dark:bg-blue-900/30'
          }`}
        >
          <Icon className={`w-4 h-4 ${accent ? 'text-white' : 'text-[#1A6BFF]'}`} />
        </div>
      </div>
      <div className={`text-3xl font-bold tracking-tight font-mono ${accent ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
        {value}
      </div>
      {sub && (
        <div className={`text-[11px] ${accent ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{sub}</div>
      )}
      {trend && (
        <span
          className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${
            trendUp ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
          }`}
        >
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      )}
    </div>
  );
  return linkTo ? <Link to={linkTo} className="block h-full">{card}</Link> : card;
};

const SectionHeader = ({ icon: Icon, title, linkTo, linkLabel, actionLabel, onAction }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white tracking-tight">
      {Icon && <Icon className="w-4 h-4" />}
      {title}
    </div>
    {linkTo && (
      <Link to={linkTo} className="text-[13px] font-semibold text-[#1A6BFF]">
        {linkLabel || 'Ver todo →'}
      </Link>
    )}
    {onAction && (
      <button onClick={onAction} className="text-[13px] font-semibold text-[#1A6BFF]">
        {actionLabel}
      </button>
    )}
  </div>
);

const AVATAR_GRADIENTS = [
  ['#1A6BFF', '#5B9BFF'],
  ['#F97316', '#FDBA74'],
  ['#8B5CF6', '#C4B5FD'],
  ['#0EA5E9', '#7DD3FC'],
  ['#22C55E', '#86EFAC'],
];

const getGradient = (str = '') => {
  const idx = (str.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
};

const AvatarCircle = ({ name = '', image, size = 'md' }) => {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  const [from, to] = getGradient(name);
  const sz = size === 'sm' ? 'w-[22px] h-[22px] text-[8px]' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  if (image) return <img src={image} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials}
    </div>
  );
};

const AthleteChip = ({ athlete }) => {
  const status = athlete.status;
  const ringStyle =
    status === 'completed'
      ? { boxShadow: '0 0 0 2.5px #22C55E' }
      : status === 'rest'
      ? { boxShadow: '0 0 0 1.5px #E2E8F0', opacity: 0.6 }
      : { boxShadow: '0 0 0 2.5px #1A6BFF' };
  const dotColor = status === 'completed' ? '#22C55E' : status === 'rest' ? '#94A3B8' : '#1A6BFF';

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer">
      <div className="relative" style={ringStyle}>
        <AvatarCircle name={athlete.name} image={athlete.image} size="lg" />
        <span
          className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900"
          style={{ background: dotColor }}
        />
      </div>
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 max-w-[48px] truncate text-center">
        {athlete.name?.split(' ')[0]}
      </span>
    </div>
  );
};

const EventCard = ({ comp, onClick }) => {
  const days = Math.ceil(
    (new Date(comp.event_date + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
  const daysLabel = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `${days}d`;
  const daysStyle =
    days < 7
      ? { background: '#FFE4E1', color: '#DC2626' }
      : days < 30
      ? { background: '#FEF3C7', color: '#D97706' }
      : { background: '#DCFCE7', color: '#16A34A' };
  const progressPct = Math.min(100, Math.max(5, ((90 - days) / 90) * 100));
  const progressColor = days < 7 ? '#DC2626' : days < 30 ? '#D97706' : '#1A6BFF';

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-[#E2E8F0] dark:border-gray-700 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-white flex-1 leading-snug">
          {comp.name}
        </span>
        <span className="text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0" style={daysStyle}>
          {daysLabel}
        </span>
      </div>
      {(comp.location || comp.distance_km) && (
        <div className="flex gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
          {comp.location && <span>📍 {comp.location}</span>}
          {comp.distance_km && <span>{comp.distance_km} km</span>}
        </div>
      )}
      {comp.athletes?.length > 0 && (
        <div className="flex items-center mt-2.5">
          <div className="flex -space-x-1">
            {comp.athletes.slice(0, 5).map((a) => (
              <div key={a.id} className="border-2 border-white dark:border-gray-800 rounded-full">
                <AvatarCircle name={a.name} image={a.image} size="sm" />
              </div>
            ))}
          </div>
          <span className="ml-2 text-[11px] text-slate-500">
            {comp.athletes.length === 1 ? '1 atleta' : `${comp.athletes.length} atletas`}
          </span>
        </div>
      )}
      <div className="mt-2.5">
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>Preparación del plan</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-1 bg-[#EEF1F7] dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: progressColor }} />
        </div>
      </div>
    </div>
  );
};

const AthleteRow = ({ athlete, lastSession }) => (
  <Link
    to={`/dashboard/athletes/${athlete.id}`}
    className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-3 border border-[#E2E8F0] dark:border-gray-700"
  >
    <AvatarCircle name={`${athlete.firstName} ${athlete.lastName}`} image={athlete.profileImage} size="lg" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
        {athlete.firstName} {athlete.lastName}
      </p>
      <p className={`text-xs mt-0.5 truncate ${lastSession?.isWarn ? 'text-[#FF6B35]' : lastSession?.isOk ? 'text-green-500' : 'text-slate-500 dark:text-slate-400'}`}>
        {lastSession?.text || athlete.specialties?.[0] || 'Sin actividad reciente'}
      </p>
    </div>
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: lastSession?.isWarn ? '#FF6B35' : lastSession?.isOk ? '#22C55E' : '#CBD5E1' }}
    />
  </Link>
);

// ---------------------------------------------------------------------------
// Helpers de tipo/estado
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  planned: 'bg-blue-50 dark:bg-blue-900/30 text-[#1A6BFF] dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  skipped: 'bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-slate-400',
};

const getStatusColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.planned;

const getStatusLabel = (status) => ({
  planned: 'Planificado',
  in_progress: 'En Progreso',
  completed: 'Completado',
  skipped: 'Omitido',
}[status] || status);

const getTrainingTypeLabel = (type) => ({
  running: 'Carrera',
  gym: 'Gimnasio',
  rest: 'Descanso',
  cross_training: 'Entreno Cruzado',
}[type] || type);

// Dot color + borde izquierdo + clases Tailwind para bg (light + dark)
const TYPE_STYLES = {
  running:       { dot: '#1A6BFF', border: '#1A6BFF', bgClass: 'bg-blue-50 dark:bg-blue-900/20',     pill: '#1A6BFF' },
  gym:           { dot: '#8B5CF6', border: '#8B5CF6', bgClass: 'bg-violet-50 dark:bg-violet-900/20', pill: '#8B5CF6' },
  rest:          { dot: '#22C55E', border: '#22C55E', bgClass: 'bg-green-50 dark:bg-green-900/20',   pill: '#22C55E' },
  cross_training:{ dot: '#F97316', border: '#F97316', bgClass: 'bg-orange-50 dark:bg-orange-900/20', pill: '#F97316' },
};
const getTypeStyle = (type) => TYPE_STYLES[type] || { dot: '#94A3B8', border: '#94A3B8', bgClass: 'bg-slate-50 dark:bg-slate-700/30', pill: '#94A3B8' };

// ---------------------------------------------------------------------------
// Dashboard principal
// ---------------------------------------------------------------------------

const Dashboard = () => {
  const { user, profile } = useAuth();
  const {
    stats, recentAthletes, loading, error,
    currentWeekStart, weekSessions, weekCompetitions, upcomingCompetitions, weekLoading,
    goToPreviousWeek, goToNextWeek, goToCurrentWeek, refreshCompetitions,
  } = useCoachDashboard(profile?.id);

  const [selectedSession, setSelectedSession] = useState(null);
  const [showCreateCompetition, setShowCreateCompetition] = useState(false);
  const [showAddAthletes, setShowAddAthletes] = useState(false);
  const [allAthletes, setAllAthletes] = useState([]);
  const [addingAthleteIds, setAddingAthleteIds] = useState([]);
  const [savingAdd, setSavingAdd] = useState(false);
  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'entrenador';

  // Próximas competiciones agrupadas
  const groupedUpcoming = (() => {
    const groups = {};
    upcomingCompetitions.forEach(c => {
      const key = `${c.name}||${c.event_date}||${c.distance_km || ''}||${c.location || ''}`;
      if (!groups[key]) groups[key] = { ...c, athletes: [] };
      groups[key].athletes.push({ id: c.athlete_id, name: c.athleteName, image: c.athleteImage });
    });
    return Object.values(groups);
  })();

  const nextComp = groupedUpcoming[0];
  const nextCompDays = nextComp
    ? Math.ceil((new Date(nextComp.event_date + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000) + 'd'
    : '—';
  const nextCompName = nextComp
    ? new Date(nextComp.event_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) +
      (nextComp.name ? ' · ' + nextComp.name.substring(0, 18) : '')
    : 'Sin competiciones';

  const todayStr = toLocalDateStr(new Date());
  const todaySessions = weekSessions.filter(s => s.scheduled_date === todayStr).length;

  const getAthletesToday = () => {
    const byAthlete = {};
    weekSessions
      .filter(s => s.scheduled_date === todayStr)
      .forEach(s => {
        if (!byAthlete[s.athlete_id]) {
          byAthlete[s.athlete_id] = {
            id: s.athlete_id,
            name: s.athleteName,
            image: s.athleteImage,
            status: s.status === 'completed' ? 'completed' : 'pending',
          };
        }
      });
    return Object.values(byAthlete);
  };
  const athletesToday = getAthletesToday();

  const getWeekDays = () => {
    const dayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateStr(d);
      return { dateStr, dayName: dayNames[i], dayNumber: d.getDate(), isToday: dateStr === todayStr };
    });
  };

  const getGroupedSessionsForDate = (dateStr) => {
    const groups = {};
    weekSessions.filter(s => s.scheduled_date === dateStr).forEach(s => {
      const key = `${s.title}||${s.training_type}||${s.description || ''}`;
      if (!groups[key]) groups[key] = { ...s, athletes: [] };
      groups[key].athletes.push({ id: s.athlete_id, name: s.athleteName, image: s.athleteImage, status: s.status, sessionId: s.id });
    });
    return Object.values(groups);
  };

  const getGroupedCompetitionsForDate = (dateStr) => {
    const groups = {};
    weekCompetitions.filter(c => c.event_date === dateStr).forEach(c => {
      const key = `${c.name}||${c.event_date}||${c.distance_km || ''}||${c.location || ''}`;
      if (!groups[key]) groups[key] = { ...c, isCompetition: true, athletes: [] };
      groups[key].athletes.push({ id: c.athlete_id, name: c.athleteName, image: c.athleteImage });
    });
    return Object.values(groups);
  };

  const getWeekRangeLabel = () => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const s = currentWeekStart, e = end;
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} - ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${s.getDate()} ${months[s.getMonth()]} - ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
  };

  const isCurrentWeek = () =>
    toLocalDateStr(getWeekStartDate(new Date())) === toLocalDateStr(currentWeekStart);

  const handleOpenAddAthletes = async (comp) => {
    setShowAddAthletes(true);
    setAddingAthleteIds([]);
    const { data } = await getCoachAthletesList(profile?.id);
    const assignedIds = new Set((comp.athletes || []).map(a => a.id));
    setAllAthletes((data || []).filter(a => !assignedIds.has(a.id)));
  };

  const handleConfirmAddAthletes = async () => {
    if (!addingAthleteIds.length || !selectedSession) return;
    setSavingAdd(true);
    const { error } = await addAthletesToCompetition(profile?.id, addingAthleteIds, {
      name: selectedSession.name, event_date: selectedSession.event_date,
      location: selectedSession.location, distance_km: selectedSession.distance_km,
      distance_name: selectedSession.distance_name, event_type: selectedSession.event_type,
      surface: selectedSession.surface, target_time_seconds: selectedSession.target_time_seconds,
      target_pace_seconds: selectedSession.target_pace_seconds, priority: selectedSession.priority,
      notes: selectedSession.notes,
    });
    setSavingAdd(false);
    if (error) {
      showError('Error al añadir atletas');
    } else {
      showSuccess(`${addingAthleteIds.length} atleta${addingAthleteIds.length > 1 ? 's' : ''} añadido${addingAthleteIds.length > 1 ? 's' : ''}`);
      setShowAddAthletes(false);
      setSelectedSession(null);
      refreshCompetitions();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F4F6FA] dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A6BFF] mx-auto" />
          <p className="mt-4 text-slate-500 dark:text-slate-400">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F6FA] dark:bg-gray-900">

      {/* ── SCROLL AREA ── */}
      <div className="px-4 lg:px-8 py-5 lg:py-8">

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            Error al cargar algunos datos. Por favor, recarga la página.
          </div>
        )}

        {/* GREETING */}
        <div className="mb-5">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            ¡Buenas, {displayName}! 👋
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {todaySessions > 0
              ? `Tienes ${todaySessions} sesión${todaySessions > 1 ? 'es' : ''} programada${todaySessions > 1 ? 's' : ''} hoy`
              : 'No hay sesiones programadas hoy'}
          </p>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
          <StatCardNew
            accent
            icon={FiUsers}
            label="Atletas activos"
            value={stats?.totalAthletes || 0}
            sub="En tu grupo"
            linkTo="/dashboard/athletes"
          />
          <StatCardNew
            icon={FiActivity}
            label="Sesiones semana"
            value={stats?.weekSessions || 0}
            sub="Programadas"
          />
          <StatCardNew
            icon={FiCheckCircle}
            label="Equipo"
            value={stats?.completedSessions || 0}
            sub="Sesiones completadas"
            trend={`${stats?.completionRate || 0}% tasa`}
            trendUp={(stats?.completionRate || 0) >= 50}
            linkTo="/dashboard/metrics"
          />
          <StatCardNew
            icon={FiCalendar}
            label="Próx. competición"
            value={nextCompDays}
            sub={nextCompName}
          />
        </div>

        {/* IA CARD — visual only (mobile: full width, desktop: dentro de col izq) */}
        <div
          className="lg:hidden rounded-2xl p-4 flex gap-3 items-start relative overflow-hidden cursor-pointer mb-5"
          style={{ background: '#0F172A', border: '1px solid #334155' }}
        >
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, background: 'radial-gradient(circle, rgba(26,107,255,0.35), transparent 70%)', pointerEvents: 'none' }} />
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1A6BFF' }}>
            <FiZap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#1A6BFF' }}>IA · Análisis</p>
            <p className="text-sm font-semibold text-white leading-snug">Análisis de carga disponible. Consulta el informe de esta semana.</p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>Ver informe completo →</p>
          </div>
        </div>

        {/* ── BENTO GRID: col izq (main) + col der (sidebar) en desktop ── */}
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 space-y-5 lg:space-y-0">

          {/* ── COLUMNA IZQUIERDA ── */}
          <div className="space-y-5">

            {/* IA CARD desktop — solo visible en desktop */}
            <div
              className="hidden lg:flex rounded-2xl p-4 gap-3 items-start relative overflow-hidden cursor-pointer"
              style={{ background: '#0F172A', border: '1px solid #334155' }}
            >
              <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, background: 'radial-gradient(circle, rgba(26,107,255,0.35), transparent 70%)', pointerEvents: 'none' }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1A6BFF' }}>
                <FiZap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#1A6BFF' }}>IA · Análisis</p>
                <p className="text-sm font-semibold text-white leading-snug">Análisis de carga disponible. Consulta el informe de esta semana.</p>
                <p className="text-xs mt-1" style={{ color: '#64748B' }}>Ver informe completo →</p>
              </div>
            </div>

            {/* AGENDA SEMANAL */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl border border-[#E2E8F0] dark:border-gray-700 p-4">
              <SectionHeader icon={FiCalendar} title="Agenda Semanal" linkTo="/dashboard/calendar" linkLabel="Ver todo →" />

              <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2 bg-[#F4F6FA] dark:bg-gray-700/50">
                <button onClick={goToPreviousWeek} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{getWeekRangeLabel()}</span>
                <button onClick={goToNextWeek} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
              {!isCurrentWeek() && (
                <button
                  onClick={goToCurrentWeek}
                  className="mt-2 text-xs px-3 py-1 rounded-full font-medium bg-blue-50 dark:bg-blue-900/30 text-[#1A6BFF] dark:text-blue-400"
                >
                  Volver a esta semana
                </button>
              )}

              {weekLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A6BFF]" />
                </div>
              ) : weekSessions.length === 0 && weekCompetitions.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <FiCalendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay eventos programados esta semana</p>
                </div>
              ) : (
                <>
                  {/* 7-col grid (desktop y tablet) */}
                  <div className="hidden sm:grid grid-cols-7 gap-1 mt-4">
                    {getWeekDays().map(day => (
                      <div key={day.dateStr} className="text-center pb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{day.dayName}</p>
                        <div
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold"
                          style={day.isToday ? { background: '#1A6BFF', color: 'white' } : { color: '#475569' }}
                        >
                          {day.dayNumber}
                        </div>
                      </div>
                    ))}
                    {getWeekDays().map(day => {
                      const grouped = getGroupedSessionsForDate(day.dateStr);
                      const comps = getGroupedCompetitionsForDate(day.dateStr);
                      return (
                        <div
                          key={`col-${day.dateStr}`}
                          className="min-h-[90px] pt-1 px-0.5 border-t"
                          style={{
                            borderColor: '#E2E8F0',
                            background: day.isToday ? 'rgba(26,107,255,0.04)' : 'transparent',
                            borderRadius: day.isToday ? '0 0 8px 8px' : undefined,
                          }}
                        >
                          {grouped.map((group, gi) => {
                            const ts = getTypeStyle(group.training_type);
                            return (
                              <div
                                key={`s-${group.id}-${gi}`}
                                onClick={() => setSelectedSession(group)}
                                className={`mb-1 p-1.5 rounded-md cursor-pointer hover:shadow-sm ${ts.bgClass}`}
                                style={{ borderLeft: `2.5px solid ${ts.border}` }}
                              >
                                <p className="text-[11px] font-semibold text-slate-900 dark:text-white truncate leading-tight">{group.title}</p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {group.athletes.length > 1 ? `${group.athletes.length} atletas` : group.athletes[0]?.name?.split(' ')[0] || ''}
                                </p>
                              </div>
                            );
                          })}
                          {comps.map((comp, ci) => (
                            <div
                              key={`c-${comp.id}-${ci}`}
                              onClick={() => setSelectedSession(comp)}
                              className="mb-1 p-1.5 rounded-md cursor-pointer hover:shadow-sm bg-red-50 dark:bg-red-900/20"
                              style={{ borderLeft: '2.5px solid #EF4444' }}
                            >
                              <p className="text-[11px] font-semibold text-slate-900 dark:text-white truncate leading-tight flex items-center gap-0.5">
                                <FiFlag className="w-3 h-3 text-red-500 flex-shrink-0" />{comp.name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {comp.athletes.length > 1 ? `${comp.athletes.length} atletas` : comp.athletes[0]?.name?.split(' ')[0] || ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile: list by day */}
                  <div className="sm:hidden space-y-3 mt-3">
                    {getWeekDays()
                      .filter(day => {
                        const g = getGroupedSessionsForDate(day.dateStr);
                        const c = getGroupedCompetitionsForDate(day.dateStr);
                        return g.length > 0 || c.length > 0 || day.isToday;
                      })
                      .map(day => {
                        const grouped = getGroupedSessionsForDate(day.dateStr);
                        const comps = getGroupedCompetitionsForDate(day.dateStr);
                        return (
                          <div key={day.dateStr}>
                            <div
                              className="flex items-center gap-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider"
                              style={{ color: day.isToday ? '#1A6BFF' : '#94A3B8' }}
                            >
                              {day.dayName} · {day.dayNumber}
                              {day.isToday && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#1A6BFF' }}>
                                  HOY
                                </span>
                              )}
                            </div>
                            {grouped.length === 0 && comps.length === 0 ? (
                              <p className="text-xs text-slate-400 ml-1">Sin eventos</p>
                            ) : (
                              <div className="space-y-1.5">
                                {grouped.map((group, gi) => {
                                  const ts = getTypeStyle(group.training_type);
                                  const single = group.athletes.length === 1;
                                  return (
                                    <div
                                      key={`s-${group.id}-${gi}`}
                                      onClick={() => setSelectedSession(group)}
                                      className="bg-white dark:bg-gray-800 rounded-xl px-3.5 py-3 flex items-center gap-3 border border-[#E2E8F0] dark:border-gray-700 cursor-pointer"
                                      style={{ borderLeft: `3px solid ${ts.border}` }}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{group.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                          {group.athletes.length > 1
                                            ? group.athletes.map(a => a.name?.split(' ')[0]).join(', ')
                                            : group.athletes[0]?.name || ''}
                                        </p>
                                      </div>
                                      {group.athletes.length > 1 ? (
                                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                          {group.athletes.length} atletas
                                        </span>
                                      ) : single ? (
                                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${getStatusColor(group.athletes[0]?.status || group.status)}`}>
                                          {getStatusLabel(group.athletes[0]?.status || group.status)}
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })}
                                {comps.map((comp, ci) => (
                                  <div
                                    key={`c-${comp.id}-${ci}`}
                                    onClick={() => setSelectedSession(comp)}
                                    className="bg-white dark:bg-gray-800 rounded-xl px-3.5 py-3 flex items-center gap-3 border border-[#E2E8F0] dark:border-gray-700 cursor-pointer"
                                    style={{ borderLeft: '3px solid #EF4444' }}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1">
                                        <FiFlag className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />{comp.name}
                                      </p>
                                      <p className="text-xs text-slate-500 truncate mt-0.5">
                                        {comp.athletes.length > 1 ? comp.athletes.map(a => a.name?.split(' ')[0]).join(', ') : comp.athletes[0]?.name || ''}
                                      </p>
                                    </div>
                                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                                      {comp.athletes.length > 1 ? `${comp.athletes.length} atletas` : 'Competición'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </section>

            {/* ATLETAS · HOY — mobile only */}
            {athletesToday.length > 0 && (
              <section className="lg:hidden">
                <SectionHeader icon={FiClock} title="Atletas · Hoy" />
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar mt-3 pb-1">
                  {athletesToday.map(a => <AthleteChip key={a.id} athlete={a} />)}
                </div>
                <div className="flex gap-4 mt-2.5 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#22C55E' }} />Completado</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#1A6BFF' }} />Pendiente</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#CBD5E1' }} />Descanso</span>
                </div>
              </section>
            )}

            {/* PRÓXIMOS EVENTOS — mobile y desktop (col izq) */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl border border-[#E2E8F0] dark:border-gray-700 p-4">
              <SectionHeader icon={FiStar} title="Próximos Eventos" actionLabel="+ Nueva →" onAction={() => setShowCreateCompetition(true)} />
              {groupedUpcoming.length === 0 ? (
                <div className="p-4 text-center mt-3">
                  <FiFlag className="w-8 h-8 mx-auto mb-2" style={{ color: '#CBD5E1' }} />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No hay competiciones próximas</p>
                  <button onClick={() => setShowCreateCompetition(true)} className="mt-2 text-sm font-medium" style={{ color: '#1A6BFF' }}>Crear una competición</button>
                </div>
              ) : (
                <div className="mt-3 max-h-[420px] overflow-y-auto pr-1 custom-scroll">
                  <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-2 lg:space-y-0">
                    {groupedUpcoming.map((comp, i) => (
                      <EventCard key={`${comp.id}-${i}`} comp={comp} onClick={() => setSelectedSession({ ...comp, isCompetition: true })} />
                    ))}
                  </div>
                </div>
              )}
            </section>

          </div>{/* fin col izquierda */}

          {/* ── COLUMNA DERECHA (solo desktop) ── */}
          <div className="hidden lg:flex lg:flex-col lg:gap-5">

            {/* MIS ATLETAS */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl border border-[#E2E8F0] dark:border-gray-700 p-4 flex flex-col">
              <SectionHeader icon={FiUsers} title="Mis Atletas" linkTo="/dashboard/athletes" linkLabel="Ver todos →" />
              <div className="space-y-2 mt-3 max-h-[296px] overflow-y-auto pr-1 custom-scroll">
                {recentAthletes.length === 0 ? (
                  <div className="p-4 text-center">
                    <FiUsers className="w-8 h-8 mx-auto mb-2" style={{ color: '#CBD5E1' }} />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No hay atletas</p>
                  </div>
                ) : (
                  recentAthletes.map(athlete => {
                    const lastSess = weekSessions
                      .filter(s => s.athlete_id === athlete.id)
                      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
                    let lastSession = null;
                    if (lastSess) {
                      if (lastSess.status === 'completed') lastSession = { text: `✓ ${lastSess.title}`, isOk: true };
                      else if (lastSess.scheduled_date === todayStr) lastSession = { text: `Hoy: ${lastSess.title}` };
                    }
                    return <AthleteRow key={athlete.id} athlete={athlete} lastSession={lastSession} />;
                  })
                )}
              </div>
            </section>

            {/* ATLETAS HOY — desktop */}
            {athletesToday.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-2xl border border-[#E2E8F0] dark:border-gray-700 p-4">
                <SectionHeader icon={FiClock} title="Atletas · Hoy" />
                <div className="flex flex-wrap gap-3 mt-3">
                  {athletesToday.map(a => <AthleteChip key={a.id} athlete={a} />)}
                </div>
                <div className="flex gap-3 mt-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />Completado</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#1A6BFF' }} />Pendiente</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#CBD5E1' }} />Descanso</span>
                </div>
              </section>
            )}

          </div>{/* fin col derecha */}

        </div>{/* fin bento grid */}

        {/* MIS ATLETAS — mobile only */}
        <section className="lg:hidden mt-5">
          <SectionHeader icon={FiUsers} title="Mis Atletas" linkTo="/dashboard/athletes" linkLabel="Ver todos →" />
          <div className="space-y-2 mt-3 max-h-[320px] overflow-y-auto pr-1 custom-scroll">
            {recentAthletes.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-[#E2E8F0] dark:border-gray-700 text-center">
                <FiUsers className="w-10 h-10 mx-auto mb-2" style={{ color: '#CBD5E1' }} />
                <p className="text-sm text-slate-500 dark:text-slate-400">No hay atletas registrados</p>
              </div>
            ) : (
              recentAthletes.map(athlete => {
                const lastSess = weekSessions
                  .filter(s => s.athlete_id === athlete.id)
                  .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
                let lastSession = null;
                if (lastSess) {
                  if (lastSess.status === 'completed') lastSession = { text: `✓ ${lastSess.title}`, isOk: true };
                  else if (lastSess.scheduled_date === todayStr) lastSession = { text: `Hoy: ${lastSess.title}` };
                }
                return <AthleteRow key={athlete.id} athlete={athlete} lastSession={lastSession} />;
              })
            )}
          </div>
        </section>

      </div>

      {/* ── MODALES ── */}
      <AnimatePresence>
        {showCreateCompetition && (
          <CreateCompetitionModal coachId={profile?.id} onCreated={refreshCompetitions} onClose={() => setShowCreateCompetition(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedSession.isCompetition ? 'Detalles de Competición' : 'Detalles del Entrenamiento'}
                  </h3>
                  <button onClick={() => setSelectedSession(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg">
                    <FiX className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Fecha */}
                  <div
                    className={`p-3 rounded-xl flex items-center gap-3 ${selectedSession.isCompetition ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}
                  >
                    <FiCalendar style={{ color: selectedSession.isCompetition ? '#EF4444' : '#1A6BFF' }} className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium" style={{ color: selectedSession.isCompetition ? '#DC2626' : '#1A6BFF' }}>
                        {new Date(
                          (selectedSession.isCompetition ? selectedSession.event_date : selectedSession.scheduled_date) + 'T00:00:00'
                        ).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      {!selectedSession.isCompetition && selectedSession.scheduled_time && (
                        <p className="text-sm flex items-center mt-1" style={{ color: '#1A6BFF' }}>
                          <FiClock className="w-3 h-3 mr-1" />{selectedSession.scheduled_time.slice(0, 5)}
                        </p>
                      )}
                    </div>
                  </div>

                  <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                    {selectedSession.isCompetition ? selectedSession.name : selectedSession.title}
                  </h4>

                  {/* Tipo / estado */}
                  {selectedSession.isCompetition ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm text-white" style={{ background: '#EF4444' }}>
                      <FiFlag className="w-3.5 h-3.5" /> Competición
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full text-sm text-white" style={{ background: getTypeStyle(selectedSession.training_type).pill }}>
                        {getTrainingTypeLabel(selectedSession.training_type)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedSession.status)}`}>
                        {getStatusLabel(selectedSession.status)}
                      </span>
                    </div>
                  )}

                  {/* Atletas */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {selectedSession.athletes?.length > 1 ? `${selectedSession.athletes.length} atletas` : 'Atleta'}
                      </p>
                      {selectedSession.isCompetition && (
                        <button onClick={() => handleOpenAddAthletes(selectedSession)} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: '#EF4444' }}>
                          <FiPlus className="w-3 h-3" /> Añadir atletas
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(selectedSession.athletes || [{
                        id: selectedSession.athlete_id,
                        name: selectedSession.athleteName,
                        image: selectedSession.athleteImage,
                        status: selectedSession.status,
                      }]).map(athlete => (
                        <Link
                          key={athlete.id}
                          to={`/dashboard/athletes/${athlete.id}`}
                          onClick={() => setSelectedSession(null)}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-gray-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <AvatarCircle name={athlete.name} image={athlete.image} size="lg" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{athlete.name}</p>
                          </div>
                          {!selectedSession.isCompetition && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(athlete.status)}`}>
                              {getStatusLabel(athlete.status)}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>

                    {/* Panel añadir atletas */}
                    {selectedSession.isCompetition && showAddAthletes && (
                      <div className="mt-3 p-3 rounded-xl border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Selecciona atletas a añadir:</p>
                        {allAthletes.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-2">Todos los atletas ya están asignados</p>
                        ) : (
                          <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
                            {allAthletes.map(a => {
                              const selected = addingAthleteIds.includes(a.id);
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => setAddingAthleteIds(prev =>
                                    prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                                  )}
                                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${selected ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700' : 'border border-transparent'}`}
                                >
                                  <div
                                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                    style={{ background: selected ? '#EF4444' : 'transparent', border: selected ? 'none' : '2px solid #CBD5E1' }}
                                  >
                                    {selected && <FiCheck className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <AvatarCircle name={`${a.first_name} ${a.last_name}`} image={a.profile_image} />
                                  <span className="text-slate-900 dark:text-white font-medium">{a.first_name} {a.last_name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowAddAthletes(false)} className="text-xs px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                          {allAthletes.length > 0 && (
                            <button
                              onClick={handleConfirmAddAthletes}
                              disabled={savingAdd || addingAthleteIds.length === 0}
                              className="text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium transition-colors"
                              style={{ background: '#EF4444' }}
                            >
                              {savingAdd ? 'Guardando...' : `Añadir${addingAthleteIds.length > 0 ? ` (${addingAthleteIds.length})` : ''}`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Competición: extra */}
                  {selectedSession.isCompetition && (
                    <>
                      {selectedSession.distance_km && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
                          <FiActivity className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500">Distancia</p>
                            <p className="font-medium text-slate-900 dark:text-white">{selectedSession.distance_km} km</p>
                          </div>
                        </div>
                      )}
                      {selectedSession.location && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
                          <FiMapPin className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500">Ubicación</p>
                            <p className="font-medium text-slate-900 dark:text-white">{selectedSession.location}</p>
                          </div>
                        </div>
                      )}
                      {selectedSession.notes && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Notas</p>
                          <p className="text-slate-900 dark:text-white text-sm whitespace-pre-wrap">{selectedSession.notes}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Entrenamiento: extra */}
                  {!selectedSession.isCompetition && (
                    <>
                      {selectedSession.estimated_duration_minutes && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
                          <FiClock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500">Duración estimada</p>
                            <p className="font-medium text-slate-900 dark:text-white">{selectedSession.estimated_duration_minutes} min</p>
                          </div>
                        </div>
                      )}
                      {selectedSession.description && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Descripción</p>
                          <p className="text-slate-900 dark:text-white text-sm whitespace-pre-wrap">{selectedSession.description}</p>
                        </div>
                      )}
                      {selectedSession.notes_coach && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Notas del entrenador</p>
                          <p className="text-slate-900 dark:text-white text-sm whitespace-pre-wrap">{selectedSession.notes_coach}</p>
                        </div>
                      )}
                      {selectedSession.notes_athlete && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Notas del atleta</p>
                          <p className="text-slate-900 dark:text-white text-sm whitespace-pre-wrap">{selectedSession.notes_athlete}</p>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => setSelectedSession(null)}
                    className="w-full py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
