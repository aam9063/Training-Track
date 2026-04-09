import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { HiLightningBolt, HiUserGroup, HiChartBar, HiChatAlt2 } from 'react-icons/hi';
import { BsStars } from 'react-icons/bs';

export default function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const reasons = [
    {
      icon: HiChartBar,
      title: 'Datos reales, decisiones reales',
      description:
        'Conecta Strava, analiza métricas de rendimiento y toma decisiones basadas en datos, no en suposiciones.',
    },
    {
      icon: BsStars,
      title: 'Informes con IA',
      description:
        'Genera informes exhaustivos de rendimiento con inteligencia artificial. Análisis de carga, riesgo de lesión y recomendaciones.',
    },
    {
      icon: HiUserGroup,
      title: 'Hecho para entrenadores',
      description:
        'Gestiona todos tus atletas desde un solo panel. Planifica sesiones, comunica y analiza sin cambiar de herramienta.',
    },
    {
      icon: HiChatAlt2,
      title: 'Comunicación directa',
      description:
        'Mensajería integrada entre entrenador y atleta. Sin grupos de WhatsApp, sin perder información.',
    },
  ];

  return (
    <section
      id="testimonios"
      ref={ref}
      className="py-24 bg-gradient-to-br from-gray-50 to-sky-50 dark:from-[#0A0A0A] dark:to-[#141414] relative overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-300 dark:bg-sky-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-300 dark:bg-[#242424]/30 rounded-full blur-3xl" />
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
            className="inline-block px-4 py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-sm font-semibold mb-4"
          >
            POR QUE ELEGIRNOS
          </motion.span>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Construido para
            <span className="block text-sky-600 dark:text-sky-400">
              entrenadores exigentes
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Training Track nace de la necesidad real de un entrenador.
            Sin datos inflados, sin promesas vacías. Pruébalo y decide tú.
          </p>
        </motion.div>

        {/* Reasons Grid */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16"
        >
          {reasons.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                className="bg-white dark:bg-[#141414] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-[#2A2A2A] group"
              >
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {reason.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {reason.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-2xl p-8 md:p-12 text-center"
        >
          <HiLightningBolt className="w-10 h-10 text-sky-200 mx-auto mb-4" />
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Empieza a entrenar mejor hoy
          </h3>
          <p className="text-sky-100 text-lg max-w-2xl mx-auto mb-6">
            Regístrate gratis y descubre todas las funcionalidades que Training Track tiene para ti.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-sky-700 font-semibold rounded-xl hover:bg-sky-50 transition-colors shadow-lg"
          >
            Crear cuenta gratis
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
