import { useState, useCallback } from 'react';
import {
  getCoachPlans,
  createPlan,
  updatePlan,
  deletePlan as deletePlanService,
  createMesocycle,
  updateMesocycle,
  deleteMesocycle as deleteMesocycleService,
  updateMicrocycleContent,
  assignPlanToAthletes,
} from '../services/planningService';

export default function usePlanningData(coachId) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    try {
      const { data, error } = await getCoachPlans(coachId);
      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error('Error loading plans:', err);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  const selectPlan = useCallback((planId) => {
    if (!planId) {
      setSelectedPlan(null);
      return;
    }
    const plan = plans.find(p => p.id === planId);
    setSelectedPlan(plan || null);
  }, [plans]);

  const createNewPlan = useCallback(async ({ name, description, modality }) => {
    setSaving(true);
    try {
      const { data, error } = await createPlan({ coachId, name, description, modality });
      if (error) throw error;
      const newPlan = { ...data, mesocycles: [], plan_assignments: [] };
      setPlans(prev => [newPlan, ...prev]);
      setSelectedPlan(newPlan);
      return { data: newPlan, error: null };
    } catch (err) {
      console.error('Error creating plan:', err);
      return { data: null, error: err };
    } finally {
      setSaving(false);
    }
  }, [coachId]);

  const updatePlanDetails = useCallback(async (planId, updates) => {
    setSaving(true);
    try {
      const { data, error } = await updatePlan(planId, updates);
      if (error) throw error;
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...data } : p));
      setSelectedPlan(prev => prev?.id === planId ? { ...prev, ...data } : prev);
      return { error: null };
    } catch (err) {
      return { error: err };
    } finally {
      setSaving(false);
    }
  }, []);

  const removePlan = useCallback(async (planId) => {
    setSaving(true);
    try {
      const { error } = await deletePlanService(planId);
      if (error) throw error;
      setPlans(prev => prev.filter(p => p.id !== planId));
      if (selectedPlan?.id === planId) setSelectedPlan(null);
      return { error: null };
    } catch (err) {
      return { error: err };
    } finally {
      setSaving(false);
    }
  }, [selectedPlan]);

  const addMesocycle = useCallback(async (planId, { name, phase, weeks }) => {
    setSaving(true);
    try {
      const plan = plans.find(p => p.id === planId);
      const sortOrder = (plan?.mesocycles?.length || 0);
      const { data, error } = await createMesocycle(planId, { name, phase, weeks, sortOrder });
      if (error) throw error;

      const updatePlanWithMeso = (p) => {
        if (p.id !== planId) return p;
        return { ...p, mesocycles: [...(p.mesocycles || []), data] };
      };

      setPlans(prev => prev.map(updatePlanWithMeso));
      setSelectedPlan(prev => prev?.id === planId ? updatePlanWithMeso(prev) : prev);
      return { data, error: null };
    } catch (err) {
      console.error('Error adding mesocycle:', err);
      return { data: null, error: err };
    } finally {
      setSaving(false);
    }
  }, [plans]);

  const updateMesocycleDetails = useCallback(async (mesocycleId, updates) => {
    setSaving(true);
    try {
      const { data, error } = await updateMesocycle(mesocycleId, updates);
      if (error) throw error;

      const updateMesoInPlan = (p) => ({
        ...p,
        mesocycles: (p.mesocycles || []).map(m =>
          m.id === mesocycleId ? { ...m, ...data } : m
        ),
      });

      setPlans(prev => prev.map(updateMesoInPlan));
      setSelectedPlan(prev => prev ? updateMesoInPlan(prev) : prev);
      return { error: null };
    } catch (err) {
      return { error: err };
    } finally {
      setSaving(false);
    }
  }, []);

  const removeMesocycle = useCallback(async (mesocycleId) => {
    setSaving(true);
    try {
      const { error } = await deleteMesocycleService(mesocycleId);
      if (error) throw error;

      const removeMesoFromPlan = (p) => ({
        ...p,
        mesocycles: (p.mesocycles || []).filter(m => m.id !== mesocycleId),
      });

      setPlans(prev => prev.map(removeMesoFromPlan));
      setSelectedPlan(prev => prev ? removeMesoFromPlan(prev) : prev);
      return { error: null };
    } catch (err) {
      return { error: err };
    } finally {
      setSaving(false);
    }
  }, []);

  const updateWeekContent = useCallback(async (microcycleId, content, plannedKm) => {
    setSaving(true);
    try {
      const { data, error } = await updateMicrocycleContent(microcycleId, content, plannedKm);
      if (error) throw error;

      const updateMicroInPlan = (p) => ({
        ...p,
        mesocycles: (p.mesocycles || []).map(meso => ({
          ...meso,
          microcycles: (meso.microcycles || []).map(micro =>
            micro.id === microcycleId ? { ...micro, ...data } : micro
          ),
        })),
      });

      setPlans(prev => prev.map(updateMicroInPlan));
      setSelectedPlan(prev => prev ? updateMicroInPlan(prev) : prev);
      return { error: null };
    } catch (err) {
      return { error: err };
    } finally {
      setSaving(false);
    }
  }, []);

  const assignToAthletes = useCallback(async (athleteIds, startDate) => {
    if (!selectedPlan) return { sessionsCreated: 0, error: new Error('No plan selected') };
    setSaving(true);
    try {
      const result = await assignPlanToAthletes(selectedPlan.id, coachId, athleteIds, startDate);
      if (result.error) throw result.error;
      // Reload plans to get updated assignments
      await loadPlans();
      return result;
    } catch (err) {
      return { sessionsCreated: 0, error: err };
    } finally {
      setSaving(false);
    }
  }, [selectedPlan, coachId, loadPlans]);

  return {
    plans,
    selectedPlan,
    loading,
    saving,
    loadPlans,
    selectPlan,
    createNewPlan,
    updatePlanDetails,
    removePlan,
    addMesocycle,
    updateMesocycleDetails,
    removeMesocycle,
    updateWeekContent,
    assignToAthletes,
  };
}
