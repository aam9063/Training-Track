import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiMessageSquare,
  FiLoader,
  FiSend,
  FiCheck,
  FiCheckCircle,
  FiUser,
  FiArrowLeft,
  FiSearch,
} from 'react-icons/fi';
import { showError } from '../../lib/toast';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { getAthletes } from '../../services/athleteService';
import {
  getConversations,
  getConversationKey,
  getMessages,
  sendMessage,
  markConversationAsRead,
  subscribeToConversation,
} from '../../services/chatService';
import { supabase } from '../../lib/supabase';

const CoachMessages = () => {
  const { profile } = useAuth();
  const { refreshUnreadCount, decrementUnread, setActiveConversationPartnerId } = useNotifications();
  const location = useLocation();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const channelRef = useRef(null);
  const textareaRef = useRef(null);

  // Load conversations + athletes
  const loadConversations = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const [convResult, athleteResult] = await Promise.all([
        getConversations(profile.id),
        getAthletes(profile.id),
      ]);

      const existingConvs = convResult.data || [];
      const athletes = athleteResult.data || [];

      // Add placeholder conversations for athletes without messages
      const existingOtherIds = new Set(existingConvs.map(c => c.otherUserId));
      const placeholders = athletes
        .filter(a => !existingOtherIds.has(a.id))
        .map(a => ({
          conversationKey: getConversationKey(profile.id, a.id),
          otherUserId: a.id,
          otherUser: {
            id: a.id,
            first_name: a.firstName,
            last_name: a.lastName,
            profile_image: a.profileImage,
          },
          lastMessage: null,
          unreadCount: 0,
        }));

      // Sort: unread first, then by last message date
      const all = [...existingConvs, ...placeholders].sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        const aTime = a.lastMessage?.created_at || '';
        const bTime = b.lastMessage?.created_at || '';
        return bTime.localeCompare(aTime);
      });

      setConversations(all);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadConversations();
    refreshUnreadCount();
  }, [loadConversations, refreshUnreadCount]);

  // Auto-open conversation from AthleteProfile navigation
  useEffect(() => {
    if (location.state?.openConversationWith && conversations.length > 0) {
      const conv = conversations.find(
        c => c.otherUser.id === location.state.openConversationWith
      );
      if (conv) handleSelectConversation(conv);
      window.history.replaceState({}, document.title);
    }
  }, [conversations, location.state]);

  // Clear active partner on unmount
  useEffect(() => {
    return () => setActiveConversationPartnerId(null);
  }, [setActiveConversationPartnerId]);

  // Select a conversation
  const handleSelectConversation = useCallback(async (conv) => {
    setSelectedConversation(conv);
    setActiveConversationPartnerId(conv.otherUserId);
    setLoadingMessages(true);
    setMessages([]);

    // Cleanup previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    try {
      const { data } = await getMessages(conv.conversationKey);
      setMessages(data || []);

      // Mark as read
      if (conv.unreadCount > 0) {
        await markConversationAsRead(conv.conversationKey, profile.id);
        decrementUnread(conv.unreadCount);
        setConversations(prev =>
          prev.map(c =>
            c.conversationKey === conv.conversationKey
              ? { ...c, unreadCount: 0 }
              : c
          )
        );
      }

      // Subscribe to new messages
      channelRef.current = subscribeToConversation(
        conv.conversationKey,
        async (newMsg) => {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Update conversation list with latest message
          setConversations(prev =>
            prev.map(c =>
              c.conversationKey === conv.conversationKey
                ? { ...c, lastMessage: newMsg }
                : c
            )
          );

          // If received, mark as read immediately (conversation is open)
          if (newMsg.receiver_id === profile.id) {
            await supabase
              .from('chat_messages')
              .update({ read: true, read_at: new Date().toISOString() })
              .eq('id', newMsg.id);
            decrementUnread(1);
          }
        }
      );
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [profile?.id, decrementUnread]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

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
      else if (loadingMessages === false) scrollToBottom(false);
    }
  }, [messages, loadingMessages, scrollToBottom]);

  // Send message
  const handleSend = async () => {
    const content = newMessageText.trim();
    if (!content || !selectedConversation || sending) return;

    setSending(true);
    setNewMessageText('');
    try {
      const { error } = await sendMessage(
        profile.id,
        selectedConversation.otherUser.id,
        content
      );
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

  // Handle Enter key
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

  const formatConversationTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return formatTime(dateStr);
    if (days === 1) return 'Ayer';
    if (days < 7) return date.toLocaleDateString('es-ES', { weekday: 'short' });
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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

  const getUserName = (user) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Usuario';
  };

  const getUserInitials = (user) => {
    const f = (user.first_name || 'U')[0];
    const l = (user.last_name || '')[0] || '';
    return `${f}${l}`.toUpperCase();
  };

  // Filter conversations
  const filteredConversations = searchQuery
    ? conversations.filter(c =>
        getUserName(c.otherUser).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiLoader className="w-8 h-8 animate-spin text-sky-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-62px-72px)] lg:h-screen overflow-hidden -mb-[72px] lg:mb-0">
      {/* Left Panel — Conversation List */}
      <div
        className={`
          w-full lg:w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-800 flex flex-col
          ${selectedConversation ? 'hidden lg:flex' : 'flex'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Mensajes
          </h1>
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar atleta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.conversationKey === conv.conversationKey;
              return (
                <button
                  key={conv.conversationKey}
                  onClick={() => handleSelectConversation(conv)}
                  className={`
                    w-full text-left p-3 flex items-center space-x-3 transition-colors
                    ${isSelected
                      ? 'bg-sky-50 dark:bg-sky-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }
                  `}
                >
                  {/* Avatar */}
                  {conv.otherUser.profile_image ? (
                    <img
                      src={conv.otherUser.profile_image}
                      alt={getUserName(conv.otherUser)}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-sm">
                        {getUserInitials(conv.otherUser)}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-900 dark:text-white'}`}>
                        {getUserName(conv.otherUser)}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                        {formatConversationTime(conv.lastMessage?.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {conv.lastMessage
                          ? (conv.lastMessage.sender_id === profile.id ? 'Tú: ' : '') + conv.lastMessage.content
                          : 'Empieza a chatear'
                        }
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-sky-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0 ml-2">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-center py-12 px-4">
              <FiMessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No se encontraron resultados' : 'No hay conversaciones'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Chat View */}
      <div
        className={`
          flex-1 flex flex-col bg-gray-50 dark:bg-gray-900
          ${selectedConversation ? 'flex' : 'hidden lg:flex'}
        `}
      >
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center space-x-3">
              <button
                onClick={() => {
                  setSelectedConversation(null);
                  setActiveConversationPartnerId(null);
                  if (channelRef.current) {
                    supabase.removeChannel(channelRef.current);
                    channelRef.current = null;
                  }
                }}
                className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              {selectedConversation.otherUser.profile_image ? (
                <img
                  src={selectedConversation.otherUser.profile_image}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {getUserInitials(selectedConversation.otherUser)}
                  </span>
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  {getUserName(selectedConversation.otherUser)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Atleta</p>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4"
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <FiLoader className="w-6 h-6 animate-spin text-sky-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiMessageSquare className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      Envía tu primer mensaje a {getUserName(selectedConversation.otherUser)}
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
                                ? 'bg-sky-500 text-white rounded-br-md'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md shadow-sm'
                              }
                            `}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className={`flex items-center justify-end space-x-1 mt-1 ${isMine ? 'text-sky-100' : 'text-gray-400 dark:text-gray-500'}`}>
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
                    // Auto-resize
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none overflow-hidden"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessageText.trim() || sending}
                  className="p-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-full transition-colors flex-shrink-0"
                >
                  {sending ? (
                    <FiLoader className="w-5 h-5 animate-spin" />
                  ) : (
                    <FiSend className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiMessageSquare className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Tus mensajes
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Selecciona un atleta para empezar a chatear
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachMessages;
