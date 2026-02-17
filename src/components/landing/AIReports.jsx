import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { BsStars } from 'react-icons/bs';
import {
  HiTrendingUp,
  HiShieldCheck,
  HiDocumentReport,
  HiChartBar,
  HiLightningBolt,
  HiHeart,
} from 'react-icons/hi';

export default function AIReports() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const reportSections = [
    {
      icon: HiChartBar,
      title: 'Resumen Ejecutivo',
      description: 'Puntuación global de fitness, logros recientes y áreas de mejora en un vistazo.',
      color: 'text-sky-500',
      bg: 'bg-sky-100 dark:bg-sky-900/30',
    },
    {
      icon: HiTrendingUp,
      title: 'Progresión de Rendimiento',
      description: 'Evolución de ritmos, eficiencia cardíaca, mejores marcas y predicciones de carrera.',
      color: 'text-green-500',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      icon: HiShieldCheck,
      title: 'Riesgo de Lesión',
      description: 'ACWR, monotonía de carga, factores de riesgo y medidas preventivas personalizadas.',
      color: 'text-orange-500',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      icon: HiDocumentReport,
      title: 'Recomendaciones',
      description: 'Ajustes de entrenamiento, áreas de foco y próximos pasos basados en los datos.',
      color: 'text-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  const metrics = [
    { label: 'ACWR', description: 'Ratio carga aguda/crónica' },
    { label: 'VO2max', description: 'Estimado desde VAM' },
    { label: 'Ritmos', description: 'Zonas personalizadas' },
    { label: 'FC', description: 'Tendencia cardíaca' },
    { label: 'Volumen', description: 'Progresión semanal' },
    { label: 'Marcas', description: 'Mejores esfuerzos' },
  ];

  return (
    <section
      id="informes-ia"
      ref={ref}
      className="py-24 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-sky-400/10 dark:bg-sky-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl" />
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-full text-sm font-semibold mb-6 border border-sky-200 dark:border-sky-800/50"
          >
            <BsStars className="w-4 h-4" />
            INTELIGENCIA ARTIFICIAL
          </motion.span>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Informes de rendimiento
            <span className="block mt-2 text-sky-600 dark:text-sky-400">
              generados con IA
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Analiza automáticamente los datos de Strava de tus atletas y genera
            informes PDF exhaustivos con análisis de rendimiento, gestión de carga
            y recomendaciones personalizadas.
          </p>
        </motion.div>

        {/* Main Content - Two Columns */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-20">
          {/* Left - Report Preview */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            {/* Mock PDF Report */}
            <div className="bg-white rounded-2xl p-8 transform -rotate-1 hover:rotate-0 transition-transform duration-500 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-gray-700">
              {/* PDF Header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center">
                  <BsStars className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    Informe de Rendimiento
                  </p>
                  <p className="text-xs text-gray-500">
                    Training Track - Generado con IA
                  </p>
                </div>
              </div>

              {/* Resumen Ejecutivo */}
              <div className="mb-5">
                <h4 className="text-xs font-bold text-sky-700 uppercase tracking-wider mb-3">
                  Resumen Ejecutivo
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-sky-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-sky-600">8.2</p>
                    <p className="text-[10px] text-gray-500">Fitness</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">1.15</p>
                    <p className="text-[10px] text-gray-500">ACWR</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">3/10</p>
                    <p className="text-[10px] text-gray-500">Riesgo</p>
                  </div>
                </div>
              </div>

              {/* Bars */}
              <div className="space-y-3 mb-5">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Volumen semanal</span>
                    <span>68 km</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Eficiencia cardíaca</span>
                    <span>Mejorando</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Monotonía de carga</span>
                    <span>Óptima</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>
              </div>

              {/* Recommendations preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Recomendaciones IA
                </h4>
                <div className="space-y-1.5">
                  {[
                    'Mantener el volumen actual, buena progresión',
                    'Incluir una sesión semanal de fuerza',
                    'Reducir intensidad en sesiones de recuperación',
                  ].map((rec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                      <p className="text-[10px] text-gray-600">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              transition={{ delay: 0.8, type: 'spring' }}
              className="absolute -bottom-4 -right-4 bg-sky-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2"
            >
              <HiDocumentReport className="w-5 h-5" />
              <span className="text-sm font-semibold">PDF Descargable</span>
            </motion.div>
          </motion.div>

          {/* Right - Report Sections */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="space-y-5"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Un informe completo en segundos
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Un click. La IA analiza las métricas de Strava, calcula la carga de
              entrenamiento, evalúa el riesgo de lesión y genera recomendaciones
              específicas para cada atleta.
            </p>

            {reportSections.map((section, index) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                  className="flex items-start gap-4 group"
                >
                  <div
                    className={`w-10 h-10 rounded-lg ${section.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className={`w-5 h-5 ${section.color}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{section.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {section.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Metrics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <p className="text-center text-gray-500 text-sm font-medium uppercase tracking-wider mb-6">
            Métricas analizadas en cada informe
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {metrics.map((metric, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: 0.8 + index * 0.05 }}
                className="bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 text-center hover:border-sky-400 dark:hover:border-sky-700/50 transition-colors duration-300"
              >
                <p className="text-sky-600 dark:text-sky-400 font-bold text-lg">{metric.label}</p>
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">{metric.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
