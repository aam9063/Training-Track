import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiZap, FiChevronLeft, FiChevronRight, FiLoader,
  FiBarChart2, FiAlertTriangle, FiCheckCircle, FiDownload,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { generateAIReportPDF } from '../../lib/pdfExport';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALERT_CONFIG = {
  critical: { label: 'Crítico', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border border-red-200', border: 'border-l-red-500', icon: '🔴' },
  attention: { label: 'Atención', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border border-amber-200', border: 'border-l-amber-400', icon: '🟡' },
  ok: { label: 'En forma', dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border border-green-200', border: 'border-l-green-500', icon: '🟢' },
};
const ALERT_COLORS = { critical: 'bg-red-50 border-red-200', attention: 'bg-amber-50 border-amber-200', ok: 'bg-green-50 border-green-200' };
const ALERT_TEXT = { critical: 'text-red-700', attention: 'text-amber-700', ok: 'text-green-700' };
const ALERT_TITLE_COLOR = { critical: 'text-red-800', attention: 'text-amber-800', ok: 'text-green-800' };

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Report card (list) ───────────────────────────────────────────────────────

function ReportCard({ report, onClick }) {
  const ai = report.ai_analysis || {};
  const level = report.alert_level || 'ok';
  const cfg = ALERT_CONFIG[level] || ALERT_CONFIG.ok;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`w-full text-left bg-white dark:bg-gray-800 rounded-2xl border-l-4 ${cfg.border} border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.icon} {cfg.label}
            </span>
            <span className="text-xs text-slate-400">{formatDate(report.week_start)} – {formatDate(report.week_end)}</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {ai.resumen || `${report.sessions_done}/${report.sessions_planned} sesiones · ${report.actual_km} km`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-lg font-bold text-slate-900 dark:text-white">{report.actual_km ?? '—'}<span className="text-xs font-normal text-slate-400 ml-0.5">km</span></span>
          <span className="text-xs text-slate-400">{report.sessions_done}/{report.sessions_planned} sesiones</span>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Report detail ────────────────────────────────────────────────────────────

function ReportDetail({ report, onBack, athleteName }) {
  const ai = report.ai_analysis || {};
  const alertas = ai.alertas || [];
  const recomendaciones = ai.recomendaciones || [];
  const comparativa = ai.comparativa || {};
  const level = report.alert_level || 'ok';
  const cfg = ALERT_CONFIG[level] || ALERT_CONFIG.ok;

  const kmExec = comparativa.km_ejecutado ?? report.actual_km ?? 0;
  const kmPlan = comparativa.km_planificado ?? report.planned_km ?? 0;
  const sessExec = comparativa.sesiones_ejecutadas ?? report.sessions_done ?? 0;
  const sessPlan = comparativa.sesiones_planificadas ?? report.sessions_planned ?? 0;

  const bar = (val, max) => Math.min(100, max > 0 ? Math.round((val / max) * 100) : 0);

  return (
    <div className="space-y-4">
      {/* Back + Download */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          <FiChevronLeft className="w-4 h-4" /> Volver a informes
        </button>
        <button
          onClick={() => generateAIReportPDF({ report, athleteName })}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors"
        >
          <FiDownload className="w-3.5 h-3.5" /> Descargar PDF
        </button>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
          <span className="text-xs text-slate-400">{formatDate(report.week_start)} – {formatDate(report.week_end)}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            { label: 'Km realizados', value: `${report.actual_km ?? '—'} km` },
            { label: 'Sesiones', value: `${report.sessions_done}/${report.sessions_planned}` },
            { label: 'RPE medio', value: report.avg_rpe ? `${report.avg_rpe}/10` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI summary */}
      {ai.resumen && (
        <div className="flex gap-3 p-4 bg-slate-900 dark:bg-gray-950 rounded-2xl">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.2)' }}>
            <FiZap className="w-4 h-4 text-green-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-green-400">Hermes · IA</p>
            <p className="text-sm leading-relaxed text-slate-200">{ai.resumen}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alertas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
            <FiAlertTriangle className="w-3.5 h-3.5" /> Alertas
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

      {/* Comparativa */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
          <FiBarChart2 className="w-3.5 h-3.5" /> Ejecutado vs Planificado
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          {[
            { label: 'Kilómetros', exec: kmExec, plan: kmPlan, unit: 'km' },
            { label: 'Sesiones', exec: sessExec, plan: sessPlan, unit: '' },
          ].map(({ label, exec, plan, unit }) => (
            <div key={label}>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{label}</span>
                <span>{exec}{unit} / {plan}{unit}</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${bar(exec, plan) > 100 ? 'bg-amber-400' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(bar(exec, plan), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recomendaciones.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
            <FiCheckCircle className="w-3.5 h-3.5" /> Recomendaciones
          </p>
          <div className="space-y-2">
            {recomendaciones.map((r, i) => (
              <div key={i} className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyReports() {
  const { user, profile } = useAuth();
  const athleteName = profile?.athlete?.name || profile?.name || user?.user_metadata?.name || '';
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 8;

  useEffect(() => {
    const athleteId = profile?.id || user?.id;
    if (!athleteId) return;

    supabase
      .from('weekly_ai_reports')
      .select('id, week_start, week_end, alert_level, sessions_done, sessions_planned, actual_km, planned_km, avg_rpe, acwr, tsb, summary, ai_analysis, status')
      .eq('athlete_id', athleteId)
      .eq('status', 'completed')
      .order('week_start', { ascending: false })
      .then(({ data }) => {
        setReports(data || []);
        setLoading(false);
      });
  }, [profile?.id, user?.id]);

  const paginated = reports.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(reports.length / PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiLoader className="w-7 h-7 animate-spin text-green-600" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="px-4 lg:px-8 py-5 lg:py-8 flex flex-col min-h-[calc(100vh-120px)]">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FiZap className="w-5 h-5 text-green-500" /> Mis Informes IA
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Análisis semanal generado por tu entrenador</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 dark:text-slate-500">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
            <FiZap className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-500 dark:text-slate-400">Aún no tienes informes disponibles</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Los informes se generan automáticamente cada lunes</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-5 lg:py-8">
      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <ReportDetail report={selected} onBack={() => setSelected(null)} athleteName={athleteName} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <FiZap className="w-5 h-5 text-green-500" /> Mis Informes IA
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Análisis semanal generado por tu entrenador</p>
            </div>

            <div className="space-y-3">
              {paginated.map(r => (
                <ReportCard key={r.id} report={r} onClick={() => setSelected(r)} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-500">{page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
