import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { showInfo } from '../lib/toast';
import {
  isStandaloneMode,
  isPushSupported,
  getPermissionState,
  hasActiveSubscription,
  subscribeToPush,
  ensureSubscriptionForUser,
} from '../lib/pushNotifications';

const NotificationContext = createContext(undefined);

export function NotificationProvider({ children }) {
  const { user, profile } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activeConversationPartnerId, setActiveConversationPartnerId] = useState(null);
  const activePartnerRef = useRef(null);

  // Push notification state: 'loading' | 'not-standalone' | 'unsupported' | 'prompt' | 'subscribed' | 'denied'
  const [pushState, setPushState] = useState('loading');

  // ─── Unread messages ───────────────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);
      if (!error) setUnreadMessages(count || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [user?.id]);

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  // ─── Unread notifications ──────────────────────────────────────────────────
  const fetchUnreadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (!error) setUnreadNotifications(count || 0);
    } catch (err) {
      console.error('Error fetching unread notifications:', err);
    }
  }, [user?.id]);

  useEffect(() => { fetchUnreadNotifications(); }, [fetchUnreadNotifications]);

  // Mark all notifications as read
  const markNotificationsRead = useCallback(async () => {
    if (!user?.id || unreadNotifications === 0) return;
    setUnreadNotifications(0); // optimistic
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
  }, [user?.id, unreadNotifications]);

  // ─── Keep ref in sync ─────────────────────────────────────────────────────
  useEffect(() => {
    activePartnerRef.current = activeConversationPartnerId;
  }, [activeConversationPartnerId]);

  // ─── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channels = [];

    // New chat messages
    const msgChannel = supabase
      .channel('global-chat-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const senderId = payload.new.sender_id;
          if (activePartnerRef.current === senderId) return;
          setUnreadMessages((prev) => prev + 1);
          const { data: sender } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', senderId)
            .single();
          const name = sender
            ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
            : 'alguien';
          showInfo(`Nuevo mensaje de ${name}`);
        }
      )
      .subscribe();
    channels.push(msgChannel);

    // New notifications (in-app)
    const notifChannel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setUnreadNotifications((prev) => prev + 1);
          showInfo(payload.new.title);
        }
      )
      .subscribe();
    channels.push(notifChannel);

    // Training sessions — only for athletes (kept for legacy toast behaviour)
    if (profile?.role === 'athlete') {
      const trainingChannel = supabase
        .channel('athlete-new-training')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'training_sessions', filter: `athlete_id=eq.${user.id}` },
          () => {} // notification now handled via notifications table trigger
        )
        .subscribe();
      channels.push(trainingChannel);
    }

    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [user?.id, profile?.role]);

  // ─── Push notification state ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setPushState('loading'); return; }
    (async () => {
      if (!isStandaloneMode()) { setPushState('not-standalone'); return; }
      if (!isPushSupported()) { setPushState('unsupported'); return; }
      const permission = getPermissionState();
      if (permission === 'denied') { setPushState('denied'); return; }
      if (permission === 'granted') {
        const active = await hasActiveSubscription();
        if (active) {
          await ensureSubscriptionForUser(user.id);
          setPushState('subscribed');
        } else {
          setPushState('prompt');
        }
        return;
      }
      setPushState('prompt');
    })();
  }, [user?.id]);

  const requestPushPermission = useCallback(async () => {
    if (!user?.id) return;
    const success = await subscribeToPush(user.id);
    setPushState(success ? 'subscribed' : 'denied');
  }, [user?.id]);

  const decrementUnread = useCallback((count = 1) => {
    setUnreadMessages((prev) => Math.max(0, prev - count));
  }, []);

  const refreshUnreadCount = useCallback(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  const value = useMemo(
    () => ({
      unreadMessages,
      decrementUnread,
      refreshUnreadCount,
      setActiveConversationPartnerId,
      pushState,
      requestPushPermission,
      unreadNotifications,
      markNotificationsRead,
    }),
    [unreadMessages, decrementUnread, refreshUnreadCount, pushState, requestPushPermission, unreadNotifications, markNotificationsRead]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
