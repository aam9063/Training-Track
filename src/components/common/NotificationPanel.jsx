import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiX, FiCheckCircle, FiCalendar, FiActivity, FiMessageSquare, FiInbox } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

const TYPE_CONFIG = {
  training_assigned: { icon: FiCalendar, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  training_completed: { icon: FiCheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
  message: { icon: FiMessageSquare, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  default: { icon: FiActivity, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-700/40' },
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const NotificationPanel = ({ accentColor = '#1A6BFF', isCoach = true }) => {
  const { user } = useAuth();
  const { unreadNotifications, markNotificationsRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, data, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data || []);
    setLoading(false);
  };

  const handleOpen = async () => {
    if (!open) {
      setOpen(true);
      await fetchNotifications();
      await markNotificationsRead();
    } else {
      setOpen(false);
    }
  };

  const handleNotifClick = (notif) => {
    const url = notif.data?.url;
    if (url) navigate(url);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="w-[38px] h-[38px] rounded-full bg-ath-inset flex items-center justify-center relative transition-colors hover:bg-ath-border"
      >
        <FiBell className="w-[18px] h-[18px] text-ath-text-muted" />
        {unreadNotifications > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full border-2 border-ath-surface flex items-center justify-center text-white font-bold"
            style={{ background: '#FF6B35', fontSize: '9px', lineHeight: 1 }}
          >
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-11 w-80 bg-ath-surface rounded-2xl shadow-xl border border-ath-border z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-ath-border">
                <div className="flex items-center gap-2">
                  <FiBell className="w-4 h-4" style={{ color: accentColor }} />
                  <span className="text-sm font-semibold text-ath-text-primary">Notificaciones</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg hover:bg-ath-inset transition-colors"
                >
                  <FiX className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* List */}
              <div className="max-h-[360px] overflow-y-auto scrollbar-hover">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-ath-text-muted">
                    <FiInbox className="w-8 h-8" />
                    <p className="text-sm">Sin notificaciones</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.default;
                    const Icon = cfg.icon;
                    const isUnread = !notif.read_at;
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-ath-inset transition-colors border-b border-ath-border last:border-0 ${isUnread ? 'bg-ath-accent-surface/40' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-ath-text-primary' : 'font-medium text-ath-text-secondary'}`}>
                              {notif.title}
                            </p>
                            <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">{timeAgo(notif.created_at)}</span>
                          </div>
                          {notif.message && (
                            <p className="text-xs text-ath-text-muted mt-0.5 truncate">
                              {notif.message.startsWith('__REPORT__:') ? '📊 Informe IA semanal' : notif.message}
                            </p>
                          )}
                        </div>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: accentColor }} />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationPanel;
