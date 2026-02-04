import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FiMessageSquare,
  FiLoader,
  FiSend,
  FiCheck,
  FiClock,
  FiUser,
  FiChevronRight,
  FiArrowLeft,
  FiPlus,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getAthletes } from '../../services/athleteService';

const CoachMessages = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [newMessage, setNewMessage] = useState({
    athleteId: '',
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
      // Load athletes
      const { data: athletesData } = await getAthletes(profile.id);
      setAthletes(athletesData || []);

      // Load sent messages
      const { data, error } = await supabase
        .from('coach_messages')
        .select(`
          *,
          recipient:athlete_id (
            id,
            user:user_id (
              first_name,
              last_name
            )
          )
        `)
        .eq('coach_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      } else {
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendMessage = async () => {
    if (!newMessage.athleteId || !newMessage.subject || !newMessage.content) {
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from('coach_messages').insert({
        coach_id: profile.id,
        athlete_id: newMessage.athleteId,
        subject: newMessage.subject,
        content: newMessage.content,
        read: false,
      });

      if (error) throw error;

      // Reset form and close modal
      setNewMessage({ athleteId: '', subject: '', content: '' });
      setShowComposeModal(false);

      // Reload messages
      loadData();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
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

  const getRecipientName = (message) => {
    if (message.recipient?.user) {
      const { first_name, last_name } = message.recipient.user;
      return `${first_name || ''} ${last_name || ''}`.trim() || 'Atleta';
    }
    return 'Atleta';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiLoader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  // Message detail view
  if (selectedMessage) {
    const recipientName = getRecipientName(selectedMessage);

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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
                <FiUser className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Para: {recipientName}
                </p>
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
              {selectedMessage.read && (
                <span className="ml-auto flex items-center text-sm text-green-600 dark:text-green-400">
                  <FiCheck className="w-4 h-4 mr-1" />
                  Leído
                </span>
              )}
            </div>
          </div>

          {/* Message Body */}
          <div className="p-4 sm:p-6">
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedMessage.content}
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
            Mensajes enviados a tus atletas
          </p>
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <FiPlus className="w-5 h-5" />
          <span className="hidden sm:inline">Nuevo Mensaje</span>
        </button>
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
              const recipientName = getRecipientName(message);

              return (
                <button
                  key={message.id}
                  onClick={() => setSelectedMessage(message)}
                  className="w-full text-left p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start space-x-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
                      <FiUser className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {recipientName}
                        </p>
                        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                          {message.read && (
                            <FiCheck className="w-4 h-4 text-green-500" />
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate mb-1">
                        {message.subject || 'Sin asunto'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {message.content}
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
              <FiMessageSquare className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No hay mensajes
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
              Aún no has enviado ningún mensaje a tus atletas.
            </p>
            <button
              onClick={() => setShowComposeModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Enviar primer mensaje</span>
            </button>
          </div>
        )}
      </motion.div>

      {/* Message count */}
      {messages.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center space-x-1">
            <FiMessageSquare className="w-4 h-4" />
            <span>{messages.length} mensaje{messages.length !== 1 ? 's' : ''} enviado{messages.length !== 1 ? 's' : ''}</span>
          </span>
          <span className="flex items-center space-x-1">
            <FiCheck className="w-4 h-4" />
            <span>{messages.filter(m => m.read).length} leído{messages.filter(m => m.read).length !== 1 ? 's' : ''}</span>
          </span>
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
              {/* Athlete selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Para
                </label>
                <select
                  value={newMessage.athleteId}
                  onChange={(e) => setNewMessage({ ...newMessage, athleteId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona un atleta</option>
                  {athletes.map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>
                      {athlete.firstName} {athlete.lastName}
                    </option>
                  ))}
                </select>
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                disabled={sending || !newMessage.athleteId || !newMessage.subject || !newMessage.content}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
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

export default CoachMessages;
