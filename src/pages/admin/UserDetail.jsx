import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiArrowLeft, FiMail, FiCalendar, FiClock,
  FiShield, FiUser, FiUsers, FiSave,
  FiToggleLeft, FiToggleRight,
} from 'react-icons/fi';
import { getUserDetail, toggleUserActive, updateCoachSubscription } from '../../services/adminService';

const PLANS = [
  { value: 'starter', label: 'Starter', maxAthletes: 10 },
  { value: 'professional', label: 'Professional', maxAthletes: 30 },
  { value: 'elite', label: 'Elite', maxAthletes: 999 },
];

export default function UserDetail() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [maxAthletes, setMaxAthletes] = useState(10);
  const [successMsg, setSuccessMsg] = useState('');
  const hasFetched = useRef(false);

  const fetchUser = useCallback(async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    try {
      const { data, error } = await getUserDetail(userId);
      if (error) throw error;
      if (data) {
        setUser(data);
        if (data.role === 'coach' && data.roleData) {
          setSelectedPlan(data.roleData.subscription_plan || 'starter');
          setMaxAthletes(data.roleData.max_athletes || 10);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleToggleActive = async () => {
    if (user.is_admin) return;
    setToggling(true);
    try {
      const newStatus = !(user.is_active !== false);
      const { error } = await toggleUserActive(userId, newStatus);
      if (!error) {
        setUser(prev => ({ ...prev, is_active: newStatus }));
        showSuccess(newStatus ? 'Usuario activado' : 'Usuario desactivado');
      }
    } catch (error) {
      console.error('Error toggling user:', error);
    } finally {
      setToggling(false);
    }
  };

  const handleSavePlan = async () => {
    setSavingPlan(true);
    try {
      const { error } = await updateCoachSubscription(userId, {
        subscription_plan: selectedPlan,
        max_athletes: parseInt(maxAthletes) || 10,
      });
      if (!error) {
        setUser(prev => ({
          ...prev,
          roleData: {
            ...prev.roleData,
            subscription_plan: selectedPlan,
            max_athletes: parseInt(maxAthletes) || 10,
          },
        }));
        showSuccess('Plan actualizado correctamente');
      }
    } catch (error) {
      console.error('Error saving plan:', error);
    } finally {
      setSavingPlan(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Usuario no encontrado</p>
        <Link to="/admin/users" className="text-sky-600 hover:underline mt-2 inline-block">
          Volver a usuarios
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 mb-6 transition-colors"
      >
        <FiArrowLeft className="w-4 h-4" />
        Volver a usuarios
      </Link>

      {/* Success Toast */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm"
        >
          {successMsg}
        </motion.div>
      )}

      {/* User Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {user.profile_image ? (
            <img src={user.profile_image} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold ${
              user.role === 'coach'
                ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            }`}>
              {user.first_name?.[0]}{user.last_name?.[0]}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {user.first_name} {user.last_name}
              </h1>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                user.role === 'coach'
                  ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              }`}>
                {user.role === 'coach' ? 'Coach' : 'Atleta'}
              </span>
              {user.is_admin && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">
                  Admin
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <FiMail className="w-4 h-4" /> {user.email}
              </span>
              <span className="flex items-center gap-1.5">
                <FiCalendar className="w-4 h-4" /> Registro: {formatDate(user.created_at)}
              </span>
            </div>
            {user.last_login && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1.5">
                <FiClock className="w-3.5 h-3.5" /> Ultimo acceso: {formatDate(user.last_login)}
              </p>
            )}
          </div>
        </div>

        {/* Status & Toggle */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
              user.is_active !== false ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${user.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {user.is_active !== false ? 'Cuenta activa' : 'Cuenta desactivada'}
            </span>
          </div>
          <button
            onClick={handleToggleActive}
            disabled={toggling || user.is_admin}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              user.is_admin
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : user.is_active !== false
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
            }`}
          >
            {user.is_active !== false ? (
              <>
                <FiToggleRight className="w-5 h-5" />
                {toggling ? 'Desactivando...' : 'Desactivar cuenta'}
              </>
            ) : (
              <>
                <FiToggleLeft className="w-5 h-5" />
                {toggling ? 'Activando...' : 'Activar cuenta'}
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Coach Plan Management */}
      {user.role === 'coach' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <FiShield className="w-5 h-5 text-sky-600" />
            Plan de Suscripcion
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Plan Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Plan
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => {
                  setSelectedPlan(e.target.value);
                  const plan = PLANS.find(p => p.value === e.target.value);
                  if (plan) setMaxAthletes(plan.maxAthletes);
                }}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              >
                {PLANS.map(plan => (
                  <option key={plan.value} value={plan.value}>{plan.label}</option>
                ))}
              </select>
            </div>

            {/* Max Athletes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Max. Atletas
              </label>
              <input
                type="number"
                min="1"
                max="999"
                value={maxAthletes}
                onChange={(e) => setMaxAthletes(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-end">
              <button
                onClick={handleSavePlan}
                disabled={savingPlan}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                {savingPlan ? 'Guardando...' : 'Guardar Plan'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Relationships */}
      {user.relationships && user.relationships.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <FiUsers className="w-5 h-5 text-sky-600" />
            {user.role === 'coach' ? 'Sus Atletas' : 'Su Entrenador'}
          </h2>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {user.relationships.map((rel) => (
              <div key={rel.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <FiUser className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{rel.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{rel.email}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  rel.status === 'active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : rel.status === 'pending'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {rel.status === 'active' ? 'Activo' : rel.status === 'pending' ? 'Pendiente' : 'Inactivo'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
