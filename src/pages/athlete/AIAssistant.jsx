import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiZap, FiSend, FiTrash2, FiLoader } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { sendIndependentChatMessage, getIndependentChatSession, clearIndependentChatSession } from '../../services/independentAiChatService';

// ─── Suggested prompts for independent athletes ───────────────────────────────

const SUGGESTED_PROMPTS = [
  '¿Cómo va mi progresión?',
  '¿Debería cambiar mi plan?',
  'Consejos para mi próxima carrera',
  '¿Cuál es mi racha de entrenamiento?',
  '¿Cómo mejorar mi ritmo de carrera?',
];

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-green-600 text-white rounded-br-sm'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>
    </motion.div>
  );
};

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

// ─── Main page component ──────────────────────────────────────────────────────

export default function AIAssistant() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Load existing session on mount
  useEffect(() => {
    if (!user?.id) {
      setLoadingHistory(false);
      return;
    }
    getIndependentChatSession(user.id)
      .then(msgs => setMessages(msgs))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await sendIndependentChatMessage({ userId: user.id, message: msg });
      setMessages(prev => [...prev, { role: 'assistant', content: reply, created_at: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Error al obtener respuesta. Inténtalo de nuevo.', created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!user?.id) return;
    await clearIndependentChatSession(user.id).catch(() => {});
    setMessages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Atleta';

  return (
    <div className="flex flex-col h-[calc(100vh-62px-72px)] lg:h-[calc(100vh-52px)] overflow-hidden bg-gray-50 dark:bg-gray-900">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
            <FiZap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-green-500 font-semibold leading-none">
              Hermes IA
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
              Tu entrenador virtual
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            title="Limpiar conversación"
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <FiTrash2 className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* ── Messages area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-4 space-y-3">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <FiLoader className="w-6 h-6 animate-spin text-gray-300 dark:text-slate-600" />
          </div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 pt-4"
          >
            {/* Welcome bubble */}
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-gray-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed text-gray-800 dark:text-slate-200">
                ¡Hola, <span className="font-semibold">{displayName}</span>! Soy{' '}
                <span className="font-semibold">Hermes</span>, tu asistente de entrenamiento personal.
                Tengo acceso a tu historial de entrenamientos, métricas y competiciones para darte
                consejos personalizados. ¿En qué puedo ayudarte hoy?
              </div>
            </div>

            {/* Suggested prompts */}
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-2 font-medium">Preguntas sugeridas:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 hover:text-green-700 dark:hover:text-green-400 transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
            </AnimatePresence>

            {loading && <TypingIndicator />}

            {/* Suggested prompts after conversation */}
            {!loading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {SUGGESTED_PROMPTS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 hover:text-green-700 dark:hover:text-green-400 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 lg:px-8 pb-4 pt-2 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        <div className="flex gap-2 bg-gray-100 dark:bg-slate-900 rounded-xl px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta a tu entrenador virtual..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500"
            style={{ maxHeight: '80px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors self-end"
          >
            {loading
              ? <FiLoader className="w-4 h-4 text-white animate-spin" />
              : <FiSend className="w-3.5 h-3.5 text-white" />
            }
          </button>
        </div>
        <p className="hidden lg:block text-[10px] mt-1.5 text-center text-gray-400 dark:text-slate-600">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
