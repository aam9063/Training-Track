import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  FiHome,
  FiCalendar,
  FiActivity,
  FiBarChart2,
  FiWatch,
  FiChevronLeft,
  FiChevronRight,
  FiLogOut,
  FiUser,
  FiMenu,
  FiX,
  FiMessageSquare,
  FiSun,
  FiMoon,
  FiZap,
  FiClipboard,
  FiFlag,
} from 'react-icons/fi';

const AthleteSidebar = ({ onCollapse }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0 });
  const userBtnRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, isIndependent } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadMessages } = useNotifications();

  // Usar profile si existe, sino usar datos básicos del user
  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Atleta';
  const displayLastName = profile?.last_name || user?.user_metadata?.last_name || '';

  useEffect(() => {
    if (onCollapse) {
      onCollapse(collapsed);
    }
  }, [collapsed, onCollapse]);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const handleSignOut = async () => {
    setShowUserMenu(false);

    // Ejecutar signOut pero NO esperar
    signOut().catch(() => {});

    // Limpiar localStorage y redirigir inmediatamente
    localStorage.clear();

    window.location.href = '/login';
  };

  const isActive = (path) => {
    if (path === '/athlete/dashboard') {
      return location.pathname === '/athlete/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${collapsed ? 'lg:w-20' : 'lg:w-64'}
          w-64
          bg-white dark:bg-gray-800 
          border-r border-gray-200 dark:border-gray-700 
          transition-all duration-300 ease-in-out
          flex flex-col
          h-screen
          fixed left-0 top-0
          z-40
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ overflowX: 'clip' }}
      >
        {/* Logo & Toggle */}
        <div className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-700 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <Link to="/athlete/dashboard" className={`flex items-center ${collapsed ? '' : 'space-x-2'}`}>
            <img src="/img/logo.png" alt="trainingtrack" className="w-8 h-8 object-contain flex-shrink-0" />
            {!collapsed && (
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Training<span className="text-green-600">Track</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:block p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Colapsar sidebar"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:block absolute top-16 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors z-10"
              aria-label="Expandir sidebar"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  relative flex items-center space-x-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200
                  ${collapsed ? 'lg:justify-center' : ''}
                  ${
                    active
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-green-600 dark:text-green-400' : ''}`} />
                <span className={`text-sm font-medium flex-1 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                {item.badge > 0 && (
                  collapsed ? (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center lg:flex hidden">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )
                )}
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle Switch */}
        <div className="px-3 pb-2">
          <button
            onClick={toggleTheme}
            className={`
              w-full flex items-center px-3 py-2.5 rounded-lg
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors
              ${collapsed ? 'lg:justify-center' : 'space-x-3'}
            `}
            title={collapsed ? (theme === 'light' ? 'Modo oscuro' : 'Modo claro') : ''}
          >
            <div className="relative w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex-shrink-0 transition-colors">
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ${theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'}`}>
                {theme === 'light' ? (
                  <FiSun className="w-3 h-3 text-yellow-500" />
                ) : (
                  <FiMoon className="w-3 h-3 text-green-600" />
                )}
              </div>
            </div>
            <span className={`font-medium text-sm ${collapsed ? 'lg:hidden' : ''}`}>
              {theme === 'light' ? 'Modo claro' : 'Modo oscuro'}
            </span>
          </button>
        </div>

        {/* User Profile Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <button
            ref={userBtnRef}
            onClick={() => {
              if (!showUserMenu && userBtnRef.current) {
                const rect = userBtnRef.current.getBoundingClientRect();
                setMenuPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
              }
              setShowUserMenu(!showUserMenu);
            }}
            className={`
              w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg
              hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors
              ${collapsed ? 'lg:justify-center' : ''}
            `}
          >
            {profile?.profile_image ? (
              <img
                src={profile.profile_image}
                alt={`${displayName} ${displayLastName}`}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-sm">
                  {displayName[0]}{displayLastName[0] || 'A'}
                </span>
              </div>
            )}
            <div className={`flex-1 text-left min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayName} {displayLastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Atleta
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* User Dropdown Menu - rendered outside sidebar to avoid overflow clip */}
      {showUserMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setShowUserMenu(false)}
          />
          <div
            className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
            style={{ bottom: menuPos.bottom, left: menuPos.left }}
          >
            <button
              onClick={() => {
                navigate('/athlete/profile');
                setShowUserMenu(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <FiUser className="w-4 h-4" />
              <span>Mi Perfil</span>
            </button>
            {!isIndependent && (
              <button
                onClick={() => {
                  navigate('/athlete/messages');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FiMessageSquare className="w-4 h-4" />
                <span>Mis Mensajes</span>
              </button>
            )}
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <FiLogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default AthleteSidebar;
