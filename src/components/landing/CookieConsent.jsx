import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiShieldCheck } from 'react-icons/hi';

const COOKIE_KEY = 'cookie_consent';

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = (type) => {
    let consent;
    if (type === 'all') {
      consent = { necessary: true, analytics: true, marketing: true };
    } else if (type === 'necessary') {
      consent = { necessary: true, analytics: false, marketing: false };
    } else {
      consent = { ...preferences };
    }
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ ...consent, date: new Date().toISOString() }));
    setShow(false);
  };

  const cookieTypes = [
    {
      key: 'necessary',
      label: 'Cookies necesarias',
      description: 'Imprescindibles para el funcionamiento de la web. Incluyen inicio de sesión, preferencias de tema y seguridad.',
      locked: true,
    },
    {
      key: 'analytics',
      label: 'Cookies de análisis',
      description: 'Nos ayudan a entender cómo se usa la plataforma para mejorar la experiencia (visitas, páginas más vistas).',
      locked: false,
    },
    {
      key: 'marketing',
      label: 'Cookies de marketing',
      description: 'Permiten mostrarte contenido y ofertas relevantes basados en tu uso de la plataforma.',
      locked: false,
    },
  ];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-[60] p-4 sm:p-6"
        >
          <div className="max-w-4xl mx-auto bg-white dark:bg-[#141414] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
            {/* Main banner */}
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl items-center justify-center flex-shrink-0 mt-0.5">
                  <HiShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                    Utilizamos cookies
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Usamos cookies propias y de terceros para mejorar tu experiencia, analizar el tráfico
                    y personalizar el contenido. Puedes aceptar todas, solo las necesarias o configurar
                    tus preferencias.
                  </p>
                </div>
              </div>

              {/* Settings panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-[#2A2A2A] space-y-4">
                      {cookieTypes.map((cookie) => (
                        <div
                          key={cookie.key}
                          className="flex items-start justify-between gap-4"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {cookie.label}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {cookie.description}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (!cookie.locked) {
                                setPreferences((prev) => ({
                                  ...prev,
                                  [cookie.key]: !prev[cookie.key],
                                }));
                              }
                            }}
                            disabled={cookie.locked}
                            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                              preferences[cookie.key]
                                ? 'bg-sky-600'
                                : 'bg-gray-300 dark:bg-[#2A2A2A]'
                            } ${cookie.locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                preferences[cookie.key] ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Buttons */}
              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => accept('all')}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Aceptar todas
                </button>
                <button
                  onClick={() => accept('necessary')}
                  className="px-5 py-2.5 bg-gray-100 dark:bg-[#242424] hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors"
                >
                  Solo necesarias
                </button>
                {!showSettings ? (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-5 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium transition-colors"
                  >
                    Configurar cookies
                  </button>
                ) : (
                  <button
                    onClick={() => accept('custom')}
                    className="px-5 py-2.5 border border-sky-600 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Guardar preferencias
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
