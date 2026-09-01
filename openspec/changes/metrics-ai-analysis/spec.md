# Spec — metrics-ai-analysis

## Scope
Análisis IA bajo demanda de las gráficas de la página Métricas del atleta (`src/pages/athlete/Metrics.jsx`), con cuota mensual, caché 24h y herencia de plan coach→atleta.

## Requirements

### REQ-1 Cuota mensual (Free)
El sistema MUST limitar a 1 análisis IA por mes natural a atletas con plan free efectivo (propio o heredado del coach).

### REQ-2 Cuota ilimitada (Premium / Pro / Team / Trial / Exempt)
El sistema MUST permitir análisis ilimitados a usuarios con plan premium/pro/team activos, en trial activo, o con `is_exempt = true`.

### REQ-3 Herencia de plan coach→atleta
Un atleta con relación activa en `coach_athlete_relationship` MUST usar el plan efectivo del coach (no el suyo propio) para determinar su cuota mensual.

### REQ-4 Caché 24h por hash
El sistema MUST cachear respuestas IA por `SHA256(chart_type || canonical_json(data) || athlete_id)` durante 24h. Los HIT no incrementan el contador de cuota.

### REQ-5 Prompt por chart_type
El edge function MUST aplicar un prompt especializado por `chart_type`, en español, con datos numéricos del atleta y contexto (`nivel`, `objetivo`, `vam` si disponible).

### REQ-6 Filtrado de thoughts Gemma
El edge function MUST filtrar `parts[].thought === true` y unir solo `parts[].text`, con fallback al thought si `text` resulta vacío (mismo patrón que `athlete-ai-chat`).

### REQ-7 RLS por atleta
Las tablas `ai_analysis_usage` y `ai_analysis_cache` MUST tener RLS: `SELECT` solo propietario (`auth.uid() = athlete_id`), `ALL` solo `service_role`.

## Scenarios

### Quota enforcement

#### Scenario 1: Free, 0 usos este mes
- GIVEN atleta free con 0 filas en `ai_analysis_usage` para `year_month = '2026-04'`
- WHEN hace click "Analizar con IA" en gráfica PMC
- THEN el edge function devuelve 200 con análisis, `ai_analysis_usage.usage_count` pasa de 0 a 1

#### Scenario 2: Free, 1 uso este mes (bloqueo)
- GIVEN atleta free con `usage_count = 1` para el mes actual
- WHEN hace click "Analizar"
- THEN el frontend NO llama al edge function, abre `PaywallModal` con mensaje "Has usado tu análisis de este mes"

#### Scenario 3: Free bypass en segundo request paralelo
- GIVEN atleta free con `usage_count = 0`, dispara dos análisis simultáneos
- WHEN ambos llegan al edge function
- THEN uno devuelve 200 (incrementa a 1), el segundo devuelve 403 `quota_exceeded`

#### Scenario 4: Premium, 50 usos este mes
- GIVEN atleta premium con `usage_count = 50`
- WHEN hace click
- THEN 200 con análisis, counter pasa a 51, sin bloqueo

#### Scenario 5: Coached, coach Pro
- GIVEN atleta coached, coach con `subscriptions.plan_key = 'coach_pro'` activa
- WHEN hace click
- THEN RPC `get_ai_analysis_limit` devuelve `{ limit: -1, source: 'coach_pro' }`, 200 con análisis

#### Scenario 6: Coached, coach Free, atleta con 0 usos
- GIVEN atleta coached, coach Free, `usage_count = 0`
- WHEN hace click
- THEN 200 con análisis, counter pasa a 1

#### Scenario 7: Coached, coach Free, cuota consumida
- GIVEN atleta coached, coach Free, `usage_count = 1`
- WHEN hace click
- THEN 403 `quota_exceeded`, frontend muestra PaywallModal CTA "Tu coach debe actualizar plan"

#### Scenario 8: Exempt
- GIVEN usuario con `users.is_exempt = true`
- WHEN hace click
- THEN RPC devuelve `{ limit: -1, source: 'exempt' }`, análisis devuelto

#### Scenario 9: Trial activo
- GIVEN usuario con `users.trial_ends_at > now()` y sin subscripción activa
- WHEN hace click
- THEN RPC devuelve `{ limit: -1, source: 'trial' }`, análisis devuelto

#### Scenario 10: Rollover de mes
- GIVEN atleta free con `usage_count = 1` para `year_month = '2026-03'`
- WHEN en `2026-04-01` hace click
- THEN nueva fila `(athlete_id, '2026-04', 1)` creada, análisis devuelto

### Caching

#### Scenario 11: Cache HIT dentro de 24h
- GIVEN misma gráfica + mismos datos + mismo atleta, analizada hace 23h (fila en `ai_analysis_cache` con `expires_at > now()`)
- WHEN click otra vez
- THEN edge function devuelve 200 con flag `cache_hit: true`, NO llama a Gemma, counter NO incrementa

#### Scenario 12: Cache MISS por TTL
- GIVEN entrada cache con `expires_at < now()` (>24h)
- WHEN click
- THEN cache MISS, llamada a Gemma, nueva entrada escrita, counter incrementa

#### Scenario 13: Cache MISS por cambio de datos
- GIVEN nueva actividad sincronizada desde Strava (dataset cambia)
- WHEN click misma gráfica
- THEN hash distinto → cache MISS → nueva llamada → counter incrementa

#### Scenario 14: Cache HIT no descuenta quota sobre límite
- GIVEN atleta free con `usage_count = 1` (quota consumida) y cache válido para la gráfica pedida
- WHEN click
- THEN edge function busca cache primero, devuelve HIT 200 sin consultar quota

