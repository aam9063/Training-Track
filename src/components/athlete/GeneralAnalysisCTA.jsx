import { useState } from 'react';
import { FiZap, FiLoader } from 'react-icons/fi';
import {
  getBestEffortsEvolution,
  getIntensityDistribution,
  getShoes,
  getTimeInZoneAggregate,
  getWeeklyLoadSeries,
} from '../../services/metricsAnalyticsService';
import useAiAnalysisQuota from '../../hooks/useAiAnalysisQuota';
import { showError } from '../../lib/toast';
import AiAnalysisPanel from './AiAnalysisPanel';

/**
 * Big CTA card that aggregates several metrics and opens a "general" AI analysis.
 *
 * Props:
 *  - athleteId: uuid
 *  - athleteContext: { nivel, objetivo, vam } | null
 */
export default function GeneralAnalysisCTA({ athleteId, athleteContext }) {
  const quota = useAiAnalysisQuota();
  const [preparing, setPreparing] = useState(false);
  const [payload, setPayload] = useState(null);
  const [open, setOpen] = useState(false);

  const noQuota = !quota.loading && !quota.canUse;

  const summarizeBestEfforts = (rows) => {
    const byKey = new Map();
    rows.forEach((r) => {
      const cur = byKey.get(r.distance_key);
      if (!cur || r.elapsed_time_sec < cur.best_time_sec) {
        byKey.set(r.distance_key, {
          distance: r.distance_key,
          best_time_sec: r.elapsed_time_sec,
          best_time_date: r.activity_date,
        });
      }
    });
    return Array.from(byKey.values());
  };

  const handleClick = async () => {
    if (!athleteId || preparing) return;
    if (noQuota) {
      setOpen(true); // AiAnalysisPanel will render the quota_exhausted branch via service call
      return;
    }
    setPreparing(true);
    try {
      const [best, tiz, intensity, shoes, weeklyLoad] = await Promise.all([
        getBestEffortsEvolution(athleteId, 50),
        getTimeInZoneAggregate(athleteId, 4),
        getIntensityDistribution(athleteId, 4),
        getShoes(athleteId),
        getWeeklyLoadSeries(athleteId, 12),
      ]);

      const data = {
        time_in_zone: tiz.data?.hasZones
          ? { zones: tiz.data.zones, weeks: 4 }
          : null,
        intensity: intensity.data?.hasZones
          ? {
              z12_pct: intensity.data.z12_pct,
              z3_pct: intensity.data.z3_pct,
              z45_pct: intensity.data.z45_pct,
              label: intensity.data.label,
              weeks: 4,
            }
          : null,
        shoes: {
          shoes: (shoes.data || []).slice(0, 6).map((s) => ({
            name: s.name,
            distance_km: s.distance_km,
            active: s.active,
          })),
        },
        best_efforts_summary: {
          personal_bests: summarizeBestEfforts(best.data || []),
        },
        weekly_load: { series: weeklyLoad.data || [] },
      };

      setPayload(data);
      setOpen(true);
    } catch (err) {
      showError(err?.message || 'No se pudieron recopilar las métricas');
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ath-border bg-gradient-to-br from-ath-accent-surface via-ath-surface to-ath-surface p-5 sm:p-6">
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-ath-accent/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-ath-accent text-ath-on-accent flex items-center justify-center shrink-0 shadow-lg">
          <FiZap className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary">
            Análisis general de tu entrenamiento
          </h3>
          <p className="text-xs sm:text-sm text-ath-text-secondary mt-1">
            Obtén una evaluación holística con IA de todas tus métricas: zonas, intensidad, carga, marcas y material.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={preparing || quota.loading}
          className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-ath-accent text-ath-on-accent text-sm font-semibold hover:bg-ath-accent-hover transition-colors disabled:opacity-60 shrink-0"
        >
          {preparing ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin" />
              Preparando...
            </>
          ) : (
            <>
              <FiZap className="w-4 h-4" />
              Generar análisis general
            </>
          )}
        </button>
      </div>

      {open && (
        <AiAnalysisPanel
          open={open}
          onClose={() => {
            setOpen(false);
            quota.refetch();
          }}
          chartType="general"
          data={payload || {}}
          athleteContext={athleteContext}
          title="Análisis general"
          onSuccess={() => quota.refetch()}
        />
      )}
    </div>
  );
}
