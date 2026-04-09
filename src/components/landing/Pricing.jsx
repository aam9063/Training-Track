import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiCheck, HiX, HiSparkles, HiLightningBolt } from 'react-icons/hi';
import { FiUsers, FiUser } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';

const coachPlans = [
  {
    name: 'Gratis',
    description: 'Para empezar sin compromiso',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { text: 'Hasta 3 atletas', included: true },
      { text: 'Planificación semanal de entrenamientos', included: true },
      { text: 'Integración con Strava', included: true },
      { text: 'ACWR y TSB automático', included: true },
      { text: 'Mensajería con atletas', included: true },
      { text: 'Informes IA semanales automáticos', included: false },
      { text: 'Tests fisiológicos (VAM, Conconi)', included: false },
      { text: 'Exportación de datos (CSV/PDF)', included: false },
    ],
    gradient: 'from-sky-400 to-sky-500',
    popular: false,
    cta: 'Empezar gratis',
  },
  {
    name: 'Pro',
    description: 'Para entrenadores profesionales',
    monthlyPrice: 14.99,
    yearlyPrice: 149,
    features: [
      { text: 'Hasta 20 atletas', included: true },
      { text: 'Informes IA semanales automáticos', included: true },
      { text: 'Integración con Strava (webhook)', included: true },
      { text: 'ACWR, TSB y control de carga', included: true },
      { text: 'Tests fisiológicos (VAM, Conconi)', included: true },
      { text: 'Exportación de datos (CSV/PDF)', included: true },
      { text: 'Planificador por mesociclos', included: true },
      { text: 'Soporte prioritario', included: true },
    ],
    gradient: 'from-sky-600 to-sky-700',
    popular: true,
    cta: 'Regístrate',
  },
  {
    name: 'Team',
    description: 'Para clubes y academias',
    monthlyPrice: 24.99,
    yearlyPrice: 249,
    features: [
      { text: 'Atletas ilimitados', included: true },
      { text: 'Todo lo del plan Pro', included: true },
      { text: 'Archivos de fuerza (PDFs gym)', included: true },
      { text: 'Notificaciones push a atletas', included: true },
      { text: 'Predicción de tiempos de carrera', included: true },
      { text: 'Competiciones y calendario', included: true },
      { text: 'Exportación completa de datos', included: true },
      { text: 'Soporte dedicado', included: true },
    ],
    gradient: 'from-sky-700 to-sky-900',
    popular: false,
    cta: 'Regístrate',
  },
];

const athletePlans = [
  {
    name: 'Gratis',
    description: 'Empieza a entrenar con IA',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { text: '1 generación de plan con IA', included: true },
      { text: 'Métricas básicas de rendimiento', included: true },
      { text: 'Seguimiento de competiciones', included: true },
      { text: 'Chat con Hermes IA', included: false },
      { text: 'Regeneraciones de plan semanales', included: false },
      { text: 'Conexión Strava y dispositivos', included: true },
    ],
    gradient: 'from-sky-400 to-sky-500',
    popular: false,
    cta: 'Empezar Gratis',
  },
  {
    name: 'Premium',
    description: 'Entrenamiento inteligente completo',
    monthlyPrice: 5,
    yearlyPrice: 48,
    features: [
      { text: '2 regeneraciones de plan por semana', included: true },
      { text: 'Chat ilimitado con Hermes IA', included: true },
      { text: 'Conexión Strava y dispositivos', included: true },
      { text: 'Seguimiento competiciones con cuenta atrás', included: true },
      { text: 'Métricas completas y progresión', included: true },
      { text: 'Logros y gamificación', included: true },
    ],
    gradient: 'from-sky-600 to-sky-700',
    popular: true,
    cta: 'Comenzar Premium',
  },
];

const athleteComparisonRows = [
  { feature: 'Generación de plan IA', free: '1 plan', premium: '2 regeneraciones/semana' },
  { feature: 'Chat con Hermes IA', free: false, premium: 'Ilimitado' },
  { feature: 'Métricas de rendimiento', free: 'Básicas', premium: 'Completas' },
  { feature: 'Conexión con Strava', free: true, premium: true },
  { feature: 'Seguimiento de competiciones', free: true, premium: 'Con cuenta atrás' },
  { feature: 'Logros y gamificación', free: false, premium: true },
];

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.4 + i * 0.1 },
  }),
};

