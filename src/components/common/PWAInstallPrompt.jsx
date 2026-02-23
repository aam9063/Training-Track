import { useState, useEffect } from 'react';
import { FiDownload, FiX, FiShare } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

export default function PWAInstallPrompt() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (!user) return; // solo mostrar si está autenticado
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed || isInStandaloneMode()) return;

    if (isIos()) {
      setIos(true);
      setShow(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', '1');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3">
      <div className="w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden">
        <img src="/img/logo_192.png" alt="TrainingTrack" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Instalar TrainingTrack</p>

        {ios ? (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              Pulsa <FiShare className="inline w-3.5 h-3.5 mx-0.5 text-blue-500" /> y luego
              <span className="font-medium text-gray-700 dark:text-gray-300"> "Añadir a pantalla de inicio"</span>
            </p>
            <button
              onClick={handleDismiss}
              className="mt-3 px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs font-medium rounded-lg transition-colors"
            >
              Entendido
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Añade la app a tu pantalla de inicio para acceso rápido
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <FiDownload className="w-3.5 h-3.5" />
                Instalar
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs font-medium rounded-lg transition-colors"
              >
                Ahora no
              </button>
            </div>
          </>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
}
