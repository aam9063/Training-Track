import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiX } from 'react-icons/hi';
import { BsStars } from 'react-icons/bs';
import { supabase } from '../../lib/supabase';
import WaitlistForm from './WaitlistForm';

export default function PromoBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem('promo_dismissed')) return;

    const checkAndShow = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Only show to non-logged-in users
      if (!session) {
        const timer = setTimeout(() => setShow(true), 6000);
        return () => clearTimeout(timer);
      }
    };

    checkAndShow();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    sessionStorage.setItem('promo_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {show && !dismissed && (
        <motion.div
          initial={{ opacity: 0, x: 100, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 100, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-40 w-[340px] sm:w-[380px]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-sky-600 to-sky-700 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BsStars className="w-4 h-4 text-sky-200" />
                <span className="text-white font-semibold text-sm">
                  ¡Próximo lanzamiento!
                </span>
              </div>
              <button
                onClick={handleDismiss}
                className="text-sky-200 hover:text-white transition-colors"
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
              <h4 className="text-gray-900 dark:text-white font-bold text-lg mb-1">
                Únete a la lista de espera
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                Estamos preparando la plataforma definitiva para entrenadores de running: IA, Strava, métricas avanzadas y mucho más. ¡Sé de los primeros!
              </p>

              <WaitlistForm source="promo" variant="light" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
