import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { HiRefresh, HiTrendingUp, HiArrowRight } from 'react-icons/hi';

export default function FinalCTA({ audience = 'coach' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const weeklyData = [
    { day: 'L', height: 40 },
    { day: 'M', height: 65 },
    { day: 'X', height: 45 },
    { day: 'J', height: 80 },
    { day: 'V', height: 55 },
    { day: 'S', height: 90 },
    { day: 'D', height: 30 },
  ];

  const content = {
    coach: {
      headline: 'Transforma tu coaching con inteligencia artificial',
      subtitle: 'Planifica, analiza y comunícate con todos tus atletas desde una sola plataforma. Empieza gratis hoy.',
      cta: 'Empieza gratis como entrenador',
    },
    athlete: {
      headline: 'Empieza a entrenar con tu coach virtual',
      subtitle: 'Hermes IA genera tu plan personalizado, responde tus dudas y te acompaña en cada entrenamiento. Sin entrenador, sin excusas.',
      cta: 'Empieza gratis como atleta',
    },
  };

  const current = content[audience] ?? content.coach;

  return (
    <section
      ref={ref}
      className="py-24 bg-sky-600 relative overflow-hidden"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={audience}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                  {current.headline}
                </h2>

                <p className="text-xl text-sky-100 mb-8 leading-relaxed">
                  {current.subtitle}
                </p>

                <Link
                  to="/register"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-white text-sky-700 rounded-xl font-bold text-lg hover:bg-sky-50 hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {current.cta}
                  <HiArrowRight className="w-5 h-5" />
                </Link>

              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Right Content - Progress Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Decorative circle */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-yellow-200/30 rounded-full blur-sm" />

            {/* Progress Card */}
            <div className="relative bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md mx-auto lg:ml-auto">
              {/* Card Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <HiRefresh className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-gray-900">Progreso semanal</span>
                </div>
                <span className="text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
                  Última semana
                </span>
              </div>

              {/* Chart */}
              <div className="mb-6">
                <div className="flex items-end justify-between h-32 px-2">
                  {weeklyData.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ height: 0 }}
                      animate={isInView ? { height: `${item.height}%` } : { height: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                      className="w-6 sm:w-8 bg-gradient-to-t from-sky-700 to-sky-400 rounded-t-lg relative group"
                    >
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs px-2 py-1 rounded">
                        {item.height}%
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="flex justify-between px-2 mt-2">
                  {weeklyData.map((item, index) => (
                    <span key={index} className="text-xs text-gray-400 w-6 sm:w-8 text-center">
                      {item.day}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Distancia total</p>
                  <p className="text-2xl font-bold text-gray-900">42.5 km</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Tiempo en zona</p>
                  <p className="text-2xl font-bold text-gray-900">3h 24m</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Ritmo promedio</p>
                  <p className="text-2xl font-bold text-sky-600">4:52 /km</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Mejora</p>
                  <p className="text-2xl font-bold text-green-500 flex items-center">
                    <HiTrendingUp className="w-5 h-5 mr-1" />
                    +8%
                  </p>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <HiTrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Esta semana</p>
                <p className="text-sm font-bold text-gray-900">+12% rendimiento</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
