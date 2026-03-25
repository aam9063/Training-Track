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
  const [activePlan, setActivePlan] = useState([]);
  const [planHistory, setPlanHistory] = useState([]);
  const [hasProfile, setHasProfile] = useState(null); // null = unknown, true/false once loaded
  const [rateLimit, setRateLimit] = useState({ used: 0, remaining: 2, canGenerate: true });
  const [currentWeekStart, setCurrentWeekStart] = useState(null);

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
   * Trigger AI plan generation and auto-assignment.
   * Validates rate limit before calling the Edge Function.
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
      await autoAssignPlan(planData, userId);

      showSuccess('¡Plan generado y asignado correctamente!');

      // Reload everything after generation
      await loadData();
    } catch (err) {
      showError(err.message ?? 'Error al generar el plan');
    } finally {
      setGenerating(false);
    }
  }, [userId, rateLimit, loadData]);

  return {
    loading,
    generating,
    activePlan,
    planHistory,
    hasProfile,
    rateLimit,
    currentWeekStart,
    generatePlan,
    refresh: loadData,
  };
}
