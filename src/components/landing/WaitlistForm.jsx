import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiCheckCircle, HiMail } from 'react-icons/hi';
import { joinWaitlist } from '../../services/waitlistService';

/**
 * Reusable waitlist signup form.
 * @param {string} source - tracking source (hero, footer, cta, promo)
 * @param {'light'|'dark'|'on-blue'} variant - visual variant
 * @param {string} className - extra wrapper classes
 */
export default function WaitlistForm({ source = 'landing', variant = 'light', className = '' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | already
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setError('');

    const result = await joinWaitlist(email, source);

    if (result.success) {
      setStatus(result.alreadyExists ? 'already' : 'success');
      if (!result.alreadyExists) setEmail('');
    } else {
      setError('Ha ocurrido un error. Inténtalo de nuevo.');
      setStatus('idle');
    }
  };

  const isOnBlue = variant === 'on-blue';
  const isDone = status === 'success' || status === 'already';

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {isDone ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl ${
              isOnBlue
                ? 'bg-white/20 text-white'
                : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            }`}
          >
            <HiCheckCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {status === 'already' ? '¡Ya estás en la lista!' : '¡Apuntado!'}
              </p>
              <p className={`text-xs ${isOnBlue ? 'text-white/80' : 'text-green-600 dark:text-green-500'}`}>
                Te avisaremos a <strong>{email || 'tu correo'}</strong> cuando lancemos.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <HiMail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 ${
                isOnBlue ? 'text-white/50' : 'text-gray-400 dark:text-gray-500'
              }`} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                disabled={status === 'loading'}
                className={`w-full pl-11 pr-4 py-3.5 rounded-xl text-sm font-medium transition-all outline-none ${
                  isOnBlue
                    ? 'bg-white/20 text-white placeholder-white/50 border border-white/30 focus:border-white/60 focus:bg-white/25'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                } disabled:opacity-60`}
              />
            </div>
            <motion.button
              type="submit"
              disabled={status === 'loading'}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`px-7 py-3.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap disabled:opacity-60 ${
                isOnBlue
                  ? 'bg-white text-sky-700 hover:bg-sky-50 shadow-lg hover:shadow-xl'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {status === 'loading' ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Enviando...
                </span>
              ) : (
                '¡Únete a la lista!'
              )}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      {error && (
        <p className={`text-xs mt-2 ${isOnBlue ? 'text-red-200' : 'text-red-500'}`}>
          {error}
        </p>
      )}

      {!isDone && (
        <p className={`text-xs mt-2.5 ${isOnBlue ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
          Sin spam. Solo te avisaremos cuando esté lista la plataforma.
        </p>
      )}
    </div>
  );
}
