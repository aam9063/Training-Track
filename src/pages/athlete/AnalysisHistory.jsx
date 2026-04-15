import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFileText,
  FiLoader,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiTrash2,
  FiAlertTriangle,
  FiZap,
} from 'react-icons/fi';
import {
  listAnalysisHistory,
  getAnalysisById,
  deleteAnalysis,
} from '../../services/metricAnalysisService';
import AiAnalysisPanel from '../../components/athlete/AiAnalysisPanel';
import { showError, showSuccess } from '../../lib/toast';

const PAGE_SIZE = 10;

const CHART_TYPE_FILTERS = [
  { value: null, label: 'Todos' },
  { value: 'general', label: 'General' },
  { value: 'tsb', label: 'TSB' },
  { value: 'intensity_distribution', label: 'Intensidad' },
  { value: 'time_in_zone', label: 'Zonas' },
  { value: 'weekly_load', label: 'Carga' },
  { value: 'best_efforts', label: 'Marcas' },
  { value: 'cardiac_drift', label: 'Desacople' },
  { value: 'shoes', label: 'Zapatillas' },
];

const CHART_TYPE_LABELS = {
  tsb: 'TSB',
  time_in_zone: 'Zonas',
  cardiac_drift: 'Desacople',
  best_efforts: 'Marcas',
  intensity_distribution: 'Intensidad',
  weekly_load: 'Carga',
  shoes: 'Zapatillas',
  general: 'General',
};

const CHART_TYPE_BADGE = 'bg-ath-accent-surface text-ath-accent-text';

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

function ConfirmDialog({ open, onCancel, onConfirm, loading }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full sm:max-w-md bg-ath-surface rounded-t-3xl sm:rounded-2xl border border-ath-border shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <FiAlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-ath-text-primary">
            Eliminar informe
          </h3>
          <p className="text-sm text-ath-text-secondary">
            ¿Seguro que quieres eliminar este informe? Esta acción no se puede deshacer.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-ath-inset text-ath-text-primary text-sm font-semibold hover:bg-ath-border transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              {loading && <FiLoader className="w-4 h-4 animate-spin" />}
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisHistory() {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chartType, setChartType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerReport, setViewerReport] = useState(null);
  const [viewerTitle, setViewerTitle] = useState('');

  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadPage = useCallback(async (nextPage, nextType) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listAnalysisHistory({
      page: nextPage,
      limit: PAGE_SIZE,
      chartType: nextType ?? undefined,
    });
    if (err) {
      setError(err.message);
      setReports([]);
      setTotal(0);
    } else {
      setReports(data?.reports ?? []);
      setTotal(data?.total ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage(page, chartType);
  }, [page, chartType, loadPage]);

  const handleFilter = (value) => {
    if (value === chartType) return;
    setChartType(value);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleOpen = async (report) => {
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerReport(null);
    setViewerTitle(report.title || 'Análisis IA');
    const { data, error: err } = await getAnalysisById(report.id);
    if (err) {
      showError(err.message || 'No se pudo cargar el informe');
      setViewerOpen(false);
      setViewerLoading(false);
      return;
    }
    setViewerReport(data?.report ?? { sections: [] });
    setViewerTitle(data?.title || report.title || 'Análisis IA');
    setViewerLoading(false);
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setViewerReport(null);
    setViewerTitle('');
  };

  const requestDelete = (id) => setConfirmId(id);
  const cancelDelete = () => setConfirmId(null);

  const confirmDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    const { error: err } = await deleteAnalysis(confirmId);
    setDeleting(false);
    if (err) {
      showError(err.message || 'No se pudo eliminar el informe');
      return;
    }
    showSuccess('Informe eliminado');
    setConfirmId(null);
    // Reload current page; step back if this was the last item on the page.
    const remainingOnPage = reports.length - 1;
    if (remainingOnPage <= 0 && page > 1) {
      setPage((p) => p - 1);
    } else {
      loadPage(page, chartType);
    }
  };

  return (
    <div className="px-4 lg:px-8 py-5 lg:py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ath-text-primary tracking-tight flex items-center gap-2">
          <FiFileText className="w-5 h-5 text-ath-accent" />
          Mis análisis IA
        </h1>
        <p className="text-sm text-ath-text-muted mt-1">
          Histórico de los análisis generados por Hermes desde tus métricas.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {CHART_TYPE_FILTERS.map((opt) => {
          const active = opt.value === chartType;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => handleFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                active
                  ? 'bg-ath-accent text-ath-on-accent'
                  : 'bg-ath-inset text-ath-text-secondary hover:bg-ath-border'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <FiLoader className="w-7 h-7 animate-spin text-ath-accent" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-300/60 bg-red-50 dark:bg-red-900/20 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-ath-inset flex items-center justify-center">
            <FiZap className="w-8 h-8 text-ath-text-muted" />
          </div>
          <div>
            <p className="text-base font-semibold text-ath-text-primary">
              Aún no tienes análisis guardados
            </p>
            <p className="text-sm text-ath-text-muted mt-1">
              Genera uno desde la sección de Métricas y aparecerá aquí.
            </p>
          </div>
          <Link
            to="/athlete/metrics"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-ath-accent text-ath-on-accent text-sm font-semibold hover:bg-ath-accent-hover transition-colors"
          >
            <FiZap className="w-4 h-4" />
            Ir a Mis Métricas
          </Link>
        </div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            <div className="space-y-3">
              {reports.map((r) => (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 bg-ath-surface rounded-2xl border border-ath-border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${CHART_TYPE_BADGE}`}
                      >
                        {CHART_TYPE_LABELS[r.chart_type] || r.chart_type}
                      </span>
                      <span className="text-xs text-ath-text-muted">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-ath-text-primary truncate">
                      {r.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpen(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ath-accent-surface text-ath-accent-text text-xs font-semibold hover:bg-ath-accent hover:text-ath-on-accent transition-colors"
                      aria-label="Ver informe"
                    >
                      <FiEye className="w-3.5 h-3.5" />
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(r.id)}
                      className="p-2 rounded-lg text-ath-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label="Eliminar informe"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-ath-border text-sm text-ath-text-secondary hover:bg-ath-inset transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-sm text-ath-text-muted">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-ath-border text-sm text-ath-text-secondary hover:bg-ath-inset transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {viewerOpen && (
        <AiAnalysisPanel
          open={viewerOpen}
          onClose={handleCloseViewer}
          chartType="general"
          data={{}}
          athleteContext={null}
          title={viewerTitle}
          mode="history"
          preloadedReport={viewerLoading ? null : viewerReport}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmId)}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  );
}
