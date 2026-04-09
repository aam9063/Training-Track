import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiZap, FiCalendar, FiTrendingUp, FiSmartphone, FiUsers, FiUser } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { useTheme } from '../../contexts/ThemeContext';
import WaitlistForm from './WaitlistForm';
import SplitText from '../common/SplitText';
import IphoneMockup from '../common/IphoneMockup';

export default function Hero({ audience, onSelectAudience }) {
  const { theme } = useTheme();
  const mobileImg = theme === 'dark' ? '/img/mobile-5-dark.png' : '/img/mobile-5.png';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
  };

  const features = [
    { icon: FiZap,        text: 'Informes IA cada lunes: ACWR, TSB, RPE y alertas de riesgo de lesión' },
    { icon: FiTrendingUp, text: 'Strava conectado — las sesiones se completan solas al terminar de correr' },
    { icon: FiCalendar,   text: 'Planificador por mesociclos con asignación masiva a todos tus atletas' },
    { icon: FiSmartphone, text: 'PWA instalable en móvil — sin App Store, con notificaciones push' },
  ];

  const handleCoachClick = (e) => {
    e.preventDefault();
    onSelectAudience?.('coach');
    const el = document.querySelector('#pricing');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAthleteClick = (e) => {
    e.preventDefault();
    onSelectAudience?.('athlete');
    const el = document.querySelector('#entrenamiento-ia');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-gray-50 dark:from-[#0A0A0A] dark:via-[#111111] dark:to-[#0A0A0A] pt-20"
    >
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute top-20 right-10 w-72 h-72 bg-sky-400/20 dark:bg-sky-600/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-20 left-10 w-96 h-96 bg-sky-300/15 dark:bg-sky-700/10 rounded-full blur-3xl"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — Text */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:text-left"
          >
            {/* Badge */}
            <motion.div variants={itemVariants} className="flex justify-center lg:justify-start mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 dark:bg-sky-900/30 rounded-full">
                <span className="w-2 h-2 bg-sky-600 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                  ¡Regístrate ahora y empieza gratis!
                </span>
              </div>
            </motion.div>

            {/* Heading */}
            <div className="mb-5 text-center lg:text-left">
              <SplitText
                text="Entrena con datos."
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight"
                tag="h1"
                delay={40}
                duration={0.8}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 30 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-50px"
                textAlign="inherit"
              />
              <SplitText
                text="No con Excel"
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-sky-600 dark:text-sky-400 leading-tight"
                tag="span"
                delay={40}
                duration={0.8}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 30 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-50px"
                textAlign="inherit"
              />
            </div>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-7 max-w-xl mx-auto lg:mx-0 leading-relaxed text-center lg:text-left"
            >
              Para entrenadores y atletas independientes. IA, Strava, métricas avanzadas y planificación inteligente — todo en un solo lugar.
            </motion.p>

            {/* Feature list */}
            <motion.div variants={itemVariants} className="flex flex-col items-start gap-2.5 mb-8">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
                    <div className="w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <span className="text-sm sm:text-base text-left">{f.text}</span>
                  </div>
                );
              })}
            </motion.div>

            {/* Dual Path Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Coach path card */}
              <motion.a
                href="#pricing"
                onClick={handleCoachClick}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="group flex items-start gap-3 p-4 rounded-2xl border-2 border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 hover:border-sky-400 dark:hover:border-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-all duration-200 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center flex-shrink-0">
                  <FiUsers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Soy Entrenador</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">
                    Dashboard de atletas, planificación IA, informes ACWR/TSB automáticos
                  </p>
                  <span className="inline-block mt-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 group-hover:underline">
                    Ver planes de entrenador →
                  </span>
                </div>
              </motion.a>

              {/* Athlete path card */}
              <motion.a
                href="#entrenamiento-ia"
                onClick={handleAthleteClick}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="group flex items-start gap-3 p-4 rounded-2xl border-2 border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#141414] hover:border-sky-400 dark:hover:border-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all duration-200 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center flex-shrink-0">
                  <BsStars className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Soy Atleta Independiente</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">
                    Tu entrenador virtual con IA, planes personalizados y Hermes IA
                  </p>
                  <span className="inline-block mt-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 group-hover:underline">
                    Descubrir entrenamiento IA →
                  </span>
                </div>
              </motion.a>
            </motion.div>

            {/* Primary CTA */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <FiUser className="w-4 h-4" />
                Regístrate gratis
              </Link>
            </motion.div>

            <WaitlistForm source="hero" variant="light" className="mt-6" />
          </motion.div>

          {/* Right — Mock phone + floating cards */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            className="relative hidden lg:flex justify-center"
          >
            {/* iPhone mockup */}
            <div className="relative w-72 mx-auto [perspective:1000px]">
              <motion.div
                initial={{ rotateY: 0, rotateX: 0 }}
                animate={{ rotateY: 16, rotateX: 5 }}
                transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
                whileHover={{ rotateY: 6, rotateX: 2, transition: { duration: 0.5 } }}
                className="[transform-style:preserve-3d] [filter:drop-shadow(20px_20px_40px_rgba(0,0,0,0.35))]"
              >
                <IphoneMockup src={mobileImg} />
              </motion.div>
            </div>

            {/* Floating card — informe IA */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="absolute -left-6 top-1/4 bg-white dark:bg-[#141414] rounded-2xl shadow-xl p-3.5 border border-gray-100 dark:border-[#2A2A2A] max-w-[180px]"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <FiZap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white">Informe IA</span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">ACWR 1.15 · TSB +4 · RPE 6.2 — Semana óptima ✓</p>
            </motion.div>

            {/* Floating card — sesión completada */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="absolute -right-6 bottom-1/3 bg-white dark:bg-[#141414] rounded-2xl shadow-xl p-3.5 border border-gray-100 dark:border-[#2A2A2A]"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">Sesión completada</p>
                  <p className="text-[10px] text-gray-400">Sincronizado con Strava</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
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
          className="w-6 h-10 border-2 border-gray-400 dark:border-[#2A2A2A] rounded-full flex items-start justify-center p-2"
        >
          <motion.div
            animate={{ height: ['0%', '40%', '0%'] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 bg-gray-400 dark:bg-[#2A2A2A] rounded-full"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
