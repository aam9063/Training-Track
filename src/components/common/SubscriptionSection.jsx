import { useState } from 'react';
import { FiCreditCard, FiExternalLink, FiCheck, FiAlertTriangle, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { createCheckout, createPortalSession } from '../../services/subscriptionService';
import { useAuth } from '../../contexts/AuthContext';
import useSubscription from '../../hooks/useSubscription';
import { PLAN_FEATURES } from '../../lib/planFeatures';
import { showError, showSuccess } from '../../lib/toast';

const COACH_PLANS = [
  { key: 'coach_free', label: 'Gratis', price: '0€', desc: 'Hasta 3 atletas', features: ['3 atletas', 'Planificación semanal', 'Strava', 'ACWR/TSB', 'Mensajería'] },
  { key: 'coach_pro', label: 'Pro', price: '14,99€/mes', desc: 'Hasta 20 atletas', features: ['20 atletas', 'Informes IA', 'Tests VAM/Conconi', 'Export CSV/PDF', 'Mesociclos'] },
  { key: 'coach_team', label: 'Team', price: '24,99€/mes', desc: 'Atletas ilimitados', features: ['Ilimitados', 'Todo de Pro', 'PDFs gym', 'Push notif.', 'Soporte dedicado'] },
];

const ATHLETE_PLANS = [
  { key: 'athlete_free', label: 'Gratis', price: '0€', desc: 'Funciones básicas', features: ['Métricas básicas', 'Strava', 'Competiciones'] },
  { key: 'athlete_premium', label: 'Premium', price: '4,99€/mes', desc: 'Acceso completo', features: ['Planes IA', 'Hermes IA', 'Métricas avanzadas', 'VAM test', 'Wellness'] },
];

export function SubscriptionSection() {
  const { profile } = useAuth();
  const {
    plan, planLabel, status, isExempt, isTrialing,
    trialDaysLeft, hasActiveSubscription, subscription,
  } = useSubscription();
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const isCoach = profile?.role === 'coach';
  const plans = isCoach ? COACH_PLANS : ATHLETE_PLANS;
  const currentPlanKey = plan;

  const handleChangePlan = async (newPlanKey) => {
    if (newPlanKey === currentPlanKey) return;

    // Free plan → cancel subscription via Stripe portal
    if (newPlanKey.endsWith('_free')) {
      setShowChangePlan(false);
      setLoading(true);
      const result = await createPortalSession();
      setLoading(false);
      if (result.url) {
        window.location.href = result.url;
      } else {
        showError(result.error || 'Error al procesar el cambio');
      }
      return;
    }

    // Upgrade to paid plan → Stripe Checkout
    setLoading(true);
    const result = await createCheckout(newPlanKey, 'month');
    setLoading(false);
    if (result.url) {
      window.location.href = result.url;
    } else {
      showError(result.error || 'Error al cambiar de plan');
    }
  };

  const handleCancel = async () => {
    // Open Stripe portal for cancellation (Stripe handles the cancel flow)
    setLoading(true);
    const result = await createPortalSession();
    setLoading(false);
    if (result.url) {
      window.location.href = result.url;
    } else {
      showError(result.error || 'Error al procesar la cancelación');
    }
  };

  const statusConfig = {
    active: { label: 'Activa', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    trialing: { label: 'Prueba gratuita', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30' },
    past_due: { label: 'Pago pendiente', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    canceled: { label: 'Cancelada', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    expired: { label: 'Expirada', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
    free: { label: 'Gratis', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
  };

  const currentStatus = statusConfig[status] || statusConfig.free;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-coach-surface rounded-xl shadow-sm border border-gray-200 dark:border-coach-border p-6 mb-4"
    >
      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-5">
        <FiCreditCard className="w-5 h-5 text-sky-500" />
        Mi Suscripción
      </h3>

      <div className="space-y-4">
        {/* Plan + Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Plan actual</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{planLabel}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${currentStatus.color} ${currentStatus.bg}`}>
            {isExempt ? 'VIP' : currentStatus.label}
          </span>
        </div>

        {/* Trial info */}
        {isTrialing && (
          <div className="flex items-center gap-2 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
            <FiCheck className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <p className="text-sm text-sky-700 dark:text-sky-300">
              Prueba gratuita · {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Exempt info */}
        {isExempt && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
            <FiCheck className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Cuenta con acceso completo sin restricciones
            </p>
          </div>
        )}

        {/* Past due warning */}
        {status === 'past_due' && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <FiAlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Tu último pago no se ha procesado. Actualiza tu método de pago.
            </p>
          </div>
        )}

        {/* Subscription details */}
        {hasActiveSubscription && subscription && (
          <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-coach-border">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Facturación</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {subscription.billing_interval === 'year' ? 'Anual' : 'Mensual'}
              </span>
            </div>
            {subscription.current_period_end && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Próxima factura</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {new Date(subscription.current_period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
            {subscription.cancel_at_period_end && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Tu suscripción se cancelará al final del período actual
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {!isExempt && (
          <div className="pt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setShowChangePlan(true)}
              className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-xl transition-colors text-sm"
            >
              Cambiar plan
            </button>

            {hasActiveSubscription && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-coach-elevated hover:bg-gray-200 dark:hover:bg-coach-inset text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors text-sm"
              >
                Cancelar plan
              </button>
            )}

            {hasActiveSubscription && (
              <button
                onClick={async () => {
                  setLoading(true);
                  const result = await createPortalSession();
                  setLoading(false);
                  if (result.url) window.location.href = result.url;
                  else showError('Error al abrir el portal');
                }}
                disabled={loading}
                className="w-full py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center justify-center gap-1"
              >
                <img src="/img/stripe-ar21.svg" alt="Stripe" className="h-5 w-auto" />
                Gestionar método de pago
              </button>
            )}
          </div>
        )}
      </div>

      {/* Change Plan Modal */}
      <AnimatePresence>
        {showChangePlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-coach-elevated rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cambiar plan</h3>
                  <button onClick={() => setShowChangePlan(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-coach-inset rounded-lg">
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-3">
                  {plans.map((p) => {
                    const isCurrent = p.key === currentPlanKey;
                    return (
                      <button
                        key={p.key}
                        onClick={() => !isCurrent && handleChangePlan(p.key)}
                        disabled={isCurrent || loading}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          isCurrent
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                            : 'border-gray-200 dark:border-coach-border hover:border-sky-300 dark:hover:border-sky-600'
                        } disabled:cursor-default`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white">{p.label}</span>
                            {isCurrent && (
                              <span className="ml-2 text-xs bg-sky-500 text-white px-2 py-0.5 rounded-full">Actual</span>
                            )}
                          </div>
                          <span className="text-lg font-bold text-sky-600 dark:text-sky-400">{p.price}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{p.desc}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {p.features.map((f) => (
                            <span key={f} className="text-[10px] bg-gray-100 dark:bg-coach-inset text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                              {f}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {loading && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">Redirigiendo a Stripe...</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-coach-elevated rounded-2xl shadow-xl max-w-sm w-full p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">¿Cancelar suscripción?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Tu plan se mantendrá activo hasta el final del período de facturación actual. Después pasarás al plan gratuito.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                Tus datos se conservarán, pero tendrás acceso limitado a las funcionalidades del plan gratuito.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-coach-inset text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors text-sm"
                >
                  Mantener plan
                </button>
                <button
                  onClick={() => { setShowCancelConfirm(false); handleCancel(); }}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  {loading ? 'Procesando...' : 'Cancelar plan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default SubscriptionSection;
