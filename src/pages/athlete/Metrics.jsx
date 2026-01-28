import { motion } from 'framer-motion';
import { Line, Bar } from 'react-chartjs-2';
import {
  FiTrendingUp,
  FiActivity,
  FiAward,
  FiTarget,
} from 'react-icons/fi';

const AthleteMetrics = () => {

  // Datos de ejemplo - después se cargarán desde Supabase
  const personalBests = [
    { distance: '5K', time: '16:45', date: '2026-01-15', pace: '3:21' },
    { distance: '10K', time: '34:30', date: '2025-12-20', pace: '3:27' },
    { distance: '21K', time: '1:15:00', date: '2025-11-10', pace: '3:34' },
    { distance: '42K', time: '2:45:30', date: '2025-10-05', pace: '3:55' },
  ];

  const physicalMetrics = {
    vo2max: 58.5,
    restingHR: 42,
    maxHR: 195,
    weight: 68.5,
    bodyFat: 8.2,
  };

  // Datos para gráfico de progresión (últimos 12 semanas)
  const progressionData = {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8', 'Sem 9', 'Sem 10', 'Sem 11', 'Sem 12'],
    datasets: [
      {
        label: 'Kilómetros Semanales',
        data: [45, 52, 48, 55, 58, 62, 60, 65, 68, 70, 72, 75],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Datos para gráfico de ritmos
  const paceData = {
    labels: ['5K', '10K', '15K', '21K', '25K', '30K', '35K', '42K'],
    datasets: [
      {
        label: 'Ritmo (min/km)',
        data: [3.35, 3.45, 3.50, 3.57, 4.05, 4.15, 4.25, 3.92],
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Mis Métricas
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Análisis de rendimiento y progresión
        </p>
      </div>

      {/* Physical Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">VO₂ Max</span>
            <FiActivity className="w-4 h-4 sm:w-5 sm:h-5 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1">{physicalMetrics.vo2max}</p>
          <p className="text-xs opacity-75">ml/kg/min</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 sm:p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">FC Reposo</span>
            <FiActivity className="w-4 h-4 sm:w-5 sm:h-5 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1">{physicalMetrics.restingHR}</p>
          <p className="text-xs opacity-75">bpm</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 sm:p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">FC Máxima</span>
            <FiTarget className="w-4 h-4 sm:w-5 sm:h-5 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1">{physicalMetrics.maxHR}</p>
          <p className="text-xs opacity-75">bpm</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 sm:p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">Peso</span>
            <FiTrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1">{physicalMetrics.weight}</p>
          <p className="text-xs opacity-75">kg</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 sm:p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">Grasa</span>
            <FiAward className="w-4 h-4 sm:w-5 sm:h-5 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1">{physicalMetrics.bodyFat}%</p>
          <p className="text-xs opacity-75">corporal</p>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Weekly KM Progression */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4">
            Progresión Semanal (km)
          </h3>
          <div className="h-48 sm:h-64">
            <Line data={progressionData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Pace Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4">
            Ritmos por Distancia
          </h3>
          <div className="h-48 sm:h-64">
            <Bar data={paceData} options={chartOptions} />
          </div>
        </motion.div>
      </div>

      {/* Personal Bests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center space-x-2 mb-4 sm:mb-6">
          <FiAward className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Marcas Personales
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {personalBests.map((best, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-4 border-2 border-yellow-200 dark:border-yellow-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {best.distance}
                </span>
                <span className="text-xl">🏆</span>
              </div>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                {best.time}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {best.pace} min/km
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {new Date(best.date).toLocaleDateString('es-ES')}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default AthleteMetrics;
