import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch,
  FiFilter,
  FiEdit2,
  FiTrash2,
  FiBarChart2,
  FiUser,
  FiPlus,
  FiCalendar,
  FiUserCheck,
  FiUserX,
  FiClock,
} from 'react-icons/fi';
import {
  getAthletes,
  removeAthlete,
  getPendingAthleteRequests,
  acceptAthleteRequest,
  rejectAthleteRequest,
} from '../../services/athleteService';
import WeeklyTrainingModal from '../../components/dashboard/WeeklyTrainingModal';

const Athletes = () => {
  const { profile } = useAuth();
  const [athletes, setAthletes] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [filteredAthletes, setFilteredAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [deleteModal, setDeleteModal] = useState({ show: false, athlete: null });
  const [trainingModal, setTrainingModal] = useState({ show: false, athlete: null });
  const [processingRequest, setProcessingRequest] = useState(null);

  // Get unique specialties for filter
  const specialties = ['all', ...new Set(athletes.flatMap(a => a.specialties || []))];

  useEffect(() => {
    loadAthletes();
  }, [profile]);

  useEffect(() => {
    filterAthletes();
  }, [athletes, searchTerm, selectedSpecialty]);

  const loadAthletes = async () => {
    if (!profile?.id) {
      setAthletes([]);
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const coachId = profile.coach_id || profile.id;

      // Cargar atletas activos y solicitudes pendientes en paralelo
      const [athletesResult, pendingResult] = await Promise.all([
        getAthletes(coachId),
        getPendingAthleteRequests(coachId),
      ]);

      setAthletes(athletesResult.data || []);
      setPendingRequests(pendingResult.data || []);
    } catch (error) {
      console.error('Error cargando atletas:', error.message);
      setAthletes([]);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (request) => {
    setProcessingRequest(request.relationshipId);
    try {
      const { error } = await acceptAthleteRequest(request.relationshipId);
      if (error) throw error;

      // Mover de pendientes a activos
      setPendingRequests(prev => prev.filter(r => r.relationshipId !== request.relationshipId));
      setAthletes(prev => [...prev, { ...request, status: 'active' }]);
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      alert('Error al aceptar la solicitud');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (request) => {
    setProcessingRequest(request.relationshipId);
    try {
      const { error } = await rejectAthleteRequest(request.relationshipId);
      if (error) throw error;

      setPendingRequests(prev => prev.filter(r => r.relationshipId !== request.relationshipId));
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      alert('Error al rechazar la solicitud');
    } finally {
      setProcessingRequest(null);
    }
  };

  const filterAthletes = () => {
    let filtered = [...athletes];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (athlete) =>
          athlete.firstName?.toLowerCase().includes(term) ||
          athlete.lastName?.toLowerCase().includes(term) ||
          athlete.email?.toLowerCase().includes(term)
      );
    }

    // Specialty filter
    if (selectedSpecialty !== 'all') {
      filtered = filtered.filter((athlete) =>
        athlete.specialties?.includes(selectedSpecialty)
      );
    }

    setFilteredAthletes(filtered);
  };

  const handleDelete = async () => {
    if (!deleteModal.athlete) return;

    try {
      const { error } = await removeAthlete(deleteModal.athlete.relationshipId);
      if (error) throw error;

      setAthletes(athletes.filter(a => a.id !== deleteModal.athlete.id));
      setDeleteModal({ show: false, athlete: null });
    } catch (error) {
      console.error('Error deleting athlete:', error);
      alert('Error al eliminar el atleta');
    }
  };

  const getSpecialtyLabel = (specialty) => {
    const labels = {
      '800m': '800m',
      '1500m': '1500m',
      '3000m': '3000m',
      '5k': '5K',
      '10k': '10K',
      'half-marathon': 'Media Maratón',
      'marathon': 'Maratón',
      'middle-distance': 'Medio Fondo',
      'long-distance': 'Fondo',
    };
    return labels[specialty] || specialty;
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Mis Atletas
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gestiona tus atletas y su rendimiento
            </p>
          </div>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            onClick={() => alert('Función de añadir atleta próximamente')}
          >
            <FiPlus className="w-5 h-5" />
            <span>Añadir Atleta</span>
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
                <option value="all">Todas las modalidades</option>
                {specialties.filter(s => s !== 'all').map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {getSpecialtyLabel(specialty)}
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

      {/* Athletes Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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
          <div className="overflow-x-auto">
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
                    Especialidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    VO2 Max
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
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {athlete.firstName} {athlete.lastName}
                          </div>
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
                        {athlete.specialties?.length > 0 ? (
                          athlete.specialties.map((specialty, idx) => (
                            <span
                              key={idx}
                              className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              {getSpecialtyLabel(specialty)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Sin especialidad
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {athlete.vo2Max || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setTrainingModal({ show: true, athlete })}
                          className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                          title="Crear Entrenamiento Semanal"
                        >
                          <FiCalendar className="w-5 h-5" />
                        </button>
                        <Link
                          to={`/dashboard/athletes/${athlete.id}/metrics`}
                          className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                          title="Ver métricas"
                        >
                          <FiBarChart2 className="w-5 h-5" />
                        </Link>
                        <Link
                          to={`/dashboard/athletes/${athlete.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Ver perfil"
                        >
                          <FiUser className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => alert('Editar atleta próximamente')}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <FiEdit2 className="w-5 h-5" />
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
        )}
      </div>

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

      {/* Weekly Training Modal */}
      <WeeklyTrainingModal
        isOpen={trainingModal.show}
        onClose={() => setTrainingModal({ show: false, athlete: null })}
        athlete={trainingModal.athlete}
        coachId={profile?.coach_id || profile?.id}
        onSuccess={() => {
          // Optionally refresh or show success message
          console.log('Entrenamiento guardado exitosamente');
        }}
      />
    </div>
  );
};

export default Athletes;
