import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const gemmaApiKey = Deno.env.get("GEMMA4_API_KEY")!;
const GEMMA_MODEL = "gemini-2.5-flash";
const GEMMA_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado - sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { reportData, athleteId, periodWeeks } = await req.json();

    if (!reportData || !athleteId) {
      return new Response(JSON.stringify({ error: "Faltan datos requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify coach has access to this athlete
    const { data: relationship, error: relError } = await supabase
      .from("coach_athlete_relationship")
      .select("id")
      .eq("coach_id", user.id)
      .eq("athlete_id", athleteId)
      .eq("status", "active")
      .maybeSingle();

    if (relError || !relationship) {
      return new Response(JSON.stringify({ error: "No tienes acceso a este atleta" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!gemmaApiKey) {
      return new Response(JSON.stringify({ error: "API key de Gemma no configurada en el servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the AI prompt
    const systemMessage = `Eres un fisiólogo deportivo y entrenador de running profesional con amplia experiencia en atletismo de medio fondo y fondo, y también conocimientos en deportes complementarios (ciclismo, natación, fuerza). Analiza los datos de rendimiento de un atleta y genera un informe exhaustivo en español. DEBES responder ÚNICAMENTE con un JSON válido siguiendo el schema exacto que se te indica. No incluyas texto fuera del JSON.`;

    const userMessage = `Analiza los siguientes datos del atleta y genera un informe de rendimiento completo.

PERFIL DEL ATLETA:
${JSON.stringify(reportData.profile, null, 2)}

MÉTRICAS DE STRAVA (período reciente):
${JSON.stringify(reportData.strava, null, 2)}
Nota: totalDistanceKm incluye TODOS los deportes. runningDistanceKm es solo running. avgPace y avgHeartrate son solo de running. sportBreakdown contiene el desglose por deporte (running, cycling, swimming, gym) si el atleta practica varios deportes.

MEJORES MARCAS (STRAVA):
${JSON.stringify(reportData.bestEfforts, null, 2)}

COMPARACIÓN DE PERÍODO (últimas 2 semanas vs 2 semanas previas):
${JSON.stringify(reportData.periodComparison, null, 2)}

CARGA DE ENTRENAMIENTO (basada SOLO en km de running — no incluye ciclismo, natación ni otros deportes):
${JSON.stringify(reportData.load, null, 2)}
Interpretación ACWR: <0.8 = desentrenamiento, 0.8-1.3 = zona óptima, 1.3-1.5 = riesgo moderado, >1.5 = alto riesgo
IMPORTANTE: Estos valores de carga (acuteLoad, chronicLoad, ACWR) son exclusivamente de actividades de running (Run, TrailRun, VirtualRun). No mezclan km de ciclismo ni otros deportes.

DATOS FISIOLÓGICOS:
${JSON.stringify(reportData.physiological, null, 2)}

VDOT Y ZONAS DANIELS:
${JSON.stringify(reportData.vdot, null, 2)}
Nota: VDOT es el índice de capacidad aeróbica de Jack Daniels. Las zonas de entrenamiento (easy, marathon, threshold, interval, repetition) son los ritmos objetivo en min/km.

PMC - PERFORMANCE MANAGEMENT CHART (estado actual basado en TSS):
${JSON.stringify(reportData.pmc, null, 2)}
CTL = Fitness crónico (media 42 días). ATL = Fatiga aguda (media 7 días). TSB = CTL - ATL (forma del día). TSB positivo = fresco, negativo = fatigado. Ramp rate > 5-7 = incremento agresivo.

TENDENCIA PMC (últimos 28 días):
${JSON.stringify(reportData.pmcTrend, null, 2)}

PERIODIZACIÓN (mesociclo activo):
${JSON.stringify(reportData.periodization, null, 2)}
Fases: base, build (construcción), peak (pico), taper, recovery (recuperación), competition, transition. Compliance = % cumplimiento km planificados vs reales.

IMPORTANTE — INTERPRETACIÓN DE KM PLANIFICADOS VS REALES:
Los km planificados se parsean del texto del plan y a menudo solo incluyen la parte de calidad. Ten en cuenta el tipo de sesión al comparar:
- Sesiones de SERIES (patrón NxDistancia como "5x1000m", "20x400m"): los km planificados solo cuentan las repeticiones. La sesión real incluye calentamiento (2-4km) y vuelta a calma (1-2km). Es NORMAL que los km reales superen los planificados en un 30-60%. NO penalices esta diferencia.
- Sesiones con calentamiento explícito (título incluye "R1", "RR" antes de series, ej: "4k R1 + 5x1000m + 2k RR"): los km planificados ya incluyen todo. Comparación directa válida.
- Rodajes continuos ("14km R2", "Rodaje 8km"): comparación directa válida. Desviaciones ±10% son normales.
- Antes de alertar por sobrecarga o bajo cumplimiento, verifica si la diferencia se explica por calentamientos/vueltas a calma no contabilizados en sesiones de series.

MARCAS PERSONALES (DB):
${JSON.stringify(reportData.personalBests, null, 2)}

PREDICCIONES DE CARRERA (Fórmula de Riegel):
${JSON.stringify(reportData.raceEstimates, null, 2)}

PROGRESIÓN DE RITMO SEMANAL (últimas semanas, solo running):
${JSON.stringify(reportData.weeklyPaces, null, 2)}

TENDENCIA FC EN CARRERA (últimas actividades de running):
${JSON.stringify(reportData.hrTrend, null, 2)}

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "resumen_ejecutivo": {
    "nivel_fitness": "excelente|bueno|moderado|necesita mejorar",
    "puntuacion_global": <número 1-10>,
    "logros": ["logro 1", "logro 2", ...],
    "areas_mejora": ["área 1", "área 2", ...],
    "resumen_general": "2-3 párrafos con análisis global del estado del atleta, incluyendo mención a actividades complementarias (ciclismo, natación, fuerza) si las practica"
  },
  "analisis_volumen": {
    "tendencia_semanal": "creciente|decreciente|estable",
    "volumen_medio_semanal_km": <número, solo running>,
    "balance_volumen_intensidad": "párrafo explicativo",
    "entrenamiento_cruzado": "párrafo analizando las actividades complementarias (ciclismo, natación, gym) si las hay, su impacto en el rendimiento de running, y si el balance es adecuado. Si no hay actividades complementarias, indicar que podría beneficiarse de cross-training.",
    "insights": ["insight 1", "insight 2", ...]
  },
  "progresion_rendimiento": {
    "evolucion_ritmo": "párrafo analizando la evolución del ritmo",
    "eficiencia_cardiaca": "párrafo sobre la relación ritmo/FC",
    "mejores_marcas_analisis": "análisis de las mejores marcas y su significado",
    "predicciones_carrera": "predicciones y análisis de tiempos esperados",
    "insights": ["insight 1", "insight 2", ...]
  },
  "analisis_vdot": {
    "valor_vdot": <número o null>,
    "nivel_vdot": "párrafo interpretando el nivel de VDOT del atleta (principiante, intermedio, avanzado, élite)",
    "coherencia_zonas": "párrafo analizando si los ritmos reales de entrenamiento coinciden con las zonas Daniels prescritas",
    "recomendacion_zonas": "párrafo con recomendaciones sobre en qué zonas debería entrenar más o menos según la fase actual",
    "insights": ["insight 1", "insight 2", ...]
  },
  "analisis_fisiologico": {
    "vam_vo2max": "análisis de VAM y VO2max si hay datos, o indicar que no hay datos disponibles",
    "zonas_fc": "análisis de zonas de frecuencia cardíaca",
    "umbrales": "análisis de umbrales (VT1, VT2, MLSS)",
    "insights": ["insight 1", "insight 2", ...]
  },
  "gestion_carga": {
    "acwr": <número>,
    "interpretacion_acwr": "interpretación detallada del ACWR. Recuerda que este valor es solo de running.",
    "monotonia": "análisis de la monotonía del entrenamiento",
    "tendencia_carga": "análisis de la tendencia de carga",
    "pmc_analisis": "párrafo analizando CTL, ATL, TSB actual y su tendencia en los últimos 28 días. Interpretar si el atleta está en buena forma (TSB positivo) o acumulando fatiga (TSB negativo). Evaluar si el ramp rate es adecuado.",
    "insights": ["insight 1", "insight 2", ...]
  },
  "periodizacion_analisis": {
    "fase_actual": "nombre de la fase actual del mesociclo o null",
    "cumplimiento": "párrafo analizando el cumplimiento de km planificados vs reales en cada semana del mesociclo",
    "coherencia_fase": "párrafo evaluando si el tipo de entrenamientos realizados es coherente con la fase de periodización (ej: base = volumen alto/intensidad baja, build = más calidad, peak = reducción volumen, etc.)",
    "recomendaciones_fase": "párrafo con recomendaciones específicas para la fase actual y la transición a la siguiente",
    "insights": ["insight 1", "insight 2", ...]
  },
  "riesgo_lesion": {
    "nivel_riesgo": "bajo|moderado|alto|muy alto",
    "puntuacion_riesgo": <número 1-10>,
    "factores_riesgo": ["factor 1", "factor 2", ...],
    "medidas_preventivas": ["medida 1", "medida 2", ...]
  },
  "recomendaciones": {
    "ajustes_entrenamiento": ["ajuste 1", "ajuste 2", ...],
    "areas_foco": ["foco 1", "foco 2", ...],
    "proximos_pasos": ["paso 1", "paso 2", ...],
    "mensaje_motivacional": "mensaje motivacional personalizado para el atleta"
  }
}`;

    // Call Gemma 4 via Gemini API
    const aiResponse = await fetch(`${GEMMA_URL}${gemmaApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMessage }] },
        contents: [{ role: "user", parts: [{ text: userMessage + "\n\nResponde SOLO con JSON válido, sin markdown ni explicaciones." }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 12000, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      return new Response(JSON.stringify({ error: `Error de la IA: ${aiResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiParts = aiData.candidates?.[0]?.content?.parts ?? [];
    const content = aiParts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text: string }) => p.text).join("") || aiParts.map((p: { text: string }) => p.text).join("");

    if (!content) {
      return new Response(JSON.stringify({ error: "La IA no generó contenido" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Respuesta de IA inválida" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save report to database using service role for insert
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: savedReport, error: saveError } = await supabaseAdmin
      .from("ai_reports")
      .insert({
        athlete_id: athleteId,
        coach_id: user.id,
        report_data: reportData,
        ai_analysis: aiAnalysis,
        period_weeks: periodWeeks || 4,
        status: "completed",
      })
      .select("id, created_at")
      .single();

    if (saveError) {
      console.error("Error saving report:", saveError);
      // Still return the AI analysis even if save fails
    }

    return new Response(
      JSON.stringify({
        aiAnalysis,
        reportId: savedReport?.id || null,
        createdAt: savedReport?.created_at || new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
