import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { BsStars } from 'react-icons/bs';
import { FiZap, FiAlertTriangle, FiCheckCircle, FiBarChart2, FiCalendar } from 'react-icons/fi';

export default function AIReports() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const reportFeatures = [
    {
      icon: FiBarChart2,
      title: 'ACWR · TSB · RPE en un vistazo',
      description: 'Ratio de carga aguda/crónica, balance de fatiga y percepción de esfuerzo — las tres métricas clave para detectar sobreentrenamiento antes de que ocurra.',
      color: 'text-sky-500',
      bg: 'bg-sky-100 dark:bg-sky-900/30',
    },
    {
      icon: FiAlertTriangle,
      title: 'Alertas inteligentes por atleta',
      description: 'La IA detecta señales de alarma: ACWR > 1.5, RPE alto con volumen normal, sesiones incompletas o fatiga acumulada (TSB < -30).',
      color: 'text-amber-500',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      icon: FiCheckCircle,
      title: 'Recomendaciones específicas',
      description: 'No frases genéricas. La IA genera 4 recomendaciones concretas para la semana siguiente basadas en los datos reales de ese atleta.',
      color: 'text-green-500',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      icon: FiCalendar,
      title: 'Predicción de competición',
      description: 'Si el atleta tiene una carrera próxima, el informe incluye estado de forma, puntuación de preparación y si está listo para competir.',
      color: 'text-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  const metrics = [
    { label: 'ACWR', description: 'Carga aguda/crónica' },
    { label: 'TSB', description: 'Balance de fatiga' },
    { label: 'RPE', description: 'Percepción de esfuerzo' },
    { label: 'Carga interna', description: 'RPE × duración' },
    { label: 'Km reales', description: 'Desde Strava' },
    { label: 'Competición', description: 'Predicción de forma' },
  ];

  return (
    <section
      id="informes-ia"
      ref={ref}
      className="py-24 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-sky-400/10 dark:bg-sky-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
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
            Cada lunes, un informe
            <span className="block mt-2 text-sky-600 dark:text-sky-400">
              por cada atleta
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Sin hacer nada. Cada semana la IA analiza los datos de Strava, el RPE registrado
            y la carga de entrenamiento de cada atleta y te envía un informe con alertas
            y recomendaciones. Exportable en PDF.
          </p>
        </motion.div>

        {/* Main content */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-20">
          {/* Left — mock report card */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-white rounded-2xl p-6 transform -rotate-1 hover:rotate-0 transition-transform duration-500 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    DM
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">David Martínez</p>
                    <p className="text-xs text-gray-400">16 feb – 22 feb</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">● Atención</span>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-900 rounded-xl p-3">
                {[
                  { label: 'ACWR', value: '1.28', color: 'text-amber-400' },
                  { label: 'TSB', value: '-12', color: 'text-amber-400' },
                  { label: 'Sesiones', value: '4/5', color: 'text-white' },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <p className={`text-base font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-5 bg-slate-900 rounded-xl p-3">
                {[
                  { label: 'Km exec.', value: '62km', color: 'text-amber-400' },
                  { label: 'RPE medio', value: '7.2/10', color: 'text-amber-400' },
                  { label: 'Carga int.', value: '1440UA', color: 'text-slate-300' },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <p className={`text-base font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* AI summary */}
              <div className="flex gap-2.5 p-3 bg-slate-900 rounded-xl mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(26,107,255,0.2)' }}>
                  <FiZap className="w-3.5 h-3.5" style={{ color: '#1A6BFF' }} />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#1A6BFF' }}>Análisis IA</p>
                  <p className="text-[10px] leading-relaxed text-slate-300">Semana de alta carga con buen cumplimiento (80%). El RPE 7.2 es elevado — vigilar la recuperación esta semana. ACWR en zona de atención.</p>
                </div>
              </div>

              {/* Alert */}
              <div className="flex gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-[10px] font-semibold text-amber-800">RPE elevado con buen volumen</p>
                  <p className="text-[9px] text-amber-700">Posible fatiga oculta. Considerar reducir intensidad.</p>
                </div>
              </div>

              {/* Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                  <span className="font-medium">Km totales</span>
                  <span><span className="font-semibold text-gray-900 dark:text-white">62km</span> / 58km</span>
                </div>
                <div className="relative h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                  <div className="absolute top-0 left-0 h-full rounded-full bg-red-500" style={{ width: '100%' }} />
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
              <BsStars className="w-4 h-4" />
              <span className="text-sm font-semibold">Cada lunes · automático</span>
            </motion.div>
          </motion.div>

          {/* Right — features */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="space-y-5"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              No solo km — la carga real percibida
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Dos semanas con los mismos kilómetros pueden ser completamente distintas.
              El RPE (percepción de esfuerzo) y la carga interna revelan cómo vivió
              realmente el atleta esa semana. Eso es lo que analiza la IA.
            </p>

            {reportFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                  className="flex items-start gap-4 group"
                >
                  <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-5 h-5 ${f.color}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{f.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Metrics grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <p className="text-center text-gray-500 text-sm font-medium uppercase tracking-wider mb-6">
            Métricas analizadas en cada informe
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {metrics.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: 0.8 + i * 0.05 }}
                className="bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 text-center hover:border-sky-400 dark:hover:border-sky-700/50 transition-colors duration-300"
              >
                <p className="text-sky-600 dark:text-sky-400 font-bold text-lg">{m.label}</p>
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">{m.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
