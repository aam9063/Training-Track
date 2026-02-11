import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  HiChartBar,
  HiUsers,
  HiClock,
  HiLightningBolt,
  HiTrendingUp,
  HiRefresh
} from 'react-icons/hi';

export default function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const features = [
    {
      icon: HiChartBar,
      title: 'Análisis Inteligente',
      description: 'Métricas avanzadas, zonas de entrenamiento y análisis de rendimiento basados en tus datos reales.',
      gradient: 'from-sky-500 to-sky-600',
    },
    {
      icon: HiUsers,
      title: 'Gestión Centralizada',
      description: 'Todos tus atletas en un solo lugar. Perfiles detallados, historial y comunicación directa.',
      gradient: 'from-slate-600 to-slate-700',
    },
    {
      icon: HiClock,
      title: 'Planificación Avanzada',
      description: 'Crea mesociclos, microciclos y sesiones detalladas con ejercicios de carrera y fuerza.',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: HiRefresh,
      title: 'Sincronización Total',
      description: 'Conecta con Garmin, Strava, Coros y más. Carga entrenamientos y recibe datos automáticamente.',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: HiTrendingUp,
      title: 'Evolución Continua',
      description: 'Visualiza el progreso con gráficas interactivas, PRs y comparativas temporales.',
      gradient: 'from-sky-600 to-sky-700',
    },
    {
      icon: HiLightningBolt,
      title: 'Feedback Inmediato',
      description: 'Notificaciones en tiempo real. El atleta completa y el entrenador lo sabe al instante.',
      gradient: 'from-yellow-500 to-orange-500',
    },
  ];

  const integrations = [
    { name: 'Garmin', logo: '/img/integrations/garmin.svg', bgColor: 'bg-white' },
    { name: 'Strava', logo: '/img/integrations/strava.svg', bgColor: 'bg-[#FC4C02]' },
    { name: 'Polar', logo: '/img/integrations/polar.svg', bgColor: 'bg-white' },
    { name: 'Suunto', logo: '/img/integrations/suunto.svg', bgColor: 'bg-white' },
    { name: 'Coros', logo: '/img/integrations/coros.jpeg', bgColor: 'bg-black' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <section
      id="conocenos"
      ref={ref}
      className="py-24 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-sky-400/10 to-gray-400/5 dark:from-sky-600/5 dark:to-gray-600/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-gray-400/10 to-sky-400/5 dark:from-gray-600/5 dark:to-sky-600/5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-sm font-semibold mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            CONOCE TRAINING TRACK PRO
          </motion.span>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            La plataforma completa para
            <span className="block mt-2 text-sky-600 dark:text-sky-400">
              el atletismo moderno
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Desde la planificación hasta el análisis post-entrenamiento. Todo integrado,
            todo sincronizado, todo en tiempo real.
          </p>
        </motion.div>

        {/* Features Grid - New Bento Style */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="group relative bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-700/50 overflow-hidden"
              >
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                {/* Icon with gradient */}
                <div className="relative mb-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-600 dark:group-hover:from-white dark:group-hover:to-gray-300 transition-all duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>

                {/* Decorative corner */}
                <div className={`absolute -bottom-8 -right-8 w-24 h-24 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity duration-500`} />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Integrations Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="relative"
        >
          <div className="bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-3xl p-8 md:p-12 lg:p-16 overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 dark:opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
                backgroundSize: '32px 32px'
              }} />
            </div>

            <div className="relative grid lg:grid-cols-2 gap-12 items-center">
              {/* Left content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-100 dark:bg-white/10 rounded-full text-sm text-sky-600 dark:text-white/80 mb-6">
                  <HiRefresh className="w-4 h-4" />
                  Integraciones
                </div>

                <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                  Conectado con tus
                  <span className="text-sky-600 dark:text-sky-400"> dispositivos favoritos</span>
                </h3>

                <p className="text-gray-600 dark:text-gray-300 text-lg mb-8 leading-relaxed">
                  Sincroniza automáticamente con las principales plataformas.
                  Carga los entrenamientos directamente en tu reloj y recibe
                  los datos una vez completados.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mt-0.5">
                      <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white font-medium">Envío de entrenamientos</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Planifica en TrainingTrack Pro y aparece en tu dispositivo</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mt-0.5">
                      <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white font-medium">Importación automática</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Los datos se sincronizan al finalizar el entrenamiento</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mt-0.5">
                      <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white font-medium">Análisis unificado</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Toda la información centralizada en un solo lugar</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - Integration logos */}
              <div className="relative">
                {/* Central hub visual */}
                <div className="relative w-full max-w-md mx-auto">
                  {/* Center logo */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: 1 } : { scale: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-sky-600 rounded-2xl flex items-center justify-center shadow-2xl z-10"
                  >
                    <img src="/img/logo.png" alt="TrainingTrackPro" className="w-full h-full object-contain" />
                  </motion.div>

                  {/* Integration logos positioned in a circle */}
                  <div className="relative w-80 h-80 mx-auto">
                    {integrations.map((integration, index) => {
                      const angle = (index * 72 - 90) * (Math.PI / 180);
                      const x = 50 + 40 * Math.cos(angle);
                      const y = 50 + 40 * Math.sin(angle);

                      return (
                        <motion.div
                          key={integration.name}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                          transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                          whileHover={{ scale: 1.15, transition: { duration: 0.2 } }}
                          className="absolute w-16 h-16 transform -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          <div className={`w-full h-full ${integration.bgColor} rounded-xl flex items-center justify-center shadow-lg cursor-pointer overflow-hidden p-2`}>
                            <img
                              src={integration.logo}
                              alt={integration.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling.style.display = 'flex';
                              }}
                            />
                            <span className="text-gray-800 font-bold text-xs text-center hidden items-center justify-center w-full h-full">
                              {integration.name}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Floating badge */}
                {/*}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ delay: 1.2 }}
                  className="absolute -bottom-4 right-0 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {['bg-blue-500', 'bg-orange-500', 'bg-red-500'].map((color, i) => (
                        <div key={i} className={`w-6 h-6 ${color} rounded-full border-2 border-gray-800`} />
                      ))}
                    </div>
                    <span className="text-white text-sm font-medium">+5 plataformas</span>
                  </div>
                </motion.div>
                */}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {[
            { value: '800m', label: 'hasta Maratón', sublabel: 'Todas las distancias' },
            { value: '100%', label: 'Personalizable', sublabel: 'Adapta todo a tu método' },
            { value: '24/7', label: 'Sincronizado', sublabel: 'Siempre actualizado' },
            { value: '∞', label: 'Atletas', sublabel: 'Sin límites de gestión' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
              className="text-center group"
            >
              <div className="text-4xl md:text-5xl font-bold text-sky-600 dark:text-sky-400 mb-2 group-hover:scale-110 transition-transform duration-300">
                {stat.value}
              </div>
              <div className="text-gray-900 dark:text-white font-semibold">
                {stat.label}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {stat.sublabel}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
