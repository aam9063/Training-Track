import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  HiCalendar,
  HiChartBar,
  HiUserGroup,
  HiMail,
  HiDocumentReport,
  HiCog,
  HiLightningBolt,
  HiClipboardList,
  HiArrowLeft,
  HiAcademicCap,
  HiHeart,
  HiGlobe,
  HiDownload,
  HiTrendingUp,
  HiBeaker,
  HiDeviceMobile,
} from 'react-icons/hi';
import { FaStrava } from 'react-icons/fa';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

const coachUseCases = [
  {
    icon: HiCalendar,
    title: 'Planificación semanal de entrenamientos',
    description:
      'Crea planes de entrenamiento semanales personalizados para cada atleta. Asigna sesiones de running, gimnasio, cross-training o descanso con horarios, duraciones y ejercicios específicos del banco de ejercicios.',
    color: 'sky',
  },
  {
    icon: HiUserGroup,
    title: 'Gestión completa de atletas',
    description:
      'Administra tu roster de atletas con perfiles detallados, solicitudes de incorporación, filtros por distancia de competición y acceso rápido a métricas, entrenamientos y tests de cada uno.',
    color: 'blue',
  },
  {
    icon: HiChartBar,
    title: 'Métricas avanzadas y progresión',
    description:
      'Visualiza la progresión semanal de kilómetros, carga de entrenamiento, distribución por tipo de actividad y ritmo medio. Compara rendimiento entre atletas con rankings de mejores rendimientos.',
    color: 'purple',
  },
  {
    icon: HiDocumentReport,
    title: 'Informes de rendimiento con IA',
    description:
      'Genera informes PDF automáticos con análisis de rendimiento, ratio ACWR, riesgo de lesión, tendencias de progresión y recomendaciones personalizadas basadas en inteligencia artificial.',
    color: 'amber',
  },
  {
    icon: HiBeaker,
    title: 'Tests fisiológicos (Conconi y VAM)',
    description:
      'Realiza tests de Conconi para determinar el umbral de deflexión y el VO2 máximo estimado. Ejecuta tests VAM para calcular la Velocidad Aeróbica Máxima. Importa datos desde CSV/Excel.',
    color: 'emerald',
  },
  {
    icon: HiMail,
    title: 'Comunicación directa con atletas',
    description:
      'Envía mensajes a tus atletas con asunto y contenido detallado. Monitoriza el estado de lectura de cada mensaje y mantén un historial completo de comunicaciones.',
    color: 'rose',
  },
  {
    icon: HiCalendar,
    title: 'Calendario de entrenamientos y competiciones',
    description:
      'Vista mensual con todas las sesiones de entrenamiento y competiciones programadas. Diferenciadas por colores según tipo (running, gimnasio, cross-training, descanso).',
    color: 'indigo',
  },
  {
    icon: HiDownload,
    title: 'Exportación de datos y PDFs',
    description:
      'Descarga planes de entrenamiento semanales en PDF y genera informes de rendimiento exportables. Toda la información de tus atletas organizada y lista para compartir.',
    color: 'teal',
  },
];

const athleteUseCases = [
  {
    icon: HiClipboardList,
    title: 'Visualización del plan semanal',
    description:
      'Consulta tu plan de entrenamiento semanal completo con todas las sesiones, ejercicios, series, repeticiones e indicaciones de tu entrenador. Navega entre semanas para ver tu programación.',
    color: 'sky',
  },
  {
    icon: FaStrava,
    title: 'Integración con Strava',
    description:
      'Conecta tu cuenta de Strava para sincronizar automáticamente tus actividades. Visualiza rutas en mapa, splits, segmentos, frecuencia cardíaca, desnivel y mejores esfuerzos.',
    color: 'orange',
  },
  {
    icon: HiHeart,
    title: 'Valoración del esfuerzo percibido (RPE)',
    description:
      'Registra tu percepción de esfuerzo del 1 al 10 en cada actividad de Strava. Añade notas personales para que tu entrenador comprenda cómo te sentiste durante la sesión.',
    color: 'rose',
  },
  {
    icon: HiTrendingUp,
    title: 'Métricas y progresión personal',
    description:
      'Analiza tu progresión semanal de kilómetros, carga de entrenamiento, distribución de actividades y ritmo medio. Consulta tus mejores marcas y récords personales.',
    color: 'emerald',
  },
  {
    icon: HiAcademicCap,
    title: 'Resultados de tests y ritmos',
    description:
      'Consulta los resultados de tus tests de Conconi y VAM, tu VO2 máximo estimado y las zonas de ritmo personalizadas calculadas por tu entrenador.',
    color: 'purple',
  },
  {
    icon: HiMail,
    title: 'Mensajería con tu entrenador',
    description:
      'Recibe mensajes de tu entrenador con indicaciones, feedback y comunicados. Responde directamente desde la plataforma manteniendo toda la conversación organizada.',
    color: 'blue',
  },
  {
    icon: HiLightningBolt,
    title: 'Competiciones y carreras',
    description:
      'Consulta tus próximas competiciones programadas con fecha, distancia y ubicación. Tu entrenador las gestiona directamente desde tu perfil.',
    color: 'amber',
  },
  {
    icon: HiDeviceMobile,
    title: 'Conexión y gestión de dispositivos',
    description:
      'Vincula tu cuenta de Strava con un solo clic. Visualiza tu perfil de atleta de Strava, estadísticas totales y gestiona la conexión en cualquier momento.',
    color: 'teal',
  },
];

