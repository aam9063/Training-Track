import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlay, HiCheckCircle, HiX } from 'react-icons/hi';

// YouTube video ID - change this when you upload your demo video
const YOUTUBE_VIDEO_ID = 'TU_VIDEO_ID';

export default function Hero() {
  const [showDemo, setShowDemo] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  const features = [
    'Planes de entrenamiento personalizados',
    'Seguimiento de progreso en tiempo real',
    'Análisis de rendimiento detallado',
  ];

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-20"
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute top-20 right-10 w-72 h-72 bg-sky-400/20 dark:bg-sky-600/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute bottom-20 left-10 w-96 h-96 bg-sky-300/15 dark:bg-sky-700/10 rounded-full blur-3xl"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-12 items-center">
          {/* Left Column - Text Content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-left"
          >
            {/* Badge */}
            <motion.div variants={itemVariants} className="inline-flex items-center space-x-2 px-4 py-2 bg-sky-100 dark:bg-sky-900/30 rounded-full mb-6">
              <span className="w-2 h-2 bg-sky-600 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                La plataforma líder en gestión de entrenamientos
              </span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight"
            >
              Lleva tu rendimiento
              <br />
              <span className="text-sky-600 dark:text-sky-400">
                al siguiente nivel
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-xl leading-relaxed"
            >
              La plataforma completa para entrenadores y atletas de medio fondo y fondo.
              Gestiona entrenamientos, analiza rendimiento y alcanza tus metas.
            </motion.p>

            {/* Features List */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col gap-3 mb-8"
            >
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 text-gray-700 dark:text-gray-300"
                >
                  <HiCheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm sm:text-base">{feature}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-start gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center space-x-2"
              >
                <span>Empieza Gratis</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDemo(true)}
                className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-semibold text-lg border-2 border-gray-200 dark:border-gray-700 hover:border-sky-600 dark:hover:border-sky-400 transition-all duration-200 flex items-center space-x-2"
              >
                <HiPlay className="w-5 h-5" />
                <span>Ver Demo</span>
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Right Column - Image */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            className="relative hidden lg:block"
          >
            <div className="relative">
              <img
                src="/img/pista.jpg"
                alt="Pista de atletismo"
                className="w-full h-auto rounded-2xl shadow-2xl object-cover"
              />
              {/* Decorative overlay gradient */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-sky-600/10 to-transparent" />
            </div>
          </motion.div>
        </div>

        {/* Statistics - Full width below */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto mt-16"
        >
          <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-4xl font-bold text-sky-600 dark:text-sky-400 mb-2">
              800m → 42K
            </div>
            <div className="text-gray-600 dark:text-gray-400 font-medium">
              Todas las distancias
            </div>
          </div>

          <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-4xl font-bold text-sky-600 dark:text-sky-400 mb-2">
              Strava + IA
            </div>
            <div className="text-gray-600 dark:text-gray-400 font-medium">
              Análisis inteligente
            </div>
          </div>

          <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-4xl font-bold text-sky-600 dark:text-sky-400 mb-2">
              100%
            </div>
            <div className="text-gray-600 dark:text-gray-400 font-medium">
              Gratuito en Beta
            </div>
          </div>
        </motion.div>
      </div>

      {/* YouTube Demo Modal */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowDemo(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowDemo(false)}
                className="absolute -top-12 right-0 text-white hover:text-sky-400 transition-colors"
              >
                <HiX className="w-8 h-8" />
              </button>
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0`}
                title="TrainingTrack Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-2xl shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-gray-400 dark:border-gray-600 rounded-full flex items-start justify-center p-2"
        >
          <motion.div
            animate={{ height: ['0%', '40%', '0%'] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 bg-gray-400 dark:bg-gray-600 rounded-full"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
