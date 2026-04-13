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

// ─── Strip markdown from AI responses ─────────────────────────────────────────

const stripMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s+/gm, '')       // headers: ### Title → Title
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold: **text** → text
    .replace(/\*(.+?)\*/g, '$1')       // italic: *text* → text
    .replace(/`{1,3}[^`]*`{1,3}/g, m => m.replace(/`/g, '')) // inline code
    .replace(/^[\s]*[-*]\s+/gm, '• ')  // list bullets: - item → • item
    .replace(/^>\s+/gm, '');           // blockquotes: > text → text
};

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
            ? 'bg-ath-accent text-ath-on-accent rounded-br-sm'
            : 'bg-ath-inset text-ath-text-primary rounded-bl-sm'
        }`}
      >
        {isUser ? message.content : stripMarkdown(message.content)}
      </div>
    </motion.div>
  );
};

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="bg-ath-inset rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
      <span className="w-1.5 h-1.5 rounded-full bg-ath-text-muted animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-ath-text-muted animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-ath-text-muted animate-bounce [animation-delay:300ms]" />
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
    <div className="flex flex-col h-[calc(100dvh-62px-100px)] lg:h-[calc(100vh-80px-12px)] overflow-hidden bg-ath-base lg:rounded-2xl lg:border lg:border-black/[0.06] lg:dark:border-white/[0.08]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-4 bg-ath-surface border-b border-ath-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-ath-accent flex items-center justify-center flex-shrink-0">
            <FiZap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-ath-accent-text font-semibold leading-none">
              Hermes IA
            </p>
            <p className="text-sm font-semibold text-ath-text-primary mt-0.5">
              Tu entrenador virtual
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            title="Limpiar conversación"
            className="flex items-center gap-1.5 text-xs text-ath-text-muted hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
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
            <FiLoader className="w-6 h-6 animate-spin text-ath-text-muted" />
          </div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 pt-4"
          >
            {/* Welcome bubble */}
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-ath-inset rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed text-ath-text-primary">
                ¡Hola, <span className="font-semibold">{displayName}</span>! Soy{' '}
                <span className="font-semibold">Hermes</span>, tu asistente de entrenamiento personal.
                Tengo acceso a tu historial de entrenamientos, métricas y competiciones para darte
                consejos personalizados. ¿En qué puedo ayudarte hoy?
              </div>
            </div>

            {/* Suggested prompts */}
            <div>
              <p className="text-xs text-ath-text-muted mb-2 font-medium">Preguntas sugeridas:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-ath-inset border border-ath-border text-ath-text-secondary hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 hover:text-green-700 dark:hover:text-green-400 transition-colors text-left"
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
                <MessageBubble key={msg.id || msg.created_at || i} message={msg} />
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
                    className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-ath-base border border-ath-border text-ath-text-muted hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 hover:text-green-700 dark:hover:text-green-400 transition-colors"
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
      <div className="flex-shrink-0 px-4 lg:px-8 pb-4 pt-2 bg-ath-surface border-t border-ath-border">
        <div className="flex gap-2 bg-ath-inset rounded-xl px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta a tu entrenador virtual..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed text-ath-text-primary placeholder-gray-400 dark:placeholder-slate-500 max-h-20"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-ath-accent hover:bg-ath-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors self-end"
          >
            {loading
              ? <FiLoader className="w-4 h-4 text-white animate-spin" />
              : <FiSend className="w-3.5 h-3.5 text-white" />
            }
          </button>
        </div>
        <p className="hidden lg:block text-[10px] mt-1.5 text-center text-ath-text-muted">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
