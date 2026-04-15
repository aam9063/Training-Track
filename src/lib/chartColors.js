/**
 * Centralised chart colour tokens.
 *
 * Chart.js cannot resolve Tailwind class names, so these hex/rgba values live
 * in a single module that can be imported from any chart config. This keeps
 * colours out of component files (hard-coded inline colours are flagged by
 * the GGA pre-commit hook) while still giving us the legitimate fixed values
 * that the charting library needs.
 */

export const CHART_COLORS = {
  fitness: '#3B82F6',
  fitnessSolid: 'rgba(59, 130, 246, 0.8)',
  fitnessBar: 'rgba(59, 130, 246, 0.7)',
  fitnessFill: 'rgba(59, 130, 246, 0.1)',
  fatigue: '#EF4444',
  fatigueFill: 'rgba(239, 68, 68, 0.1)',
  fatigueBar: 'rgba(239, 68, 68, 0.7)',
  form: '#10B981',
  formFill: 'rgba(16, 185, 129, 0.15)',
  formFillSoft: 'rgba(16, 185, 129, 0.1)',
  warningBar: 'rgba(249, 115, 22, 0.7)',
  successBar: 'rgba(34, 197, 94, 0.7)',
  cycling: 'rgb(245, 158, 11)',
  cyclingFill: 'rgba(245, 158, 11, 0.1)',
  cyclingBar: 'rgba(245, 158, 11, 0.7)',
  swimming: 'rgb(14, 165, 233)',
  swimmingFill: 'rgba(14, 165, 233, 0.1)',
  swimmingBar: 'rgba(14, 165, 233, 0.7)',
  muted: 'rgba(156, 163, 175, 0.5)',
  mutedLight: 'rgba(156, 163, 175, 0.3)',
  mutedDashed: 'rgba(156, 163, 175, 0.6)',
  grid: 'rgba(156, 163, 175, 0.1)',
  axisTick: 'rgb(156, 163, 175)',
  gymSurface: 'rgba(17, 24, 39, 0.8)',
  gym: '#6366F1',
  gymFill: 'rgba(99, 102, 241, 0.4)',
  gymBar: 'rgba(99, 102, 241, 0.7)',
};

/**
 * Shared tooltip / legend palette used by Chart.js plugin configs.
 */
export const CHART_TOOLTIP = {
  bg: 'rgba(17, 24, 39, 0.95)',
  title: '#F9FAFB',
  body: '#D1D5DB',
  legend: '#9CA3AF',
};

/**
 * Five-zone training palette (Z1..Z5).
 */
export const TRAINING_ZONE_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
];

/**
 * Tailwind background classes paired with TRAINING_ZONE_COLORS (same order).
 * Used for small legend dots so the markup can stay in pure Tailwind.
 */
export const TRAINING_ZONE_BG_CLASSES = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-violet-500',
];

/**
 * Colours per Strava activity type. Kept as hex so they can be fed directly
 * to Chart.js datasets.
 */
export const ACTIVITY_COLORS = {
  Run: '#3b82f6',
  TrailRun: '#22c55e',
  VirtualRun: '#06b6d4',
  Walk: '#8b5cf6',
  Hike: '#10b981',
  Ride: '#22c55e',
  VirtualRide: '#eab308',
  Swim: '#06b6d4',
  WeightTraining: '#a855f7',
  Workout: '#f59e0b',
  CrossFit: '#ef4444',
  Yoga: '#ec4899',
  Elliptical: '#64748b',
  other: '#6b7280',
};

/**
 * Tailwind equivalents of ACTIVITY_COLORS for DOM elements (legend dots, etc.).
 * When a type isn't listed, fall back to `other`.
 */
export const ACTIVITY_BG_CLASSES = {
  Run: 'bg-blue-500',
  TrailRun: 'bg-green-500',
  VirtualRun: 'bg-cyan-500',
  Walk: 'bg-violet-500',
  Hike: 'bg-emerald-500',
  Ride: 'bg-green-500',
  VirtualRide: 'bg-yellow-500',
  Swim: 'bg-cyan-500',
  WeightTraining: 'bg-purple-500',
  Workout: 'bg-amber-500',
  CrossFit: 'bg-red-500',
  Yoga: 'bg-pink-500',
  Elliptical: 'bg-slate-500',
  other: 'bg-slate-500',
};
