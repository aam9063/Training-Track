import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlay, HiX } from 'react-icons/hi';
import { FiZap, FiCalendar, FiTrendingUp, FiSmartphone } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

const YOUTUBE_VIDEO_ID = 'TU_VIDEO_ID';

export default function Hero() {
  const [showDemo, setShowDemo] = useState(false);
  const { theme } = useTheme();
  const mobileImg = theme === 'dark' ? '/img/mobile-1-dark.png' : '/img/mobile-1.png';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
  };

  const features = [
    { icon: FiZap,        text: 'Informes IA automáticos cada lunes con ACWR, TSB y RPE' },
    { icon: FiCalendar,   text: 'Planificador de temporada con mesociclos y asignación masiva' },
    { icon: FiTrendingUp, text: 'Predictor de tiempos basado en tests VAM y Conconi' },
    { icon: FiSmartphone, text: 'App instalable en móvil directamente desde el navegador' },
  ];

  const stats = [
    { value: '800m → 42K', label: 'Todas las distancias', sub: 'Medio fondo y fondo' },
    { value: 'Strava + IA', label: 'Análisis automático', sub: 'Sincronización en tiempo real' },
    { value: '100% gratis', label: 'Durante la Beta', sub: 'Sin tarjeta de crédito' },
  ];

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-20"
    >
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute top-20 right-10 w-72 h-72 bg-sky-400/20 dark:bg-sky-600/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-20 left-10 w-96 h-96 bg-sky-300/15 dark:bg-sky-700/10 rounded-full blur-3xl"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — Text */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:text-left"
          >
            {/* Badge */}
            <motion.div variants={itemVariants} className="flex justify-center lg:justify-start mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 dark:bg-sky-900/30 rounded-full">
                <span className="w-2 h-2 bg-sky-600 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                  Plataforma de entrenamiento con IA · Beta gratuita
                </span>
              </div>
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-5 leading-tight text-center lg:text-left"
            >
              El entrenador
              <br />
              <span className="text-sky-600 dark:text-sky-400">
                que nunca para
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-7 max-w-xl mx-auto lg:mx-0 leading-relaxed text-center lg:text-left"
            >
              Gestiona tus atletas, diseña planes personalizados y recibe análisis IA cada semana — sin hacer nada. Integrado con Strava.
            </motion.p>

            {/* Feature list */}
            <motion.div variants={itemVariants} className="flex flex-col items-start gap-2.5 mb-8">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
                    <div className="w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <span className="text-sm sm:text-base text-left">{f.text}</span>
                  </div>
                );
              })}
            </motion.div>

            {/* CTAs */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center lg:items-start gap-4">
              <Link to="/register">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center gap-2"
                >
                  <span>Empieza gratis</span>
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </motion.button>
              </Link>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDemo(true)}
                className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-semibold text-lg border-2 border-gray-200 dark:border-gray-700 hover:border-sky-600 dark:hover:border-sky-400 transition-all duration-200 flex items-center gap-2"
              >
                <HiPlay className="w-5 h-5" />
                <span>Ver demo</span>
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Right — Mock phone + floating cards */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            className="relative hidden lg:flex justify-center"
          >
            {/* Phone frame */}
            <div className="relative w-64 mx-auto" style={{ perspective: '900px' }}>
              <motion.div
                initial={{ rotateY: 0, rotateX: 0 }}
                animate={{ rotateY: 18, rotateX: 6 }}
                transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
                whileHover={{ rotateY: 8, rotateX: 3, transition: { duration: 0.4 } }}
                className="bg-gray-900 rounded-[2.5rem] p-2.5 ring-1 ring-white/10"
                style={{
                  transformStyle: 'preserve-3d',
                  boxShadow: '20px 20px 60px rgba(0,0,0,0.45), 8px 8px 20px rgba(0,0,0,0.25)',
                }}
              >
                <div className="rounded-[2rem] overflow-hidden bg-white relative">
                  {/* Notch bar — covers top of screenshot */}
                  <div className="absolute top-0 left-0 right-0 h-7 bg-gray-900 flex items-center justify-center z-10">
                    <div className="w-20 h-4 bg-gray-900 rounded-full" />
                  </div>
                  {/* Screenshot below notch */}
                  <div className="pt-7">
                    <img
                      src={mobileImg}
                      alt="TrainingTrack en móvil"
                      className="w-full"
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Floating card — informe IA */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="absolute -left-6 top-1/4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3.5 border border-gray-100 dark:border-gray-700 max-w-[180px]"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <FiZap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white">Informe IA</span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">ACWR 1.15 · TSB +4 · RPE 6.2 — Semana óptima ✓</p>
            </motion.div>

            {/* Floating card — sesión completada */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="absolute -right-6 bottom-1/3 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3.5 border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">Sesión completada</p>
                  <p className="text-[10px] text-gray-400">Sincronizado con Strava</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16"
        >
          {stats.map((s, i) => (
            <div key={i} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-3xl font-bold text-sky-600 dark:text-sky-400 mb-1">{s.value}</div>
              <div className="text-sm font-semibold text-gray-800 dark:text-white">{s.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Demo modal */}
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