const sharedFeatures = [
  {
    icon: HiGlobe,
    title: 'Aplicación 100% web',
    description: 'Accede desde cualquier navegador sin instalar nada. Diseño responsive optimizado para escritorio, tablet y móvil.',
  },
  {
    icon: HiCog,
    title: 'Modo claro y oscuro',
    description: 'Elige el tema visual que prefieras. La preferencia se guarda automáticamente entre sesiones.',
  },
  {
    icon: FaStrava,
    title: 'Datos reales de Strava',
    description: 'Toda la información de métricas proviene directamente de la API de Strava — datos reales de entrenamientos y competiciones.',
  },
  {
    icon: HiDocumentReport,
    title: 'Informes con inteligencia artificial',
    description: 'Análisis automatizado de rendimiento, riesgo de lesión y recomendaciones personalizadas generadas por IA.',
  },
];

const colorMap = {
  sky: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
};

function UseCaseCard({ useCase, index }) {
  const colors = colorMap[useCase.color] || colorMap.sky;
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      custom={index % 4}
      className={`bg-white dark:bg-gray-800 rounded-2xl p-6 border ${colors.border} hover:shadow-lg transition-shadow duration-300`}
    >
      <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center mb-4`}>
        <useCase.icon className={`w-6 h-6 ${colors.text}`} />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
        {useCase.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        {useCase.description}
      </p>
    </motion.div>
  );
}

export default function UseCases() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 -left-40 w-[500px] h-[500px] bg-sky-400/10 dark:bg-sky-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -right-40 w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 text-sm font-medium mb-8 transition-colors"
            >
              <HiArrowLeft className="w-4 h-4" />
              Volver al inicio
            </Link>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white mb-6">
              Casos de{' '}
              <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
                Uso
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Descubre todas las funcionalidades que TrainingTrack Pro pone a disposición
              de entrenadores y atletas para llevar el rendimiento al siguiente nivel.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Coach Use Cases */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-1.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded-full text-sm font-semibold mb-4">
              Para Entrenadores
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Herramientas para el entrenador
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Todo lo que necesitas para planificar, monitorizar y analizar el rendimiento de tus atletas desde un solo panel.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {coachUseCases.map((uc, i) => (
              <UseCaseCard key={uc.title} useCase={uc} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Athlete Use Cases */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-semibold mb-4">
              Para Atletas
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Herramientas para el atleta
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Accede a tu planificación, métricas y comunicación con tu entrenador en cualquier momento y lugar.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {athleteUseCases.map((uc, i) => (
              <UseCaseCard key={uc.title} useCase={uc} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Shared / Platform Features */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-semibold mb-4">
              Plataforma
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Características de la plataforma
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Funcionalidades transversales que mejoran la experiencia de todos los usuarios.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sharedFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-sky-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Empieza a entrenar mejor hoy
            </h2>
            <p className="text-sky-100 text-lg mb-8 max-w-2xl mx-auto">
              Acceso gratuito completo durante la fase beta. Sin compromisos, sin tarjeta de crédito.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-sky-700 font-bold rounded-xl hover:bg-sky-50 transition-colors shadow-lg hover:shadow-xl"
            >
              Crear cuenta gratis
              <HiLightningBolt className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
