import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { FiSmartphone, FiDownload, FiShare2 } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import IphoneMockup from '../common/IphoneMockup';

const mobileScreenshots = [
  {
    id: 1,
    light: '/img/mobile-1.png',
    dark: '/img/mobile-1-dark.png',
    ext: 'png',
    title: 'Métricas del atleta',
    description: 'Km reales de Strava, ritmo, FC y predictor de tiempos en un vistazo.',
  },
  {
    id: 2,
    light: '/img/mobile-2.png',
    dark: '/img/mobile-2-dark.png',
    ext: 'png',
    title: 'Calendario mensual',
    description: 'Sesiones y competiciones organizadas. Toca cualquier día para ver el detalle.',
  },
  {
    id: 3,
    light: '/img/mobile-3.png',
    dark: '/img/mobile-3-dark.png',
    ext: 'png',
    title: 'Informe IA semanal',
    description: 'ACWR, TSB, RPE y alertas de carga. Todo en la palma de tu mano.',
  },
  {
    id: 4,
    light: '/img/mobile-4.png',
    dark: '/img/mobile-4-dark.png',
    ext: 'png',
    title: 'Planificador de temporada',
    description: 'Diseña planes con mesociclos y asígnalos a tus atletas desde el móvil.',
  },
];

const pwaFeatures = [
  { icon: FiShare2, text: 'Instálala desde el navegador — sin pasar por el App Store' },
  { icon: FiDownload, text: 'Queda en tu pantalla de inicio como cualquier app' },
  { icon: FiSmartphone, text: 'Diseñada para móvil desde el primer momento' },
];

export default function MobileShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { theme } = useTheme();

  const getSrc = (s) => theme === 'dark' ? s.dark : s.light;

  const handleImgError = (e, s) => {
    if (e.target.src !== s.light) e.target.src = s.light;
  };

  const active = mobileScreenshots[activeIndex];

  return (
    <section className="py-24 bg-gradient-to-b from-white via-sky-50/30 to-white dark:from-[#0A0A0A] dark:via-[#111111] dark:to-[#0A0A0A] overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
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
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-sm font-semibold mb-4"
          >
            <FiSmartphone className="w-4 h-4" />
            App móvil
          </motion.span>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            En tu bolsillo,{' '}
            <span className="text-sky-600 dark:text-sky-400">siempre</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Sin pasar por el App Store. Ábrela en el navegador, pulsa "Añadir a inicio"
            y ya tienes TrainingTrack en tu móvil como cualquier otra app.
          </p>
        </motion.div>

        {/* Main layout */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — phone frames */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7 }}
            className="relative flex justify-center sm:px-20 lg:px-12"
          >
            {/* Glow */}
            <div className="absolute inset-0 bg-sky-400/10 dark:bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* 3D perspective wrapper */}
            <div className="relative z-10 w-full max-w-[200px] sm:max-w-[240px] [perspective:900px]">

              {/* iPhone mockup — tilted */}
              <motion.div
                initial={{ rotateY: 0, rotateX: 0 }}
                whileInView={{ rotateY: -16, rotateX: 5 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                whileHover={{ rotateY: -6, rotateX: 2, transition: { duration: 0.5 } }}
                className="[transform-style:preserve-3d] [filter:drop-shadow(-20px_20px_40px_rgba(0,0,0,0.35))]"
              >
                <div className="relative">
                  {/* Animated screenshot layer */}
                  <div
                    className="absolute z-[1] overflow-hidden pointer-events-none"
                    style={{
                      left: '4.91%', top: '2.18%', width: '89.95%', height: '95.64%',
                      borderRadius: '14.31% / 6.61%',
                    }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`${active.id}-${theme}`}
                        src={getSrc(active)}
                        alt={active.title}
                        onError={(e) => handleImgError(e, active)}
                        initial={{ opacity: 0, scale: 1.04 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className="w-full h-full object-cover object-top"
                      />
                    </AnimatePresence>
                  </div>
                  <IphoneMockup />
                </div>
              </motion.div>

              {/* PWA install badge — outside the 3D transform */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
                className="absolute -top-3 -right-14 sm:-right-16 bg-white dark:bg-[#141414] rounded-2xl shadow-xl p-2.5 border border-gray-200 dark:border-[#2A2A2A] hidden sm:flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src="/img/mobile-pwa.png"
                    alt="TrainingTrack instalada en móvil"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-900 dark:text-white leading-tight">Instalada</p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight whitespace-nowrap">Como app nativa</p>
                </div>
              </motion.div>

              {/* Floating AI badge — outside the 3D transform */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="absolute -bottom-3 -left-14 sm:-left-16 bg-slate-900 rounded-xl shadow-xl px-2.5 py-2 hidden sm:flex items-center gap-1.5 border border-slate-700"
              >
                <BsStars className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-white whitespace-nowrap">IA · cada lunes</span>
              </motion.div>
            </div>
          </motion.div>

          {/* Right — tabs + info */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            {/* Screen selector tabs */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {mobileScreenshots.map((s, i) => (
                <motion.button
                  key={s.id}
                  onClick={() => setActiveIndex(i)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    i === activeIndex
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                      : 'border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#141414] hover:border-sky-300 dark:hover:border-sky-700'
                  }`}
                >
                  <div className={`w-8 h-1.5 rounded-full mb-2 ${i === activeIndex ? 'bg-sky-500' : 'bg-gray-300 dark:bg-[#2A2A2A]'}`} />
                  <p className={`text-sm font-semibold leading-tight ${i === activeIndex ? 'text-sky-600 dark:text-sky-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {s.title}
                  </p>
                </motion.button>
              ))}
            </div>

            {/* Active screen description */}
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="mb-10"
              >
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {active.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                  {active.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* PWA features */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
                App móvil instalable desde el navegador
              </p>
              {pwaFeatures.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{f.text}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
