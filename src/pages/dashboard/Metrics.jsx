import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  FiTrendingUp,
  FiActivity,
  FiTarget,
  FiAward,
  FiUser,
} from 'react-icons/fi';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { getAthletes } from '../../services/athleteService';
import { getAllAthletesPerformance } from '../../services/metricsService';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Metrics = () => {
  const { profile } = useAuth();
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState([]);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.id) {
      console.log('⚠️ No profile.id en Metrics, mostrando datos vacíos');
      setAthletes([]);
      setPerformanceData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: athletesData } = await getAthletes(profile.id);
      setAthletes(athletesData || []);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const { data: metricsData } = await getAllAthletesPerformance(
        profile.id,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      setPerformanceData(metricsData || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
      setAthletes([]);
      setPerformanceData([]);
    } finally {
      setLoading(false);
    }
  };

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  // Sample data for pace progression
  const paceProgressionData = {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
    datasets: [
      {
        label: 'Ritmo Promedio (min/km)',
        data: [5.2, 5.0, 4.9, 4.8],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Sample data for training load
  const trainingLoadData = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    datasets: [
      {
        label: 'Carga de Entrenamiento',
        data: [300, 450, 350, 500, 400, 600, 200],
        backgroundColor: 'rgba(147, 51, 234, 0.8)',
        borderColor: 'rgb(147, 51, 234)',
        borderWidth: 1,
      },
    ],
  };

  // Sample data for training type distribution
  const trainingTypeData = {
    labels: ['Carrera', 'Gimnasio', 'Descanso', 'Otro'],
    datasets: [
      {
        data: [45, 30, 15, 10],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(147, 51, 234, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Métricas y Análisis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Analiza el rendimiento y progreso de tus atletas
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Athlete Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Atleta
            </label>
            <select
              value={selectedAthlete}
              onChange={(e) => setSelectedAthlete(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los atletas</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.firstName} {athlete.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Período
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 3 meses</option>
              <option value="180">Últimos 6 meses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FiTrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            4.8 min/km
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Ritmo Promedio</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">↑ 8% mejora</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <FiActivity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            2,850
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Carga Acumulada</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Esta semana</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <FiTarget className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            92%
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Tasa de Finalización</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">↑ 5% este mes</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <FiAward className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            3
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Nuevas Marcas</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Este mes</p>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pace Progression */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Progresión de Ritmo
          </h3>
          <div className="h-80">
            <Line data={paceProgressionData} options={chartOptions} />
          </div>
        </div>

        {/* Training Load */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Carga de Entrenamiento Semanal
          </h3>
          <div className="h-80">
            <Bar data={trainingLoadData} options={chartOptions} />
          </div>
        </div>

        {/* Training Type Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Distribución de Entrenamiento
          </h3>
          <div className="h-80 flex items-center justify-center">
            <Doughnut
              data={trainingTypeData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Mejores Rendimientos
          </h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((rank) => (
              <div
                key={rank}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {rank}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Atleta {rank}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(4.0 + rank * 0.1).toFixed(1)} min/km promedio
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    ↑ {(5 + rank * 2)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Metrics;
