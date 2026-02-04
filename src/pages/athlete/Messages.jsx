import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FiMessageSquare,
  FiLoader,
  FiInbox,
  FiCheck,
  FiClock,
  FiUser,
  FiChevronRight,
  FiArrowLeft,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const AthleteMessages = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);

  const loadMessages = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch messages sent to this athlete
      const { data, error } = await supabase
        .from('coach_messages')
        .select(`
          *,
          sender:coach_id (
            id,
            first_name,
            last_name
          )
        `)
        .eq('athlete_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching messages:', error);
        // If table doesn't exist, show empty state
        setMessages([]);
      } else {
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const markAsRead = async (messageId) => {
    try {
      await supabase
        .from('coach_messages')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', messageId);

      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, read: true } : m))
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleSelectMessage = (message) => {
    setSelectedMessage(message);
    if (!message.read) {
      markAsRead(message.id);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return date.toLocaleDateString('es-ES', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
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

  // Message detail view
  if (selectedMessage) {
    const senderName = selectedMessage.sender
      ? `${selectedMessage.sender.first_name || ''} ${selectedMessage.sender.last_name || ''}`.trim()
      : 'Tu entrenador';

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setSelectedMessage(null)}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span>Volver a mensajes</span>
          </button>
        </div>

        {/* Message Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Message Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {selectedMessage.subject || 'Sin asunto'}
            </h1>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <FiUser className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{senderName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(selectedMessage.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Message Body */}
          <div className="p-4 sm:p-6">
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedMessage.content || selectedMessage.message}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Message list view
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Mis Mensajes
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Mensajes de tu entrenador
        </p>
      </div>

      {/* Messages List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {messages.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {messages.map((message) => {
              const senderName = message.sender
                ? `${message.sender.first_name || ''} ${message.sender.last_name || ''}`.trim()
                : 'Tu entrenador';

              return (
                <button
                  key={message.id}
                  onClick={() => handleSelectMessage(message)}
                  className={`w-full text-left p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    !message.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <FiUser className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-medium truncate ${
                          !message.read
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {senderName}
                        </p>
                        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                          {!message.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                      </div>
                      <p className={`text-sm truncate mb-1 ${
                        !message.read
                          ? 'font-semibold text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {message.subject || 'Sin asunto'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {message.content || message.message}
                      </p>
                    </div>

                    {/* Arrow */}
                    <FiChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 self-center" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiInbox className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No hay mensajes
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Tu bandeja de entrada está vacía. Los mensajes de tu entrenador aparecerán aquí.
            </p>
          </div>
        )}
      </motion.div>

      {/* Unread count */}
      {messages.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <FiMessageSquare className="w-4 h-4" />
              <span>{messages.length} mensaje{messages.length !== 1 ? 's' : ''}</span>
            </span>
            {messages.filter(m => !m.read).length > 0 && (
              <span className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
                <FiClock className="w-4 h-4" />
                <span>{messages.filter(m => !m.read).length} sin leer</span>
              </span>
            )}
          </div>
          {messages.filter(m => m.read).length > 0 && (
            <span className="flex items-center space-x-1">
              <FiCheck className="w-4 h-4" />
              <span>{messages.filter(m => m.read).length} leído{messages.filter(m => m.read).length !== 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AthleteMessages;
