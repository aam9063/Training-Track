import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiMessageSquare, FiLogOut, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import NotificationPanel from '../common/NotificationPanel';

const MobileHeader = () => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  const displayName = profile?.first_name || user?.user_metadata?.first_name || '';
  const displayLastName = profile?.last_name || user?.user_metadata?.last_name || '';
  const initials = [
    (profile?.first_name || user?.user_metadata?.first_name || '')[0] || '',
    (profile?.last_name || user?.user_metadata?.last_name || '')[0] || '',
  ].join('').toUpperCase() || 'TT';

  const handleSignOut = () => {
    setShowUserMenu(false);
    signOut().catch(() => {});
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-[#E2E8F0] dark:border-gray-700 px-5 py-3 flex items-center justify-between">
      {/* Logo */}
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
        <img src="/img/logo.png" alt="TrainingTrack" className="h-8 w-auto" />
        <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Training<span style={{ color: '#1A6BFF' }}>Track</span>
        </span>
      </button>

      <div className="flex items-center gap-3">
        {/* Campana */}
        <NotificationPanel accentColor="#1A6BFF" isCoach={true} />

        {/* Avatar con menú */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1A6BFF, #5B9BFF)' }}
          >
            {profile?.profile_image
              ? <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
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
                  className="absolute right-0 top-11 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-[#E2E8F0] dark:border-gray-700 py-1.5 z-50 overflow-hidden"
                >
                  {/* User info */}
                  <div className="px-4 py-2.5 border-b border-[#E2E8F0] dark:border-gray-700">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {displayName} {displayLastName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Coach</p>
                  </div>

                  <button
                    onClick={() => { navigate('/dashboard/profile'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FiUser className="w-4 h-4" /> Mi Perfil
                  </button>
                  <button
                    onClick={() => { navigate('/dashboard/messages'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FiMessageSquare className="w-4 h-4" /> Mis Mensajes
                  </button>

                  {/* Dark mode toggle */}
                  <div className="border-t border-[#E2E8F0] dark:border-gray-700 my-1" />
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {theme === 'light'
                        ? <FiMoon className="w-4 h-4" />
                        : <FiSun className="w-4 h-4 text-yellow-400" />
                      }
                      {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
                    </div>
                    {/* Mini toggle visual */}
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-brand-primary' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </div>
                  </button>

                  <div className="border-t border-[#E2E8F0] dark:border-gray-700 my-1" />
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

export default MobileHeader;
