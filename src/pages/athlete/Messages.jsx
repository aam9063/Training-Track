import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiMessageSquare,
  FiLoader,
  FiSend,
  FiCheck,
  FiCheckCircle,
  FiZap,
  FiAlertTriangle,
  FiBarChart2,
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

// ─── AI Report Message Card ───────────────────────────────────────────────────

const ALERT_LABEL = { critical: 'Crítico', attention: 'Atención', ok: 'En forma' };
const ALERT_DOT   = { critical: 'bg-red-500', attention: 'bg-amber-400', ok: 'bg-green-500' };
const ALERT_BORDER = { critical: 'border-red-400', attention: 'border-amber-400', ok: 'border-green-400' };

function parseReport(content) {
  if (!content?.startsWith('__REPORT__:')) return null;
  try { return JSON.parse(content.slice('__REPORT__:'.length)); } catch { return null; }
}

const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

function ReportMessageCard({ data }) {
  const [expanded, setExpanded] = useState(false);
  const ai = data.ai_analysis || {};
  const level = data.alert_level || 'ok';
  const recomendaciones = ai.recomendaciones || [];
  const alertas = ai.alertas || [];

  return (
    <div className={`w-full bg-ath-surface rounded-2xl border-l-4 ${ALERT_BORDER[level] || ALERT_BORDER.ok} border border-ath-border overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(26,107,255,0.12)' }}>
          <FiZap className="w-3.5 h-3.5" style={{ color: '#1A6BFF' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#1A6BFF' }}>Informe IA</p>
          <p className="text-xs text-ath-text-muted">{fmtDate(data.week_start)} – {fmtDate(data.week_end)}</p>
        </div>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ath-base border border-ath-border`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ALERT_DOT[level]}`} />
          {ALERT_LABEL[level]}
        </span>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-px bg-ath-inset border-t border-ath-border text-center">
        {[
          { label: 'ACWR', value: data.acwr != null ? data.acwr.toFixed(2) : '—' },
          { label: 'Sesiones', value: `${data.sessions_done}/${data.sessions_planned}` },
          { label: 'Km', value: data.actual_km != null ? `${data.actual_km}` : '—' },
        ].map(m => (
          <div key={m.label} className="bg-ath-surface py-2">
            <p className="text-sm font-bold text-ath-text-primary leading-none">{m.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Summary */}
      {ai.resumen && (
        <div className="px-3 py-2 border-t border-ath-border">
          <p className="text-xs text-ath-text-secondary leading-relaxed line-clamp-3">{ai.resumen}</p>
        </div>
      )}

      {/* Expand toggle */}
      {(recomendaciones.length > 0 || alertas.length > 0) && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full px-3 py-2 text-[11px] font-semibold border-t border-ath-border text-blue-600 dark:text-blue-400 hover:bg-ath-inset transition-colors text-left"
        >
          {expanded ? 'Ver menos ↑' : `Ver detalles ↓ (${recomendaciones.length} recomendaciones)`}
        </button>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-ath-border pt-2">
          {alertas.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex items-center gap-1">
                <FiAlertTriangle className="w-3 h-3" /> Alertas
              </p>
              {alertas.map((a, i) => (
                <div key={i} className="text-xs text-ath-text-secondary mb-1">
                  <span className="font-semibold">{a.tipo}: </span>{a.descripcion}
                </div>
              ))}
            </div>
          )}
          {recomendaciones.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex items-center gap-1">
                <FiBarChart2 className="w-3 h-3" /> Recomendaciones
              </p>
              {recomendaciones.map((r, i) => (
                <div key={i} className="flex gap-1.5 text-xs text-ath-text-secondary mb-1">
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const AthleteMessages = () => {
  const { profile, getMyCoach } = useAuth();
  const { refreshUnreadCount, decrementUnread, setActiveConversationPartnerId } = useNotifications();

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
      setActiveConversationPartnerId(coach.id);

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
    } catch {
      showError('Error al cargar mensajes');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, getMyCoach, refreshUnreadCount, decrementUnread, setActiveConversationPartnerId]);

  useEffect(() => {
    loadData();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      setActiveConversationPartnerId(null);
    };
  }, [loadData, setActiveConversationPartnerId]);

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
    } catch {
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
          <FiLoader className="w-8 h-8 animate-spin text-ath-accent mx-auto mb-4" />
          <p className="text-ath-text-secondary">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  // No coach assigned
  if (!coachInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-20 h-20 bg-ath-inset rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMessageSquare className="w-10 h-10 text-ath-text-muted" />
          </div>
          <h3 className="text-lg font-medium text-ath-text-primary mb-2">
            Sin entrenador asignado
          </h3>
          <p className="text-ath-text-muted max-w-sm mx-auto">
            Los mensajes aparecerán aquí cuando tengas un entrenador asignado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-62px-88px)] lg:h-[calc(100vh-80px-12px)] overflow-hidden -mb-[88px] lg:mb-0 lg:rounded-2xl lg:border lg:border-black/[0.06] lg:dark:border-white/[0.08]">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-ath-border bg-ath-surface flex items-center space-x-3">
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
          <p className="font-semibold text-ath-text-primary text-sm">
            {getCoachName()}
          </p>
          <p className="text-xs text-ath-text-muted">Entrenador</p>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 bg-ath-base"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-ath-inset rounded-full flex items-center justify-center mx-auto mb-4">
                <FiMessageSquare className="w-8 h-8 text-ath-text-muted" />
              </div>
              <p className="text-ath-text-muted">
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
                      <span className="bg-ath-inset text-ath-text-secondary text-xs px-3 py-1 rounded-full">
                        {getDateSeparator(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                    {(() => {
                      const reportData = parseReport(msg.content);
                      if (reportData) {
                        return (
                          <div className="max-w-[85%] sm:max-w-[75%]">
                            <ReportMessageCard data={reportData} />
                            <div className="flex items-center justify-end gap-1 mt-1 text-ath-text-muted">
                              <span className="text-[11px]">{formatTime(msg.created_at)}</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          className={`
                            max-w-[75%] sm:max-w-[65%] px-3 py-2 rounded-2xl
                            ${isMine
                              ? 'bg-ath-accent text-ath-on-accent rounded-br-md'
                              : 'bg-ath-surface text-ath-text-primary rounded-bl-md shadow-sm'
                            }
                          `}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className={`flex items-center justify-end space-x-1 mt-1 ${isMine ? 'text-green-200' : 'text-ath-text-muted'}`}>
                            <span className="text-[11px]">{formatTime(msg.created_at)}</span>
                            {isMine && (
                              msg.read
                                ? <FiCheckCircle className="w-3 h-3" />
                                : <FiCheck className="w-3 h-3" />
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-ath-border bg-ath-surface">
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
            className="flex-1 px-4 py-2.5 border border-ath-border rounded-2xl bg-ath-inset text-ath-text-primary text-sm focus:ring-2 focus:ring-ath-accent focus:border-transparent resize-none overflow-hidden min-h-10 max-h-[120px]"
          />
          <button
            onClick={handleSend}
            disabled={!newMessageText.trim() || sending}
            className="p-2.5 bg-ath-accent hover:bg-ath-accent-hover disabled:opacity-50 text-ath-on-accent rounded-full transition-colors flex-shrink-0"
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
