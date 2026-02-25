import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiX } from 'react-icons/fi';
import { useNotifications } from '../../contexts/NotificationContext';

const PushNotificationBanner = () => {
  const { pushState, requestPushPermission } = useNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only show when push is available but not yet subscribed
  if (pushState !== 'prompt' || dismissed) return null;

  const handleActivate = async () => {
    setLoading(true);
    await requestPushPermission();
    setLoading(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 sm:mx-6 lg:mx-8 mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-800/40 rounded-full flex items-center justify-center">
              <FiBell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Activar notificaciones
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Recibe avisos de entrenamientos, mensajes y competiciones
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleActivate}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Activando...' : 'Activar'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PushNotificationBanner;
