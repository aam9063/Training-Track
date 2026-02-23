import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { showInfo, showSuccess } from '../../lib/toast';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch,
  FiFilter,
  FiTrash2,
  FiBarChart2,
  FiUser,
  FiLink,
  FiCalendar,
  FiUserCheck,
  FiUserX,
  FiClock,
  FiFileText,
} from 'react-icons/fi';
import useCoachAthletes from '../../hooks/useCoachAthletes';
import ConconiTestModal from '../../components/dashboard/ConconiTestModal';
import VAMTestModal from '../../components/dashboard/VAMTestModal';

const Athletes = () => {
  const { profile } = useAuth();
  const {
    athletes, pendingRequests, filteredAthletes, loading,
    searchTerm, setSearchTerm, selectedSpecialty, setSelectedSpecialty,
    raceDistances, processingRequest,
    handleAcceptRequest, handleRejectRequest, handleDelete: deleteAthlete,
  } = useCoachAthletes(profile?.coach_id || profile?.id);
  const [deleteModal, setDeleteModal] = useState({ show: false, athlete: null });
  const [conconiModal, setConconiModal] = useState({ show: false, athlete: null });
  const [vamModal, setVamModal] = useState({ show: false, athlete: null });
  const [testMenuAthleteId, setTestMenuAthleteId] = useState(null);
  const [testMenuPos, setTestMenuPos] = useState({ top: 0, left: 0 });
  const [expandedAthleteId, setExpandedAthleteId] = useState(null);

  const openTestMenu = useCallback((athleteId, e) => {
    if (testMenuAthleteId === athleteId) {
      setTestMenuAthleteId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setTestMenuPos({
      top: rect.top - 4,
      left: rect.right,
    });
    setTestMenuAthleteId(athleteId);
  }, [testMenuAthleteId]);

  const handleDelete = async () => {
    if (!deleteModal.athlete) return;
    await deleteAthlete(deleteModal.athlete);
    setDeleteModal({ show: false, athlete: null });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando atletas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Mis Atletas
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gestiona tus atletas y su rendimiento
            </p>
          </div>
          <button
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors w-full sm:w-auto font-medium"
            onClick={() => {
              const coachId = profile?.coach_id || profile?.id;
              const link = `${window.location.origin}/register?invite=${coachId}`;
              navigator.clipboard.writeText(link).then(() => {
                showSuccess('Enlace de invitación copiado al portapapeles');
              }).catch(() => {
                showInfo(link);
              });
            }}
          >
            <FiLink className="w-5 h-5" />
            <span>Copiar Invitación</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Specialty Filter */}
            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
              >
                <option value="all">Todas las distancias</option>
                {raceDistances.filter(d => d !== 'all').map((distance) => (
                  <option key={distance} value={distance}>
                    {distance}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-amber-200 dark:border-amber-800 flex items-center space-x-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <FiClock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                Solicitudes Pendientes
              </h3>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {pendingRequests.length} atleta{pendingRequests.length !== 1 ? 's' : ''} quiere{pendingRequests.length !== 1 ? 'n' : ''} unirse a tu equipo
              </p>
            </div>
          </div>
          <div className="divide-y divide-amber-200 dark:divide-amber-800">
            {pendingRequests.map((request) => (
              <div
                key={request.relationshipId}
                className="px-6 py-4 flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={
                      request.profileImage ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        request.firstName + ' ' + request.lastName
                      )}&background=f59e0b&color=fff`
                    }
                    alt={`${request.firstName} ${request.lastName}`}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {request.firstName} {request.lastName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {request.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAcceptRequest(request)}
                    disabled={processingRequest === request.relationshipId}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FiUserCheck className="w-4 h-4" />
                    <span>Aceptar</span>
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request)}
                    disabled={processingRequest === request.relationshipId}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FiUserX className="w-4 h-4" />
                    <span>Rechazar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Athletes List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {filteredAthletes.length === 0 ? (
          <div className="text-center py-16">
            <FiUser className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No se encontraron atletas
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || selectedSpecialty !== 'all'
                ? 'Intenta cambiar los filtros de búsqueda'
                : 'Los atletas aparecerán aquí cuando se registren con tu email'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile accordion list */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {filteredAthletes.map((athlete, index) => {
                const isExpanded = expandedAthleteId === athlete.id;
                return (
                  <motion.div
                    key={athlete.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    {/* Row header — tap to expand */}
                    <button
                      type="button"
                      onClick={() => setExpandedAthleteId(isExpanded ? null : athlete.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    >
                      <img
                        src={
                          athlete.profileImage ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            athlete.firstName + ' ' + athlete.lastName
                          )}&background=random`
                        }
                        alt={`${athlete.firstName} ${athlete.lastName}`}
                        className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {athlete.firstName} {athlete.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {athlete.email}
                        </p>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-gray-400 flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </motion.div>
                    </button>

                    {/* Expandable options */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 bg-gray-50 dark:bg-gray-700/40">
                            {/* Distances */}
                            {athlete.raceDistances?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {athlete.raceDistances.map((distance, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  >
                                    {distance}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Action grid */}
                            <div className="grid grid-cols-2 gap-2">
                              <Link
                                to={`/dashboard/athletes/${athlete.id}`}
                                className="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
                              >
                                <FiUser className="w-4 h-4 text-blue-500" />
                                Perfil
                              </Link>
                              <Link
                                to="/dashboard/planning"
                                className="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200 dark:hover:border-orange-700 transition-colors"
                              >
                                <FiCalendar className="w-4 h-4 text-orange-500" />
                                Planificación
                              </Link>
                              <Link
                                to={`/dashboard/athletes/${athlete.id}/metrics`}
                                className="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-200 dark:hover:border-purple-700 transition-colors"
                              >
                                <FiBarChart2 className="w-4 h-4 text-purple-500" />
                                Métricas
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedAthleteId(null);
                                  setConconiModal({ show: true, athlete });
                                }}
                                className="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-700 transition-colors text-left"
                              >
                                <FiFileText className="w-4 h-4 text-amber-500" />
                                Test Conconi
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedAthleteId(null);
                                  setVamModal({ show: true, athlete });
                                }}
                                className="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-700 transition-colors text-left"
                              >
                                <FiFileText className="w-4 h-4 text-amber-500" />
                                Test VAM
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedAthleteId(null);
                                  setDeleteModal({ show: true, athlete });
                                }}
                                className="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-gray-700 rounded-xl border border-red-100 dark:border-red-900/30 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                              >
                                <FiTrash2 className="w-4 h-4" />
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Atleta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Distancias
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAthletes.map((athlete, index) => (
                    <motion.tr
                      key={athlete.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={
                              athlete.profileImage ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                athlete.firstName + ' ' + athlete.lastName
                              )}&background=random`
                            }
                            alt={`${athlete.firstName} ${athlete.lastName}`}
                            className="w-10 h-10 rounded-full mr-3"
                          />
                          <div>
                            <Link
                              to={`/dashboard/athletes/${athlete.id}`}
                              className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              {athlete.firstName} {athlete.lastName}
                            </Link>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {athlete.gender || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {athlete.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {athlete.raceDistances?.length > 0 ? (
                            athlete.raceDistances.map((distance, idx) => (
                              <span
                                key={idx}
                                className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              >
                                {distance}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Sin distancias
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to="/dashboard/planning"
                            className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                            title="Planificación"
                          >
                            <FiCalendar className="w-5 h-5" />
                          </Link>
                          <Link
                            to={`/dashboard/athletes/${athlete.id}/metrics`}
                            className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            title="Ver métricas"
                          >
                            <FiBarChart2 className="w-5 h-5" />
                          </Link>
                          <button
                            onClick={(e) => openTestMenu(athlete.id, e)}
                            className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title="Tests"
                          >
                            <FiFileText className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ show: true, athlete })}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <FiTrash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Test Menu (fixed position to avoid overflow clipping) */}
      {testMenuAthleteId && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTestMenuAthleteId(null)} />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[170px]"
            style={{ top: testMenuPos.top, left: testMenuPos.left, transform: 'translate(-100%, -100%)' }}
          >
            <button
              onClick={() => {
                const athlete = athletes.find(a => a.id === testMenuAthleteId);
                setTestMenuAthleteId(null);
                if (athlete) setConconiModal({ show: true, athlete });
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Test de Conconi
            </button>
            <button
              onClick={() => {
                const athlete = athletes.find(a => a.id === testMenuAthleteId);
                setTestMenuAthleteId(null);
                if (athlete) setVamModal({ show: true, athlete });
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Test VAM
            </button>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Eliminar Atleta
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                ¿Estás seguro de que quieres eliminar a{' '}
                <strong>
                  {deleteModal.athlete?.firstName} {deleteModal.athlete?.lastName}
                </strong>
                ? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteModal({ show: false, athlete: null })}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Conconi Test Modal */}
      <ConconiTestModal
        isOpen={conconiModal.show}
        onClose={() => setConconiModal({ show: false, athlete: null })}
        athlete={conconiModal.athlete}
        coachId={profile?.coach_id || profile?.id}
        onSuccess={() => {
          console.log('Test de Conconi guardado exitosamente');
        }}
      />

      {/* VAM Test Modal */}
      <VAMTestModal
        isOpen={vamModal.show}
        onClose={() => setVamModal({ show: false, athlete: null })}
        athlete={vamModal.athlete}
        coachId={profile?.coach_id || profile?.id}
        onSuccess={() => {
          console.log('Test VAM guardado exitosamente');
        }}
      />
    </div>
  );
};

export default Athletes;
