import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiMessageSquare, FiLogOut, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useSubscription from '../../hooks/useSubscription';
import NotificationPanel from '../common/NotificationPanel';

const AthleteMobileHeader = () => {
  const { user, profile, signOut, isIndependent } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { planLabel, isTrialing, isExempt } = useSubscription();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  const displayName = profile?.first_name || user?.user_metadata?.first_name || '';
  const displayLastName = profile?.last_name || user?.user_metadata?.last_name || '';
  const initials = [
    (profile?.first_name || user?.user_metadata?.first_name || '')[0] || '',
    (profile?.last_name || user?.user_metadata?.last_name || '')[0] || '',
  ].join('').toUpperCase() || 'AT';

  const handleSignOut = () => {
    setShowUserMenu(false);
    signOut().catch(() => {});
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-ath-surface border-b border-ath-border px-5 py-3 flex items-center justify-between">
      {/* Logo */}
      <button onClick={() => navigate('/athlete/dashboard')} className="flex items-center gap-2">
        <img src={theme === 'dark' ? '/img/logo-user-dark.png' : '/img/logo-user.png'} alt="TrainingTrack" className="h-8 w-auto rounded-lg" />
        <span className="text-xl font-bold tracking-tight text-ath-text-primary">
          Training<span className="text-ath-accent">Track</span>
        </span>
      </button>

      <div className="flex items-center gap-3">
        {/* Campana */}
        <NotificationPanel accentColor="#16a34a" isCoach={false} />

        {/* Avatar con menú */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0 bg-ath-accent"
          >
            {profile?.profile_image
              ? <img src={profile.profile_image} alt="Foto de perfil" className="w-full h-full object-cover" />
              : initials
            }
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-11 w-52 bg-ath-surface rounded-xl shadow-lg border border-ath-border py-1.5 z-50 overflow-hidden"
                >
                  {/* User info */}
                  <div className="px-4 py-2.5 border-b border-ath-border">
                    <p className="text-sm font-semibold text-ath-text-primary truncate">
                      {displayName} {displayLastName}
                    </p>
                    <p className="text-xs text-ath-text-muted flex items-center gap-1.5 flex-wrap mt-0.5">
                      Atleta
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${
                        isExempt
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                          : 'bg-ath-accent-surface text-ath-accent-text'
                      }`}>
                        {isExempt ? 'VIP' : isTrialing ? 'Trial' : planLabel}
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={() => { navigate('/athlete/profile'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ath-text-secondary hover:bg-ath-inset transition-colors"
                  >
                    <FiUser className="w-4 h-4" /> Mi Perfil
                  </button>
                  {!isIndependent && (
                    <button
                      onClick={() => { navigate('/athlete/messages'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ath-text-secondary hover:bg-ath-inset transition-colors"
                    >
                      <FiMessageSquare className="w-4 h-4" /> Mis Mensajes
                    </button>
                  )}

                  {/* Dark mode toggle */}
                  <div className="border-t border-ath-border my-1" />
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-ath-text-secondary hover:bg-ath-inset transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {theme === 'light'
                        ? <FiMoon className="w-4 h-4" />
                        : <FiSun className="w-4 h-4 text-ath-accent" />
                      }
                      {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
                    </div>
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-ath-accent' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </div>
                  </button>

                  <div className="border-t border-ath-border my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <FiLogOut className="w-4 h-4" /> Cerrar Sesión
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default AthleteMobileHeader;
