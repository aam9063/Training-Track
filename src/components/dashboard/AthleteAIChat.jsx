import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiZap, FiSend, FiTrash2, FiChevronDown, FiChevronUp, FiLoader } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { sendAthleteChatMessage, getChatSession, clearChatSession } from '../../services/aiChatService';

const stripMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, m => m.replace(/`/g, ''))
    .replace(/^[\s]*[-*]\s+/gm, '• ')
    .replace(/^>\s+/gm, '');
};

const SUGGESTED = [
  '¿Está listo para subir volumen esta semana?',
  '¿Tiene riesgo de lesión?',
  '¿Cómo va la preparación para la próxima competición?',
  '¿Cómo fue su respuesta al bloque de carga reciente?',
];

export default function AthleteAIChat({ athleteId, athleteName, inline = false }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expanded, setExpanded] = useState(inline);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  // Load existing session on mount
  useEffect(() => {
    if (!user?.id || !athleteId) return;
    getChatSession(user.id, athleteId)
      .then(msgs => setMessages(msgs))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [user?.id, athleteId]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, expanded]);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await sendAthleteChatMessage({ athleteId, athleteName, message: msg });
      setMessages(prev => [...prev, { role: 'assistant', content: reply, created_at: new Date().toISOString() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Error al obtener respuesta. Inténtalo de nuevo.', created_at: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!user?.id) return;
    await clearChatSession(user.id, athleteId).catch(() => {});
    setMessages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Collapsed bar ──────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-coach-surface rounded-2xl p-4 cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <FiZap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-blue-500 font-semibold">Hermes</p>
              <p className="text-sm text-white font-medium">
                {messages.length > 0
                  ? `${Math.floor(messages.length / 2)} pregunta${Math.floor(messages.length / 2) !== 1 ? 's' : ''} sobre ${athleteName}`
                  : `Pregunta sobre ${athleteName}`}
              </p>
            </div>
          </div>
          <FiChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </motion.div>
    );
  }

  // ── Expanded chat ──────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: inline ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={inline ? "flex flex-col h-full bg-white dark:bg-coach-base" : "bg-coach-surface rounded-2xl overflow-hidden"}
    >
      {/* Header — only shown in standalone (non-inline) mode */}
      {!inline && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <FiZap className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-blue-500 font-semibold leading-none">Hermes</p>
              <p className="text-xs text-slate-300 mt-0.5">{athleteName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                title="Limpiar conversación"
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setExpanded(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <FiChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Inline clear button row */}
      {inline && messages.length > 0 && (
        <div className="flex justify-end px-3 pt-2">
          <button
            onClick={handleClear}
            title="Limpiar conversación"
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-coach-text-muted hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <FiTrash2 className="w-3 h-3" />
            Limpiar
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className={inline ? "flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700" : "h-80 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-700"}>
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <FiLoader className={`w-5 h-5 animate-spin ${inline ? 'text-gray-300 dark:text-coach-text-muted' : 'text-coach-text-muted'}`} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col h-full">
            {/* Greeting bubble */}
            <div className="flex justify-start mb-3">
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed rounded-bl-sm ${
                inline
                  ? 'bg-gray-100 dark:bg-coach-elevated text-gray-800 dark:text-white'
                  : 'bg-slate-800 text-slate-200'
              }`}>
                Hola, soy <span className="font-semibold">Hermes</span>, tu asistente de IA. Pregúntame lo que quieras sobre <span className="font-semibold">{athleteName}</span> — tengo acceso a sus datos de entrenamiento.
              </div>
            </div>
            {/* Suggested questions */}
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors text-left ${
                    inline
                      ? 'bg-gray-100 dark:bg-coach-elevated text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-coach-elevated hover:text-gray-900 dark:hover:text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : inline
                          ? 'bg-gray-100 dark:bg-coach-elevated text-gray-800 dark:text-white rounded-bl-sm'
                          : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'user' ? msg.content : stripMarkdown(msg.content)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <div className="flex justify-start">
                <div className={`rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1 items-center ${inline ? 'bg-gray-100 dark:bg-coach-elevated' : 'bg-coach-elevated'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${inline ? 'bg-gray-300 dark:bg-slate-500' : 'bg-gray-500'}`} style={{ animationDelay: '0ms' }} />
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${inline ? 'bg-gray-300 dark:bg-slate-500' : 'bg-gray-500'}`} style={{ animationDelay: '150ms' }} />
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${inline ? 'bg-gray-300 dark:bg-slate-500' : 'bg-gray-500'}`} style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {/* Suggested questions — inside scroll area, after last message */}
            {!loading && (
              <div className="flex gap-2 flex-wrap pt-1">
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                      inline
                        ? 'bg-gray-100 dark:bg-coach-base text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-coach-elevated hover:text-gray-800 dark:hover:text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
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

      {/* Input */}
      <div className={inline ? "px-3 pb-4 pt-2 border-t border-gray-100 dark:border-coach-border" : "px-3 pb-3"}>
        <div className={`flex gap-2 rounded-xl px-3 py-2 ${inline ? 'bg-gray-100 dark:bg-coach-elevated' : 'bg-coach-elevated'}`}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta algo sobre este atleta..."
            rows={1}
            className={`flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed ${
              inline
                ? 'text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500'
                : 'text-slate-200 placeholder-slate-500'
            }`}
            style={{ maxHeight: '80px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors self-end"
          >
            <FiSend className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <p className={`hidden lg:block text-[10px] mt-1.5 text-center ${inline ? 'text-gray-400 dark:text-coach-text-muted' : 'text-coach-text-muted'}`}>Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </motion.div>
  );
}
