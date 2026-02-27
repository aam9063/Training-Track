import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

const initialScreenshots = [
  {
    id: 1,
    light: '/img/1.png',
    dark: '/img/1-dark.png',
    alt: 'Dashboard del entrenador con agenda semanal y próximas competiciones',
    title: 'Dashboard del entrenador',
  },
  {
    id: 2,
    light: '/img/2.png',
    dark: '/img/2-dark.png',
    alt: 'Calendario mensual con sesiones y competiciones por atleta',
    title: 'Calendario de entrenamientos',
  },
  {
    id: 3,
    light: '/img/3.png',
    dark: '/img/3-dark.png',
    alt: 'Métricas de rendimiento del atleta con datos de Strava',
    title: 'Métricas reales desde Strava',
  },
  {
    id: 4,
    light: '/img/4.png',
    dark: '/img/4-dark.png',
    alt: 'Planificador de temporada con mesociclos y asignación a atletas',
    title: 'Planificador de temporada',
  },
  {
    id: 5,
    light: '/img/5.png',
    dark: '/img/5-dark.png',
    alt: 'Informes IA semanales por atleta con ACWR, TSB y RPE',
    title: 'Informes IA semanales',
  }
];

export default function AppShowcase() {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { theme } = useTheme();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  const getSrc = (screenshot) => theme === 'dark' ? screenshot.dark : screenshot.light;

  const handleImgError = (e, screenshot) => {
    if (e.target.src !== screenshot.light) {
      e.target.src = screenshot.light;
    }
  };

  // Get current main screenshot and secondary screenshots
  const mainScreenshot = initialScreenshots[activeIndex];
  const secondaryScreenshots = initialScreenshots.filter((_, i) => i !== activeIndex);

  const handleScreenshotClick = (clickedIndex) => {
    // Find the actual index in the original array
    const actualIndex = initialScreenshots.findIndex(s => s.id === secondaryScreenshots[clickedIndex].id);
    setActiveIndex(actualIndex);
  };

  return (
    <section
      ref={containerRef}
      className="relative py-24 overflow-hidden bg-gradient-to-b from-white via-sky-50/50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-72 h-72 bg-sky-400/10 dark:bg-sky-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-gray-400/10 dark:bg-gray-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-sm font-semibold mb-4"
          >
            Interfaz Moderna
          </motion.span>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Diseñado para{' '}
            <span className="text-sky-600 dark:text-sky-400">
              el rendimiento
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Una experiencia visual intuitiva que te permite enfocarte en lo que realmente importa: tus atletas.
          </p>
        </motion.div>

        {/* Main Featured Screenshot */}
        <motion.div
          style={{ y, opacity }}
          className="relative mb-16"
        >
          <div className="relative mx-auto max-w-5xl">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-sky-600/20 rounded-3xl blur-2xl opacity-50" />

            {/* Main screenshot with 3D perspective */}
            <motion.div
              initial={{ opacity: 0, y: 50, rotateX: 10 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="relative"
              style={{ perspective: '1000px' }}
            >
              <div className="relative bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-2 shadow-2xl">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-t-xl">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-gray-200 rounded-lg px-4 py-1.5 text-gray-400 text-sm text-center">
                      app.trainingtrack.es
                    </div>
                  </div>
                </div>

                {/* Screenshot with animation */}
                <div className="relative overflow-hidden rounded-b-xl">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={`${mainScreenshot.id}-${theme}`}
                      src={getSrc(mainScreenshot)}
                      alt={mainScreenshot.alt}
                      onError={(e) => handleImgError(e, mainScreenshot)}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4, ease: 'easeInOut' }}
                      className="w-full"
                    />
                  </AnimatePresence>
                  {/* Bottom fade-out gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-gray-200 dark:from-gray-900 to-transparent pointer-events-none" />
                </div>

                {/* Current screenshot title badge */}
                <div className="absolute bottom-4 left-4 right-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={mainScreenshot.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg px-4 py-2 inline-block"
                    >
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {mainScreenshot.title}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Floating badge */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="absolute -left-4 top-1/4 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 border border-gray-200 dark:border-gray-700 hidden lg:block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Sesión completada</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Hace 2 min</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating stats card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="absolute -right-4 bottom-1/4 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 border border-gray-200 dark:border-gray-700 hidden lg:block"
              >
                <div className="text-center">
                  <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                    +15%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Rendimiento</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Secondary Screenshots Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <AnimatePresence mode="popLayout">
            {secondaryScreenshots.map((screenshot, index) => (
              <motion.div
                key={screenshot.id}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => handleScreenshotClick(index)}
                className="group relative cursor-pointer"
              >
                {/* Hover glow */}
                <div className="absolute -inset-2 bg-sky-600/0 group-hover:bg-sky-600/20 rounded-2xl blur-xl transition-all duration-500 opacity-0 group-hover:opacity-100" />

                <div className="relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 group-hover:border-sky-500/50 dark:group-hover:border-sky-400/50 transition-all duration-300">
                  <img
                    src={getSrc(screenshot)}
                    alt={screenshot.alt}
                    onError={(e) => handleImgError(e, screenshot)}
                    className="w-full aspect-[4/3] object-cover object-top"
                  />

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-start justify-end p-4">
                    <span className="text-white font-semibold text-sm mb-1">
                      {screenshot.title}
                    </span>
                    <span className="text-white/70 text-xs flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      Click para ampliar
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
