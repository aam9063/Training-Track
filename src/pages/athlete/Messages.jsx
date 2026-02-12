import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiMessageSquare,
  FiLoader,
  FiSend,
  FiCheck,
  FiCheckCircle,
} from 'react-icons/fi';
import { showError } from '../../lib/toast';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  getConversationKey,
  getMessages,
  sendMessage,
  markConversationAsRead,
  subscribeToConversation,
} from '../../services/chatService';
import { supabase } from '../../lib/supabase';

const AthleteMessages = () => {
  const { profile, getMyCoach } = useAuth();
  const { refreshUnreadCount, decrementUnread } = useNotifications();

  const [coachInfo, setCoachInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const channelRef = useRef(null);
  const textareaRef = useRef(null);

  // Load coach info and messages
  const loadData = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }

    try {
      const { data: coach } = await getMyCoach();
      if (!coach) { setLoading(false); return; }

      setCoachInfo({
        id: coach.id,
        first_name: coach.first_name,
        last_name: coach.last_name,
        profile_image: coach.profile_image,
      });

      const key = getConversationKey(profile.id, coach.id);

      const { data } = await getMessages(key);
      setMessages(data || []);

      // Mark as read
      await markConversationAsRead(key, profile.id);
      refreshUnreadCount();

      // Subscribe to new messages
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = subscribeToConversation(key, async (newMsg) => {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // If received, mark as read immediately
        if (newMsg.receiver_id === profile.id) {
          await supabase
            .from('chat_messages')
            .update({ read: true, read_at: new Date().toISOString() })
            .eq('id', newMsg.id);
          decrementUnread(1);
        }
      });
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, getMyCoach, refreshUnreadCount, decrementUnread]);

  useEffect(() => {
    loadData();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [loadData]);

  // Auto-scroll
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const container = messagesContainerRef.current;
      if (!container) { scrollToBottom(false); return; }
      const { scrollHeight, scrollTop, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      if (isNearBottom) scrollToBottom(true);
      else scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  // Send message
  const handleSend = async () => {
    const content = newMessageText.trim();
    if (!content || !coachInfo || sending) return;

    setSending(true);
    setNewMessageText('');
    try {
      const { error } = await sendMessage(profile.id, coachInfo.id, content);
      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Error al enviar el mensaje');
      setNewMessageText(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format helpers
  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDateSeparator = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.floor((today - msgDate) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getCoachName = () => {
    if (!coachInfo) return 'Entrenador';
    return `${coachInfo.first_name || ''} ${coachInfo.last_name || ''}`.trim() || 'Entrenador';
  };

  const getCoachInitials = () => {
    if (!coachInfo) return 'E';
    const f = (coachInfo.first_name || 'E')[0];
    const l = (coachInfo.last_name || '')[0] || '';
    return `${f}${l}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiLoader className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  // No coach assigned
  if (!coachInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMessageSquare className="w-10 h-10 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Sin entrenador asignado
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Los mensajes aparecerán aquí cuando tengas un entrenador asignado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center space-x-3">
        {coachInfo.profile_image ? (
          <img
            src={coachInfo.profile_image}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {getCoachInitials()}
            </span>
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {getCoachName()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Entrenador</p>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-gray-900"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiMessageSquare className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                Envía tu primer mensaje a {getCoachName()}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isMine = msg.sender_id === profile.id;
              const showDateSep = idx === 0 ||
                getDateSeparator(msg.created_at) !== getDateSeparator(messages[idx - 1].created_at);

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center justify-center my-4">
                      <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-full">
                        {getDateSeparator(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div
                      className={`
                        max-w-[75%] sm:max-w-[65%] px-3 py-2 rounded-2xl
                        ${isMine
                          ? 'bg-green-600 text-white rounded-br-md'
                          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md shadow-sm'
                        }
                      `}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`flex items-center justify-end space-x-1 mt-1 ${isMine ? 'text-green-200' : 'text-gray-400 dark:text-gray-500'}`}>
                        <span className="text-[11px]">{formatTime(msg.created_at)}</span>
                        {isMine && (
                          msg.read
                            ? <FiCheckCircle className="w-3 h-3" />
                            : <FiCheck className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-end space-x-3">
          <textarea
            ref={textareaRef}
            value={newMessageText}
            onChange={(e) => {
              setNewMessageText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none overflow-hidden"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessageText.trim() || sending}
            className="p-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-full transition-colors flex-shrink-0"
          >
            {sending ? (
              <FiLoader className="w-5 h-5 animate-spin" />
            ) : (
              <FiSend className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AthleteMessages;
