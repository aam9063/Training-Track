import { supabase } from '../lib/supabase';

const RUNNING = 'running_exercises_bank';
const GYM = 'gym_exercises_bank';

const tableFor = (kind) => (kind === 'gym' ? GYM : RUNNING);

const buildBaseQuery = (kind, coachId) => {
  let q = supabase.from(tableFor(kind)).select('*');
  if (coachId) {
    q = q.or(`coach_id.is.null,coach_id.eq.${coachId}`);
  } else {
    q = q.is('coach_id', null);
  }
  return q;
};

const applyFilters = (query, { search, category, level, tags, bodyRegion } = {}) => {
  let q = query;
  if (search && search.trim()) {
    const term = search.trim().replace(/[%,]/g, '');
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (category) q = q.eq('category', category);
  if (level && level !== 'todos') q = q.in('level', [level, 'todos']);
  if (Array.isArray(tags) && tags.length > 0) q = q.contains('tags', tags);
  if (Array.isArray(bodyRegion) && bodyRegion.length > 0) q = q.overlaps('body_region', bodyRegion);
  return q;
};

/**
 * Busca ejercicios con filtros combinables. `kind` es 'running' o 'gym'.
 * Filtros: search (ILIKE en name/description), category, level (incluye 'todos'),
 * tags (contiene TODOS los pedidos), bodyRegion (overlap), pagination.
 */
export const searchExercises = async ({
  kind = 'running',
  coachId = null,
  search,
  category,
  level,
  tags,
  bodyRegion,
  limit = 100,
  offset = 0,
} = {}) => {
  try {
    let q = buildBaseQuery(kind, coachId);
    q = applyFilters(q, { search, category, level, tags, bodyRegion });
    q = q.order('category', { ascending: true }).order('name', { ascending: true });
    q = q.range(offset, offset + limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error(`Error searching exercises (${kind}):`, error);
    return { data: [], error };
  }
};

export const getExerciseBySlug = async (kind, slug) => {
  try {
    const { data, error } = await supabase
      .from(tableFor(kind))
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error(`Error fetching exercise ${slug}:`, error);
    return { data: null, error };
  }
};

/**
 * Devuelve las facetas disponibles para los filtros (counts por categoria,
 * level y tags). Util para pintar la sidebar con badges de conteo.
 */
export const getFacets = async ({ kind = 'running', coachId = null } = {}) => {
  try {
    const { data, error } = await buildBaseQuery(kind, coachId).select(
      'category, level, tags, body_region'
    );
    if (error) throw error;
    const facets = {
      category: new Map(),
      level: new Map(),
      tag: new Map(),
      bodyRegion: new Map(),
    };
    const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
    for (const row of data || []) {
      if (row.category) bump(facets.category, row.category);
      if (row.level) bump(facets.level, row.level);
      for (const t of row.tags || []) bump(facets.tag, t);
      for (const b of row.body_region || []) bump(facets.bodyRegion, b);
    }
    const toArr = (m) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
    return {
      data: {
        category: toArr(facets.category),
        level: toArr(facets.level),
        tag: toArr(facets.tag),
        bodyRegion: toArr(facets.bodyRegion),
      },
      error: null,
    };
  } catch (error) {
    console.error(`Error fetching facets (${kind}):`, error);
    return {
      data: { category: [], level: [], tag: [], bodyRegion: [] },
      error,
    };
  }
};

export const slugify = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const createCustomExercise = async (kind, coachId, payload) => {
  try {
    // payload primero — luego se imponen coach_id, is_custom y slug por defecto
    const base = {
      ...payload,
      coach_id: coachId,
      is_custom: true,
      slug: payload.slug || `${slugify(payload.name)}-${(coachId || '').slice(0, 6)}`,
    };
    const { data, error } = await supabase
      .from(tableFor(kind))
      .insert(base)
      .select('*')
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error(`Error creating exercise (${kind}):`, error);
    return { data: null, error };
  }
};

export const updateExercise = async (kind, exerciseId, patch) => {
  try {
    const { data, error } = await supabase
      .from(tableFor(kind))
      .update(patch)
      .eq('id', exerciseId)
      .select('*')
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error(`Error updating exercise (${kind}):`, error);
    return { data: null, error };
  }
};

export const deleteExercise = async (kind, exerciseId) => {
  try {
    const { error } = await supabase.from(tableFor(kind)).delete().eq('id', exerciseId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error(`Error deleting exercise (${kind}):`, error);
    return { error };
  }
};
