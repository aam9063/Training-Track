# Design — metrics-ai-analysis

## Architecture overview

```
Metrics.jsx (chart section)
  ├── <MetricAIAnalyzer chart_type="tsb" data={pmcData} />
  │     ├── uses useAiAnalysisQuota() → { used, limit, remaining, canUse }
  │     └── on click → opens <AiAnalysisModal>
  │                          └── calls aiAnalysisService.analyze({ chart_type, data })
  │                                └── POST /functions/v1/analyze-metric-chart
  │                                       ├── verify JWT
  │                                       ├── compute input_hash (SHA-256)
  │                                       ├── SELECT ai_analysis_cache WHERE input_hash ... AND expires_at > now()
  │                                       │     └── HIT → return response (cache_hit: true)
  │                                       ├── RPC get_ai_analysis_limit(athlete_id) → { limit, source }
  │                                       ├── SELECT ai_analysis_usage for current month → compare
  │                                       │     └── exceeded → 403
  │                                       ├── build prompt from PROMPTS[chart_type]
  │                                       ├── fetch Gemma 4 (AbortController 25s)
  │                                       ├── filter thought parts
  │                                       ├── INSERT ai_analysis_cache
  │                                       ├── UPSERT ai_analysis_usage (increment)
  │                                       └── return 200 { response, cache_hit: false, remaining }
  └── General button in header → same flow with chart_type='general'
```

## Data model

```sql
-- UP
BEGIN;

-- Monthly usage counter per athlete
CREATE TABLE IF NOT EXISTS public.ai_analysis_usage (
  athlete_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year_month  text NOT NULL CHECK (year_month ~ '^[0-9]{4}-[0-9]{2}$'),
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (athlete_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_month
  ON public.ai_analysis_usage(year_month);

ALTER TABLE public.ai_analysis_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_select_own ON public.ai_analysis_usage
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

CREATE POLICY ai_usage_service_all ON public.ai_analysis_usage
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 24h response cache
CREATE TABLE IF NOT EXISTS public.ai_analysis_cache (
  input_hash  text PRIMARY KEY,
  athlete_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chart_type  text NOT NULL,
  response    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_athlete
  ON public.ai_analysis_cache(athlete_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires
  ON public.ai_analysis_cache(expires_at);

ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_cache_select_own ON public.ai_analysis_cache
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

CREATE POLICY ai_cache_service_all ON public.ai_analysis_cache
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- RPC: effective monthly limit resolving coach plan
CREATE OR REPLACE FUNCTION public.get_ai_analysis_limit(p_athlete_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_exempt      boolean := false;
  v_trial_ends     timestamptz;
  v_own_plan       text;
  v_own_status     text;
  v_coach_id       uuid;
  v_coach_plan     text;
  v_coach_status   text;
  v_effective_plan text;
BEGIN
  -- Exempt wins
  SELECT u.is_exempt, u.trial_ends_at
    INTO v_is_exempt, v_trial_ends
    FROM public.users u WHERE u.id = p_athlete_id;

  IF v_is_exempt THEN
    RETURN jsonb_build_object('limit', -1, 'source', 'exempt');
  END IF;

  IF v_trial_ends IS NOT NULL AND v_trial_ends > now() THEN
    RETURN jsonb_build_object('limit', -1, 'source', 'trial');
  END IF;

  -- Coached athlete? → use coach's plan
  SELECT car.coach_id INTO v_coach_id
    FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = p_athlete_id AND car.status = 'active'
    ORDER BY car.created_at DESC
    LIMIT 1;

  IF v_coach_id IS NOT NULL THEN
    SELECT s.plan_key, s.status INTO v_coach_plan, v_coach_status
      FROM public.subscriptions s
      WHERE s.user_id = v_coach_id AND s.status = 'active'
      ORDER BY s.created_at DESC LIMIT 1;

    v_effective_plan := COALESCE(v_coach_plan, 'coach_free');

    IF v_effective_plan IN ('coach_pro', 'coach_team') THEN
      RETURN jsonb_build_object('limit', -1, 'source', v_effective_plan);
    END IF;
    -- coach_free falls through to free limit
    RETURN jsonb_build_object('limit', 1, 'source', v_effective_plan);
  END IF;

  -- Independent: own plan
  SELECT s.plan_key, s.status INTO v_own_plan, v_own_status
    FROM public.subscriptions s
    WHERE s.user_id = p_athlete_id AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1;

  v_effective_plan := COALESCE(v_own_plan, 'athlete_free');

  IF v_effective_plan IN ('athlete_premium', 'athlete_indep_premium') THEN
    RETURN jsonb_build_object('limit', -1, 'source', v_effective_plan);
  END IF;

  RETURN jsonb_build_object('limit', 1, 'source', v_effective_plan);
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_analysis_limit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_analysis_limit(uuid)
  TO authenticated, service_role;

COMMIT;
```

