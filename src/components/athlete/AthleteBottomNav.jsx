import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiActivity, FiCalendar, FiBarChart2, FiMessageSquare, FiClipboard, FiZap } from 'react-icons/fi';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

const coachedTabs = [
  { path: '/athlete/dashboard', icon: FiHome, label: 'Inicio', exact: true },
  { path: '/athlete/training', icon: FiActivity, label: 'Entrenos' },
  { path: '/athlete/calendar', icon: FiCalendar, label: 'Calendario' },
  { path: '/athlete/metrics', icon: FiBarChart2, label: 'Métricas' },
  { path: '/athlete/messages', icon: FiMessageSquare, label: 'Mensajes' },
];

const independentTabs = [
  { path: '/athlete/dashboard', icon: FiHome, label: 'Inicio', exact: true },
  { path: '/athlete/my-plan', icon: FiClipboard, label: 'Mi Plan' },
  { path: '/athlete/metrics', icon: FiBarChart2, label: 'Métricas' },
  { path: '/athlete/ai-assistant', icon: FiZap, label: 'Hermes IA' },
  { path: '/athlete/competitions', icon: FiCalendar, label: 'Competi.' },
];

const AthleteBottomNav = () => {
  const location = useLocation();
  const { unreadMessages } = useNotifications();
  const { isIndependent } = useAuth();

  const tabs = isIndependent ? independentTabs : coachedTabs;

  const isActive = (tab) =>
    tab.exact
      ? location.pathname === tab.path
      : location.pathname.startsWith(tab.path);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-2 pb-2 z-50">
      {tabs.map((tab) => {
        const active = isActive(tab);
        const Icon = tab.icon;
        const showBadge = tab.path === '/athlete/messages' && unreadMessages > 0;

        return (
          <Link
            key={tab.path}
            to={tab.path}
            className="flex flex-col items-center gap-1 flex-1 pt-2"
          >
            <div className="relative flex flex-col items-center">
              <Icon
                className={`w-[22px] h-[22px] ${active ? 'text-green-600 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
              />
              {showBadge && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
              {active && (
                <span className="mt-1 w-1 h-1 rounded-full bg-green-600 dark:bg-white" />
              )}
            </div>
            <span
              className={`text-[10px] font-medium leading-none ${active ? 'text-green-600 dark:text-white font-semibold' : 'text-slate-400 dark:text-slate-500'}`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default AthleteBottomNav;
