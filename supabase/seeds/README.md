# Seeds — biblioteca de ejercicios

Datasets versionables que mantienen los bancos globales de `running_exercises_bank` y `gym_exercises_bank` en sintonía entre dev y prod.

## Archivos

- `exercises_running.json` — 67 entradas (51 originales enriquecidas + 16 nuevas: drills técnicos, tempo, recovery, progressive, test).
- `exercises_gym.json` — 57 entradas (36 originales enriquecidas + 21 nuevas: core, mobility, plyometrics, injury prevention).

Cada entrada tiene su `slug` único como upsert key. El script es idempotente: ejecutarlo varias veces no duplica filas, solo actualiza.

Entradas con clave `_section` son **comentarios visuales** dentro del JSON, no se insertan.

## Schema mínimo de una entrada

```json
{
  "slug": "single-leg-rdl",          // requerido, único, kebab-case
  "name": "Peso muerto rumano a 1 pierna",
  "category": "injury_prevention",   // debe estar en el enum (ver _meta del JSON)
  "level": "intermedio",             // principiante | intermedio | avanzado | todos
  "description": "...",
  "tags": ["prevencion", "isquiotibiales"],
  "body_region": ["piernas", "gluteos"],
  "common_errors": ["..."],
  // Gym tambien admite: instructions[], muscle_groups[], equipment[], video_url, image_url
  // Running tambien admite: kpi{}, distance_meters, duration_seconds, pace_description
  "default_sets": 3,
  "default_reps": 10,
  "default_rest_seconds": 60
}
```

## Cómo aplicar

Desde el root del frontend:

```bash
# 1) Validación sin escribir nada (recomendado siempre primero)
node scripts/seed_library.mjs --dry-run

# 2) Aplicar con service_role (escribe en BD)
SUPABASE_URL="https://lusirdkixfliydimemre.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
node scripts/seed_library.mjs

# 3) Solo un banco
node scripts/seed_library.mjs --only running --dry-run
node scripts/seed_library.mjs --only gym
```

**ATENCIÓN:** necesita la **service_role key**, no la anon key, porque la inserción global requiere saltar RLS. La service_role NUNCA se commitea ni se sube al repo. Ponla en una variable de entorno temporal o en un `.env` ignorado.

## Convenciones de contenido

- **slug**: kebab-case, sin tildes ni espacios. Es la clave estable, no cambiar después de publicar.
- **name**: español, con tildes. Es lo que ve el usuario.
- **tags**: minúsculas, kebab-case si tiene espacios. Ej.: `umbral`, `gluteo-medio`, `shin-splints`.
- **body_region**: español, plurales cuando aplique. Ej.: `piernas`, `core`, `caderas`, `tobillos`, `espalda`, `hombros`.
- **level**: si el ejercicio es genérico para cualquier nivel, usar `todos`.
- **kpi** (running): jsonb libre, recomendado incluir `rpe`, `cadence_spm`, `recovery_seconds` o `gradient_pct` cuando aplique.
- **video_url** (solo gym): URL de YouTube embebible (`https://www.youtube.com/watch?v=...`). Vacío si aún no hay vídeo.

## Cómo añadir un ejercicio nuevo

1. Editar el JSON correspondiente.
2. Validar: `node scripts/seed_library.mjs --dry-run`.
3. Aplicar: `node scripts/seed_library.mjs`.
4. Commit del JSON.

## Cómo renombrar / eliminar

- **Renombrar** (cambiar `name` pero mantener `slug`): editar JSON + aplicar seed. La fila se actualiza.
- **Eliminar**: el script no borra filas — solo upserta. Para borrar un ejercicio global, hacer DELETE manual en BD por su slug. Documentarlo en una migración.
- **No cambiar el `slug` de una fila existente**: si lo necesitas, primero elimina la fila antigua y luego crea una nueva con el nuevo slug.

## Próximos pasos

- Rellenar `video_url` en los ejercicios de gym (B1).
- Crear seeds para `recovery_routines` (B3) y `plan_templates` (B5).
