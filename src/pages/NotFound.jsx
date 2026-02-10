import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HiHome, HiArrowLeft, HiMail } from 'react-icons/hi';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-sky-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-sky-400/10 dark:bg-sky-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-200/10 dark:bg-sky-800/10 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-2xl mx-auto">
        {/* 404 Number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className="mb-8"
        >
          <h1 className="text-[10rem] sm:text-[14rem] font-black leading-none select-none">
            <span className="bg-gradient-to-br from-sky-400 via-sky-600 to-blue-700 bg-clip-text text-transparent">
              4
            </span>
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="inline-block bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 bg-clip-text text-transparent"
            >
              0
            </motion.span>
            <span className="bg-gradient-to-br from-sky-400 via-sky-600 to-blue-700 bg-clip-text text-transparent">
              4
            </span>
          </h1>
        </motion.div>

        {/* Track illustration - running lane lines */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          <div className="h-1 w-16 bg-sky-300 dark:bg-sky-700 rounded-full" />
          <div className="h-1.5 w-24 bg-sky-400 dark:bg-sky-600 rounded-full" />
          <div className="h-2 w-12 bg-sky-500 rounded-full" />
          <div className="h-1.5 w-24 bg-sky-400 dark:bg-sky-600 rounded-full" />
          <div className="h-1 w-16 bg-sky-300 dark:bg-sky-700 rounded-full" />
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Te has salido de la pista
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-2 max-w-md mx-auto leading-relaxed">
            La página que buscas no existe o está en construcción.
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mb-10">
            Estamos trabajando para traerte más contenido muy pronto.
          </p>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/"
            className="flex items-center gap-2 px-8 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-sky-600/25 hover:shadow-xl hover:shadow-sky-600/30"
          >
            <HiHome className="w-5 h-5" />
            Volver al inicio
          </Link>

          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-8 py-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:border-sky-400 dark:hover:border-sky-600 transition-colors"
          >
            <HiArrowLeft className="w-5 h-5" />
            Página anterior
          </button>
        </motion.div>

        {/* Contact hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-12 text-sm text-gray-400 dark:text-gray-500 flex items-center justify-center gap-2"
        >
          <HiMail className="w-4 h-4" />
          ¿Necesitas ayuda? Escríbenos a contacto@trainingtrackpro.com
        </motion.p>
      </div>
    </div>
  );
}
