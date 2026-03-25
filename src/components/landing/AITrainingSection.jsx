import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { FiCalendar, FiTrendingUp, FiTarget } from 'react-icons/fi';
import { BsStars, BsChatDotsFill } from 'react-icons/bs';

const aiFeatures = [
  {
    icon: BsStars,
    title: 'Hermes IA — Tu entrenador virtual',
    description:
      'Chat ilimitado con tu IA personal. Pregunta sobre tu plan, ajusta entrenamientos, recibe consejos personalizados basados en tus datos reales de entrenamiento.',
    bgClass: 'bg-sky-50 dark:bg-sky-900/20',
    iconBgClass: 'bg-sky-600',
    iconColor: 'text-white',
  },
  {
    icon: FiCalendar,
    title: 'Plan personalizado con IA',
    description:
      'Genera un plan de 4 semanas adaptado a tu nivel, objetivos, días disponibles y kilómetros semanales. Periodización inteligente desde 800m hasta maratón.',
    bgClass: 'bg-gray-50 dark:bg-gray-800/60',
    iconBgClass: 'bg-gradient-to-br from-sky-500 to-sky-700',
    iconColor: 'text-white',
  },
  {
    icon: FiTrendingUp,
    title: 'Métricas y progresión',
    description:
      'Evolución de km, ritmos, RPE y marcas personales. Conecta Strava para que tus actividades se registren automáticamente. Control de carga con ACWR y TSB.',
    bgClass: 'bg-sky-50 dark:bg-sky-900/20',
    iconBgClass: 'bg-sky-700',
    iconColor: 'text-white',
  },
  {
    icon: FiTarget,
    title: 'Competiciones con cuenta atrás',
    description:
      'Registra tus carreras y objetivos. Cuenta atrás en tiempo real, seguimiento de preparación y recordatorios para que llegues al día de la carrera en tu mejor versión.',
    bgClass: 'bg-gray-50 dark:bg-gray-800/60',
    iconBgClass: 'bg-gradient-to-br from-sky-600 to-sky-800',
    iconColor: 'text-white',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.12, ease: 'easeOut' },
  }),
};

export default function AITrainingSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      id="entrenamiento-ia"
      ref={ref}
      className="py-24 bg-white dark:bg-gray-900 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-200 dark:bg-sky-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-sky-100 dark:bg-sky-800/20 rounded-full blur-3xl" />
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-sm font-semibold mb-4"
          >
            <BsChatDotsFill className="w-4 h-4" />
            PARA ATLETAS INDEPENDIENTES
          </motion.span>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Tu entrenador con IA,
            <span className="block text-sky-600 dark:text-sky-400">
              siempre disponible
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Sin entrenador humano, sin hojas de cálculo. TrainingTrack genera tu plan,
            responde tus dudas y analiza tu progreso con inteligencia artificial avanzada.
          </p>
        </motion.div>

        {/* Feature Cards — 2x2 on lg+, single col below md */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {aiFeatures.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className={`${feature.bgClass} rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-lg transition-shadow duration-300`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${feature.iconBgClass} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Hermes IA Chat mock */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="max-w-2xl mx-auto mb-12 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-sky-600 to-sky-700">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <BsStars className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Hermes IA</p>
              <p className="text-xs text-sky-200">Tu entrenador virtual · siempre disponible</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-sky-200">En línea</span>
            </div>
          </div>

          {/* Chat bubbles */}
          <div className="px-5 py-4 space-y-4">
            <div className="flex justify-start">
              <div className="max-w-xs bg-sky-100 dark:bg-sky-900/40 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm">
                ¿Cómo debería preparar mi semana antes del maratón?
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-sm bg-sky-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                Esa semana antes de la carrera es clave. Reduce el volumen al 40%, mantén 2-3 activaciones cortas a ritmo objetivo y duerme 8h. Tu ACWR actual es 1.08 — estás en zona óptima 🏃
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-xs bg-sky-100 dark:bg-sky-900/40 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm">
                ¿Y la semana de la carrera?
              </div>
            </div>
          </div>

          {/* Chat input hint */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700/60 rounded-xl px-4 py-2.5">
              <span className="text-sm text-gray-400 dark:text-gray-500 flex-1">Pregunta a Hermes IA...</span>
              <BsStars className="w-4 h-4 text-sky-500" />
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.65 }}
          className="text-center"
        >
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Empieza gratis — sin tarjeta de crédito, sin compromiso
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <BsStars className="w-4 h-4" />
            Empieza Gratis
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
