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
  const [activeConversationPartnerId, setActiveConversationPartnerId] = useState(null);
  const activePartnerRef = useRef(null);

  // Push notification state: 'loading' | 'not-standalone' | 'unsupported' | 'prompt' | 'subscribed' | 'denied'
  const [pushState, setPushState] = useState('loading');

  // Fetch initial unread count — unified chat_messages table
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);

      if (!error) setUnreadMessages(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [user?.id]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Keep ref in sync for use inside realtime callback
  useEffect(() => {
    activePartnerRef.current = activeConversationPartnerId;
  }, [activeConversationPartnerId]);

  // Set up Realtime subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const channels = [];

    // New chat messages for this user
    const msgChannel = supabase
      .channel('global-chat-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const senderId = payload.new.sender_id;

          // Skip toast if the user is already viewing this conversation
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

    // Training sessions — only for athletes
    if (profile?.role === 'athlete') {
      const trainingChannel = supabase
        .channel('athlete-new-training')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'training_sessions',
            filter: `athlete_id=eq.${user.id}`,
          },
          () => {
            showInfo('Nuevo entrenamiento asignado');
          }
        )
        .subscribe();

      channels.push(trainingChannel);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [user?.id, profile?.role]);

  // Detect push notification state
  useEffect(() => {
    if (!user?.id) {
      setPushState('loading');
      return;
    }

    (async () => {
      if (!isStandaloneMode()) {
        setPushState('not-standalone');
        return;
      }
      if (!isPushSupported()) {
        setPushState('unsupported');
        return;
      }

      const permission = getPermissionState();
      if (permission === 'denied') {
        setPushState('denied');
        return;
      }
      if (permission === 'granted') {
        const active = await hasActiveSubscription();
        if (active) {
          // Ensure this device's subscription is linked to the current user
          // (handles account switching on the same device)
          await ensureSubscriptionForUser(user.id);
          setPushState('subscribed');
        } else {
          setPushState('prompt');
        }
        return;
      }
      // permission === 'default'
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

  const refreshUnreadCount = useCallback(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const value = useMemo(
    () => ({
      unreadMessages,
      decrementUnread,
      refreshUnreadCount,
      setActiveConversationPartnerId,
      pushState,
      requestPushPermission,
    }),
    [unreadMessages, decrementUnread, refreshUnreadCount, pushState, requestPushPermission]
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
