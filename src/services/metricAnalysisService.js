import { supabase } from '../lib/supabase';

/**
 * Normalise a server response into a Report object.
 * Accepts new shape `{ report: { sections: [...] } }` and legacy string `{ response }`.
 */
const coerceReport = (result) => {
  if (result?.report && Array.isArray(result.report.sections)) {
    return result.report;
  }
  if (typeof result?.response === 'string' && result.response.length > 0) {
    return { sections: [{ type: 'text', content: result.response }] };
  }
  return { sections: [] };
};

/**
 * Invokes the analyze-metric-chart edge function.
 *
 * @param {Object} params
 * @param {string} params.chartType - one of the whitelist chart types
 * @param {Object} params.data - chart-specific payload
 * @param {Object} [params.athleteContext] - { nivel, objetivo, vam }
 * @returns {Promise<{ data: { report: object, report_id: string|null, title: string|null, cached: boolean, source?: string, remaining?: number|null } | null, error: { code: string, message: string, meta?: any } | null }>}
 */
export const analyzeMetricChart = async ({ chartType, data, athleteContext } = {}) => {
  if (!chartType) {
    return {
      data: null,
      error: { code: 'invalid_input', message: 'chartType requerido' },
    };
  }

  const { data: result, error } = await supabase.functions.invoke('analyze-metric-chart', {
    body: {
      chart_type: chartType,
      data: data ?? {},
      athlete_context: athleteContext ?? null,
    },
  });

  if (error) {
    return {
      data: null,
      error: { code: 'network', message: error.message || 'Error de red' },
    };
  }

  if (!result?.ok) {
    return {
      data: null,
      error: {
        code: result?.code || 'unknown',
        message: result?.message || 'No se pudo generar el análisis',
        meta: result,
      },
    };
  }

  return {
    data: {
      report: coerceReport(result),
      report_id: result.report_id ?? null,
      title: result.title ?? null,
      cached: Boolean(result.cached),
      source: result.source,
      remaining: result.remaining ?? null,
    },
    error: null,
  };
};

/**
 * List paginated AI analysis reports for the current athlete.
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {string} [params.chartType]
 * @returns {Promise<{ data: { reports: Array, total: number, page: number, limit: number, has_more: boolean } | null, error: { code: string, message: string } | null }>}
 */
export const listAnalysisHistory = async ({ page = 1, limit = 10, chartType } = {}) => {
  const body = { action: 'list', page, limit };
  if (chartType) body.chart_type = chartType;

  const { data: result, error } = await supabase.functions.invoke('list-ai-reports', {
    body,
  });

  if (error) {
    return {
      data: null,
      error: { code: 'network', message: error.message || 'Error de red' },
    };
  }

  if (!result?.ok) {
    return {
      data: null,
      error: {
        code: result?.code || 'unknown',
        message: result?.message || 'No se pudieron cargar los informes',
      },
    };
  }

  return {
    data: {
      reports: result.reports ?? [],
      total: result.total ?? 0,
      page: result.page ?? page,
      limit: result.limit ?? limit,
      has_more: Boolean(result.has_more),
    },
    error: null,
  };
};

/**
 * Fetch a full saved analysis by id.
 */
export const getAnalysisById = async (id) => {
  if (!id) {
    return { data: null, error: { code: 'invalid_input', message: 'id requerido' } };
  }
  const { data: result, error } = await supabase.functions.invoke('list-ai-reports', {
    body: { action: 'get', id },
  });

  if (error) {
    return {
      data: null,
      error: { code: 'network', message: error.message || 'Error de red' },
    };
  }
  if (!result?.ok) {
    return {
      data: null,
      error: {
        code: result?.code || 'unknown',
        message: result?.message || 'No se pudo cargar el informe',
      },
    };
  }

  const row = result.report;
  return {
    data: {
      id: row?.id,
      chart_type: row?.chart_type,
      title: row?.title,
      report: row?.report ?? { sections: [] },
      athlete_context: row?.athlete_context ?? null,
      created_at: row?.created_at,
    },
    error: null,
  };
};

/**
 * Delete a saved analysis by id.
 */
export const deleteAnalysis = async (id) => {
  if (!id) {
    return { data: null, error: { code: 'invalid_input', message: 'id requerido' } };
  }
  const { data: result, error } = await supabase.functions.invoke('list-ai-reports', {
    body: { action: 'delete', id },
  });

  if (error) {
    return {
      data: null,
      error: { code: 'network', message: error.message || 'Error de red' },
    };
  }
  if (!result?.ok) {
    return {
      data: null,
      error: {
        code: result?.code || 'unknown',
        message: result?.message || 'No se pudo eliminar el informe',
      },
    };
  }
  return { data: { ok: true }, error: null };
};
