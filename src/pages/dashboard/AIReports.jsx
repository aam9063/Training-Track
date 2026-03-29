import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiZap, FiChevronLeft, FiChevronRight, FiX, FiRefreshCw,
  FiLoader, FiBarChart2, FiAlertTriangle, FiCheckCircle,
  FiArrowRight, FiCalendar, FiTarget, FiSend,
  FiDownload, FiInfo, FiArrowLeft, FiMessageCircle,
} from 'react-icons/fi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCoachWeeklyReports,
  getCoachReportWeeks,
  triggerWeeklyReports,
} from '../../services/aiReportService';
import { sendMessage } from '../../services/chatService';
import { getWeeklyDiaryForCoach } from '../../services/weeklyDiaryService';
import { showSuccess, showError } from '../../lib/toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALERT_CONFIG = {
  critical: {
    label: 'Crítico',
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    border: 'border-l-red-500',
    ring: 'ring-red-500/30',
    bar: 'bg-red-500',
    icon: '🔴',
  },
  attention: {
    label: 'Atención',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    border: 'border-l-amber-400',
    ring: 'ring-amber-500/30',
    bar: 'bg-amber-400',
    icon: '🟡',
  },
  ok: {
    label: 'En forma',
    dot: 'bg-green-500',
    badge: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
    border: 'border-l-green-500',
    ring: 'ring-green-500/30',
    bar: 'bg-green-500',
    icon: '🟢',
  },
};

const ALERT_COLORS = {
  critical: 'bg-red-500/10 border-red-500/20',
  attention: 'bg-amber-500/10 border-amber-500/20',
  ok: 'bg-green-500/10 border-green-500/20',
};
const ALERT_TEXT = {
  critical: 'text-red-600 dark:text-red-400',
  attention: 'text-amber-600 dark:text-amber-400',
  ok: 'text-green-600 dark:text-green-400',
};
const ALERT_TITLE_COLOR = {
  critical: 'text-red-800',
  attention: 'text-amber-800',
  ok: 'text-green-800',
};

const formatDate = (dateStr) =>
  new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

