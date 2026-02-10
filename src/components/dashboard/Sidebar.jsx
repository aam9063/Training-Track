import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  FiHome,
  FiUsers,
  FiBarChart2,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiLogOut,
  FiUser,
  FiMenu,
  FiX,
  FiMessageSquare,
} from 'react-icons/fi';

const Sidebar = ({ onCollapse }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0 });
  const userBtnRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  // Usar profile si existe, sino usar datos básicos del user
  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Usuario';
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

  const menuItems = [
    { path: '/dashboard', icon: FiHome, label: 'Dashboard' },
    { path: '/dashboard/athletes', icon: FiUsers, label: 'Mis Atletas' },
    { path: '/dashboard/metrics', icon: FiBarChart2, label: 'Métricas' },
    { path: '/dashboard/calendar', icon: FiCalendar, label: 'Calendario' },
  ];

  const handleSignOut = async () => {
    console.log('🚪 Cerrando sesión...');
    setShowUserMenu(false);
    
    // Ejecutar signOut pero NO esperar
    signOut().catch(err => console.error('Error en signOut:', err));
    
    // Limpiar localStorage y redirigir inmediatamente
    console.log('🧹 Limpiando localStorage...');
    localStorage.clear();
    
    console.log('🔄 Redirigiendo a login...');
    window.location.href = '/login';
  };

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
      >
        {mobileOpen ? (
          <FiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        ) : (
          <FiMenu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        )}
      </button>

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
        <Link to="/dashboard" className={`flex items-center ${collapsed ? '' : 'space-x-2'}`}>
          <img src="/img/logo.png" alt="TrainingTrackPro" className="w-8 h-8 object-contain flex-shrink-0" />
          {!collapsed && (
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              TrainingTrack<span className="text-blue-600">Pro</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Colapsar sidebar"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute top-16 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors z-10"
            aria-label="Expandir sidebar"
          >
            <FiChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center space-x-3 px-3 py-2.5 rounded-lg
                transition-all duration-200
                ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? item.label : ''}
            >
              <Icon className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
              {!collapsed && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-sm">
                  {displayName[0]}{displayLastName[0] || 'C'}
                </span>
              </div>
            )}
            <div className={`flex-1 text-left min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayName} {displayLastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Coach
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
                navigate('/dashboard/profile');
                setShowUserMenu(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <FiUser className="w-4 h-4" />
              <span>Mi Perfil</span>
            </button>
            <button
              onClick={() => {
                navigate('/dashboard/messages');
                setShowUserMenu(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <FiMessageSquare className="w-4 h-4" />
              <span>Mis Mensajes</span>
            </button>
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

export default Sidebar;