```sql
-- DOWN
BEGIN;
DROP FUNCTION IF EXISTS public.get_ai_analysis_limit(uuid);
DROP TABLE IF EXISTS public.ai_analysis_cache;
DROP TABLE IF EXISTS public.ai_analysis_usage;
COMMIT;
```

## Edge function `analyze-metric-chart`

### Input
```ts
type AnalyzeRequest = {
  chart_type:
    | 'tsb' | 'time_in_zone' | 'cardiac_drift' | 'best_efforts'
    | 'intensity_distribution' | 'weekly_load' | 'shoes'
    | 'vdot_predictor' | 'zones_donut' | 'activity_type_distribution'
    | 'weekly_progression' | 'general';
  data: Record<string, unknown>;         // chart-specific payload
  athlete_context?: {
    nivel?: string; objetivo?: string;
    vam?: number; edad?: number; sexo?: string;
  };
};
```

### Output
```ts
type AnalyzeResponse =
  | { ok: true; response: string; cache_hit: boolean; remaining: number | null; source: string }
  | { ok: false; code: 'unauthorized' | 'invalid_chart_type' | 'quota_exceeded' | 'ai_timeout' | 'ai_error'; message: string; meta?: unknown };
```

### Flow
1. Validate `Authorization` header → `supabase.auth.getUser(jwt)` → else 401.
2. Parse body; validate `chart_type` against registry keys → else 400.
3. Build canonical JSON (sorted keys) and compute `input_hash = sha256(chart_type + '|' + canonical(data) + '|' + athlete_id)`.
4. `SELECT response FROM ai_analysis_cache WHERE input_hash = $1 AND expires_at > now()` (service-role client).
   - HIT → return `{ ok, response, cache_hit: true, remaining: null, source: 'cache' }`. No quota touch.
5. Call `rpc('get_ai_analysis_limit', { p_athlete_id })` → `{ limit, source }`.
6. If `limit !== -1`: `SELECT usage_count FROM ai_analysis_usage WHERE athlete_id AND year_month = YYYY-MM`. If `used >= limit` → 403 `quota_exceeded` with `{ used, limit, resets_at }`.
7. Build prompt from `PROMPTS[chart_type]({ data, context })`. System prompt enforces plain-text Spanish.
8. `fetch` Gemma 4 endpoint (`gemma-4-26b-a4b-it`) with `AbortController` timeout 25s. Header `x-goog-api-key: GEMMA4_API_KEY`.
9. Filter thoughts:
   ```ts
   const parts = aiResult.candidates?.[0]?.content?.parts ?? [];
   let text = parts.filter(p => !p.thought).map(p => p.text).join('').trim();
   if (!text) text = parts.map(p => p.text).join('').trim();
   ```
10. `INSERT INTO ai_analysis_cache (input_hash, athlete_id, chart_type, response)` (default `expires_at = now()+24h`).
11. UPSERT `ai_analysis_usage`:
    ```sql
    INSERT INTO ai_analysis_usage (athlete_id, year_month, usage_count, last_used_at)
    VALUES ($1, $2, 1, now())
    ON CONFLICT (athlete_id, year_month)
    DO UPDATE SET usage_count = ai_analysis_usage.usage_count + 1, last_used_at = now();
    ```
12. Return `{ ok: true, response, cache_hit: false, remaining: limit === -1 ? null : limit - used - 1, source }`.

### Prompt registry (`PROMPTS`)
Each entry is a function `(data, context) => string`. Output in Spanish, ~150-250 words, estructura fija:
- **Lectura**: qué muestra la gráfica (1-2 frases con números concretos).
- **Diagnóstico**: qué significa para el atleta (considerando nivel/objetivo).
- **Recomendación**: 1-3 acciones concretas.

System prompt (común):
> Eres un entrenador experto en running con conocimiento de fisiología del ejercicio. Responde siempre en español de España, en texto plano SIN markdown, SIN asteriscos, SIN símbolos # ni listas con -. Usa párrafos. Tono cercano, profesional, preciso. No inventes datos: usa solo los números del payload.

