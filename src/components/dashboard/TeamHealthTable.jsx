import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiRefreshCw, FiAlertTriangle, FiUser, FiChevronDown,
  FiChevronUp, FiActivity, FiLoader,
} from 'react-icons/fi';
import { getAcwrZoneDisplay } from '../../lib/trainingMetrics';

// ─── Constants ───────────────────────────────────────────────────────────────

const INJURY_OPTIONS = [
  { value: 'ok',         label: 'OK',           bg: 'bg-green-100 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-300',   dot: 'bg-green-500' },
  { value: 'precaution', label: 'Precaución',   bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  { value: 'injured',    label: 'Lesionado',    bg: 'bg-red-100 dark:bg-red-900/30',       text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500' },
];

const getInjuryOption = (status) =>
  INJURY_OPTIONS.find(o => o.value === status) || INJURY_OPTIONS[0];

// ─── Semaphore: combines ACWR + injury ───────────────────────────────────────

const getTrafficLight = (acwr, injuryStatus, tsb) => {
  if (injuryStatus === 'injured')    return { color: 'bg-red-500',    ring: 'ring-red-400',    label: 'Lesionado' };
  if (injuryStatus === 'precaution') return { color: 'bg-yellow-500', ring: 'ring-yellow-400', label: 'Precaución' };
  if (acwr === null)                 return { color: 'bg-gray-300 dark:bg-coach-inset', ring: 'ring-gray-400', label: 'Sin datos' };
  if (acwr > 1.5 || tsb < -30)      return { color: 'bg-red-500',    ring: 'ring-red-400',    label: 'Riesgo' };
  if (acwr >= 0.8 && acwr <= 1.3 && (tsb === null || tsb >= -30)) {
    return { color: 'bg-green-500', ring: 'ring-green-400', label: 'Óptimo' };
  }
  return { color: 'bg-yellow-500', ring: 'ring-yellow-400', label: 'Atención' };
};

// ─── Last session badge ───────────────────────────────────────────────────────

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86_400_000);
};

