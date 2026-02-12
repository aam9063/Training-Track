import { supabase } from '../lib/supabase';

/**
 * Build a deterministic conversation key from two user IDs.
 * Always returns the lexicographically smaller UUID first.
 */
export function getConversationKey(userId1, userId2) {
  return userId1 < userId2
    ? `${userId1}:${userId2}`
    : `${userId2}:${userId1}`;
}

/**
 * Fetch all conversations for a user with last message, other participant info, and unread count.
 */
export async function getConversations(userId) {
  const { data: allMessages, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_key, sender_id, receiver_id, content, read, created_at')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };

  // Group by conversation_key, take first (latest) message per conversation
  const conversationMap = new Map();
  for (const msg of allMessages) {
    if (!conversationMap.has(msg.conversation_key)) {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      conversationMap.set(msg.conversation_key, {
        conversationKey: msg.conversation_key,
        otherUserId: otherId,
        lastMessage: msg,
        unreadCount: 0,
      });
    }
    if (msg.receiver_id === userId && !msg.read) {
      conversationMap.get(msg.conversation_key).unreadCount += 1;
    }
  }

  // Resolve user info for all other participants
  const otherIds = [...new Set([...conversationMap.values()].map(c => c.otherUserId))];
  let userMap = new Map();
  if (otherIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, profile_image')
      .in('id', otherIds);
    userMap = new Map((users || []).map(u => [u.id, u]));
  }

  const conversations = [...conversationMap.values()].map(conv => ({
    ...conv,
    otherUser: userMap.get(conv.otherUserId) || {
      id: conv.otherUserId,
      first_name: 'Usuario',
      last_name: '',
      profile_image: null,
    },
  }));

  return { data: conversations, error: null };
}

/**
 * Fetch messages for a specific conversation.
 */
export async function getMessages(conversationKey, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_key', conversationKey)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Reverse so oldest first (for rendering top-to-bottom)
  return { data: (data || []).reverse(), error };
}

/**
 * Send a message.
 */
export async function sendMessage(senderId, receiverId, content) {
  const conversationKey = getConversationKey(senderId, receiverId);
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_key: conversationKey,
      sender_id: senderId,
      receiver_id: receiverId,
      content: content.trim(),
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Mark all unread messages in a conversation as read for the current user.
 */
export async function markConversationAsRead(conversationKey, userId) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('conversation_key', conversationKey)
    .eq('receiver_id', userId)
    .eq('read', false);

  return { error };
}

/**
 * Subscribe to new messages for a specific conversation.
 * Returns the channel for cleanup.
 */
export function subscribeToConversation(conversationKey, onNewMessage) {
  const channel = supabase
    .channel(`chat:${conversationKey}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_key=eq.${conversationKey}`,
      },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe();

  return channel;
}
