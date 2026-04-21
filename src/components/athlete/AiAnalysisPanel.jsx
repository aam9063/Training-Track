import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  FiX,
  FiZap,
  FiLoader,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiLock,
  FiBookmark,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { analyzeMetricChart } from '../../services/metricAnalysisService';
import {
  STATUS_BADGE_CLASSES,
  STATE_ICON_CLASSES,
  OVERLAY_CLASSES,
} from '../../lib/themeClasses';
import { ReportRenderer } from './reports/ReportRenderer';

const emptyState = () => ({
  loading: false,
  report: null,
  reportId: null,
  cached: false,
  remaining: null,
  errorCode: null,
  errorMessage: null,
});

const loadingState = () => ({
  loading: true,
  report: null,
  reportId: null,
  cached: false,
  remaining: null,
  errorCode: null,
  errorMessage: null,
});

/**
 * Right-side slide-over panel that runs an AI analysis for a given chart payload.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - chartType: string
 *  - data: object
 *  - athleteContext: { nivel, objetivo, vam } | null
 *  - title: string
 *  - onSuccess: (result) => void  (optional, to refresh quota externally)
 *  - mode: 'live' | 'history'  (default 'live')
 *  - preloadedReport: object | null  (when set, no API call — used by history view)
 */
export function AiAnalysisPanel({
  open,
  onClose,
  chartType,
  data,
  athleteContext,
  title,
  onSuccess,
  mode = 'live',
  preloadedReport = null,
}) {
  const isHistory = mode === 'history';
  const [state, setState] = useState(() =>
    preloadedReport
      ? {
          loading: false,
          report: preloadedReport,
          reportId: null,
          cached: true,
          remaining: null,
          errorCode: null,
          errorMessage: null,
        }
      : loadingState()
  );

  const requestedRef = useRef(false);
  const mountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);

  const closeButtonRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runAnalysis = useCallback(async () => {
    setState(loadingState());
    const { data: result, error } = await analyzeMetricChart({
      chartType,
      data,
      athleteContext,
    });
    if (!mountedRef.current) return;

    if (error) {
      setState({
        ...emptyState(),
        errorCode: error.code,
        errorMessage: error.message,
      });
      return;
    }

    setState({
      loading: false,
      report: result?.report ?? { sections: [] },
      reportId: result?.report_id ?? null,
      cached: Boolean(result?.cached),
      remaining: result?.remaining ?? null,
      errorCode: null,
      errorMessage: null,
    });
    if (onSuccessRef.current) onSuccessRef.current(result);
  }, [chartType, data, athleteContext]);

  // Run analysis on open transition (live mode only).
  useEffect(() => {
    if (!open) {
      requestedRef.current = false;
      return;
    }
    if (isHistory) {
      requestedRef.current = true;
      return;
    }
    if (requestedRef.current) return;
    requestedRef.current = true;
    runAnalysis();
  }, [open, isHistory, runAnalysis]);

  // History mode: sync preloadedReport prop changes (parent fetches async).
  useEffect(() => {
    if (!isHistory) return;
    if (preloadedReport) {
      setState({
        loading: false,
        report: preloadedReport,
        reportId: null,
        cached: true,
        remaining: null,
        errorCode: null,
        errorMessage: null,
      });
    } else {
      setState(loadingState());
    }
  }, [isHistory, preloadedReport]);

  // ESC key listener — only while open and not loading.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !state.loading) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, state.loading, onClose]);

  // Focus close button on open.
  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  const handleRetry = useCallback(() => {
    runAnalysis();
  }, [runAnalysis]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !state.loading) {
      onClose();
    }
  };

  const renderBody = () => {
    if (state.loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <FiLoader className="w-10 h-10 animate-spin text-ath-accent" />
          <p className="text-ath-text-secondary text-sm">Analizando con IA...</p>
        </div>
      );
    }

    if (state.errorCode === 'quota_exhausted') {
      return (
        <div className="flex flex-col items-center text-center py-10 px-4 gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${STATE_ICON_CLASSES.warning.bg}`}>
            <FiLock className={`w-7 h-7 ${STATE_ICON_CLASSES.warning.fg}`} />
          </div>
          <h3 className="text-lg font-bold text-ath-text-primary">
            Has alcanzado tu cuota mensual
          </h3>
          <p className="text-sm text-ath-text-secondary max-w-sm">
            Actualiza a Premium para obtener análisis ilimitados con IA y desbloquear todas las funciones avanzadas.
          </p>
          <Link
            to="/pricing"
            onClick={onClose}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ath-accent text-ath-on-accent text-sm font-semibold hover:bg-ath-accent-hover transition-colors"
          >
            <FiZap className="w-4 h-4" />
            Descubrir Premium
          </Link>
        </div>
      );
    }

    if (state.errorCode) {
      let msg = state.errorMessage || 'No se pudo generar el análisis.';
      if (state.errorCode === 'ai_timeout') {
        msg = 'Tiempo de espera agotado, vuelve a intentar en unos segundos.';
      } else if (state.errorCode === 'invalid_chart_type') {
        msg = 'Tipo de gráfico no soportado.';
      } else if (state.errorCode === 'ai_error') {
        msg = 'El análisis falló. Inténtalo de nuevo.';
      }
      return (
        <div className="flex flex-col items-center text-center py-10 px-4 gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${STATE_ICON_CLASSES.error.bg}`}>
            <FiAlertTriangle className={`w-7 h-7 ${STATE_ICON_CLASSES.error.fg}`} />
          </div>
          <p className="text-sm text-ath-text-secondary max-w-sm">{msg}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ath-inset text-ath-text-primary text-sm font-semibold hover:bg-ath-border transition-colors"
          >
            <FiRefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 py-2">
        <div className="flex items-center flex-wrap gap-2">
          {isHistory ? (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE_CLASSES.history}`}>
              <FiBookmark className="w-3 h-3" />
              Informe guardado
            </span>
          ) : state.cached ? (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE_CLASSES.cached}`}>
              <FiCheckCircle className="w-3 h-3" />
              Resultado en caché
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE_CLASSES.generated}`}>
              <FiZap className="w-3 h-3" />
              Generado ahora
            </span>
          )}
          {!isHistory && state.remaining !== null && state.remaining !== undefined && state.remaining >= 0 && (
            <span className="text-xs text-ath-text-muted">
              {state.remaining} análisis restantes este mes
            </span>
          )}
          {!isHistory && state.remaining === -1 && (
            <span className={`text-xs ${STATUS_BADGE_CLASSES.unlimited}`}>
              Análisis ilimitados
            </span>
          )}
        </div>
        <div className="text-sm sm:text-base text-ath-text-primary leading-relaxed">
          <ReportRenderer report={state.report} />
        </div>
      </div>
    );
  };

  const panelMotion = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: { type: 'spring', damping: 28, stiffness: 300 },
      };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed top-[62px] bottom-[88px] left-0 right-0 lg:inset-0 z-40 ${OVERLAY_CLASSES.backdrop}`}
            onClick={handleBackdropClick}
            aria-hidden="true"
          />
          <motion.aside
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={panelMotion.transition}
            className="fixed right-0 top-[62px] bottom-[88px] lg:top-0 lg:bottom-0 z-50 w-full max-w-md lg:max-w-xl flex flex-col bg-ath-surface shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-panel-title"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-ath-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-ath-accent flex items-center justify-center flex-shrink-0">
                  <FiZap className="w-4 h-4 text-ath-on-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-ath-accent-text font-semibold leading-none">
                    Hermes
                  </p>
                  <p
                    id="ai-panel-title"
                    className="text-sm text-ath-text-primary font-medium mt-0.5 truncate"
                  >
                    {title || 'Análisis con IA'}
                  </p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Cerrar panel"
                className="p-1.5 rounded-lg text-ath-text-muted hover:text-ath-text-primary hover:bg-ath-inset transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {renderBody()}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
