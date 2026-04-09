import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiLoader } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/landing/Navbar';

/**
 * Post-checkout success page. Polls subscription table until
 * the webhook has processed the payment and created the subscription.
 */
export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [status, setStatus] = useState('polling'); // polling | success | timeout

  useEffect(() => {
    if (!profile?.id) return;

    let attempts = 0;
    let cancelled = false;
    let timeoutId = null;
    const maxAttempts = 15;

    const poll = async () => {
      if (cancelled) return;

      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (cancelled) return;

      if (data?.status === 'active' || data?.status === 'trialing') {
        setStatus('success');
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        setStatus('timeout');
        return;
      }

      timeoutId = setTimeout(poll, 2000);
    };

    poll();
    return () => { cancelled = true; if (timeoutId) clearTimeout(timeoutId); };
  }, [profile?.id]);

  const dashboardPath = profile?.role === 'coach' ? '/dashboard' : '/athlete/dashboard';

  return (
    <div className="min-h-screen bg-white dark:bg-coach-base">
      <Navbar />
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          {status === 'polling' && (
            <>
              <FiLoader className="w-12 h-12 animate-spin text-sky-500 mx-auto mb-5" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Procesando tu pago...
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Estamos confirmando tu suscripción. Esto puede tardar unos segundos.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                <FiCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                ¡Suscripción activada!
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Tu plan está activo. Ya puedes disfrutar de todas las funcionalidades.
              </p>
              <Link
                to={dashboardPath}
                className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors"
              >
                Ir al dashboard
              </Link>
            </>
          )}

          {status === 'timeout' && (
            <>
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                <FiCheckCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Pago recibido
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Tu pago se ha procesado correctamente. La activación puede tardar un momento.
                Si no se activa en unos minutos, contacta con soporte.
              </p>
              <Link
                to={dashboardPath}
                className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors"
              >
                Ir al dashboard
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
