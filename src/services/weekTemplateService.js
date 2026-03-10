import { supabase } from '../lib/supabase';

/**
 * Copy all sessions from a source week (microcycle content) to target microcycles.
 * sourceContent: { days: [{dayIndex, description, km, ...}] }
 * targetMicrocycleIds: array of microcycle ids to paste content into
 */
export const copyWeekContent = async (sourceContent, targetMicrocycleId) => {
  if (!sourceContent?.days || !targetMicrocycleId) return { error: 'Missing data' };

  const { error } = await supabase
    .from('microcycles')
    .update({ content: sourceContent })
    .eq('id', targetMicrocycleId);

  return { error };
};

/**
 * Save a microcycle week as a named template.
 */
export const saveWeekAsTemplate = async (coachId, name, content) => {
  if (!coachId || !name?.trim() || !content?.days) return { error: 'Missing data' };

  const { data: template, error: tErr } = await supabase
    .from('week_templates')
    .insert({ coach_id: coachId, name: name.trim() })
    .select('id')
    .single();

  if (tErr) return { error: tErr };

  // Store each day that has content as a session row
  const sessions = content.days
    .filter(d => d?.description?.trim())
    .map(d => ({
      template_id: template.id,
      athlete_id: coachId, // placeholder — templates are coach-owned, athlete_id not used here
      day_of_week: d.dayIndex + 1, // 1-indexed
      description: d.description.trim(),
      title: d.title || '',
      training_type: d.type || 'running',
      distance_km: d.km || null,
    }));

  if (sessions.length > 0) {
    const { error: sErr } = await supabase
      .from('week_template_sessions')
      .insert(sessions);
    if (sErr) return { error: sErr };
  }

  return { data: template, error: null };
};

/**
 * List all templates for a coach.
 */
export const listWeekTemplates = async (coachId) => {
  if (!coachId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('week_templates')
    .select('id, name, created_at, week_template_sessions(id, day_of_week, description, title, training_type, distance_km)')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
};

/**
 * Delete a template (cascades to sessions).
 */
export const deleteWeekTemplate = async (templateId) => {
  const { error } = await supabase
    .from('week_templates')
    .delete()
    .eq('id', templateId);

  return { error };
};

/**
 * Build microcycle content from a template.
 * Returns content object compatible with WeeklyPlanEditor.
 */
export const templateToContent = (template) => {
  const days = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    description: '',
    km: 0,
    type: 'rest',
    title: '',
  }));

  for (const s of template.week_template_sessions || []) {
    const idx = s.day_of_week - 1;
    if (idx >= 0 && idx < 7) {
      days[idx] = {
        dayIndex: idx,
        description: s.description || '',
        km: s.distance_km || 0,
        type: s.training_type || 'running',
        title: s.title || '',
      };
    }
  }

  return { days };
};
