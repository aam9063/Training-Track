/**
 * Segmented control for filtering chart data by date range.
 * Value is number of days (30 | 90 | 180 | 365 | null). null = "Todo".
 */
const OPTIONS = [
  { value: 30, label: '1m' },
  { value: 90, label: '3m' },
  { value: 180, label: '6m' },
  { value: 365, label: '1y' },
  { value: null, label: 'Todo' },
];

export default function DateRangeSelector({ value = null, onChange }) {
  return (
    <div
      role="group"
      aria-label="Rango de fechas"
      className="inline-flex items-center gap-1 p-1 rounded-xl bg-ath-inset border border-ath-border"
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange?.(opt.value)}
            aria-pressed={isActive}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              isActive
                ? 'bg-ath-accent text-ath-on-accent'
                : 'text-ath-text-secondary hover:bg-ath-border'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
