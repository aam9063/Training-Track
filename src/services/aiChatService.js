import { supabase } from '../lib/supabase';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/athlete-ai-chat`;

/**
 * Send a message to the athlete AI chat and get a reply.
 */
export async function sendAthleteChatMessage({ athleteId, athleteName, message }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No auth session');

  const response = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ athleteId, athleteName, message }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error calling AI chat');
  return data.reply;
}

/**
 * Load existing chat session messages for a coach-athlete pair.
 * Returns array of { role, content, created_at }
 */
export async function getChatSession(coachId, athleteId) {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('messages')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (error) throw error;
  return data?.messages ?? [];
}

/**
 * Clear chat history for a coach-athlete pair.
 */
export async function clearChatSession(coachId, athleteId) {
  const { error } = await supabase
    .from('ai_chat_sessions')
    .update({ messages: [], updated_at: new Date().toISOString() })
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId);

  if (error) throw error;
}
