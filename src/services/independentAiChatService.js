import { supabase } from '../lib/supabase';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/athlete-ai-chat`;

/**
 * Send a message to the AI assistant as an independent athlete.
 * The Edge Function uses the athlete's own JWT, detects is_independent=true,
 * and builds enhanced context from the athlete's own data.
 *
 * @param {Object} params
 * @param {string} params.userId - athlete's UUID (= auth.uid())
 * @param {string} params.message - user message
 * @returns {Promise<string>} AI reply
 */
export async function sendIndependentChatMessage({ userId, message }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No auth session');

  const response = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      athleteId: userId,
      message,
      // athleteName will be resolved by the Edge Function from the athlete's own profile
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error calling AI chat');
  return data.reply;
}

/**
 * Load existing chat session messages for an independent athlete.
 * Uses athlete_id = coach_id (self-chat pattern) in ai_chat_sessions.
 *
 * @param {string} userId - athlete's UUID
 * @returns {Promise<Array>} array of { role, content, created_at }
 */
export async function getIndependentChatSession(userId) {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('messages')
    .eq('coach_id', userId)
    .eq('athlete_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.messages ?? [];
}

/**
 * Clear chat history for an independent athlete.
 *
 * @param {string} userId - athlete's UUID
 */
export async function clearIndependentChatSession(userId) {
  const { error } = await supabase
    .from('ai_chat_sessions')
    .update({ messages: [], updated_at: new Date().toISOString() })
    .eq('coach_id', userId)
    .eq('athlete_id', userId);

  if (error) throw error;
}
