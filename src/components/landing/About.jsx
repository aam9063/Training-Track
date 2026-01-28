import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { HiChartBar, HiUsers, HiClock, HiLightningBolt, HiTrendingUp, HiDeviceMobile } from 'react-icons/hi';

export default function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const features = [
    {
      icon: HiChartBar,
      title: 'Análisis Avanzado',
      description: 'Métricas detalladas y gráficas de progreso para tomar decisiones basadas en datos reales.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: HiUsers,
      title: 'Gestión de Atletas',
      description: 'Administra múltiples atletas desde un solo lugar con perfiles personalizados.',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: HiClock,
      title: 'Planificación Flexible',
      description: 'Crea y ajusta planes de entrenamiento adaptados a cada objetivo y distancia.',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: HiLightningBolt,
      title: 'Actualizaciones en Tiempo Real',
      description: 'Sincronización instantánea entre entrenador y atleta para feedback inmediato.',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: HiTrendingUp,
      title: 'Seguimiento de Progreso',
      description: 'Visualiza la evolución de cada atleta con gráficas y estadísticas completas.',
      gradient: 'from-indigo-500 to-blue-500',
    },
    {
      icon: HiDeviceMobile,
      title: 'Acceso Multiplataforma',
      description: 'Disponible en web y móvil para entrenar desde cualquier lugar.',
      gradient: 'from-pink-500 to-rose-500',
    },
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
      className="py-24 bg-white dark:bg-gray-900 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30">
        <div className="absolute top-20 right-0 w-96 h-96 bg-blue-200 dark:bg-blue-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-0 w-96 h-96 bg-purple-200 dark:bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.5 }}
            className="inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold mb-4"
          >
            CONOCE TRACKPRO
          </motion.span>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Todo lo que necesitas para
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              entrenar profesionalmente
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Diseñado específicamente para entrenadores y atletas de medio fondo y fondo.
            Desde 400m hasta maratón, todo en una sola plataforma.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                className="group relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700"
              >
                {/* Icon */}
                <div
                  className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover gradient border */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none`}
                />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 sm:p-12">
            <div className="text-left">
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                ¿Listo para transformar tu entrenamiento?
              </h3>
              <p className="text-blue-100">
                Únete a cientos de entrenadores que ya confían en TrackPro
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-200 whitespace-nowrap"
            >
              Comenzar Ahora
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
