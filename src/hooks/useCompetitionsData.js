import { useState, useEffect, useCallback } from 'react';
import { toLocalDateStr } from '../lib/dateUtils';
import { showError, showSuccess } from '../lib/toast';
import {
  getIndependentCompetitions,
  createCompetition,
  updateCompetition,
  deleteCompetition,
} from '../services/competitionService';

/**
 * Custom hook for the Competitions page.
 * Separates competitions into upcoming and past, computes countdown days,
 * and exposes CRUD handlers.
 *
 * @param {string} userId - UUID of the authenticated independent athlete
 */
export default function useCompetitionsData(userId) {
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);

  const splitCompetitions = useCallback((competitions) => {
    const today = toLocalDateStr(new Date());

    const upcomingList = competitions
      .filter((c) => c.event_date >= today)
      .map((c) => {
        const eventDate = new Date(c.event_date + 'T00:00:00');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const diffMs = eventDate.getTime() - todayDate.getTime();
        const daysUntil = Math.round(diffMs / 86400000);
        return { ...c, daysUntil };
      });

    const pastList = competitions
      .filter((c) => c.event_date < today)
      .sort((a, b) => (a.event_date < b.event_date ? 1 : -1));

    setUpcoming(upcomingList);
    setPast(pastList);
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await getIndependentCompetitions(userId);
      if (error) throw error;
      splitCompetitions(data ?? []);
    } catch {
      showError('Error al cargar las competiciones');
    } finally {
      setLoading(false);
    }
  }, [userId, splitCompetitions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = useCallback(
    async (competitionData) => {
      const { data, error } = await createCompetition(userId, competitionData);
      if (error) {
        showError('Error al crear la competición');
        return { error };
      }
      showSuccess('Competición creada');
      await loadData();
      return { data, error: null };
    },
    [userId, loadData]
  );

  const handleUpdate = useCallback(
    async (competitionId, updates) => {
      const { data, error } = await updateCompetition(competitionId, updates);
      if (error) {
        showError('Error al actualizar la competición');
        return { error };
      }
      showSuccess('Competición actualizada');
      await loadData();
      return { data, error: null };
    },
    [loadData]
  );

  const handleDelete = useCallback(
    async (competitionId) => {
      const { error } = await deleteCompetition(competitionId);
      if (error) {
        showError('Error al eliminar la competición');
        return { error };
      }
      showSuccess('Competición eliminada');
      await loadData();
      return { error: null };
    },
    [loadData]
  );

  return {
    loading,
    upcoming,
    past,
    create: handleCreate,
    update: handleUpdate,
    remove: handleDelete,
    refresh: loadData,
  };
}
