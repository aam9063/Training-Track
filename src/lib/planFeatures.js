/**
 * Subscription plan features configuration.
 * Used by useSubscription() hook to gate features based on plan.
 */

export const PLAN_FEATURES = {
  // Coach plans
  coach_free: {
    label: 'Gratis',
    maxAthletes: 3,
    features: {
      weeklyPlanning: true,
      stravaIntegration: true,
      acwrTsb: true,
      messaging: true,
      aiReports: false,
      stravaWebhook: false,
      loadControl: false,
      vamConconiTests: false,
      csvPdfExport: false,
      mesocyclePlanner: false,
      prioritySupport: false,
      gymFiles: false,
      pushNotifications: false,
      racePredictions: false,
      competitionsCalendar: false,
      fullDataExport: false,
      dedicatedSupport: false,
    },
  },
  coach_pro: {
    label: 'Pro',
    maxAthletes: 20,
    features: {
      weeklyPlanning: true,
      stravaIntegration: true,
      acwrTsb: true,
      messaging: true,
      aiReports: true,
      stravaWebhook: true,
      loadControl: true,
      vamConconiTests: true,
      csvPdfExport: true,
      mesocyclePlanner: true,
      prioritySupport: true,
      gymFiles: false,
      pushNotifications: false,
      racePredictions: false,
      competitionsCalendar: false,
      fullDataExport: false,
      dedicatedSupport: false,
    },
  },
  coach_team: {
    label: 'Team',
    maxAthletes: Infinity,
    features: {
      weeklyPlanning: true,
      stravaIntegration: true,
      acwrTsb: true,
      messaging: true,
      aiReports: true,
      stravaWebhook: true,
      loadControl: true,
      vamConconiTests: true,
      csvPdfExport: true,
      mesocyclePlanner: true,
      prioritySupport: true,
      gymFiles: true,
      pushNotifications: true,
      racePredictions: true,
      competitionsCalendar: true,
      fullDataExport: true,
      dedicatedSupport: true,
    },
  },

  // Athlete plans
  athlete_free: {
    label: 'Gratis',
    features: {
      viewTraining: true,
      stravaSync: true,
      basicMetrics: true,
      aiPlans: false,
      hermesChat: false,
      advancedMetrics: false,
      competitions: false,
      vamTest: false,
      wellness: false,
    },
  },
  athlete_premium: {
    label: 'Premium',
    features: {
      viewTraining: true,
      stravaSync: true,
      basicMetrics: true,
      aiPlans: true,
      hermesChat: true,
      advancedMetrics: true,
      competitions: true,
      vamTest: true,
      wellness: true,
    },
  },
};

/**
 * Feature labels in Spanish for UI display.
 */
export const FEATURE_LABELS = {
  // Coach
  weeklyPlanning: 'Planificación semanal',
  stravaIntegration: 'Integración con Strava',
  acwrTsb: 'ACWR y TSB automático',
  messaging: 'Mensajería con atletas',
  aiReports: 'Informes IA semanales',
  stravaWebhook: 'Sincronización Strava (webhook)',
  loadControl: 'Control de carga',
  vamConconiTests: 'Tests fisiológicos (VAM, Conconi)',
  csvPdfExport: 'Exportación de datos (CSV/PDF)',
  mesocyclePlanner: 'Planificador por mesociclos',
  prioritySupport: 'Soporte prioritario',
  gymFiles: 'Archivos de fuerza (PDFs gym)',
  pushNotifications: 'Notificaciones push a atletas',
  racePredictions: 'Predicción de tiempos de carrera',
  competitionsCalendar: 'Competiciones y calendario',
  fullDataExport: 'Exportación completa de datos',
  dedicatedSupport: 'Soporte dedicado',
  // Athlete
  viewTraining: 'Ver entrenamientos',
  stravaSync: 'Sincronización Strava',
  basicMetrics: 'Métricas básicas',
  aiPlans: 'Planes de entrenamiento con IA',
  hermesChat: 'Hermes IA (entrenador virtual)',
  advancedMetrics: 'Métricas avanzadas',
  competitions: 'Competiciones',
  vamTest: 'Test VAM',
  wellness: 'Wellness y diario semanal',
};

/**
 * Check if a plan has access to a specific feature.
 */
export const canAccessFeature = (planKey, feature) => {
  const plan = PLAN_FEATURES[planKey];
  if (!plan) return false;
  return plan.features?.[feature] === true;
};

/**
 * Get the max plan key for a role (used during trial — full access).
 */
export const getMaxPlanForRole = (role) => {
  if (role === 'coach') return 'coach_team';
  return 'athlete_premium';
};

/**
 * Get the free plan key for a role.
 */
export const getFreePlanForRole = (role) => {
  if (role === 'coach') return 'coach_free';
  return 'athlete_free';
};
