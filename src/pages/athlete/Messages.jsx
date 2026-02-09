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
  FiPlus,
  FiX,
  FiSend,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const AthleteMessages = () => {
  const { profile, getMyCoach } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [coachInfo, setCoachInfo] = useState(null);
  const [newMessage, setNewMessage] = useState({
    subject: '',
    content: '',
  });
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get coach info using the AuthContext method
      const { data: coach } = await getMyCoach();
      if (coach) {
        setCoachInfo({
          id: coach.id,
          first_name: coach.first_name,
          last_name: coach.last_name,
        });
      }

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
  }, [profile?.id, getMyCoach]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleSendMessage = async () => {
    if (!newMessage.subject || !newMessage.content || !coachInfo?.id) {
      return;
    }

    setSending(true);
    try {
      // Insert message to athlete_messages table (athlete to coach)
      const { error } = await supabase.from('athlete_messages').insert({
        athlete_id: profile.id,
        coach_id: coachInfo.id,
        subject: newMessage.subject,
        content: newMessage.content,
        read: false,
      });

      if (error) throw error;

      // Reset form and close modal
      setNewMessage({ subject: '', content: '' });
      setShowComposeModal(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleReply = (originalMessage) => {
    setNewMessage({
      subject: `Re: ${originalMessage.subject || 'Sin asunto'}`,
      content: '',
    });
    setSelectedMessage(null);
    setShowComposeModal(true);
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
          <FiLoader className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-4" />
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
            <div className="flex items-center justify-between">
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
              {/* Reply button */}
              <button
                onClick={() => handleReply(selectedMessage)}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                <FiSend className="w-4 h-4" />
                <span>Responder</span>
              </button>
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
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mis Mensajes
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Comunicación con tu entrenador
          </p>
        </div>
        {coachInfo && (
          <button
            onClick={() => setShowComposeModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-800 hover:bg-green-900 text-white rounded-lg font-medium transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Nuevo Mensaje</span>
          </button>
        )}
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
                    !message.read ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
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
                            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
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
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
              Tu bandeja de entrada está vacía. Los mensajes de tu entrenador aparecerán aquí.
            </p>
            {coachInfo && (
              <button
                onClick={() => setShowComposeModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-green-800 hover:bg-green-900 text-white rounded-lg font-medium transition-colors"
              >
                <FiPlus className="w-5 h-5" />
                <span>Enviar primer mensaje</span>
              </button>
            )}
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
              <span className="flex items-center space-x-1 text-orange-600 dark:text-orange-400">
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

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Nuevo Mensaje
              </h2>
              <button
                onClick={() => setShowComposeModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Recipient info */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">
                    {coachInfo?.first_name?.[0] || 'E'}{coachInfo?.last_name?.[0] || ''}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Para: {coachInfo?.first_name} {coachInfo?.last_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tu entrenador</p>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Asunto
                </label>
                <input
                  type="text"
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                  placeholder="Asunto del mensaje"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mensaje
                </label>
                <textarea
                  value={newMessage.content}
                  onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                  placeholder="Escribe tu mensaje..."
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowComposeModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendMessage}
                disabled={sending || !newMessage.subject || !newMessage.content}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white rounded-lg font-medium transition-colors"
              >
                {sending ? (
                  <FiLoader className="w-5 h-5 animate-spin" />
                ) : (
                  <FiSend className="w-5 h-5" />
                )}
                <span>Enviar</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AthleteMessages;
