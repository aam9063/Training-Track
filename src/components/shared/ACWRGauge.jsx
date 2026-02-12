// ACWR Semicircular Gauge - Pure CSS + Tailwind
const ACWRGauge = ({ acwr }) => {
  const clampedAcwr = Math.min(Math.max(acwr, 0), 2.0);
  const rotation = -90 + (clampedAcwr / 2.0) * 180;

  const getZone = (value) => {
    if (value < 0.8) return { label: 'Bajo', textClass: 'text-blue-500' };
    if (value <= 1.3) return { label: 'Óptimo', textClass: 'text-green-500' };
    if (value <= 1.5) return { label: 'Alto', textClass: 'text-orange-500' };
    return { label: 'Peligro', textClass: 'text-red-500' };
  };

  const zone = getZone(acwr);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24 sm:w-56 sm:h-28 overflow-hidden">
        {/* Background arc with color zones */}
        <div
          className="absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full"
          style={{
            background: `conic-gradient(
              from 180deg,
              #3b82f6 0deg,
              #3b82f6 72deg,
              #22c55e 72deg,
              #22c55e 117deg,
              #f97316 117deg,
              #f97316 135deg,
              #ef4444 135deg,
              #ef4444 180deg,
              transparent 180deg
            )`,
          }}
        />
        {/* Inner cutout */}
        <div className="absolute top-5 left-5 sm:top-6 sm:left-6 w-[152px] h-[152px] sm:w-[176px] sm:h-[176px] rounded-full bg-white dark:bg-gray-800" />
        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 origin-bottom h-[76px] sm:h-[88px] w-0.5 bg-gray-800 dark:bg-white transition-transform duration-700"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-full bg-gray-800 dark:bg-white" />
      </div>
      <div className="mt-2 text-center">
        <p className={`text-2xl sm:text-3xl font-bold ${zone.textClass}`}>
          {acwr.toFixed(2)}
        </p>
        <p className={`text-sm font-medium ${zone.textClass}`}>
          {zone.label}
        </p>
      </div>
    </div>
  );
};

export const getACWRZone = (acwr) => {
  if (acwr < 0.8) return { label: 'Bajo', textClass: 'text-blue-500', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' };
  if (acwr <= 1.3) return { label: 'Óptimo', textClass: 'text-green-500', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' };
  if (acwr <= 1.5) return { label: 'Alto', textClass: 'text-orange-500', badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' };
  return { label: 'Peligro', textClass: 'text-red-500', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' };
};

export default ACWRGauge;