const initials = (firstName, lastName) =>
  `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?';

const avatarGradient = (name = '') => {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-green-500 to-emerald-600',
    'from-purple-500 to-violet-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
    'from-teal-500 to-cyan-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
};

const pct = (done, planned) =>
  planned > 0 ? Math.round((done / planned) * 100) : 0;

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlertBadge({ level }) {
  const cfg = ALERT_CONFIG[level] || ALERT_CONFIG.ok;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function AthleteAvatar({ firstName, lastName, image, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  const fullName = `${firstName || ''} ${lastName || ''}`.trim();
  if (image) {
    return <img src={image} alt={fullName} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${avatarGradient(fullName)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials(firstName, lastName)}
    </div>
  );
}

function ProgressBar({ value, max, colorClass = 'bg-brand-primary', height = 'h-1.5' }) {
  const pctVal = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`w-full bg-slate-100 dark:bg-coach-elevated rounded-full ${height} overflow-hidden`}>
      <div
        className={`${height} rounded-full ${colorClass} transition-all duration-500`}
        style={{ width: `${pctVal}%` }}
      />
    </div>
  );
}

function MetricPill({ label, value, sub, colorClass = 'text-slate-900 dark:text-white' }) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <span className={`text-base font-bold ${colorClass} leading-none`}>{value}</span>
      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide leading-tight text-center">{label}</span>
      {sub && <span className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</span>}
    </div>
  );
}

// ─── Athlete Report Card ──────────────────────────────────────────────────────

function ReportCard({ report, onClick }) {
  const cfg = ALERT_CONFIG[report.alert_level] || ALERT_CONFIG.ok;
  const athlete = report.users || {};
  const sessPct = pct(report.sessions_done, report.sessions_planned);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onClick(report)}
      className={`w-full text-left bg-coach-surface rounded-2xl border border-coach-border border-l-4 ${cfg.border} p-4 transition-all hover:shadow-md hover:ring-2 ${cfg.ring} dark:ring-opacity-20`}
    >
      <div className="flex items-start gap-3">
        <AthleteAvatar
          firstName={athlete.first_name}
          lastName={athlete.last_name}
          image={athlete.profile_image}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {athlete.first_name} {athlete.last_name}
            </span>
            <AlertBadge level={report.alert_level} />
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
            {report.summary || `${report.sessions_done}/${report.sessions_planned} sesiones completadas`}
          </p>

          {/* Metrics row */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-coach-border">
            <MetricPill
              label="ACWR"
              value={report.acwr != null ? report.acwr.toFixed(2) : '—'}
              colorClass={
                report.acwr == null ? 'text-slate-400'
                : report.acwr > 1.5 ? 'text-red-600'
                : report.acwr >= 1.2 ? 'text-amber-600'
                : 'text-green-600'
              }
            />
            <MetricPill
              label="TSB"
              value={report.tsb != null ? (report.tsb > 0 ? `+${Math.round(report.tsb)}` : Math.round(report.tsb)) : '—'}
              colorClass={
                report.tsb == null ? 'text-slate-400'
                : report.tsb < -30 ? 'text-red-600'
                : report.tsb < -10 ? 'text-amber-600'
                : 'text-green-600'
              }
            />
            <MetricPill
              label="Sesiones"
              value={`${report.sessions_done}/${report.sessions_planned}`}
              colorClass={sessPct < 50 ? 'text-red-600' : sessPct < 80 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}
            />
            <MetricPill
              label="RPE med."
              value={report.avg_rpe != null ? report.avg_rpe.toFixed(1) : '—'}
              colorClass={
                report.avg_rpe == null ? 'text-slate-400'
                : report.avg_rpe >= 8.5 ? 'text-red-600'
                : report.avg_rpe >= 7.5 ? 'text-amber-600'
                : 'text-green-600'
              }
            />
          </div>
        </div>
        <FiArrowRight className="w-4 h-4 text-slate-300 dark:text-gray-600 flex-shrink-0 mt-1" />
      </div>
    </motion.button>
  );
}

// ─── Report Detail View (full page) ──────────────────────────────────────────

function ReportDetailView({ report, onBack, coachId }) {
  const ai = report.ai_analysis || {};
  const athlete = report.users || {};
  const alertas = ai.alertas || [];
  const recomendaciones = ai.recomendaciones || [];
  const prediccion = ai.prediccion_competicion;
  const comparativa = ai.comparativa || {};

  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteTab, setNoteTab] = useState('note');
  const [noteText, setNoteText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const noteRef = useRef(null);
  const [diary, setDiary] = useState(undefined); // undefined=loading, null=no entry, object=entry

  useEffect(() => {
    if (athlete.id && report.week_start) {
      getWeeklyDiaryForCoach(athlete.id, report.week_start)
        .then(({ data }) => setDiary(data));
    }
  }, [athlete.id, report.week_start]);

  const handleSendNote = async () => {
    if (!noteText.trim() || !coachId || !athlete.id) return;
    setSendingNote(true);
    try {
      const { error } = await sendMessage(coachId, athlete.id, noteText.trim());
      if (error) throw error;
      showSuccess('Nota enviada al atleta');
      setNoteText('');
      setShowNoteInput(false);
    } catch (err) {
      showError('Error al enviar la nota');
    } finally {
      setSendingNote(false);
    }
  };

  const handleSendReport = async () => {
    if (!coachId || !athlete.id) return;
    setSendingNote(true);
    try {
      const payload = {
        week_start: report.week_start,
        week_end: report.week_end,
        alert_level: report.alert_level,
        summary: report.summary,
        sessions_done: report.sessions_done,
        sessions_planned: report.sessions_planned,
        actual_km: report.actual_km,
        acwr: report.acwr,
        tsb: report.tsb,
        avg_rpe: report.avg_rpe,
        ai_analysis: report.ai_analysis,
      };
      const content = `__REPORT__:${JSON.stringify(payload)}`;
      const { error } = await sendMessage(coachId, athlete.id, content);
      if (error) throw error;
      showSuccess(`Informe enviado a ${athlete.first_name}`);
      setShowNoteInput(false);
    } catch (err) {
      showError('Error al enviar el informe');
    } finally {
      setSendingNote(false);
    }
  };

  useEffect(() => {
    if (showNoteInput && noteTab === 'note') noteRef.current?.focus();
  }, [showNoteInput, noteTab]);

  const kmExec = comparativa.km_ejecutado ?? report.actual_km ?? 0;
  const kmPlan = comparativa.km_planificado ?? report.planned_km ?? 0;
  const sessExec = comparativa.sesiones_ejecutadas ?? report.sessions_done ?? 0;
  const sessPlan = comparativa.sesiones_planificadas ?? report.sessions_planned ?? 0;
  const timeExecMin = comparativa.tiempo_ejecutado_min ?? 0;
  const timePlanMin = comparativa.tiempo_planificado_min ?? 0;
  const avgRpe = comparativa.rpe_medio ?? report.avg_rpe ?? null;
  const internalLoad = comparativa.carga_interna ?? report.internal_load ?? null;

  const formatMin = (m) => {
    if (!m) return '0h';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h${min > 0 ? min : ''}` : `${min}m`;
  };

  return (
    <>
    {/* Note / Report modal */}
    {showNoteInput && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowNoteInput(false); setNoteText(''); }} />
        <div className="relative w-full max-w-lg bg-coach-surface rounded-2xl shadow-2xl overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-coach-border">
            <div className="flex items-center gap-3">
              <AthleteAvatar firstName={athlete.first_name} lastName={athlete.last_name} image={athlete.profile_image} size="md" />
              <div>
                <p className="text-base font-bold text-slate-800 dark:text-white">{athlete.first_name} {athlete.last_name}</p>
                <p className="text-xs text-slate-400">Informe semanal · {formatDate(report.week_start)} – {formatDate(report.week_end)}</p>
              </div>
            </div>
            <button onClick={() => { setShowNoteInput(false); setNoteText(''); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
              <FiX className="w-4 h-4" />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex border-b border-coach-border">
            {[{ id: 'note', label: 'Nota rápida' }, { id: 'report', label: 'Enviar informe' }].map(tab => (
              <button
                key={tab.id}
                onClick={() => setNoteTab(tab.id)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${noteTab === tab.id ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="p-5">
            {noteTab === 'note' ? (
              <>
                <textarea
                  ref={noteRef}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendNote(); }}
                  placeholder={`Escribe una nota para ${athlete.first_name}...`}
                  rows={5}
                  className="w-full text-sm text-slate-700 dark:text-slate-200 bg-coach-inset border border-coach-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none placeholder-slate-400 leading-relaxed"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => { setShowNoteInput(false); setNoteText(''); }} className="text-sm text-slate-400 hover:text-slate-600 px-4 py-2 rounded-xl transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleSendNote}
                    disabled={!noteText.trim() || sendingNote}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-coach-on-accent bg-coach-accent disabled:opacity-50 transition-opacity"
                  >
                    {sendingNote ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiSend className="w-4 h-4" />}
                    Enviar nota
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-4 p-4 bg-coach-inset rounded-xl mb-4 border border-coach-border">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-coach-accent/15">
                    <FiZap className="w-5 h-5 text-coach-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Informe IA · {formatDate(report.week_start)} – {formatDate(report.week_end)}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">{ai.resumen || `${report.sessions_done}/${report.sessions_planned} sesiones completadas`}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                  {athlete.first_name} recibirá el informe completo en su chat con métricas, alertas y recomendaciones de la IA.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowNoteInput(false)} className="text-sm text-slate-400 hover:text-slate-600 px-4 py-2 rounded-xl transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleSendReport}
                    disabled={sendingNote}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-coach-on-accent bg-coach-accent disabled:opacity-50 transition-opacity"
                  >
                    {sendingNote ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiSend className="w-4 h-4" />}
                    Enviar informe
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )}

    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="px-4 lg:px-8 py-6 lg:py-8"
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-brand-primary transition-colors mb-5"
      >
        <FiArrowLeft className="w-4 h-4" />
        Volver a informes
      </button>

      {/* Athlete header */}
      <div className="flex items-center gap-3 mb-5">
        <AthleteAvatar firstName={athlete.first_name} lastName={athlete.last_name} image={athlete.profile_image} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{athlete.first_name} {athlete.last_name}</h1>
            <AlertBadge level={report.alert_level} />
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Informe semanal · {formatDate(report.week_start)} – {formatDate(report.week_end)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowNoteInput(v => !v)}
            title="Nota rápida"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showNoteInput ? 'bg-brand-primary text-white shadow-md' : 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white'}`}
          >
            <FiMessageCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => exportReportPDF(report)}
            title="Exportar PDF"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-coach-inset text-coach-text-secondary hover:bg-slate-200 dark:hover:bg-gray-600 transition-all"
          >
            <FiDownload className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2 mb-2 bg-slate-900 dark:bg-coach-base rounded-t-2xl px-4 pt-4 pb-3">
        <MetricPill label="ACWR" value={report.acwr != null ? report.acwr.toFixed(2) : '—'} colorClass={report.acwr == null ? 'text-slate-500' : report.acwr > 1.5 ? 'text-red-400' : report.acwr >= 1.2 ? 'text-amber-400' : 'text-green-400'} />
        <MetricPill label="TSB" value={report.tsb != null ? (report.tsb > 0 ? `+${Math.round(report.tsb)}` : Math.round(report.tsb)) : '—'} colorClass={report.tsb == null ? 'text-slate-500' : report.tsb < -30 ? 'text-red-400' : report.tsb < -10 ? 'text-amber-400' : 'text-green-400'} />
        <MetricPill label="Sesiones" value={`${report.sessions_done}/${report.sessions_planned}`} colorClass="text-white" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5 bg-slate-900 dark:bg-coach-base rounded-b-2xl px-4 pb-4 pt-3 border-t border-white/5">
        <MetricPill label="Km ejecutados" value={`${report.actual_km}km`} colorClass="text-amber-400" />
        <MetricPill
          label="RPE medio"
          value={report.avg_rpe != null ? `${report.avg_rpe.toFixed(1)}/10` : '—'}
          colorClass={report.avg_rpe == null ? 'text-slate-500' : report.avg_rpe >= 8.5 ? 'text-red-400' : report.avg_rpe >= 7.5 ? 'text-amber-400' : 'text-green-400'}
        />
        <MetricPill
          label="Carga interna"
          value={report.internal_load != null ? `${Math.round(report.internal_load)}UA` : '—'}
          colorClass="text-slate-300"
        />
      </div>

      <div className="space-y-5">
        {/* AI Summary */}
        {ai.resumen && (
          <div className="flex gap-3 p-4 bg-slate-900 dark:bg-coach-base rounded-2xl overflow-hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-coach-accent/20">
              <FiZap className="w-4 h-4 text-coach-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-coach-accent">Hermes · IA</p>
              <p className="text-sm leading-relaxed break-words text-slate-200">{ai.resumen}</p>
            </div>
          </div>
        )}

        {/* Diario del atleta */}
        {diary !== undefined && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
              <FiInfo className="w-3.5 h-3.5" /> Diario del atleta
            </p>
            {diary === null ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">El atleta no rellenó el diario esta semana.</p>
            ) : (
              <div className="bg-coach-inset rounded-xl p-3 space-y-3">
                {/* Overall */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Semana en general</p>
                  <div className="flex items-center gap-1.5">
                    {['😩','😕','😐','🙂','💪'].map((emoji, i) => (
                      <span key={i} className={`text-lg ${diary.overall_rating === i + 1 ? 'opacity-100 scale-125' : 'opacity-25'} transition-all`}>{emoji}</span>
                    ))}
                    <span className="ml-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{diary.overall_rating}/5</span>
                  </div>
                  {diary.overall_notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">"{diary.overall_notes}"</p>
                  )}
                </div>
                {/* Pain */}
                {diary.pain_notes && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-0.5">Molestias</p>
                    <p className="text-xs text-amber-800 dark:text-amber-300">"{diary.pain_notes}"</p>
                  </div>
                )}
                {/* Next week */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Confianza próxima semana</p>
                  <div className="flex items-center gap-1.5">
                    {['😰','😟','😐','😊','🔥'].map((emoji, i) => (
                      <span key={i} className={`text-lg ${diary.next_week_rating === i + 1 ? 'opacity-100 scale-125' : 'opacity-25'} transition-all`}>{emoji}</span>
                    ))}
                    <span className="ml-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{diary.next_week_rating}/5</span>
                  </div>
                  {diary.next_week_notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">"{diary.next_week_notes}"</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Alerts */}
        {alertas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
              <FiAlertTriangle className="w-3.5 h-3.5" /> Alertas detectadas
            </p>
            <div className="space-y-2">
              {alertas.map((a, i) => {
                const lvl = a.nivel || 'ok';
                return (
                  <div key={i} className={`flex gap-3 p-3 rounded-xl border ${ALERT_COLORS[lvl] || ALERT_COLORS.ok}`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${ALERT_CONFIG[lvl]?.dot || 'bg-green-500'}`} />
                    <div>
                      <p className={`text-sm font-semibold ${ALERT_TITLE_COLOR[lvl] || 'text-green-800'}`}>{a.tipo}</p>
                      <p className={`text-xs ${ALERT_TEXT[lvl] || 'text-green-700'} mt-0.5 leading-relaxed`}>{a.descripcion}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ejecutado vs Planificado */}
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
            <FiBarChart2 className="w-3.5 h-3.5" /> Ejecutado vs Planificado
          </p>
          <div className="bg-coach-surface border border-coach-border rounded-xl p-4 space-y-3">
            {[
              { label: 'Km totales', exec: kmExec, plan: kmPlan, execLabel: `${kmExec}km`, planLabel: `${kmPlan}km` },
              { label: 'Sesiones', exec: sessExec, plan: sessPlan, execLabel: `${sessExec}`, planLabel: `${sessPlan}` },
              { label: 'Tiempo', exec: timeExecMin, plan: timePlanMin, execLabel: formatMin(timeExecMin), planLabel: formatMin(timePlanMin) },
              ...(avgRpe != null ? [{ label: 'RPE medio', exec: avgRpe, plan: 7, execLabel: `${avgRpe.toFixed(1)}/10`, planLabel: '7/10', overrideColor: avgRpe >= 8.5 ? 'bg-red-500' : avgRpe >= 7.5 ? 'bg-amber-400' : 'bg-green-500' }] : []),
            ].map(({ label, exec, plan, execLabel, planLabel, overrideColor }) => {
              const execPct = plan > 0 ? Math.min(100, Math.round((exec / plan) * 100)) : (exec > 0 ? 100 : 0);
              const overload = exec > plan;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">{label}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      <span className={`font-semibold ${overload ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{execLabel}</span>
                      {' / '}
                      <span className="text-slate-400">{planLabel}</span>
                    </span>
                  </div>
                  <div className="relative h-2 bg-slate-100 dark:bg-coach-elevated rounded-full overflow-visible">
                    <div className="absolute inset-0 rounded-full bg-brand-primary/20" />
                    <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${overrideColor ?? (overload ? 'bg-red-500' : 'bg-brand-primary')}`} style={{ width: `${Math.min(execPct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="flex gap-3 pt-1">
              <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2.5 h-1.5 rounded-full bg-brand-primary inline-block" /> Ejecutado</span>
              <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2.5 h-1.5 rounded-full bg-brand-primary/30 inline-block" /> Planificado</span>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recomendaciones.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
              <FiCheckCircle className="w-3.5 h-3.5" /> Recomendaciones para esta semana
            </p>
            <div className="space-y-2">
              {recomendaciones.map((rec, i) => (
                <div key={i} className="flex gap-3 p-3 bg-coach-surface border border-coach-border rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competition prediction */}
        {prediccion && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
              <FiTarget className="w-3.5 h-3.5" /> Predicción competición
            </p>
            <div className="bg-slate-900 dark:bg-coach-base rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <FiCalendar className="w-3.5 h-3.5 text-green-400" />
                <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Predicción competición</p>
              </div>
              <p className="text-base font-bold text-white mb-2">{prediccion.nombre} · {prediccion.dias}d</p>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">{prediccion.estado_forma}</p>
              {prediccion.puntuacion_preparacion != null && (
                <div className="flex items-end gap-4">
                  <div>
                    <span className="text-4xl font-black text-white">{prediccion.puntuacion_preparacion}</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Puntuación de preparación estimada</p>
                    <p className="text-[10px] text-slate-600">Basado en CTL, TSB y progresión del plan</p>
                  </div>
                  {prediccion.listo_para_competir != null && (
                    <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold ${prediccion.listo_para_competir ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {prediccion.listo_para_competir ? 'listo para competir' : 'necesita más preparación'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </motion.div>
    </>
  );
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportReportPDF(report) {
  const athlete = report.users || {};
  const ai = report.ai_analysis || {};
  const athleteName = `${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || 'Atleta';
  const weekLabel = `${formatDate(report.week_start)} – ${formatDate(report.week_end)}`;
  const alertas = ai.alertas || [];
  const recomendaciones = ai.recomendaciones || [];
  const prediccion = ai.prediccion_competicion;
  const comparativa = ai.comparativa || {};

  const kmExec = comparativa.km_ejecutado ?? report.actual_km ?? 0;
  const kmPlan = comparativa.km_planificado ?? report.planned_km ?? 0;
  const sessExec = comparativa.sesiones_ejecutadas ?? report.sessions_done ?? 0;
  const sessPlan = comparativa.sesiones_planificadas ?? report.sessions_planned ?? 0;

  const formatMin = (m) => {
    if (!m) return '0h';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h${min > 0 ? min : ''}` : `${min}m`;
  };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210;
  const MARGIN = 15;
  const CW = PW - MARGIN * 2;
  let y = MARGIN;

  // Header bar
  doc.setFillColor(26, 107, 255);
  doc.rect(0, 0, PW, 18, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('INFORME IA SEMANAL', MARGIN, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Training Track', PW - MARGIN, 12, { align: 'right' });
  y = 26;

  // Athlete name + week
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(athleteName, MARGIN, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Semana: ${weekLabel}`, MARGIN, y);

  // Alert badge
  const cfg = ALERT_CONFIG[report.alert_level] || ALERT_CONFIG.ok;
  const badgeColors = { critical: [239, 68, 68], attention: [245, 158, 11], ok: [34, 197, 94] };
  const bc = badgeColors[report.alert_level] || badgeColors.ok;
  doc.setFillColor(...bc);
  doc.roundedRect(PW - MARGIN - 28, y - 5, 28, 7, 1.5, 1.5, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(cfg.label, PW - MARGIN - 14, y - 0.5, { align: 'center' });
  y += 10;

  // Metrics row
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(MARGIN, y, CW, 18, 2, 2, 'F');
  const metrics = [
    { label: 'ACWR', value: report.acwr != null ? report.acwr.toFixed(2) : '—' },
    { label: 'TSB', value: report.tsb != null ? (report.tsb > 0 ? `+${Math.round(report.tsb)}` : String(Math.round(report.tsb))) : '—' },
    { label: 'Sesiones', value: `${report.sessions_done}/${report.sessions_planned}` },
    { label: 'Carga', value: `${report.actual_km}km` },
  ];
  metrics.forEach((m, i) => {
    const mx = MARGIN + 10 + i * (CW / 4);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(m.value, mx, y + 10, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(m.label, mx, y + 15, { align: 'center' });
  });
  y += 24;

  // AI Summary
  if (ai.resumen) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const textWidth = CW - 8;
    const summaryLines = doc.splitTextToSize(ai.resumen, textWidth);
    const lineHeight = 4.2;
    const paddingTop = 10;
    const paddingBottom = 5;
    const summaryH = paddingTop + summaryLines.length * lineHeight + paddingBottom;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(MARGIN, y, CW, summaryH, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 107, 255);
    doc.text('ANÁLISIS IA', MARGIN + 4, y + 5.5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(summaryLines, MARGIN + 4, y + paddingTop + 1, { lineHeightFactor: 1.4 });
    y += summaryH + 6;
  }

  // Ejecutado vs Planificado
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('EJECUTADO VS PLANIFICADO', MARGIN, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Métrica', 'Ejecutado', 'Planificado', '% Completado']],
    body: [
      ['Km totales', `${kmExec} km`, `${kmPlan} km`, kmPlan > 0 ? `${Math.round((kmExec / kmPlan) * 100)}%` : '—'],
      ['Sesiones', String(sessExec), String(sessPlan), sessPlan > 0 ? `${Math.round((sessExec / sessPlan) * 100)}%` : '—'],
      ['Tiempo', formatMin(comparativa.tiempo_ejecutado_min ?? 0), formatMin(comparativa.tiempo_planificado_min ?? 0), '—'],
    ],
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [26, 107, 255], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Alerts
  if (alertas.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('ALERTAS DETECTADAS', MARGIN, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Nivel', 'Tipo', 'Descripción']],
      body: alertas.map(a => [a.nivel || 'ok', a.tipo || '', a.descripcion || '']),
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 40 } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Recommendations
  if (recomendaciones.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('RECOMENDACIONES', MARGIN, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['#', 'Recomendación']],
      body: recomendaciones.map((r, i) => [String(i + 1), r]),
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Competition prediction
  if (prediccion) {
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, CW, 22, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('PREDICCIÓN COMPETICIÓN', MARGIN + 4, y + 5.5);
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`${prediccion.nombre || ''} · ${prediccion.dias ?? '?'}d`, MARGIN + 4, y + 12);
    if (prediccion.estado_forma) {
      const lines = doc.splitTextToSize(prediccion.estado_forma, CW - 8);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(lines[0], MARGIN + 4, y + 18);
    }
    if (prediccion.puntuacion_preparacion != null) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(String(prediccion.puntuacion_preparacion), PW - MARGIN - 8, y + 14, { align: 'right' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('puntos', PW - MARGIN - 8, y + 19, { align: 'right' });
    }
    y += 28;
  }

  // Footer
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generado el ${new Date().toLocaleDateString('es-ES')} | Training Track · Hermes`,
    PW / 2,
    290,
    { align: 'center' }
  );

  const fileName = `informe-ia-${athleteName.toLowerCase().replace(/\s+/g, '-')}-${report.week_start}.pdf`;
  doc.save(fileName);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIReports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const coachId = profile?.id;

  const loadWeeks = useCallback(async () => {
    if (!coachId) return;
    try {
      const data = await getCoachReportWeeks(coachId);
      setWeeks(data);
    } catch { /* silenced */ }
  }, [coachId]);

  const loadReports = useCallback(async (weekStart = null) => {
    if (!coachId) return;
    setLoading(true);
    try {
      const data = await getCoachWeeklyReports(coachId, weekStart);
      setReports(data);
    } catch (err) {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    if (!coachId) return;
    loadWeeks();
  }, [loadWeeks]);

  useEffect(() => {
    if (!coachId) return;
    const weekStart = weeks[selectedWeekIdx]?.week_start || null;
    loadReports(weekStart);
  }, [coachId, loadReports, selectedWeekIdx, weeks]);

  const handleGenerate = async () => {
    if (!coachId) return;
    setGenerating(true);
    try {
      await triggerWeeklyReports(coachId);
      showSuccess('Generando informes... Recibirás una notificación cuando estén listos.');
      setTimeout(async () => {
        await loadWeeks();
        await loadReports(weeks[0]?.week_start || null);
      }, 5000);
    } catch (err) {
      showError(err.message || 'Error al generar informes');
    } finally {
      setGenerating(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const critical = reports.filter(r => r.alert_level === 'critical').length;
    const attention = reports.filter(r => r.alert_level === 'attention').length;
    const ok = reports.filter(r => r.alert_level === 'ok').length;
    return { critical, attention, ok };
  }, [reports]);

  const currentWeek = weeks[selectedWeekIdx];
  const nextWeekLabel = currentWeek
    ? `${formatDate(currentWeek.week_start)} – ${formatDate(currentWeek.week_end)}`
    : null;

  // Next automatic report: next Monday
  const nextMonday = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + diff);
    return Math.ceil((next - now) / 86400000);
  }, []);

  // Show detail view when a report is selected
  if (selectedReport) {
    return (
      <AnimatePresence mode="wait">
        <ReportDetailView key={selectedReport.id} report={selectedReport} onBack={() => setSelectedReport(null)} coachId={coachId} />
      </AnimatePresence>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Informes IA</h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Análisis semanal de tus atletas</p>
      </div>
      {/* Next report banner */}
      <div className="flex items-center gap-4 p-4 rounded-2xl mb-5 bg-slate-900 dark:bg-coach-base">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-coach-accent/20">
          <FiZap className="w-5 h-5 text-coach-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Próximo informe automático</p>
          <p className="text-xs mt-0.5 text-coach-text-muted">Generado cada lunes · 8:00 AM</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-black leading-none text-coach-accent">{nextMonday}d</p>
          <p className="text-[10px] text-coach-text-muted">restantes</p>
        </div>
      </div>

      {/* Week selector */}
      {weeks.length > 0 && (
        <div className="flex items-center justify-between bg-coach-surface border border-coach-border rounded-xl px-4 py-3 mb-4">
          <button
            onClick={() => setSelectedWeekIdx(i => Math.min(i + 1, weeks.length - 1))}
            disabled={selectedWeekIdx >= weeks.length - 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <FiChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{nextWeekLabel}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Informe generado {currentWeek ? new Date(weeks[selectedWeekIdx]?.created_at || Date.now()).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
          </div>
          <button
            onClick={() => setSelectedWeekIdx(i => Math.max(i - 1, 0))}
            disabled={selectedWeekIdx <= 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <FiChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      )}

      {/* Alert summary pills */}
      {reports.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            { level: 'critical', count: stats.critical, label: 'Crítico' },
            { level: 'attention', count: stats.attention, label: 'Atención' },
            { level: 'ok', count: stats.ok, label: 'En forma' },
          ].map(({ level, count, label }) => {
            const cfg = ALERT_CONFIG[level];
            return (
              <div key={level} className="flex flex-col items-center py-3 bg-coach-surface border border-coach-border rounded-xl">
                <span className={`text-2xl font-black ${level === 'critical' ? 'text-red-600' : level === 'attention' ? 'text-amber-500' : 'text-green-600'}`}>
                  {count}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section label */}
      {reports.length > 0 && (
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
          Requieren atención
        </p>
      )}

      {/* Report list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <FiLoader className="w-6 h-6 animate-spin text-coach-accent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-14">
          <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
            <FiZap className="w-7 h-7 text-brand-primary" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            {weeks.length === 0 ? 'Aún no hay informes generados' : 'Sin informes esta semana'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
            Los informes se generan automáticamente cada lunes a las 8:00 AM, o puedes generarlos ahora.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 bg-coach-accent text-coach-on-accent"
          >
            {generating ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiZap className="w-4 h-4" />}
            {generating ? 'Generando...' : 'Generar informe ahora'}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reports.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              onClick={setSelectedReport}
            />
          ))}
        </div>
      )}

      {/* Manual regenerate button */}
      {reports.length > 0 && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-coach-text-secondary hover:text-brand-primary border border-coach-border rounded-lg transition-colors disabled:opacity-60"
          >
            {generating ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiRefreshCw className="w-3.5 h-3.5" />}
            {generating ? 'Generando...' : 'Regenerar informes'}
          </button>
        </div>
      )}

      {/* Tooltip info */}
      <div className="mt-5 flex items-start gap-2.5 p-3.5 bg-brand-primary/5 dark:bg-brand-primary/10 rounded-xl border border-brand-primary/10">
        <FiInfo className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Los informes usan IA para analizar ACWR, TSB, sesiones completadas y competiciones próximas.
          El nivel de alerta se determina automáticamente y te avisa solo donde hay algo que hacer.
        </p>
      </div>
    </div>
  );
}
