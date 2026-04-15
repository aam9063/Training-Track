import { useEffect, useState } from 'react';
import { FiActivity, FiLoader, FiZap } from 'react-icons/fi';
import { getRecentActivitiesForSelector } from '../../../services/metricsAnalyticsService';
import { showError } from '../../../lib/toast';

const TYPE_LABELS = {
  Run: 'Carrera',
  TrailRun: 'Trail',
  VirtualRun: 'Carrera Virtual',
  Walk: 'Caminata',
  Hike: 'Senderismo',
  Ride: 'Ciclismo',
  VirtualRide: 'Ciclismo Virtual',
  Swim: 'Natación',
};

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatDateShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
};

export default function ActivitySelector({ athleteId, value, onChange }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setLoading(true);
      const { data, error } = await getRecentActivitiesForSelector(athleteId, 30);
      if (cancelled) return;
      if (error) {
        showError(error.message || 'No se pudieron cargar las actividades');
        setActivities([]);
      } else {
        setActivities(data || []);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const selected = activities.find((a) => a.id === value) || null;

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FiActivity className="w-5 h-5 text-ath-accent shrink-0" />
        <h3 className="text-base font-bold text-ath-text-primary">Selecciona actividad</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-ath-text-muted">
          <FiLoader className="w-4 h-4 animate-spin" />
          Cargando actividades...
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-ath-text-muted">
          Aún no hay actividades recientes para analizar.
        </p>
      ) : (
        <>
          <select
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value || null)}
            className="w-full rounded-lg border border-ath-border bg-ath-inset text-ath-text-primary text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ath-accent"
          >
            <option value="">— Elige una actividad —</option>
            {activities.map((a) => {
              const km = a.distance ? (Number(a.distance) / 1000).toFixed(1) : '0';
              const typeLabel = TYPE_LABELS[a.type] || a.type || 'Actividad';
              const date = formatDateShort(a.start_date_local);
              return (
                <option key={a.id} value={a.id}>
                  {`${typeLabel} — ${date}, ${km} km${a.has_streams ? '' : ' (sin streams)'}`}
                </option>
              );
            })}
          </select>

          {selected && !selected.has_streams && (
            <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400">
              <FiZap className="w-3 h-3" />
              Sin streams — se intentarán cargar al seleccionar.
            </div>
          )}
        </>
      )}
    </div>
  );
}