Chart-specific templates (resumen):
- `tsb`: CTL/ATL/TSB interpretación forma/fatiga; riesgo si TSB < -30.
- `time_in_zone`: polarizado vs piramidal vs threshold; recomendación por objetivo.
- `cardiac_drift`: % drift por actividad; benchmark < 5% buena eficiencia aeróbica.
- `best_efforts`: evolución PRs; ritmo de progresión.
- `intensity_distribution`: % easy/moderate/hard; 80/20 rule.
- `weekly_load`: ACWR; 0.8-1.3 óptimo, >1.5 riesgo lesión.
- `shoes`: kms por zapatilla; alerta >600km.
- `vdot_predictor`: VDOT + predicciones Daniels; calidad de estimación.
- `zones_donut`: distribución HR; comparar con objetivo.
- `activity_type_distribution`: running vs cross; equilibrio.
- `weekly_progression`: kms, tiempo, sesiones; tendencia.
- `general`: snapshot holístico, prioriza TSB + volumen + próximo paso.

## Frontend component `MetricAIAnalyzer.jsx`
Props:
```ts
{
  chartType: ChartType;
  data: unknown;
  title?: string;       // for modal header
  compact?: boolean;    // small button for inline chart cards
}
```
Internals:
- `const { canUse, remaining, limit, source } = useAiAnalysisQuota();`
- Disabled if `!canUse`; tooltip "Has usado tu análisis mensual".
- On click: open `AiAnalysisModal` with `state: 'loading'`; call `aiAnalysisService.analyze({ chartType, data })`.
- On success: `state: 'done'` + response text.
- On error: `state: 'error'` + retry button.
- Refetch quota on success (invalidate React Query key `['aiAnalysisQuota', athleteId]`).

## `AiAnalysisModal.jsx`
- Overlay `<motion.div>` (copia pattern existente).
- Header: título + chart_type label.
- Body: `<div className="whitespace-pre-wrap text-sm text-gray-800">{response}</div>`.
- Loading: spinner + "Analizando tu gráfica...".
- Error: icono + mensaje + "Reintentar".
- Footer quota: "Te quedan N análisis este mes" o "Ilimitado" o "Plan del coach".

## `useAiAnalysisQuota.js`
```ts
export function useAiAnalysisQuota() {
  // Uses React Query (ya en stack? TanStack Query). Si no, useState + useEffect.
  // Queries:
  //   - RPC get_ai_analysis_limit(athlete_id) → { limit, source }
  //   - SELECT usage_count FROM ai_analysis_usage WHERE athlete_id AND year_month = current
  // Returns: { used, limit, remaining, canUse, source, refetch }
}
```

## `aiAnalysisService.js`
```ts
export async function analyze({ chartType, data, athleteContext }) {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-metric-chart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart_type: chartType, data, athlete_context: athleteContext }),
  });
  const json = await res.json();
  if (!json.ok) throw Object.assign(new Error(json.message), { code: json.code, meta: json.meta });
  return json;
}
```

## `planFeatures.js` delta
Add `aiAnalysis: true|false` por plan:
- `coach_free`: true (limitado 1/mes via quota)
- `coach_pro` / `coach_team`: true (unlimited)
- `athlete_free`: true (1/mes)
- `athlete_premium`: true (unlimited)
- `athlete_indep_free`: true (1/mes)
- `athlete_indep_premium`: true (unlimited)

El flag `aiAnalysis` es TRUE para todos (todos ven los botones). El gate real es la cuota, no el feature flag.

## ADRs

### ADR-1 Quota en servidor vía RPC, no solo en cliente
Razón: cliente puede modificar estado local. RPC `SECURITY DEFINER` + check en edge function hace la quota inviolable. UI solo precalcula para UX.

### ADR-2 Caché en DB, no en KV edge
Razón: Supabase no tiene KV nativo. Reusar Postgres es coherente con el stack; TTL lazy vía `expires_at > now()`.

### ADR-3 Counter mensual, no diario
Razón: 1/día sería punitivo y complicado; 1/mes es fácil de entender, suficiente generoso para atraer upgrade a premium al 2º intento.

### ADR-4 Coach plan hereda "hacia abajo", no agrega
Razón: el atleta ve el plan del coach como su tope efectivo. El coach NO ve agregados de atletas (fuera de scope). Un-way inheritance.

### ADR-5 Plain text, no markdown
Razón: coherencia con `athlete-ai-chat` y `AIAssistant.jsx`, evita dependencia `react-markdown`. `whitespace-pre-wrap` basta.

### ADR-6 Gemma 4 (no DeepSeek)
Razón: locked por requirement. Mismo secret (`GEMMA4_API_KEY`) y patrón (thought filtering) reutilizable.

## Deployment order
1. Migration aplicada en Supabase (tablas + RPC).
2. Edge function `analyze-metric-chart` deploy (`supabase functions deploy`).
3. Frontend deploy (Vercel) con buttons activos.

## Observability
- Log en edge function: `{ chart_type, athlete_id, cache_hit, gemma_ms, quota_source }`.
- Revisar Supabase Function Logs tras primer día.
- Añadir counter en `get_advisors` o dashboard manual de coste.
