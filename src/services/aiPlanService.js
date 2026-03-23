import { supabase } from '../lib/supabase';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-plan`;

/**
 * Service for AI-powered training plan generation.
 * Calls the generate-ai-plan Edge Function with the coach's JWT.
 */

/**
 * Generate an AI training plan for the given athlete.
 * Requires the caller to be a coach with an active relationship to the athlete.
 *
 * @param {string} athleteId - UUID of the athlete
 * @returns {Promise<object>} Parsed plan JSON with plan_name, duration_weeks, tier, weeks[]
 * @throws {Error} On auth failure, network error, or AI generation failure
 */
/**
 * Generate an AI plan and handle loading/error state via callbacks.
 * Keeps UI state management in the component while core logic lives here.
 *
 * @param {string} athleteId
 * @param {object} callbacks - { onStart, onSuccess, onError, onFinally }
 */
export const generateAIPlanWithCallbacks = async (athleteId, { onStart, onSuccess, onError, onFinally }) => {
  onStart?.();
  try {
    const plan = await generateAIPlan(athleteId);
    onSuccess?.(plan);
  } catch (err) {
    onError?.(err);
  } finally {
    onFinally?.();
  }
};

export const generateAIPlan = async (athleteId) => {
  if (!athleteId) {
    throw new Error('No athleteId provided');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No auth session');
  }

  const response = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ athlete_id: athleteId }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = data?.error ?? 'unknown_error';
    const message = errorCode === 'ai_generation_failed'
      ? 'No se pudo generar el plan. Inténtalo de nuevo.'
      : data?.message ?? `Error ${response.status}`;
    throw new Error(message);
  }

  return data;
};
