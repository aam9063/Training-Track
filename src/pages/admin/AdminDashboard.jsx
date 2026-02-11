import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiUserCheck, FiActivity, FiLink, FiDatabase, FiArrowRight } from 'react-icons/fi';
import { getAdminStats, getAllUsers } from '../../services/adminService';

const StatCard = ({ icon: Icon, label, value, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </motion.div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetchData = useCallback(async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    try {
      const [statsRes, usersRes] = await Promise.all([
        getAdminStats(),
        getAllUsers(),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (usersRes.data) setRecentUsers(usersRes.data.slice(0, 5));
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando panel de administracion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Panel de Administracion
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Resumen general de la plataforma
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={FiUsers}
          label="Total Usuarios"
          value={stats?.totalUsers || 0}
          color="bg-sky-600"
          delay={0}
        />
        <StatCard
          icon={FiUserCheck}
          label="Entrenadores"
          value={stats?.totalCoaches || 0}
          color="bg-sky-600"
          delay={0.05}
        />
        <StatCard
          icon={FiActivity}
          label="Atletas"
          value={stats?.totalAthletes || 0}
          color="bg-green-600"
          delay={0.1}
        />
        <StatCard
          icon={FiLink}
          label="Relaciones Activas"
          value={stats?.activeRelationships || 0}
          color="bg-orange-500"
          delay={0.15}
        />
        <StatCard
          icon={FiDatabase}
          label="Sesiones Totales"
          value={stats?.totalSessions || 0}
          color="bg-pink-600"
          delay={0.2}
        />
      </div>

      {/* Recent Users */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Usuarios Recientes
          </h2>
          <Link
            to="/admin/users"
            className="text-sm text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
          >
            Ver todos <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No hay usuarios registrados
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentUsers.map((user) => (
              <Link
                key={user.id}
                to={`/admin/users/${user.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {user.profile_image ? (
                    <img src={user.profile_image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${user.role === 'coach' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                      <span className="font-semibold text-sm">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    user.role === 'coach'
                      ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  }`}>
                    {user.role === 'coach' ? 'Coach' : 'Atleta'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                    {formatDate(user.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
