#!/usr/bin/env node
/**
 * seed_library.mjs — Sincroniza supabase/seeds/exercises_{running,gym}.json
 * contra los bancos en Supabase.
 *
 * Estrategia:
 * - Carga ambos JSON
 * - Filtra entradas con `_section` u otros campos "comentario"
 * - Valida shape minimo (slug, name, category, level)
 * - Hace UPSERT en `running_exercises_bank` y `gym_exercises_bank` por `slug`
 * - Marca todas las filas como globales (coach_id = null, is_custom = false)
 * - Idempotente: ejecuciones repetidas no duplican filas
 *
 * Uso:
 *   SUPABASE_URL=https://...supabase.co \\
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \\
 *   node scripts/seed_library.mjs              # aplica
 *
 *   node scripts/seed_library.mjs --dry-run     # solo valida e imprime resumen
 *   node scripts/seed_library.mjs --only running
 *   node scripts/seed_library.mjs --only gym
 *
 * IMPORTANTE: usa SUPABASE_SERVICE_ROLE_KEY, no la anon key. El service role
 * salta RLS, lo cual es necesario para escribir filas globales.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = resolve(__dirname, '..', 'supabase', 'seeds');

const LEVELS = new Set(['principiante', 'intermedio', 'avanzado', 'todos']);

const RUNNING_CATEGORIES = new Set([
  'series_short','series_medium','series_long',
  'warmup_run','easy_run','long_run','tempo_run',
  'fartlek_time','fartlek_distance','hill_repeats',
  'recovery_run','race','test','technical_drill','progressive_run','pace_blocks',
]);

const GYM_CATEGORIES = new Set([
  'max_strength','general_strength','explosive_strength',
  'core','mobility','plyometrics','injury_prevention',
]);

const COMMON_FIELDS = new Set([
  'slug','name','category','description','level',
  'tags','body_region','common_errors',
  'default_sets','default_reps','default_rest_seconds',
]);

const RUNNING_EXTRA = new Set(['kpi','distance_meters','duration_seconds','pace_description']);
const GYM_EXTRA = new Set(['instructions','muscle_groups','equipment','video_url','image_url']);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

function loadEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!DRY_RUN && (!url || !key)) {
    console.error('ERROR: faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    console.error('Para correr sin escribir nada: node scripts/seed_library.mjs --dry-run');
    process.exit(1);
  }
  return { url, key };
}

function isCommentEntry(entry) {
  return entry && typeof entry === 'object' && '_section' in entry && !entry.slug;
}

function pickFields(entry, allowed) {
  const out = {};
  for (const k of Object.keys(entry)) {
    if (allowed.has(k)) out[k] = entry[k];
  }
  return out;
}

function validateEntry(entry, kind) {
  const errs = [];
  if (!entry.slug || typeof entry.slug !== 'string') errs.push('slug missing');
  if (!entry.name) errs.push('name missing');
  if (!entry.category) errs.push('category missing');
  const validCategories = kind === 'running' ? RUNNING_CATEGORIES : GYM_CATEGORIES;
  if (entry.category && !validCategories.has(entry.category)) {
    errs.push(`category "${entry.category}" not in enum`);
  }
  if (entry.level && !LEVELS.has(entry.level)) {
    errs.push(`level "${entry.level}" not in {principiante,intermedio,avanzado,todos}`);
  }
  return errs;
}

function buildRow(entry, kind) {
  const allowed = new Set([
    ...COMMON_FIELDS,
    ...(kind === 'running' ? RUNNING_EXTRA : GYM_EXTRA),
  ]);
  const row = pickFields(entry, allowed);
  // Defaults explicitos
  row.is_custom = false;
  row.coach_id = null;
  if (!row.level) row.level = 'todos';
  if (!Array.isArray(row.tags)) row.tags = [];
  if (!Array.isArray(row.body_region)) row.body_region = [];
  if (!Array.isArray(row.common_errors)) row.common_errors = [];
  if (kind === 'gym' && !Array.isArray(row.instructions)) row.instructions = [];
  return row;
}

async function processFile(kind, filename, supabase) {
  const path = resolve(SEEDS_DIR, filename);
  const raw = JSON.parse(await readFile(path, 'utf-8'));
  const all = Array.isArray(raw.exercises) ? raw.exercises : [];
  const entries = all.filter((e) => !isCommentEntry(e));
  const skipped = all.length - entries.length;

  const errors = [];
  const rows = [];
  for (const e of entries) {
    const errs = validateEntry(e, kind);
    if (errs.length) {
      errors.push({ slug: e.slug || '<no-slug>', errs });
      continue;
    }
    rows.push(buildRow(e, kind));
  }

  console.log(`\n[${kind}] ${filename}`);
  console.log(`  entradas en archivo : ${all.length}`);
  console.log(`  comentarios (_section): ${skipped}`);
  console.log(`  validas             : ${rows.length}`);
  console.log(`  con errores         : ${errors.length}`);
  if (errors.length) {
    for (const e of errors) console.error(`    - ${e.slug}: ${e.errs.join(', ')}`);
    throw new Error(`Validacion fallida en ${filename}`);
  }

  // Resumen por categoria/level
  const byCat = {};
  const byLvl = {};
  for (const r of rows) {
    byCat[r.category] = (byCat[r.category] || 0) + 1;
    byLvl[r.level] = (byLvl[r.level] || 0) + 1;
  }
  console.log('  por categoria       :', JSON.stringify(byCat));
  console.log('  por nivel           :', JSON.stringify(byLvl));

  if (DRY_RUN) {
    console.log(`  [dry-run] no se escribe en BD`);
    return { rows: rows.length, inserted: 0, updated: 0 };
  }

  const table = kind === 'running' ? 'running_exercises_bank' : 'gym_exercises_bank';
  // Upsert por slug. onConflict=slug => actualiza columnas indicadas; insertara si no existe.
  const { data, error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'slug', ignoreDuplicates: false })
    .select('id, slug');

  if (error) {
    console.error('  ERROR upsert:', error);
    throw error;
  }
  console.log(`  upsert OK           : ${data?.length || 0} filas`);
  return { rows: rows.length, upserted: data?.length || 0 };
}

async function main() {
  const { url, key } = loadEnv();
  const supabase = DRY_RUN ? null : createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const totals = { running: null, gym: null };
  if (!ONLY || ONLY === 'running') {
    totals.running = await processFile('running', 'exercises_running.json', supabase);
  }
  if (!ONLY || ONLY === 'gym') {
    totals.gym = await processFile('gym', 'exercises_gym.json', supabase);
  }

  console.log('\n=== Resumen ===');
  console.log(JSON.stringify(totals, null, 2));
  console.log(DRY_RUN ? '(dry-run, BD intacta)' : 'OK');
}

main().catch((e) => {
  console.error('\nSeed FAIL:', e.message || e);
  process.exit(1);
});
