import { HiCheck, HiSparkles } from 'react-icons/hi';
import { PLAN_FEATURES, FEATURE_LABELS } from '../../lib/planFeatures';

// Visual plan metadata (prices + tagline). Feature list comes from PLAN_FEATURES.
const PLAN_META = {
  coach_free: {
    label: 'Gratis',
    tagline: 'Para empezar sin compromiso',
    monthlyPrice: 0,
    yearlyPrice: 0,
    featured: false,
  },
  coach_pro: {
    label: 'Pro',
    tagline: 'Para entrenadores profesionales',
    monthlyPrice: 14.99,
    yearlyPrice: 149,
    featured: true,
  },
  coach_team: {
    label: 'Team',
    tagline: 'Para clubes y academias',
    monthlyPrice: 24.99,
    yearlyPrice: 249,
    featured: false,
  },
  athlete_free: {
    label: 'Gratis',
    tagline: 'Empieza a entrenar con IA',
    monthlyPrice: 0,
    yearlyPrice: 0,
    featured: false,
  },
  athlete_premium: {
    label: 'Premium',
    tagline: 'Entrenamiento inteligente completo',
    monthlyPrice: 5,
    yearlyPrice: 48,
    featured: true,
  },
};

const COACH_PLAN_KEYS = ['coach_free', 'coach_pro', 'coach_team'];
const ATHLETE_PLAN_KEYS = ['athlete_free', 'athlete_premium'];

const PLAN_ORDER = {
  coach_free: 0,
  coach_pro: 1,
  coach_team: 2,
  athlete_free: 0,
  athlete_premium: 1,
};

/**
 * Return the top N enabled features for a plan key.
 */
const getTopFeatures = (planKey, limit = 4) => {
  const plan = PLAN_FEATURES[planKey];
  if (!plan?.features) return [];
  const enabled = Object.entries(plan.features)
    .filter(([, value]) => value === true)
    .map(([key]) => FEATURE_LABELS[key])
    .filter(Boolean);
  return enabled.slice(0, limit);
};

/**
 * Plan selection wizard step. Pure presentation — all state lives in parent.
 *
 * @param {Object} props
 * @param {'coach'|'athlete'} props.role
 * @param {string|null} props.value - current selected plan_key
 * @param {(planKey: string) => void} props.onChange
 * @param {'month'|'year'} props.interval
 * @param {(interval: 'month'|'year') => void} props.onIntervalChange
 * @param {() => void} [props.onNext] - called on Siguiente button click
 * @param {string} [props.nextLabel='Siguiente']
 * @param {boolean} [props.nextLoading=false]
 */
export default function PlanSelectionStep({
  role,
  value,
  onChange,
  interval,
  onIntervalChange,
  onNext,
  nextLabel = 'Siguiente',
  nextLoading = false,
}) {
  const planKeys = role === 'coach' ? COACH_PLAN_KEYS : ATHLETE_PLAN_KEYS;
  const sortedKeys = [...planKeys].sort(
    (a, b) => (PLAN_ORDER[a] ?? 0) - (PLAN_ORDER[b] ?? 0),
  );

  const handleKeyDown = (event, planKey) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onChange(planKey);
    }
  };

  const hasSelection = Boolean(value);

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Elige tu plan
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Todos los planes incluyen 14 días de prueba gratis
        </p>
      </div>

      {/* Billing interval toggle */}
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label="Intervalo de facturación"
          className="inline-flex items-center gap-1 bg-gray-100 dark:bg-[#141414] rounded-full p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={interval === 'month'}
            onClick={() => onIntervalChange('month')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              interval === 'month'
                ? 'bg-white dark:bg-[#242424] text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Mensual
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={interval === 'year'}
            onClick={() => onIntervalChange('year')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              interval === 'year'
                ? 'bg-white dark:bg-[#242424] text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <span>Anual</span>
            <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full">
              Ahorra
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div
        role="radiogroup"
        aria-label="Planes disponibles"
        aria-describedby={!hasSelection ? 'plan-selection-error' : undefined}
        className={`grid gap-4 ${
          sortedKeys.length >= 3
            ? 'sm:grid-cols-3'
            : 'sm:grid-cols-2'
        }`}
      >
        {sortedKeys.map((planKey) => {
          const meta = PLAN_META[planKey];
          if (!meta) return null;
          const price = interval === 'month' ? meta.monthlyPrice : meta.yearlyPrice;
          const isSelected = value === planKey;
          const topFeatures = getTopFeatures(planKey, 4);

          return (
            <div
              key={planKey}
              role="radio"
              tabIndex={0}
              aria-checked={isSelected}
              onClick={() => onChange(planKey)}
              onKeyDown={(e) => handleKeyDown(e, planKey)}
              className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all bg-white dark:bg-[#141414] focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-[#0A0A0A] ${
                isSelected
                  ? 'border-sky-500 dark:border-sky-400 shadow-lg'
                  : 'border-gray-200 dark:border-[#2A2A2A] hover:border-sky-300 dark:hover:border-sky-600'
              }`}
            >
              {meta.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-sky-600 text-white text-[11px] font-semibold px-3 py-1 rounded-full">
                    <HiSparkles className="w-3 h-3" />
                    Recomendado
                  </span>
                </div>
              )}

              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center">
                  <HiCheck className="w-4 h-4" aria-hidden="true" />
                </div>
              )}

              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {meta.label}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {meta.tagline}
                </p>
              </div>

              <div className="text-center mb-4">
                <div className="flex items-end justify-center">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {price}€
                  </span>
                  {price > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 mb-1">
                      /{interval === 'month' ? 'mes' : 'año'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                  14 días de prueba gratis incluidos
                </p>
              </div>

              <ul className="space-y-2">
                {topFeatures.map((label) => (
                  <li
                    key={label}
                    className="flex items-start text-xs text-gray-700 dark:text-gray-300"
                  >
                    <HiCheck className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Inline error (announced via aria-describedby above) */}
      {!hasSelection && (
        <p
          id="plan-selection-error"
          role="alert"
          className="text-sm text-center text-gray-500 dark:text-gray-400"
        >
          Selecciona un plan para continuar
        </p>
      )}

      {/* Next button (optional — used by wizard step) */}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={!hasSelection || nextLoading}
          aria-describedby={!hasSelection ? 'plan-selection-error' : undefined}
          className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nextLoading ? 'Procesando...' : nextLabel}
        </button>
      )}
    </div>
  );
}
