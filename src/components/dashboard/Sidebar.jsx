import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  FiHome,
  FiUsers,
  FiBarChart2,
  FiCalendar,
  FiZap,
  FiMessageSquare,
  FiClipboard,
  FiBookOpen,
  FiSun,
  FiMoon,
} from 'react-icons/fi';

const Sidebar = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { unreadMessages } = useNotifications();

  const menuItems = [
    { path: '/dashboard', icon: FiHome, label: 'Inicio' },
    { path: '/dashboard/athletes', icon: FiUsers, label: 'Mis Atletas' },
    { path: '/dashboard/planning', icon: FiClipboard, label: 'Planificación' },
    { path: '/dashboard/library', icon: FiBookOpen, label: 'Biblioteca' },
    { path: '/dashboard/ai-reports', icon: FiZap, label: 'Informes IA' },
    { path: '/dashboard/metrics', icon: FiBarChart2, label: 'Equipo' },
    { path: '/dashboard/calendar', icon: FiCalendar, label: 'Calendario' },
    { path: '/dashboard/messages', icon: FiMessageSquare, label: 'Mensajes', badge: unreadMessages },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="hidden lg:block w-[76px] fixed inset-y-0 left-0 z-40 p-3 pr-0">
      {/* Floating column */}
      <div className="w-[52px] h-full rounded-2xl bg-white dark:bg-coach-elevated border border-black/[0.06] dark:border-white/[0.08] shadow-sm flex flex-col items-center py-4">
        {/* Logo */}
        <Link to="/dashboard" className="mb-4 flex-shrink-0">
          <img src="/img/logo.png" alt="TrainingTrack" className="w-8 h-8 object-contain rounded-lg" />
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
                        ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400'
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
                <FiSun className="w-5 h-5 text-sky-500" />
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

export default Sidebar;