const LastSessionBadge = ({ date, status, silenceDays, tone }) => {
  // Engagement/churn-risk silence (Agent 2) takes priority over the raw
  // last-session date when it crosses the warning threshold — amber ≥10d,
  // red ≥21d (matching SILENCE_WARNING_DAYS/SILENCE_DANGER_DAYS).
  if (silenceDays != null && silenceDays >= 10) {
    const isDanger = silenceDays >= 21 || tone === 'danger';
    const color = isDanger ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400';
    return (
      <span className={`text-xs font-semibold ${color}`} title={isDanger ? 'Riesgo de abandono' : 'Inactividad'}>
        {silenceDays}d sin señal
      </span>
    );
  }

  const days = daysSince(date);
  if (days === null) return <span className="text-xs text-gray-400">—</span>;

  const color =
    status === 'completed' ? 'text-green-600 dark:text-green-400' :
    status === 'skipped'   ? 'text-red-500 dark:text-red-400' :
                             'text-gray-500 dark:text-gray-400';

  const label = days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${days}d`;
  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
};

// ─── Injury picker (inline dropdown) ─────────────────────────────────────────

const InjuryPicker = ({ athleteId, current, onUpdate, disabled }) => {
  const [open, setOpen] = useState(false);
  const opt = getInjuryOption(current);

  const select = async (value) => {
    setOpen(false);
    if (value !== current) await onUpdate(athleteId, value);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-opacity ${opt.bg} ${opt.text} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
      >
        {disabled
          ? <FiLoader className="w-3 h-3 animate-spin" />
          : <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
        }
        <span className="hidden sm:inline">{opt.label}</span>
        <FiChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full mt-1 z-50 bg-coach-surface rounded-xl shadow-xl border border-gray-200 dark:border-coach-border py-1 min-w-[130px]"
            >
              {INJURY_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => select(o.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    o.value === current ? `${o.text} font-bold` : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${o.dot}`} />
                  {o.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── ACWR pill ────────────────────────────────────────────────────────────────

const AcwrPill = ({ acwr }) => {
  if (acwr === null) return <span className="text-xs text-gray-400">—</span>;
  const zone = getAcwrZoneDisplay(acwr);
  const colorMap = {
    undertraining: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    optimal:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    high:          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    danger:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colorMap[zone.zone]}`}>
      {acwr.toFixed(2)}
    </span>
  );
};

// ─── TSB value ────────────────────────────────────────────────────────────────

const TsbValue = ({ tsb }) => {
  if (tsb === null) return <span className="text-xs text-gray-400">—</span>;
  const color =
    tsb > 10  ? 'text-green-600 dark:text-green-400' :
    tsb > -10 ? 'text-yellow-600 dark:text-yellow-400' :
    tsb > -30 ? 'text-orange-600 dark:text-orange-400' :
                'text-red-600 dark:text-red-400';
  return (
    <span className={`text-xs font-bold ${color}`}>
      {tsb > 0 ? '+' : ''}{tsb}
    </span>
  );
};

// ─── Athlete avatar ───────────────────────────────────────────────────────────

const Avatar = ({ athlete, size = 'sm' }) => {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  if (athlete.profileImage) {
    return <img src={athlete.profileImage} alt={athlete.firstName} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sz} rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-bold">
        {athlete.firstName[0]}{athlete.lastName[0] || ''}
      </span>
    </div>
  );
};

// ─── Expand row — notes input on mobile ──────────────────────────────────────

const NotesRow = ({ athlete, onUpdate, disabled }) => {
  const [notes, setNotes] = useState(athlete.injuryNotes || '');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await onUpdate(athlete.id, athlete.injuryStatus, notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-coach-border bg-white dark:bg-coach-elevated text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-sky-500"
      />
      <button
        onClick={save}
        disabled={disabled}
        className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium transition-colors disabled:opacity-50"
      >
        {saved ? '✓' : 'Guardar'}
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeamHealthTable({ athletes, loading, updatingId, onUpdateInjury, onRefresh }) {
  const [expandedId, setExpandedId] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  const sorted = [...athletes].sort((a, b) => {
    let av, bv;
    switch (sortBy) {
      case 'name':   av = a.firstName; bv = b.firstName; break;
      case 'acwr':   av = a.acwr ?? -1; bv = b.acwr ?? -1; break;
      case 'tsb':    av = a.tsb ?? -999; bv = b.tsb ?? -999; break;
      case 'status': av = a.injuryStatus; bv = b.injuryStatus; break;
      default:       av = a.firstName; bv = b.firstName;
    }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const SortIcon = ({ col }) =>
    sortBy === col
      ? (sortDir === 'asc' ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />)
      : null;

  const TH = ({ col, label, className = '' }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`py-2.5 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-800 dark:hover:text-gray-200 whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-0.5">{label} <SortIcon col={col} /></span>
    </th>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <FiLoader className="w-7 h-7 animate-spin text-sky-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando estado del equipo...</p>
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <FiUser className="w-10 h-10 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">No hay atletas activos</p>
      </div>
    );
  }

  const injured   = sorted.filter(a => a.injuryStatus === 'injured').length;
  const precaution = sorted.filter(a => a.injuryStatus === 'precaution').length;
  const atRisk    = sorted.filter(a => a.acwr !== null && a.acwr > 1.5).length;

  return (
    <div>
      {/* Summary bar */}
      {(injured > 0 || precaution > 0 || atRisk > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {injured > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              <FiAlertTriangle className="w-3 h-3" />
              {injured} lesionado{injured > 1 ? 's' : ''}
            </span>
          )}
          {precaution > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
              <FiAlertTriangle className="w-3 h-3" />
              {precaution} en precaución
            </span>
          )}
          {atRisk > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
              <FiActivity className="w-3 h-3" />
              {atRisk} con ACWR alto
            </span>
          )}
        </div>
      )}

      {/* ── MOBILE: stacked cards ─────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {sorted.map(athlete => {
          const light = getTrafficLight(athlete.acwr, athlete.injuryStatus, athlete.tsb);
          const isExpanded = expandedId === athlete.id;

          return (
            <motion.div
              key={athlete.id}
              layout
              className="bg-coach-surface rounded-xl border border-gray-200 dark:border-coach-border overflow-hidden"
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-3 py-3">
                {/* Traffic light dot */}
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${light.color}`} title={light.label} />

                {/* Avatar */}
                <Avatar athlete={athlete} size="sm" />

                {/* Name */}
                <Link
                  to={`/dashboard/athletes/${athlete.id}`}
                  className="flex-1 min-w-0"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {athlete.firstName} {athlete.lastName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <LastSessionBadge
                      date={athlete.lastSessionDate}
                      status={athlete.lastSessionStatus}
                      silenceDays={athlete.silenceDays}
                      tone={athlete.engagementTone}
                    />
                    {athlete.lastSessionTitle && (
                      <span className="text-[10px] text-gray-400 truncate max-w-[100px]">· {athlete.lastSessionTitle}</span>
                    )}
                  </div>
                </Link>

                {/* Metrics pills */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <AcwrPill acwr={athlete.acwr} />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">TSB</span>
                    <TsbValue tsb={athlete.tsb} />
                  </div>
                </div>

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : athlete.id)}
                  className="ml-1 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                >
                  {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded: injury picker + notes */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="border-t border-gray-100 dark:border-coach-border px-3 py-3 bg-coach-inset/30"
                  >
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Estado del atleta</p>
                    <div className="flex gap-2">
                      {INJURY_OPTIONS.map(o => (
                        <button
                          key={o.value}
                          onClick={() => onUpdateInjury(athlete.id, o.value, athlete.injuryNotes || '')}
                          disabled={updatingId === athlete.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-2 ${
                            athlete.injuryStatus === o.value
                              ? `${o.bg} ${o.text} border-current`
                              : 'bg-coach-surface text-gray-600 dark:text-gray-400 border-gray-200 dark:border-coach-border hover:border-gray-400'
                          } ${updatingId === athlete.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${o.dot}`} />
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <NotesRow
                      athlete={athlete}
                      onUpdate={onUpdateInjury}
                      disabled={updatingId === athlete.id}
                    />
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      {[
                        { label: 'ACWR', value: athlete.acwr != null ? athlete.acwr.toFixed(2) : '—' },
                        { label: 'CTL', value: athlete.ctl ?? '—' },
                        { label: 'TSB', value: athlete.tsb != null ? (athlete.tsb > 0 ? `+${athlete.tsb}` : athlete.tsb) : '—' },
                      ].map(m => (
                        <div key={m.label} className="bg-coach-surface rounded-lg py-2">
                          <p className="text-[10px] text-gray-400 mb-0.5">{m.label}</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── DESKTOP: dense table ───────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-coach-border">
        <table className="w-full text-sm">
          <thead className="bg-coach-inset/50">
            <tr>
              <th className="py-2.5 px-3 w-8" />
              <TH col="name"   label="Atleta" />
              <TH col="status" label="Estado" />
              <TH col="acwr"   label="ACWR" className="text-center" />
              <th className="py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">CTL</th>
              <TH col="tsb"    label="TSB" />
              <th className="py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Última sesión</th>
              <th className="py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-coach-border/50">
            {sorted.map(athlete => {
              const light = getTrafficLight(athlete.acwr, athlete.injuryStatus, athlete.tsb);
              return (
                <tr
                  key={athlete.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                >
                  {/* Traffic light */}
                  <td className="py-3 pl-3 pr-1">
                    <span
                      className={`block w-3 h-3 rounded-full ${light.color}`}
                      title={light.label}
                    />
                  </td>

                  {/* Athlete */}
                  <td className="py-3 px-3">
                    <Link
                      to={`/dashboard/athletes/${athlete.id}`}
                      className="flex items-center gap-2.5 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                    >
                      <Avatar athlete={athlete} size="sm" />
                      <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {athlete.firstName} {athlete.lastName}
                      </span>
                    </Link>
                  </td>

                  {/* Injury picker */}
                  <td className="py-3 px-3">
                    <InjuryPicker
                      athleteId={athlete.id}
                      current={athlete.injuryStatus}
                      onUpdate={(id, val) => onUpdateInjury(id, val, athlete.injuryNotes || '')}
                      disabled={updatingId === athlete.id}
                    />
                  </td>

                  {/* ACWR */}
                  <td className="py-3 px-3 text-center">
                    <AcwrPill acwr={athlete.acwr} />
                  </td>

                  {/* CTL */}
                  <td className="py-3 px-3 text-xs text-gray-600 dark:text-gray-400">
                    {athlete.ctl ?? '—'}
                  </td>

                  {/* TSB */}
                  <td className="py-3 px-3">
                    <TsbValue tsb={athlete.tsb} />
                  </td>

                  {/* Last session */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-0.5">
                      <LastSessionBadge
                        date={athlete.lastSessionDate}
                        status={athlete.lastSessionStatus}
                        silenceDays={athlete.silenceDays}
                        tone={athlete.engagementTone}
                      />
                      {athlete.lastSessionTitle && (
                        <span className="text-[11px] text-gray-400 truncate max-w-[140px]">
                          {athlete.lastSessionTitle}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Injury notes */}
                  <td className="py-3 px-3 max-w-[180px]">
                    <DesktopNotesCell
                      athlete={athlete}
                      onUpdate={onUpdateInjury}
                      disabled={updatingId === athlete.id}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end mt-3">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors px-2 py-1 rounded-lg"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>
    </div>
  );
}

// Inline editable notes cell for desktop
function DesktopNotesCell({ athlete, onUpdate, disabled }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(athlete.injuryNotes || '');

  const save = async () => {
    setEditing(false);
    if (val !== (athlete.injuryNotes || '')) {
      await onUpdate(athlete.id, athlete.injuryStatus, val);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full text-xs px-2 py-1 rounded border border-sky-400 bg-white dark:bg-coach-elevated text-gray-900 dark:text-white focus:outline-none"
        disabled={disabled}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={disabled}
      className="text-left w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 truncate group-hover:underline decoration-dotted"
    >
      {val || <span className="text-gray-300 dark:text-gray-600 italic">Añadir nota...</span>}
    </button>
  );
}
