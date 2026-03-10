import { supabase } from '../lib/supabase';

/**
 * Save a mesocycle (with all its microcycles) as a named template.
 */
export const saveMesocycleAsTemplate = async (coachId, name, meso) => {
  if (!coachId || !name?.trim() || !meso) return { error: 'Missing data' };

  const { data: template, error: tErr } = await supabase
    .from('mesocycle_templates')
    .insert({
      coach_id: coachId,
      name: name.trim(),
      phase: meso.phase || 'base',
      weeks: meso.weeks || (meso.microcycles?.length ?? 0),
    })
    .select('id')
    .single();

  if (tErr) return { error: tErr };

  const weekRows = (meso.microcycles || []).map(mc => ({
    template_id: template.id,
    week_number: mc.week_number,
    content: mc.content || null,
    planned_km: mc.planned_km || null,
    week_type: mc.week_type || 'normal',
  }));

  if (weekRows.length > 0) {
    const { error: wErr } = await supabase
      .from('mesocycle_template_weeks')
      .insert(weekRows);
    if (wErr) return { error: wErr };
  }

  return { data: template, error: null };
};

/**
 * List all mesocycle templates for a coach (with weeks).
 */
export const listMesocycleTemplates = async (coachId) => {
  if (!coachId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('mesocycle_templates')
    .select('id, name, phase, weeks, created_at, mesocycle_template_weeks(id, week_number, content, planned_km, week_type)')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
};

/**
 * Delete a mesocycle template (cascades to weeks).
 */
export const deleteMesocycleTemplate = async (templateId) => {
  const { error } = await supabase
    .from('mesocycle_templates')
    .delete()
    .eq('id', templateId);
  return { error };
};

/**
 * Copy all microcycle contents from a source mesocycle to a target mesocycle.
 * Matches by week_number; only overwrites weeks that exist in the target.
 * Returns an array of { microcycleId, content, planned_km } updates applied.
 */
export const copyMesocycleContent = async (sourceMeso, targetMeso) => {
  if (!sourceMeso?.microcycles || !targetMeso?.microcycles) return { error: 'Missing data' };

  const sourceByWeek = {};
  for (const mc of sourceMeso.microcycles) {
    sourceByWeek[mc.week_number] = mc;
  }

  const updates = [];
  for (const targetMicro of targetMeso.microcycles) {
    const src = sourceByWeek[targetMicro.week_number];
    if (!src?.content) continue;
    const { error } = await supabase
      .from('microcycles')
      .update({ content: src.content, planned_km: src.planned_km || null })
      .eq('id', targetMicro.id);
    if (error) return { error };
    updates.push(targetMicro.id);
  }

  return { updated: updates.length, error: null };
};

/**
 * Duplicate a mesocycle inside the same plan.
 * Creates a new mesocycle with the given name + same phase/weeks,
 * inserts its microcycles, then copies content week by week.
 * Returns { data: newMesocycle, error }.
 */
export const duplicateMesocycle = async (planId, sourceMeso, newName, sortOrder) => {
  if (!planId || !sourceMeso) return { error: 'Missing data' };

  // 1. Create new mesocycle row
  const { data: newMeso, error: mesoErr } = await supabase
    .from('mesocycles')
    .insert({
      plan_id: planId,
      name: newName?.trim() || `${sourceMeso.name} (copia)`,
      phase: sourceMeso.phase || 'base',
      weeks: sourceMeso.weeks || (sourceMeso.microcycles?.length ?? 0),
      sort_order: sortOrder ?? 999,
      start_date: sourceMeso.start_date,
      end_date: sourceMeso.end_date,
    })
    .select()
    .single();

  if (mesoErr) return { error: mesoErr };

  // 2. Insert microcycles for each week, with content copied
  const microRows = (sourceMeso.microcycles || []).map(mc => ({
    mesocycle_id: newMeso.id,
    week_number: mc.week_number,
    content: mc.content || null,
    planned_km: mc.planned_km || null,
    week_type: mc.week_type || 'normal',
    start_date: mc.start_date,
  }));

  let createdMicros = [];
  if (microRows.length > 0) {
    const { data, error: microErr } = await supabase
      .from('microcycles')
      .insert(microRows)
      .select();
    if (microErr) return { error: microErr };
    createdMicros = data || [];
  }

  return { data: { ...newMeso, microcycles: createdMicros }, error: null };
};

/**
 * Apply a mesocycle template to an existing mesocycle.
 * Matches by week_number (1-indexed).
 */
export const applyMesocycleTemplate = async (template, targetMeso) => {
  if (!template?.mesocycle_template_weeks || !targetMeso?.microcycles) return { error: 'Missing data' };

  const templateByWeek = {};
  for (const tw of template.mesocycle_template_weeks) {
    templateByWeek[tw.week_number] = tw;
  }

  const updates = [];
  for (const targetMicro of targetMeso.microcycles) {
    const tw = templateByWeek[targetMicro.week_number];
    if (!tw?.content) continue;
    const { error } = await supabase
      .from('microcycles')
      .update({ content: tw.content, planned_km: tw.planned_km || null })
      .eq('id', targetMicro.id);
    if (error) return { error };
    updates.push(targetMicro.id);
  }

  return { updated: updates.length, error: null };
};
