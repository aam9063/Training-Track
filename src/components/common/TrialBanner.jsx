import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock, FiX } from 'react-icons/fi';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useSubscription from '../../hooks/useSubscription';

/**
 * Sticky trial banner shown when trial is ending soon or expired.
 * Hidden for exempt users and users with active subscriptions.
 */
export function TrialBanner() {
  const { isTrialing, trialDaysLeft, trialExpired, isExempt, hasActiveSubscription } = useSubscription();
  const { profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const pricingUrl = profile?.role === 'coach' ? '/pricing?audience=coach' : '/pricing?audience=athlete';

  // Don't show if exempt, has subscription, or dismissed
  if (isExempt || hasActiveSubscription || dismissed) return null;

  // Show during entire trial period
  const showTrial = isTrialing;
  // Show expired message
  const showExpired = trialExpired;

  if (!showTrial && !showExpired) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        className={`relative flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium ${
          showExpired
            ? 'bg-red-500 text-white'
            : trialDaysLeft <= 3
              ? 'bg-amber-500 text-white'
              : trialDaysLeft <= 7
                ? 'bg-sky-500 text-white'
                : 'bg-sky-600/90 text-white'
        }`}
      >
        <FiClock className="w-4 h-4 flex-shrink-0" />
        {showExpired ? (
          <span>
            Tu prueba gratuita ha expirado.{' '}
            <Link to={pricingUrl} className="underline font-bold">
              Elige tu plan →
            </Link>
          </span>
        ) : (
          <span>
            Prueba gratuita · {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}.{' '}
            Acceso completo a todas las funcionalidades.{' '}
            <Link to={pricingUrl} className="underline font-bold">
              Ver planes →
            </Link>
          </span>
        )}
        {!showExpired && (
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/20"
            aria-label="Cerrar banner"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default TrialBanner;
