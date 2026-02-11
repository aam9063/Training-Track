import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSearch, FiFilter, FiToggleLeft, FiToggleRight, FiChevronRight } from 'react-icons/fi';
import { getAllUsers, toggleUserActive } from '../../services/adminService';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toggling, setToggling] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAllUsers({ search, roleFilter, statusFilter });
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleToggleActive = async (e, userId, currentStatus) => {
    e.preventDefault();
    e.stopPropagation();
    setToggling(userId);
    try {
      const { error } = await toggleUserActive(userId, !currentStatus);
      if (!error) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, is_active: !currentStatus } : u
        ));
      }
    } catch (error) {
      console.error('Error toggling user:', error);
    } finally {
      setToggling(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPlanLabel = (plan) => {
    const plans = {
      starter: 'Starter',
      professional: 'Professional',
      elite: 'Elite',
    };
    return plans[plan] || plan || 'Starter';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Gestion de Usuarios
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {users.length} usuario{users.length !== 1 ? 's' : ''} encontrado{users.length !== 1 ? 's' : ''}
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        {/* Search */}
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Role Filter */}
        <div className="relative">
          <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none appearance-none cursor-pointer"
          >
            <option value="all">Todos los roles</option>
            <option value="coach">Entrenadores</option>
            <option value="athlete">Atletas</option>
          </select>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none appearance-none cursor-pointer"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Desactivados</option>
        </select>
      </motion.div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          No se encontraron usuarios con los filtros aplicados
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
          >
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rol</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Registro</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-4">
                      <Link to={`/admin/users/${user.id}`} className="flex items-center gap-3 min-w-0">
                        {user.profile_image ? (
                          <img src={user.profile_image} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${user.role === 'coach' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
                            <span className="font-semibold text-xs">{user.first_name?.[0]}{user.last_name?.[0]}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.first_name} {user.last_name}
                            {user.is_admin && <span className="ml-2 text-xs bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-1.5 py-0.5 rounded-full">Admin</span>}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        user.role === 'coach'
                          ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {user.role === 'coach' ? 'Coach' : 'Atleta'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {user.role === 'coach' ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {getPlanLabel(user.coach?.subscription_plan)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        user.is_active !== false
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${user.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {user.is_active !== false ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(user.created_at)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => handleToggleActive(e, user.id, user.is_active !== false)}
                          disabled={toggling === user.id || user.is_admin}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.is_admin
                              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                              : user.is_active !== false
                                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }`}
                          title={user.is_admin ? 'No puedes desactivar un admin' : user.is_active !== false ? 'Desactivar' : 'Activar'}
                        >
                          {user.is_active !== false ? (
                            <FiToggleRight className="w-5 h-5" />
                          ) : (
                            <FiToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        <Link
                          to={`/admin/users/${user.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                        >
                          <FiChevronRight className="w-5 h-5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/admin/users/${user.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {user.profile_image ? (
                        <img src={user.profile_image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${user.role === 'coach' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
                          <span className="font-semibold text-sm">{user.first_name?.[0]}{user.last_name?.[0]}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <FiChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      user.role === 'coach'
                        ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}>
                      {user.role === 'coach' ? 'Coach' : 'Atleta'}
                    </span>
                    {user.role === 'coach' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getPlanLabel(user.coach?.subscription_plan)}
                      </span>
                    )}
                    <span className={`ml-auto inline-flex items-center gap-1 text-xs ${
                      user.is_active !== false ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {user.is_active !== false ? 'Activo' : 'Desactivado'}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
