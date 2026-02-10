import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { HiCheck, HiX, HiSparkles, HiLightningBolt } from 'react-icons/hi';

export default function Pricing() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = [
    {
      name: 'Starter',
      description: 'Para entrenadores que empiezan',
      monthlyPrice: 29,
      yearlyPrice: 290,
      features: [
        { text: 'Hasta 10 atletas', included: true },
        { text: 'Planificación semanal de entrenamientos', included: true },
        { text: 'Métricas básicas de Strava', included: true },
        { text: 'Mensajería con atletas', included: true },
        { text: 'Soporte por email', included: true },
        { text: 'Informes IA de rendimiento', included: false },
        { text: 'Banco de ejercicios personalizado', included: false },
        { text: 'Cálculos fisiológicos avanzados', included: false },
      ],
      gradient: 'from-sky-500 to-sky-600',
      popular: false,
    },
    {
      name: 'Professional',
      description: 'Para entrenadores profesionales',
      monthlyPrice: 79,
      yearlyPrice: 790,
      features: [
        { text: 'Hasta 30 atletas', included: true },
        { text: '3 informes IA por atleta/mes', included: true },
        { text: 'Gráficas avanzadas de progreso', included: true },
        { text: 'Banco de ejercicios personalizado', included: true },
        { text: 'Análisis de competiciones', included: true },
        { text: 'Exportación de datos (CSV/PDF)', included: true },
        { text: 'Soporte prioritario', included: true },
        { text: 'Múltiples entrenadores', included: false },
      ],
      gradient: 'from-sky-600 to-sky-700',
      popular: true,
    },
    {
      name: 'Enterprise',
      description: 'Para clubes y organizaciones',
      monthlyPrice: 149,
      yearlyPrice: 1490,
      features: [
        { text: 'Atletas ilimitados', included: true },
        { text: 'Informes IA ilimitados', included: true },
        { text: 'Múltiples entrenadores por cuenta', included: true },
        { text: 'Cálculos fisiológicos (VAM, Conconi)', included: true },
        { text: 'Predicción de tiempos de carrera', included: true },
        { text: 'Exportación de datos completa', included: true },
        { text: 'API de acceso', included: true },
        { text: 'Soporte dedicado', included: true },
      ],
      gradient: 'from-sky-700 to-sky-900',
      popular: false,
    },
  ];

  return (
    <section
      id="pricing"
      ref={ref}
      className="py-24 bg-white dark:bg-gray-900 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-200 dark:bg-sky-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-200 dark:bg-gray-800/30 rounded-full blur-3xl" />
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

        {/* Beta Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.2 }}
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
          <a
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-sky-700 font-semibold rounded-xl hover:bg-sky-50 transition-colors shadow-lg"
          >
            Empezar gratis
          </a>
        </motion.div>

        {/* Future Plans Label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4"
        >
          Planes tras la fase beta
        </motion.p>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex justify-center mb-10"
        >
          <div className="inline-flex items-center space-x-4 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 flex items-center space-x-2 ${
                billingCycle === 'yearly'
                  ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <span>Anual</span>
              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                -17%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border-2 transition-all duration-300 ${
                plan.popular
                  ? 'border-sky-500 dark:border-sky-400 scale-105'
                  : 'border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-600'
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
                  <span className="text-gray-600 dark:text-gray-400 ml-2 mb-2">
                    /{billingCycle === 'monthly' ? 'mes' : 'año'}
                  </span>
                </div>
                {billingCycle === 'yearly' && (
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

              {/* CTA Button - All go to register (free during beta) */}
              <a
                href="/register"
                className={`block w-full py-4 rounded-xl font-semibold text-lg text-center transition-all duration-200 ${
                  plan.popular
                    ? `bg-gradient-to-r ${plan.gradient} text-white shadow-lg hover:shadow-xl hover:opacity-90`
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Empezar gratis
              </a>
            </motion.div>
          ))}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-center"
        >
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Durante la beta, todas las funcionalidades son gratuitas. No se requiere tarjeta de crédito.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Sin tarjeta de crédito
            </div>
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Acceso completo en beta
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
