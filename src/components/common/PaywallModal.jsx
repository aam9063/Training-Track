import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiCheck, FiZap } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useSubscription from '../../hooks/useSubscription';

/**
 * Full-screen paywall overlay shown when trial has expired and user has no subscription.
 * Redirects to pricing page for plan selection.
 */
export function PaywallModal() {
  const { needsPaywall, isExempt } = useSubscription();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const pricingUrl = profile?.role === 'coach' ? '/pricing?audience=coach' : '/pricing?audience=athlete';

  if (!needsPaywall || isExempt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-coach-elevated rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
            <FiLock className="w-7 h-7 text-sky-600 dark:text-sky-400" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Tu prueba gratuita ha terminado
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            Para seguir usando TrainingTrack, elige el plan que mejor se adapte a ti.
            Puedes empezar con el plan gratuito o desbloquear todas las funcionalidades.
          </p>

          <div className="space-y-3 text-left mb-6">
            {['Planificación semanal', 'Integración con Strava', 'Métricas de rendimiento'].map(feature => (
              <div key={feature} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <FiCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400 font-medium">
              <FiZap className="w-4 h-4 flex-shrink-0" />
              <span>Y mucho más con los planes de pago</span>
            </div>
          </div>

          <button
            onClick={() => navigate(pricingUrl)}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors"
          >
            Ver planes y precios
          </button>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Plan gratuito disponible — sin tarjeta de crédito
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PaywallModal;
