import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { HiCheck, HiX, HiSparkles } from 'react-icons/hi';

export default function Pricing() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [billingCycle, setBillingCycle] = useState('monthly'); // monthly or yearly

  const plans = [
    {
      name: 'Starter',
      description: 'Perfecto para entrenadores que empiezan',
      monthlyPrice: 29,
      yearlyPrice: 290,
      freeTrial: '1 mes gratis',
      features: [
        { text: 'Hasta 10 atletas', included: true },
        { text: 'Planes de entrenamiento básicos', included: true },
        { text: 'Gráficas de progreso', included: true },
        { text: 'Mensajería con atletas', included: true },
        { text: 'Soporte por email', included: true },
        { text: 'Análisis avanzado de rendimiento', included: false },
        { text: 'Exportación de datos', included: false },
        { text: 'API acceso', included: false },
      ],
      gradient: 'from-blue-500 to-cyan-500',
      popular: false,
    },
    {
      name: 'Professional',
      description: 'Para entrenadores profesionales',
      monthlyPrice: 79,
      yearlyPrice: 790,
      features: [
        { text: 'Hasta 50 atletas', included: true },
        { text: 'Planes de entrenamiento avanzados', included: true },
        { text: 'Gráficas y análisis completos', included: true },
        { text: 'Mensajería ilimitada', included: true },
        { text: 'Soporte prioritario 24/7', included: true },
        { text: 'Análisis avanzado de rendimiento', included: true },
        { text: 'Exportación de datos', included: true },
        { text: 'API acceso', included: false },
      ],
      gradient: 'from-purple-500 to-pink-500',
      popular: true,
    },
    {
      name: 'Enterprise',
      description: 'Para clubes y organizaciones',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      features: [
        { text: 'Atletas ilimitados', included: true },
        { text: 'Todas las características Pro', included: true },
        { text: 'Personalización completa', included: true },
        { text: 'Múltiples entrenadores', included: true },
        { text: 'Soporte dedicado', included: true },
        { text: 'Análisis avanzado de rendimiento', included: true },
        { text: 'Exportación de datos', included: true },
        { text: 'API acceso completo', included: true },
      ],
      gradient: 'from-orange-500 to-red-500',
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
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 dark:bg-purple-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-200 dark:bg-blue-900/20 rounded-full blur-3xl" />
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
            className="inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold mb-4"
          >
            PRECIOS
          </motion.span>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Planes que se adaptan a
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              tus necesidades
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Elige el plan perfecto para ti. Sin contratos a largo plazo, cancela cuando quieras.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center space-x-4 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 flex items-center space-x-2 ${
                billingCycle === 'yearly'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <span>Anual</span>
              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                Ahorra 17%
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
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border-2 transition-all duration-300 ${
                plan.popular
                  ? 'border-purple-500 dark:border-purple-400 scale-105'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                    <HiSparkles className="w-4 h-4" />
                    <span>Más Popular</span>
                  </div>
                </div>
              )}

              {/* Free Trial Badge */}
              {plan.freeTrial && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {plan.freeTrial}
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
                    {billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice} €
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2 mb-2">
                    /{billingCycle === 'monthly' ? 'mes' : 'año'}
                  </span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    ${Math.round((plan.monthlyPrice - plan.yearlyPrice / 12) * 12)} de ahorro anual
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
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
                  plan.popular
                    ? `bg-gradient-to-r ${plan.gradient} text-white shadow-lg hover:shadow-xl`
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Comenzar Ahora
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Todos los planes incluyen prueba gratuita de 30 días. No se requiere tarjeta de crédito.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Sin contratos a largo plazo
            </div>
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Cancela cuando quieras
            </div>
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Actualizaciones gratuitas
            </div>
            <div className="flex items-center">
              <HiCheck className="w-4 h-4 text-green-500 mr-2" />
              Soporte técnico 24/7
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