export default function Pricing({ audience, onAudienceChange }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [billingCycle, setBillingCycle] = useState('monthly');

  const activeAudience = audience ?? 'coach';
  const isAthlete = activeAudience === 'athlete';
  const plans = isAthlete ? athletePlans : coachPlans;

  return (
    <section
      id="pricing"
      ref={ref}
      className="py-24 bg-white dark:bg-[#0A0A0A] relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-200 dark:bg-sky-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-200 dark:bg-[#141414]/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.5 }}
            className="inline-block px-4 py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-sm font-semibold mb-4"
          >
            PRECIOS
          </motion.span>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Planes que se adaptan a
            <span className="block text-sky-600 dark:text-sky-400">
              tus necesidades
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Elige el plan perfecto para ti. Sin contratos, cancela cuando quieras.
          </p>
        </motion.div>

        {/* Audience Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-[#141414] rounded-2xl p-1.5">
            <button
              onClick={() => onAudienceChange?.('coach')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                !isAthlete
                  ? 'bg-white dark:bg-[#242424] text-sky-600 dark:text-sky-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <FiUsers className="w-4 h-4" />
              Entrenador
            </button>
            <button
              onClick={() => onAudienceChange?.('athlete')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                isAthlete
                  ? 'bg-white dark:bg-[#242424] text-sky-600 dark:text-sky-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <BsStars className="w-4 h-4" />
              Atleta Independiente
            </button>
          </div>
        </motion.div>

        {/* Beta Banner — coach only */}
        <AnimatePresence mode="wait">
          {!isAthlete && (
            <motion.div
              key="beta-banner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="bg-gradient-to-r from-sky-600 to-sky-700 dark:from-sky-700 dark:to-sky-800 rounded-2xl p-6 md:p-8 mb-12 text-center"
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <HiLightningBolt className="w-6 h-6 text-sky-200" />
                <h3 className="text-2xl md:text-3xl font-bold text-white">
                  Gratis durante la beta
                </h3>
              </div>
              <p className="text-sky-100 text-lg max-w-2xl mx-auto mb-4">
                Todas las funcionalidades de todos los planes disponibles sin coste.
                Acceso completo mientras dure la fase beta.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-sky-700 font-semibold rounded-xl hover:bg-sky-50 transition-colors shadow-lg"
              >
                Empezar gratis
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Future Plans Label — coach only */}
        {!isAthlete && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4"
          >
            Planes tras la fase beta
          </motion.p>
        )}

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex justify-center mb-10"
        >
          <div className="inline-flex items-center space-x-4 bg-gray-100 dark:bg-[#141414] rounded-full p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-white dark:bg-[#242424] text-sky-600 dark:text-sky-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 flex items-center space-x-2 ${
                billingCycle === 'yearly'
                  ? 'bg-white dark:bg-[#242424] text-sky-600 dark:text-sky-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <span>Anual</span>
              {isAthlete ? (
                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                  Ahorra 12€
                </span>
              ) : (
                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                  -17%
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isAthlete ? 'athlete-plans' : 'coach-plans'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className={`grid gap-8 mb-12 items-center ${
              isAthlete
                ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto'
                : 'grid-cols-1 md:grid-cols-3'
            }`}
          >
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className={`relative bg-white dark:bg-[#141414] rounded-2xl shadow-xl border-2 transition-all duration-300 ${
                  plan.popular
                    ? 'border-sky-500 dark:border-sky-400 scale-[1.08] -my-6 py-14 px-8 z-10 shadow-2xl shadow-sky-500/20'
                    : 'border-gray-200 dark:border-[#2A2A2A] hover:border-sky-300 dark:hover:border-sky-600 p-8'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-sky-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                      <HiSparkles className="w-4 h-4" />
                      <span>Recomendado</span>
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="text-center mb-8">
                  <div className="flex items-end justify-center">
                    <span className={`text-5xl font-bold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                      {billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}€
                    </span>
                    {(billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice) > 0 && (
                      <span className="text-gray-600 dark:text-gray-400 ml-2 mb-2">
                        /{billingCycle === 'monthly' ? 'mes' : 'año'}
                      </span>
                    )}
                  </div>
                  {isAthlete && plan.name === 'Premium' && billingCycle === 'yearly' && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                      Ahorra 12€ al año
                    </p>
                  )}
                  {!isAthlete && billingCycle === 'yearly' && plan.monthlyPrice > 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                      {Math.round(plan.monthlyPrice * 12 - plan.yearlyPrice)}€ de ahorro anual
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      {feature.included ? (
                        <HiCheck className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      ) : (
                        <HiX className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${
                          feature.included
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500 line-through'
                        }`}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Link
                  to="/register"
                  className={`block w-full py-4 rounded-xl font-semibold text-lg text-center transition-all duration-200 ${
                    plan.popular
                      ? `bg-gradient-to-r ${plan.gradient} text-white shadow-lg hover:shadow-xl hover:opacity-90`
                      : 'bg-gray-100 dark:bg-[#242424] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Athlete Feature Comparison Table */}
        <AnimatePresence>
          {isAthlete && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-3xl mx-auto mb-12"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-6">
                Comparativa de planes
              </h3>
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2A2A2A] shadow-sm">
                {/* Table header */}
                <div className="grid grid-cols-3 bg-gray-50 dark:bg-[#141414] border-b border-gray-200 dark:border-[#2A2A2A]">
                  <div className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Función</div>
                  <div className="px-4 py-3 text-sm font-semibold text-center text-gray-600 dark:text-gray-400">Gratis</div>
                  <div className="px-4 py-3 text-sm font-semibold text-center text-sky-600 dark:text-sky-400">Premium</div>
                </div>
                {/* Table rows */}
                {athleteComparisonRows.map((row, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-3 border-b border-gray-100 dark:border-[#2A2A2A]/50 last:border-0 ${
                      i % 2 === 0 ? 'bg-white dark:bg-[#141414]/40' : 'bg-gray-50/50 dark:bg-[#141414]/20'
                    }`}
                  >
                    <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.feature}</div>
                    <div className="px-4 py-3 text-sm text-center">
                      {row.free === false ? (
                        <HiX className="w-4 h-4 text-gray-400 mx-auto" />
                      ) : (
                        <span className="text-gray-600 dark:text-gray-400">{row.free === true ? '✓' : row.free}</span>
                      )}
                    </div>
                    <div className="px-4 py-3 text-sm text-center">
                      {row.premium === false ? (
                        <HiX className="w-4 h-4 text-gray-400 mx-auto" />
                      ) : (
                        <span className="text-sky-600 dark:text-sky-400 font-medium">
                          {row.premium === true ? '✓' : row.premium}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-center"
        >
          {!isAthlete && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Durante la beta, todas las funcionalidades son gratuitas. No se requiere tarjeta de crédito.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Sin tarjeta de crédito
            </div>
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              {isAthlete ? 'Plan gratis disponible siempre' : 'Acceso completo en beta'}
            </div>
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Sin compromiso
            </div>
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Actualizaciones gratuitas
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
