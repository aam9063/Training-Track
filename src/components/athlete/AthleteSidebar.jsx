import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  FiHome,
  FiCalendar,
  FiActivity,
  FiBarChart2,
  FiWatch,
  FiMessageSquare,
  FiSun,
  FiMoon,
  FiZap,
  FiClipboard,
  FiFlag,
} from 'react-icons/fi';

const AthleteSidebar = () => {
  const location = useLocation();
  const { isIndependent } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadMessages } = useNotifications();

  const independentMenuItems = [
    { path: '/athlete/dashboard', icon: FiHome, label: 'Inicio' },
    { path: '/athlete/my-plan', icon: FiClipboard, label: 'Mi Plan' },
    { path: '/athlete/calendar', icon: FiCalendar, label: 'Calendario' },
    { path: '/athlete/metrics', icon: FiBarChart2, label: 'Mis Métricas' },
    { path: '/athlete/competitions', icon: FiFlag, label: 'Competiciones' },
    { path: '/athlete/ai-assistant', icon: FiZap, label: 'Hermes IA' },
    { path: '/athlete/devices', icon: FiWatch, label: 'Dispositivos' },
  ];

  const coachedMenuItems = [
    { path: '/athlete/dashboard', icon: FiHome, label: 'Inicio' },
    { path: '/athlete/training', icon: FiActivity, label: 'Mis Entrenamientos' },
    { path: '/athlete/calendar', icon: FiCalendar, label: 'Calendario' },
    { path: '/athlete/metrics', icon: FiBarChart2, label: 'Mis Métricas' },
    { path: '/athlete/my-reports', icon: FiZap, label: 'Mis Informes IA' },
    { path: '/athlete/devices', icon: FiWatch, label: 'Dispositivos' },
    { path: '/athlete/messages', icon: FiMessageSquare, label: 'Mensajes', badge: unreadMessages },
  ];

  const menuItems = isIndependent ? independentMenuItems : coachedMenuItems;

  const isActive = (path) => {
    if (path === '/athlete/dashboard') {
      return location.pathname === '/athlete/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="hidden lg:block w-[76px] fixed inset-y-0 left-0 z-40 p-3 pr-0">
      {/* Floating column */}
      <div className="w-[52px] h-full rounded-2xl bg-white dark:bg-ath-elevated border border-black/[0.06] dark:border-white/[0.08] shadow-sm flex flex-col items-center py-4">
        {/* Logo */}
        <Link to="/athlete/dashboard" className="mb-4 flex-shrink-0">
          <img
            src={theme === 'dark' ? '/img/logo-user-dark.png' : '/img/logo-user.png'}
            alt="TrainingTrack"
            className="w-8 h-8 object-contain rounded-lg"
          />
        </Link>

        {/* Nav items — centered vertically between logo and dark mode toggle */}
        <nav className="flex-1 flex flex-col items-center justify-center gap-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <div key={item.path} className="group relative">
                <Link
                  to={item.path}
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center
                    transition-colors relative cursor-pointer
                    ${
                      active
                        ? 'bg-ath-accent-surface text-ath-accent-text'
                        : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-slate-300'
                    }
                  `}
                  aria-label={item.label}
                >
                  <Icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </Link>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                  {item.label}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Dark mode toggle */}
        <div className="mt-2 flex-shrink-0">
          <div className="group relative">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              aria-label={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            >
              {theme === 'light' ? (
                <FiMoon className="w-5 h-5" />
              ) : (
                <FiSun className="w-5 h-5 text-ath-accent" />
              )}
            </button>
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
              {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AthleteSidebar;
