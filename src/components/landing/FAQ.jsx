import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import { HiChevronDown } from 'react-icons/hi';

export default function FAQ() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: '¿Qué distancias de atletismo cubre TrackPro?',
      answer: 'TrackPro está diseñado específicamente para medio fondo y fondo, cubriendo desde 400m hasta maratón completo. Incluye: 400m, 800m, 1500m, 3000m, 5000m, 10000m, 5K, 10K, 21K (media maratón) y Maratón (42K).',
    },
    {
      question: '¿Cómo funciona la prueba gratuita?',
      answer: 'Ofrecemos 30 días de prueba gratuita sin necesidad de tarjeta de crédito. Tendrás acceso completo a todas las características del plan que elijas. Al finalizar el período de prueba, podrás decidir si continuar con una suscripción.',
    },
    {
      question: '¿Puedo cambiar de plan en cualquier momento?',
      answer: 'Sí, puedes actualizar o cambiar tu plan en cualquier momento. Si actualizas, solo pagarás la diferencia prorrateada. Si cambias a un plan inferior, el cambio se aplicará en tu próximo ciclo de facturación.',
    },
    {
      question: '¿Qué métodos de pago aceptan?',
      answer: 'Aceptamos todas las tarjetas de crédito principales (Visa, Mastercard, American Express), Stripe y transferencias bancarias para planes Enterprise. Todos los pagos son procesados de forma segura.',
    },
    {
      question: '¿Los atletas también necesitan una suscripción?',
      answer: 'No, los atletas no pagan nada. Solo el entrenador necesita una suscripción. Los atletas reciben acceso gratuito a la app para ver sus entrenamientos, progreso y comunicarse con su entrenador.',
    },
    {
      question: '¿Puedo exportar mis datos?',
      answer: 'Sí, en los planes Professional y Enterprise puedes exportar todos tus datos en formatos CSV y PDF. Esto incluye entrenamientos, análisis de rendimiento, estadísticas y progreso de atletas.',
    },
    {
      question: '¿Está disponible en móvil?',
      answer: 'Sí, TrackPro está completamente optimizado para dispositivos móviles a través del navegador web. Próximamente lanzaremos apps nativas para iOS y Android.',
    },
    {
      question: '¿Qué tipo de soporte ofrecen?',
      answer: 'El plan Starter incluye soporte por email con respuesta en 24-48 horas. Professional incluye soporte prioritario 24/7 por email y chat. Enterprise incluye un gestor de cuenta dedicado y soporte telefónico.',
    },
    {
      question: '¿Puedo usar TrackPro para un equipo o club?',
      answer: 'Absolutamente. El plan Enterprise está diseñado específicamente para clubes y organizaciones. Permite múltiples entrenadores, atletas ilimitados, y personalización completa con tu marca.',
    },
    {
      question: '¿Qué pasa si cancelo mi suscripción?',
      answer: 'Puedes cancelar en cualquier momento sin penalización. Mantendrás acceso completo hasta el final de tu período de facturación actual. Tus datos se conservan durante 90 días por si decides regresar.',
    },
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      ref={ref}
      className="py-24 bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-blue-300 dark:bg-blue-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-300 dark:bg-purple-900/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
            PREGUNTAS FRECUENTES
          </motion.span>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            ¿Tienes preguntas?
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Tenemos respuestas
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300">
            Encuentra respuestas a las preguntas más comunes sobre TrackPro
          </p>
        </motion.div>

        {/* FAQ List */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-4"
        >
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
              >
                <span className="text-lg font-semibold text-gray-900 dark:text-white pr-8">
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <HiChevronDown className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </motion.div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-gray-600 dark:text-gray-300 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 text-center bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-gray-700"
        >
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            ¿Aún tienes preguntas?
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Nuestro equipo está aquí para ayudarte. Contáctanos y te responderemos lo antes posible.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
            >
              Contactar Soporte
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
            >
              Ver Documentación
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
