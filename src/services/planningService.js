import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

// ============================================================
// TRAINING PLANS
// ============================================================

export const getCoachPlans = async (coachId) => {
  try {
    const { data, error } = await supabase
      .from('training_plans')
      .select(`
        *,
        mesocycles (
          *,
          microcycles (*)
        ),
        plan_assignments (
          id,
          athlete_id,
          start_date,
          assigned_at
        )
      `)
      .eq('coach_id', coachId)
      .eq('is_template', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Sort mesocycles and microcycles
    const sorted = (data || []).map(plan => ({
      ...plan,
      mesocycles: (plan.mesocycles || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(meso => ({
          ...meso,
          microcycles: (meso.microcycles || []).sort((a, b) => a.week_number - b.week_number),
        })),
    }));

    return { data: sorted, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

export const createPlan = async ({ coachId, name, description, modality }) => {
  try {
    const { data, error } = await supabase
      .from('training_plans')
      .insert({
        coach_id: coachId,
        name,
        description: description || null,
        modality: modality || null,
        is_template: true,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const updatePlan = async (planId, updates) => {
  try {
    const { data, error } = await supabase
      .from('training_plans')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', planId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const deletePlan = async (planId) => {
  try {
    // 1. Get athletes assigned to this plan
    const { data: assignments } = await supabase
      .from('plan_assignments')
      .select('athlete_id, start_date')
      .eq('plan_id', planId);

    // 2. Get plan duration to calculate date range
    const { data: plan } = await supabase
      .from('training_plans')
      .select('weeks, coach_id')
      .eq('id', planId)
      .maybeSingle();

    // 3. Delete future planned sessions for each assigned athlete
    if (assignments?.length && plan) {
      const today = toLocalDateStr(new Date());
      for (const assignment of assignments) {
        await supabase
          .from('training_sessions')
          .delete()
          .eq('plan_id', planId)
          .eq('athlete_id', assignment.athlete_id)
          .eq('status', 'planned')
          .gte('scheduled_date', today);
      }
    }

    // 4. Delete the plan (cascades to mesocycles, microcycles, plan_assignments via FK)
    const { error } = await supabase
      .from('training_plans')
      .delete()
      .eq('id', planId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: { message: 'Error al eliminar el plan' } };
  }
};

// ============================================================
// MESOCYCLES
// ============================================================

export const createMesocycle = async (planId, { name, phase, weeks, sortOrder }) => {
  try {
    // We use placeholder dates — they'll be recalculated on assignment
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + (weeks || 4) * 7);

    const { data, error } = await supabase
      .from('mesocycles')
      .insert({
        plan_id: planId,
        name,
        phase: phase || 'base',
        start_date: toLocalDateStr(now),
        end_date: toLocalDateStr(endDate),
        weeks: weeks || 4,
        sort_order: sortOrder || 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-create microcycles for each week
    const microcycles = [];
    for (let i = 1; i <= (weeks || 4); i++) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() + (i - 1) * 7);

      microcycles.push({
        mesocycle_id: data.id,
        week_number: i,
        start_date: toLocalDateStr(weekStart),
        week_type: i === (weeks || 4) ? 'recovery' : 'normal',
        planned_km: null,
        content: null,
      });
    }

    const { data: createdMicros, error: microError } = await supabase
      .from('microcycles')
      .insert(microcycles)
      .select();

    if (microError) throw microError;

    return { data: { ...data, microcycles: createdMicros || [] }, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateMesocycle = async (mesocycleId, updates) => {
  try {
    const { data, error } = await supabase
      .from('mesocycles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', mesocycleId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteMesocycle = async (mesocycleId) => {
  try {
    const { error } = await supabase
      .from('mesocycles')
      .delete()
      .eq('id', mesocycleId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
};

// ============================================================
// MICROCYCLES (Week content)
// ============================================================

export const updateMicrocycleContent = async (microcycleId, content, plannedKm) => {
  try {
    const { data, error } = await supabase
      .from('microcycles')
      .update({
        content,
        planned_km: plannedKm,
        updated_at: new Date().toISOString(),
      })
      .eq('id', microcycleId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// ============================================================
// PLAN ASSIGNMENT
// ============================================================

export const getCoachAthletesList = async (coachId) => {
  try {
    const { data, error } = await supabase
      .from('coach_athlete_relationship')
      .select(`
        athlete_id,
        athletes!coach_athlete_relationship_athlete_id_fkey (
          id,
          users!athletes_id_fkey (
            first_name,
            last_name,
            profile_image
          )
        )
      `)
      .eq('coach_id', coachId)
      .eq('status', 'active');

    if (error) throw error;

    const athletes = (data || []).map(rel => ({
      id: rel.athlete_id,
      first_name: rel.athletes?.users?.first_name || '',
      last_name: rel.athletes?.users?.last_name || '',
      profile_image: rel.athletes?.users?.profile_image || null,
    }));

    return { data: athletes, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

export const getPlanAssignments = async (planId) => {
  try {
    const { data, error } = await supabase
      .from('plan_assignments')
      .select(`
        *,
        athletes!plan_assignments_athlete_id_fkey (
          id,
          users!athletes_id_fkey (
            first_name,
            last_name
          )
        )
      `)
      .eq('plan_id', planId);

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
};

/**
 * Derives a short title from a training description text.
 * Takes the first line (or first ~50 chars) as a summary.
 */
function deriveTitle(description) {
  if (!description || !description.trim()) return 'Entrenamiento';
  const firstLine = description.split('\n')[0].trim();
  if (firstLine.length <= 50) return firstLine;
  return firstLine.slice(0, 47) + '...';
}

export const assignPlanToAthletes = async (planId, coachId, athleteIds, startDate) => {
  try {
    // 1. Get all microcycles for this plan (ordered)
    const { data: plan, error: planError } = await supabase
      .from('training_plans')
      .select(`
        *,
        mesocycles (
          *,
          microcycles (*)
        )
      `)
      .eq('id', planId)
      .single();

    if (planError) throw planError;

    // Flatten and sort microcycles in order
    const allMicrocycles = (plan.mesocycles || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap(meso =>
        (meso.microcycles || []).sort((a, b) => a.week_number - b.week_number)
      );

    // 2. Delete old training_sessions and plan_assignments for this plan + these athletes
    //    (so reassignment starts fresh)
    const { error: delSessionsError } = await supabase
      .from('training_sessions')
      .delete()
      .eq('plan_id', planId)
      .in('athlete_id', athleteIds);

    if (delSessionsError) throw delSessionsError;

    const { error: delAssignError } = await supabase
      .from('plan_assignments')
      .delete()
      .eq('plan_id', planId)
      .in('athlete_id', athleteIds);

    if (delAssignError) throw delAssignError;

    // 3. Insert fresh plan_assignments
    const assignments = athleteIds.map(athleteId => ({
      plan_id: planId,
      athlete_id: athleteId,
      start_date: toLocalDateStr(new Date(startDate)),
    }));

    const { error: assignError } = await supabase
      .from('plan_assignments')
      .insert(assignments);

    if (assignError) throw assignError;

    // 4. Generate training_sessions for each athlete
    const sessions = [];
    const planStartDate = new Date(startDate);

    for (const athleteId of athleteIds) {
      let weekOffset = 0;

      for (const micro of allMicrocycles) {
        const content = micro.content;
        if (!content?.days) {
          weekOffset++;
          continue;
        }

        for (const day of content.days) {
          if (!day || !day.description?.trim()) continue;

          const sessionDate = new Date(planStartDate);
          sessionDate.setDate(sessionDate.getDate() + weekOffset * 7 + (day.dayIndex || 0));

          const desc = (day.description || '').trim();

          sessions.push({
            plan_id: planId,
            coach_id: coachId,
            athlete_id: athleteId,
            scheduled_date: toLocalDateStr(sessionDate),
            training_type: 'running',
            status: 'planned',
            title: deriveTitle(desc),
            description: desc,
            estimated_duration_minutes: day.duration || null,
          });
        }

        weekOffset++;
      }
    }

    if (sessions.length > 0) {
      // Insert in batches of 100 to avoid payload limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
        const batch = sessions.slice(i, i + BATCH_SIZE);
        const { error: sessionsError } = await supabase
          .from('training_sessions')
          .insert(batch);

        if (sessionsError) throw sessionsError;
      }
    }

    // 4. Update plan start_date/end_date/weeks
    const totalWeeks = allMicrocycles.length;
    const planEndDate = new Date(planStartDate);
    planEndDate.setDate(planEndDate.getDate() + totalWeeks * 7 - 1);

    await supabase
      .from('training_plans')
      .update({
        start_date: toLocalDateStr(planStartDate),
        end_date: toLocalDateStr(planEndDate),
        weeks: totalWeeks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);

    return { sessionsCreated: sessions.length, error: null };
  } catch (error) {
    return { sessionsCreated: 0, error };
  }
};