### UI flow

#### Scenario 15: Click → modal con spinner
- GIVEN atleta con cuota disponible
- WHEN click "Analizar con IA"
- THEN se abre `AiAnalysisModal` inmediatamente con spinner "Analizando..."

#### Scenario 16: Éxito → respuesta visible
- GIVEN llamada en vuelo
- WHEN edge function responde 200
- THEN spinner desaparece, response plain-text visible con `whitespace-pre-wrap`

#### Scenario 17: Error de red
- GIVEN llamada falla (500, timeout, fetch error)
- WHEN error
- THEN modal muestra "No se pudo analizar. Inténtalo de nuevo." + botón "Reintentar" (no consume cuota; backend solo incrementa tras éxito)

#### Scenario 18: Timeout (>30s)
- GIVEN llamada excede 30s
- WHEN timeout
- THEN `AbortController` aborta, modal muestra mensaje de timeout + retry, counter NO incrementa

#### Scenario 19: Cerrar y reabrir mismo día
- GIVEN análisis ya realizado hoy, modal cerrado
- WHEN reabre click
- THEN cache HIT, respuesta instantánea, sin spinner

#### Scenario 20: Botón "Análisis general"
- GIVEN atleta con cuota
- WHEN click "Análisis general" en header de Métricas
- THEN se envía `chart_type = 'general'` con snapshot agregado (volumen semanal, TSB actual, zonas dominantes, récord reciente); cuenta como 1 unidad en el mismo counter

#### Scenario 21: Botón deshabilitado visualmente si quota exhausta
- GIVEN free con `usage_count = 1`
- WHEN render Metrics.jsx
- THEN todos los botones "Analizar con IA" se renderizan con estado disabled visual + tooltip "Has usado tu análisis de este mes"

### Edge function behavior

#### Scenario 22: Auth missing
- GIVEN request sin `Authorization` header
- WHEN edge function recibe
- THEN 401 `unauthorized`

#### Scenario 23: Invalid chart_type
- GIVEN request con `chart_type = 'foo'` (no en el registry)
- WHEN edge function
- THEN 400 `invalid_chart_type`

#### Scenario 24: Quota exceeded
- GIVEN auth OK + quota exhausta
- WHEN edge function consulta RPC
- THEN 403 con body `{ code: 'quota_exceeded', limit: 1, used: 1, resets_at: '2026-05-01' }`

#### Scenario 25: Gemma devuelve solo thoughts
- GIVEN Gemma responde solo `parts[].thought = true`, sin text final
- WHEN filtro
- THEN fallback incluye thought joined; response no vacía

#### Scenario 26: Gemma timeout
- GIVEN Gemma no responde en 25s
- WHEN AbortController dispara
- THEN 504 `ai_timeout`, counter NO incrementa, NO se escribe cache

### Prompt templates

#### Scenario 27: Prompt PMC/TSB
- GIVEN `chart_type = 'tsb'`, data con últimos 42 días CTL/ATL/TSB
- THEN prompt incluye "Analiza este PMC (CTL, ATL, TSB) para un corredor nivel {nivel} con objetivo {objetivo}. CTL actual: X, ATL: Y, TSB: Z. Interpreta forma, fatiga y fitness..."

#### Scenario 28: Prompt HR zones
- GIVEN `chart_type = 'time_in_zone'`, distribución % por zona
- THEN prompt incluye "Distribución de tiempo en zonas HR: Z1 X%, Z2 Y%... Evalúa si el entrenamiento es polarizado, piramidal o threshold..."

#### Scenario 29: Prompt weekly load (ACWR)
- GIVEN `chart_type = 'weekly_load'`, ACWR + últimas 6 semanas
- THEN prompt incluye valor ACWR, benchmarks (0.8-1.3 zona óptima, >1.5 riesgo)

#### Scenario 30: Prompt best efforts
- GIVEN `chart_type = 'best_efforts'`, PRs 1k/5k/10k
- THEN prompt incluye evolución temporal + sugerencias

#### Scenario 31: Prompt general
- GIVEN `chart_type = 'general'`, snapshot agregado
- THEN prompt holístico: volumen, forma (TSB), zonas dominantes, carga, próximos pasos

#### Scenario 32: Output sin markdown
- GIVEN cualquier chart_type
- THEN system prompt dice explícitamente "Responde en texto plano en español, sin markdown, sin asteriscos, sin títulos con #"

### Data integrity

#### Scenario 33: RLS cross-athlete
- GIVEN atleta A autenticado
- WHEN `SELECT * FROM ai_analysis_usage WHERE athlete_id = '<B>'`
- THEN 0 filas (RLS bloquea)

#### Scenario 34: Cleanup de meses viejos (futuro)
- GIVEN filas en `ai_analysis_usage` con `year_month < '2025-10'` (>6 meses)
- WHEN cron cleanup
- THEN DELETE esas filas

#### Scenario 35: Cleanup de cache expirada
- GIVEN filas en `ai_analysis_cache` con `expires_at < now() - interval '7 days'`
- WHEN cleanup (lazy en read o cron)
- THEN DELETE

## Out of scope
- Página `pages/dashboard/Metrics.jsx` del coach (follow-up).
- Streaming de respuestas.
- Historial de análisis IA persistente en UI (cacheado en DB 24h, pero no una vista historial).
- Exportación a PDF del análisis.
- Render markdown (se mantiene plain text por coherencia).
