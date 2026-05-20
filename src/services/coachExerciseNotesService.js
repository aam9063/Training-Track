import { supabase } from '../lib/supabase';

const TABLE = 'coach_exercise_notes';

const kindToColumn = (kind) => (kind === 'gym' ? 'gym_exercise_id' : 'running_exercise_id');

/**
 * Obtiene la nota del coach para un ejercicio concreto.
 * Visible para el coach dueno y para sus atletas con relacion activa (RLS).
 */
export const getCoachNote = async (coachId, kind, exerciseId) => {
  try {
    const col = kindToColumn(kind);
    const { data, error } = await supabase
      .from(TABLE)
      .select('coach_id, exercise_kind, running_exercise_id, gym_exercise_id, note, updated_at')
      .eq('coach_id', coachId)
      .eq(col, exerciseId)
      .maybeSingle();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching coach exercise note:', error);
    return { data: null, error };
  }
};

/**
 * Lista todas las notas del coach (por ejemplo para indicar en la grid que ejercicios tienen nota).
 * Devuelve un Map por exerciseId con la nota completa.
 */
export const listCoachNotes = async (coachId, kind) => {
  try {
    const col = kindToColumn(kind);
    const { data, error } = await supabase
      .from(TABLE)
      .select(`coach_id, exercise_kind, ${col}, note, updated_at`)
      .eq('coach_id', coachId)
      .eq('exercise_kind', kind);
    if (error) throw error;
    const map = new Map();
    for (const row of data || []) {
      map.set(row[col], row);
    }
    return { data: map, error: null };
  } catch (error) {
    console.error('Error listing coach exercise notes:', error);
    return { data: new Map(), error };
  }
};

/**
 * Crea o actualiza la nota del coach para un ejercicio.
 * Si `note` es vacio o solo espacios => borra la nota.
 */
export const upsertCoachNote = async (coachId, kind, exerciseId, note) => {
  try {
    const trimmed = (note || '').trim();
    if (!trimmed) {
      return await deleteCoachNote(coachId, kind, exerciseId);
    }
    const col = kindToColumn(kind);
    const row = {
      coach_id: coachId,
      exercise_kind: kind,
      [col]: exerciseId,
      note: trimmed,
    };
    // Usamos onConflict en el indice unico parcial correspondiente.
    const onConflict = kind === 'gym'
      ? 'coach_id,gym_exercise_id'
      : 'coach_id,running_exercise_id';
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict })
      .select('*')
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error upserting coach exercise note:', error);
    return { data: null, error };
  }
};

export const deleteCoachNote = async (coachId, kind, exerciseId) => {
  try {
    const col = kindToColumn(kind);
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('coach_id', coachId)
      .eq(col, exerciseId);
    if (error) throw error;
    return { data: null, error: null };
  } catch (error) {
    console.error('Error deleting coach exercise note:', error);
    return { data: null, error };
  }
};

/**
 * Resuelve las notas visibles para un atleta: las del coach con el que tiene relacion activa.
 * Devuelve un Map por exerciseId. Cuando un atleta no tiene coach, devuelve Map vacio.
 */
export const listNotesForAthlete = async (athleteId, kind) => {
  try {
    const col = kindToColumn(kind);
    // El RLS ya filtra: si el atleta no tiene relacion activa con el coach, no ve nada.
    const { data, error } = await supabase
      .from(TABLE)
      .select(`coach_id, exercise_kind, ${col}, note, updated_at`)
      .eq('exercise_kind', kind);
    if (error) throw error;
    const map = new Map();
    for (const row of data || []) {
      map.set(row[col], row);
    }
    return { data: map, error: null };
  } catch (error) {
    console.error('Error listing notes for athlete:', error);
    return { data: new Map(), error };
  }
};
