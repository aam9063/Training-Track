// Centralized semantic theme class tokens. Using a single source of truth
// avoids hardcoded color classes scattered across components and keeps
// dark-mode variants consistent.

export const PRIORITY_CLASSES = {
  high: {
    wrapper:
      'border-red-300/60 bg-red-50 dark:bg-red-900/20 dark:border-red-500/30',
    label: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  medium: {
    wrapper:
      'border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/30',
    label: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  low: {
    wrapper: 'border-ath-border bg-ath-inset dark:bg-slate-900/40',
    label: 'text-ath-text-primary',
    badge: 'bg-ath-inset text-ath-text-secondary',
  },
};

export const DELTA_CLASSES = {
  positive:
    'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300',
  negative: 'text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300',
  neutral: 'text-ath-text-muted bg-ath-inset',
};

export const STATUS_BADGE_CLASSES = {
  history:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  cached:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  generated:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  unlimited: 'text-emerald-600 dark:text-emerald-400',
};

export const STATE_ICON_CLASSES = {
  warning: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    fg: 'text-amber-500',
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    fg: 'text-red-500',
  },
};

export const OVERLAY_CLASSES = {
  backdrop: 'bg-black/40 backdrop-blur-sm',
};

// Destructive action button (delete, confirm-destroy, etc.). Centralises the
// red CTA styling so pages don't reach for raw bg-red-500 utilities.
export const DANGER_BUTTON_CLASSES =
  'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500';

// Gradients for the top-level stat cards in the athlete metrics page.
// Keyed by the concept (not a Tailwind color), so the visual language stays
// centralised even if palette decisions change later.
export const STAT_CARD_GRADIENTS = {
  running: 'from-orange-500 to-orange-600',
  time: 'from-blue-500 to-blue-600',
  pace: 'from-green-500 to-green-600',
  heartRate: 'from-red-500 to-red-600',
  activities: 'from-purple-500 to-purple-600',
  elevation: 'from-yellow-500 to-amber-600',
};

// Sport-specific section styling (summary chips for cycling / swimming / gym).
export const SPORT_SECTION_CLASSES = {
  cycling: {
    chipBg: 'bg-yellow-50 dark:bg-yellow-900/20',
    chipText: 'text-yellow-700 dark:text-yellow-300',
    headerIcon: 'text-yellow-500',
  },
  swimming: {
    chipBg: 'bg-cyan-50 dark:bg-cyan-900/20',
    chipText: 'text-cyan-700 dark:text-cyan-300',
    headerIcon: 'text-cyan-500',
  },
  gym: {
    chipBg: 'bg-indigo-50 dark:bg-indigo-900/20',
    chipText: 'text-indigo-700 dark:text-indigo-300',
    headerIcon: 'text-indigo-500',
  },
};

// Race predictor badge (VDOT chip + info dot in the predictor card).
export const RACE_PREDICTOR_CLASSES = {
  badge:
    'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  infoDot:
    'bg-violet-100 dark:bg-violet-900/40 text-violet-500',
};

// "Connect Strava" prompt shown when the athlete has no Strava linked.
export const STRAVA_PROMPT_CLASSES = {
  iconBg: 'bg-orange-100 dark:bg-orange-900/30',
  iconFg: 'text-orange-500',
  button: 'bg-orange-500 hover:bg-orange-600 text-white',
};

// ACWR alert banner (one palette per ACWR severity).
export const ACWR_ALERT_CLASSES = {
  low: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
  },
  optimal: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
  },
};
