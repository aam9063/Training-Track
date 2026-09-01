# Proposal — metrics-ai-analysis

## Why
Los atletas (coached e independientes) ven sus gráficas en `pages/athlete/Metrics.jsx` sin contexto pedagógico. La página es densa (PMC/TSB, zonas HR, VDOT, ACWR, récords, etc.) y la interpretación requiere conocimiento de entrenamiento. Queremos un botón "Analizar con IA" por gráfica y un "Análisis general" que explique en lenguaje natural (es-ES) qué significa, qué está haciendo bien el atleta y qué mejorar. Ya existen dos patrones IA (`athlete-ai-chat`, `generate-ai-report`) con Gemma 4 — reutilizamos modelo y secret.

## What changes
- Botón "Analizar con IA" por cada gráfica (PMC, HR zones, ACWR, weekly progression, best efforts, zones donut, activity type, VDOT predictor, etc.).
- Botón "Análisis general" arriba de la página con un snapshot agregado.
- Modal compartido (nuevo) que muestra spinner → respuesta plain-text (`whitespace-pre-wrap`, sin markdown — coherente con el resto del stack IA).
- Edge function `analyze-metric-chart` (Gemma 4, `GEMMA4_API_KEY`) con registro de prompts por `chart_type` en español, filtrado de `thought` parts como en `athlete-ai-chat`.
- Caché 24h server-side por `input_hash` (SHA-256 de `{chart_type, data canónicos, athlete_id}`). Los HIT no descuentan cuota.
- Cuota mensual: free 1/mes (global a toda gráfica + análisis general), premium ilimitado, trial/exempt ilimitado. Coached athletes heredan el plan del coach (Free→1/mes, Pro/Team→unlimited) resuelto en un RPC `get_ai_analysis_limit`.
- Nuevas tablas: `ai_analysis_usage` (contador por `athlete_id, year_month`) y `ai_analysis_cache` (kv con TTL).
- Extensión de `planFeatures.js` (`aiAnalysis` feature) y `useSubscription` (expone `aiAnalysisQuota { used, limit, remaining, source }`).

## Affected modules
- `src/pages/athlete/Metrics.jsx` — buttons por sección + "Análisis general".
- NEW `src/components/athlete/AiAnalysisModal.jsx` — modal compartido.
- NEW `src/components/athlete/MetricAIAnalyzer.jsx` — botón + hook de quota + llamada al servicio.
- NEW `src/services/aiAnalysisService.js` — wrapper del edge function + lecturas de cuota/caché.
- NEW `src/hooks/useAiAnalysisQuota.js` — wrap de RPC + contador mensual + invalidación post-call.
- `src/hooks/useSubscription.js` — añadir `aiAnalysisQuota` resolviendo plan del coach vía nuevo servicio.
- `src/lib/planFeatures.js` — añadir `aiAnalysis` al matrix (coach_free/pro/team + athlete_free/premium/indep).
- `src/contexts/AuthContext.jsx` — exponer `coachId` helper (opcional; hoy disponible via path anidado).
- NEW `supabase/functions/analyze-metric-chart/index.ts` — Gemma 4, prompt registry, cache, quota enforcement.
- NEW migration `supabase/migrations/<ts>_metrics_ai_analysis.sql` — 2 tablas + RLS + RPC `get_ai_analysis_limit`.

## RLS
- `ai_analysis_usage` y `ai_analysis_cache`: `SELECT` only owner (`auth.uid() = athlete_id`); `ALL` sólo `service_role`. Escrituras únicamente desde edge function con service_role key.

## Rollback
1. Drop edge function `analyze-metric-chart`.
2. Revertir migration (DROP RPC, DROP tablas).
3. Revertir commits en `Metrics.jsx`, `planFeatures.js`, `useSubscription.js`, `AuthContext.jsx`.
4. Borrar nuevos archivos (`MetricAIAnalyzer.jsx`, `AiAnalysisModal.jsx`, `useAiAnalysisQuota.js`, `aiAnalysisService.js`).

## Risks
- **Prompt quality**: mal prompt = respuesta genérica ("sigue entrenando duro"). Mitigación: plantilla específica por `chart_type` con datos numéricos concretos + contexto del atleta (nivel, objetivo, VAM) + estructura fija (insight + recomendación).
- **Quota loophole**: si el dataset cambia levemente el hash difiere y se puede abusar. Mitigación: el hash NO es la llave de quota — la quota se incrementa siempre que hay cache MISS. Caché sólo evita cobrar dos veces por la misma vista. Límite mensual firme en el server (RPC + check en edge function).
- **Token cost**: ~2-5K tokens por llamada a Gemma. Free 1/mes a escala de 10k atletas = coste despreciable. Premium ilimitado es el que hay que vigilar — monitorizar en dashboards Supabase.
- **Gemma "thought" parts**: replicar filtro `parts.filter(p => !p.thought)` del chat.
- **Coached athlete → plan del coach**: RPC `get_ai_analysis_limit` es `SECURITY DEFINER` con `search_path` explícito; debe validar que la relación esté `status='active'` y el coach tenga suscripción `active`.
- **Caché stale**: 24h TTL via `expires_at`; limpieza lazy al leer + cleanup cron (futuro, mismo patrón que `cleanup-gym-files`).
- **UX quota exhausta**: al segundo click tras consumir, modal "Has usado tu análisis de este mes" + CTA upgrade (reutilizar `PaywallModal`).

## Success criteria
- Atleta free con 0 usos este mes → click "Analizar" → respuesta IA visible en <15s → contador = 1.
- Mismo atleta free intenta 2º análisis → ve modal upgrade, no hay llamada a Gemma.
- Atleta premium → N análisis sin bloqueo.
- Atleta coached con coach Pro → unlimited (RPC devuelve `limit = -1`, `source = 'coach_pro'`).
- Atleta coached con coach Free → comparte 1/mes con el propio counter del atleta.
- Misma gráfica, mismos datos, 2º click <24h → cache HIT, contador NO se incrementa.
- Día 1 del mes siguiente → counter reset (nueva fila `year_month`).
- RLS: atleta A no puede leer usage/cache de atleta B (verificar con SELECT directo autenticado).
- Markdown-free output, render en plain-text con `whitespace-pre-wrap` (coherente con `AIAssistant.jsx`).

## Next phase
sdd-spec + sdd-design (paralelo), luego sdd-tasks.
