import { useState, useEffect, useMemo } from 'react';
import {
  getAthletes,
  removeAthlete,
  getPendingAthleteRequests,
  acceptAthleteRequest,
  rejectAthleteRequest,
} from '../services/athleteService';
import { showSuccess, showError } from '../lib/toast';

export default function useCoachAthletes(profileId) {
  const [athletes, setAthletes] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [processingRequest, setProcessingRequest] = useState(null);

  // Derived filtered list (replaces useState + useEffect combo)
  const filteredAthletes = useMemo(() => {
    let filtered = [...athletes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (athlete) =>
          athlete.firstName?.toLowerCase().includes(term) ||
          athlete.lastName?.toLowerCase().includes(term) ||
          athlete.email?.toLowerCase().includes(term)
      );
    }

    if (selectedSpecialty !== 'all') {
      filtered = filtered.filter((athlete) =>
        athlete.raceDistances?.includes(selectedSpecialty)
      );
    }

    return filtered;
  }, [athletes, searchTerm, selectedSpecialty]);

  const raceDistances = useMemo(() =>
    ['all', ...new Set(athletes.flatMap(a => a.raceDistances || []))],
    [athletes]
  );

  const loadAthletes = async () => {
    if (!profileId) {
      setAthletes([]);
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [athletesResult, pendingResult] = await Promise.all([
        getAthletes(profileId),
        getPendingAthleteRequests(profileId),
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

  useEffect(() => {
    loadAthletes();
  }, [profileId]);

  const handleAcceptRequest = async (request) => {
    setProcessingRequest(request.relationshipId);
    try {
      const { error } = await acceptAthleteRequest(request.relationshipId);
      if (error) throw error;

      setPendingRequests(prev => prev.filter(r => r.relationshipId !== request.relationshipId));
      setAthletes(prev => [...prev, { ...request, status: 'active' }]);
      showSuccess('Solicitud aceptada correctamente');
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      showError('Error al aceptar la solicitud');
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
      showSuccess('Solicitud rechazada');
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      showError('Error al rechazar la solicitud');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDelete = async (athlete) => {
    try {
      const { error } = await removeAthlete(athlete.relationshipId);
      if (error) throw error;

      setAthletes(prev => prev.filter(a => a.id !== athlete.id));
      showSuccess('Atleta eliminado correctamente');
    } catch (error) {
      console.error('Error deleting athlete:', error);
      showError('Error al eliminar el atleta');
    }
  };

  return {
    athletes,
    pendingRequests,
    filteredAthletes,
    loading,
    searchTerm,
    setSearchTerm,
    selectedSpecialty,
    setSelectedSpecialty,
    raceDistances,
    processingRequest,
    handleAcceptRequest,
    handleRejectRequest,
    handleDelete,
    loadAthletes,
  };
}
