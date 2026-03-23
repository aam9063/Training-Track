import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  FiHome,
  FiUsers,
  FiChevronLeft,
  FiChevronRight,
  FiLogOut,
  FiArrowLeft,
  FiMenu,
  FiX,
  FiSun,
  FiMoon,
  FiShield,
  FiMail,
} from 'react-icons/fi';

const AdminSidebar = ({ onCollapse }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0 });
  const userBtnRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Admin';
  const displayLastName = profile?.last_name || user?.user_metadata?.last_name || '';

  useEffect(() => {
    if (onCollapse) onCollapse(collapsed);
  }, [collapsed, onCollapse]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const menuItems = [
    { path: '/admin', icon: FiHome, label: 'Panel Admin' },
    { path: '/admin/users', icon: FiUsers, label: 'Usuarios' },
    { path: '/admin/waitlist', icon: FiMail, label: 'Lista de Espera' },
  ];

  const handleSignOut = async () => {
    setShowUserMenu(false);
    signOut().catch(() => {});
    localStorage.clear();
    window.location.href = '/login';
  };

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin';
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
          overflow-x-clip
        `}
      >
        {/* Logo & Toggle */}
        <div className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-700 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <Link to="/admin" className={`flex items-center ${collapsed ? '' : 'space-x-2'}`}>
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center flex-shrink-0">
              <FiShield className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Admin<span className="text-sky-600">Panel</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute top-16 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors z-10"
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
                  ${active
                    ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
                title={collapsed ? item.label : ''}
              >
                <Icon className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
                {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
              </Link>
            );
          })}

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-3"></div>

          {/* Back to Dashboard */}
          <Link
            to="/dashboard"
            className={`
              flex items-center space-x-3 px-3 py-2.5 rounded-lg
              text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700
              transition-all duration-200
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? 'Volver al Dashboard' : ''}
          >
            <FiArrowLeft className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
            {!collapsed && <span className="font-medium text-sm">Volver al Dashboard</span>}
          </Link>
        </nav>

        {/* Theme Toggle */}
        <div className="px-3 pb-2">
          <button
            onClick={toggleTheme}
            className={`
              w-full flex items-center px-3 py-2.5 rounded-lg
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors
              ${collapsed ? 'justify-center' : 'space-x-3'}
            `}
            title={collapsed ? (theme === 'light' ? 'Modo oscuro' : 'Modo claro') : ''}
          >
            <div className="relative w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex-shrink-0 transition-colors">
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ${theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'}`}>
                {theme === 'light' ? (
                  <FiSun className="w-3 h-3 text-yellow-500" />
                ) : (
                  <FiMoon className="w-3 h-3 text-sky-600" />
                )}
              </div>
            </div>
            {!collapsed && (
              <span className="font-medium text-sm">
                {theme === 'light' ? 'Modo claro' : 'Modo oscuro'}
              </span>
            )}
          </button>
        </div>

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
            <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {displayName[0]}{displayLastName[0] || 'A'}
              </span>
            </div>
            <div className={`flex-1 text-left min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayName} {displayLastName}
              </p>
              <p className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                Administrador
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* User Dropdown Menu */}
      {showUserMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setShowUserMenu(false)} />
          <div
            className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
            style={{ bottom: menuPos.bottom, left: menuPos.left }}
          >
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

export default AdminSidebar;
