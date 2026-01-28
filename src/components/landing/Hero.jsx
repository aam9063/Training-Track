import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HiPlay, HiCheckCircle } from 'react-icons/hi';

// Register GSAP plugin
gsap.registerPlugin(ScrollTrigger);

export default function Hero() {
  const statsRef = useRef(null);

  useEffect(() => {
    // Animate statistics numbers on mount
    const stats = statsRef.current.querySelectorAll('.stat-number');

    stats.forEach((stat) => {
      const target = parseInt(stat.getAttribute('data-target'));
      gsap.to(stat, {
        innerHTML: target,
        duration: 2,
        ease: 'power2.out',
        snap: { innerHTML: 1 },
        scrollTrigger: {
          trigger: stat,
          start: 'top 80%',
        },
      });
    });
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  const features = [
    'Planes de entrenamiento personalizados',
    'Seguimiento de progreso en tiempo real',
    'Análisis de rendimiento detallado',
  ];

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 pt-20"
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute top-20 right-10 w-72 h-72 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute bottom-20 left-10 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              La plataforma líder en gestión de entrenamientos
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight"
          >
            Lleva tu rendimiento
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              al siguiente nivel
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed"
          >
            La plataforma completa para entrenadores y atletas de medio fondo y fondo.
            Gestiona entrenamientos, analiza rendimiento y alcanza tus metas.
          </motion.p>

          {/* Features List */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
          >
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-300"
              >
                <HiCheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm sm:text-base">{feature}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center space-x-2"
            >
              <span>Empieza Gratis</span>
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-semibold text-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-600 dark:hover:border-blue-400 transition-all duration-200 flex items-center space-x-2"
            >
              <HiPlay className="w-5 h-5" />
              <span>Ver Demo</span>
            </motion.button>
          </motion.div>

          {/* Statistics */}
          <motion.div
            ref={statsRef}
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                <span className="stat-number" data-target="500">0</span>+
              </div>
              <div className="text-gray-600 dark:text-gray-400 font-medium">
                Entrenadores Activos
              </div>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                <span className="stat-number" data-target="5000">0</span>+
              </div>
              <div className="text-gray-600 dark:text-gray-400 font-medium">
                Atletas Registrados
              </div>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                <span className="stat-number" data-target="98">0</span>%
              </div>
              <div className="text-gray-600 dark:text-gray-400 font-medium">
                Satisfacción
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-gray-400 dark:border-gray-600 rounded-full flex items-start justify-center p-2"
        >
          <motion.div
            animate={{ height: ['0%', '40%', '0%'] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 bg-gray-400 dark:bg-gray-600 rounded-full"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
