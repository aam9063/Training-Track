import { useState, useEffect, useCallback } from 'react';
import { getAthleteProfile } from '../services/athleteProfileService';
import {
  generateSelfPlan,
  autoAssignPlan,
  getMyActivePlan,
  getMyPlanHistory,
  checkGenerationRateLimit,
} from '../services/independentPlanService';
import { showError, showSuccess } from '../lib/toast';

/**
 * Custom hook for the Mi Plan page.
 * Encapsulates all business logic: active plan, plan history,
 * onboarding gate, generation state, and rate limiting.
 *
 * @param {string} userId - UUID of the authenticated independent athlete
 */
export default function useMyPlanData(userId) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [activePlan, setActivePlan] = useState([]);
  const [planHistory, setPlanHistory] = useState([]);
  const [hasProfile, setHasProfile] = useState(null); // null = unknown, true/false once loaded
  const [rateLimit, setRateLimit] = useState({ used: 0, remaining: 2, canGenerate: true });
  const [currentWeekStart, setCurrentWeekStart] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);

  // Compute current week Monday
  const getThisMonday = useCallback(() => {
    const today = new Date();
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const monday = getThisMonday();
      setCurrentWeekStart(monday);

      const [profileRes, activePlanRes, historyRes, rateLimitRes] = await Promise.all([
        getAthleteProfile(userId),
        getMyActivePlan(userId),
        getMyPlanHistory(userId),
        checkGenerationRateLimit(userId),
      ]);

      setHasProfile(!!profileRes.data);
      setActivePlan(activePlanRes.data ?? []);
      setPlanHistory(historyRes.data ?? []);
      setRateLimit(rateLimitRes);
    } catch {
      showError('Error al cargar el plan');
    } finally {
      setLoading(false);
    }
  }, [userId, getThisMonday]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Trigger AI plan generation and store result in pendingPlan for preview.
   * Does NOT auto-assign — the user must confirm via assignPlan().
   */
  const generatePlan = useCallback(async () => {
    if (!userId) return;

    if (!rateLimit.canGenerate) {
      showError('Has alcanzado el límite de regeneraciones esta semana (máx. 2).');
      return;
    }

    setGenerating(true);
    try {
      const planData = await generateSelfPlan(userId);
      setPendingPlan(planData);
    } catch (err) {
      showError(err.message ?? 'Error al generar el plan');
    } finally {
      setGenerating(false);
    }
  }, [userId, rateLimit]);

  /**
   * Assign the pending plan to the athlete and refresh data.
   */
  const assignPlan = useCallback(async () => {
    if (!pendingPlan || !userId) return;

    setAssigning(true);
    try {
      await autoAssignPlan(pendingPlan, userId);
      showSuccess('¡Plan asignado correctamente!');
      setPendingPlan(null);
      await loadData();
    } catch (err) {
      showError(err.message ?? 'Error al asignar el plan');
    } finally {
      setAssigning(false);
    }
  }, [pendingPlan, userId, loadData]);

  /**
   * Discard the pending plan without assigning.
   */
  const discardPlan = useCallback(() => {
    setPendingPlan(null);
  }, []);

  return {
    loading,
    generating,
    assigning,
    activePlan,
    planHistory,
    hasProfile,
    rateLimit,
    currentWeekStart,
    pendingPlan,
    generatePlan,
    assignPlan,
    discardPlan,
    refresh: loadData,
  };
}
