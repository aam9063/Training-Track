import { useState, useRef, useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useSubscription from '../hooks/useSubscription';
import useAthleteSearch from '../hooks/useAthleteSearch';
import Sidebar from '../components/dashboard/Sidebar';
import BottomNav from '../components/dashboard/BottomNav';
import MobileHeader from '../components/dashboard/MobileHeader';
import NotificationPanel from '../components/common/NotificationPanel';
import PushNotificationBanner from '../components/common/PushNotificationBanner';
import { TrialBanner } from '../components/common/TrialBanner';
import { SubscriptionGuard } from '../components/common/SubscriptionGuard';
import PlanSelectionGuard from '../components/common/PlanSelectionGuard';
import {
  FiSearch,
  FiUser,
  FiMessageSquare,
  FiLogOut,
} from 'react-icons/fi';

const DashboardLayout = () => {
  const { user, loading, profile, signOut } = useAuth();
  const { planLabel, isTrialing, isExempt } = useSubscription();
  const navigate = useNavigate();
  const { searchQuery, searchResults, showSearchResults, setShowSearchResults, handleSearch, clearSearch } = useAthleteSearch(user?.id);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const searchRef = useRef(null);

  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Usuario';
  const displayLastName = profile?.last_name || user?.user_metadata?.last_name || '';

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [setShowSearchResults]);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    try { await signOut(); } catch { /* ignore */ }
    localStorage.clear();
    window.location.href = '/login';
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-coach-base">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = profile?.role || user?.user_metadata?.role || 'coach';
  if (userRole === 'athlete') {
    return <Navigate to="/athlete/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-coach-base">
      <Sidebar />
      <BottomNav />
      <MobileHeader />

      {/* Desktop floating topbar — separate floating elements */}
      <div className="hidden lg:flex items-center justify-between fixed top-3 left-[88px] right-3 z-20 pointer-events-none">
        {/* Search — center floating pill */}
        <div className="flex-1 flex justify-center pointer-events-none">
          <div ref={searchRef} className="relative w-full max-w-sm pointer-events-auto">
            <div className="relative h-11 rounded-2xl bg-white dark:bg-coach-elevated border border-black/[0.06] dark:border-white/[0.08] shadow-sm flex items-center px-4 gap-2">
              <FiSearch className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => { if (searchQuery.trim()) setShowSearchResults(true); }}
                placeholder="Buscar atletas..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Search results dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white dark:bg-coach-elevated rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-lg py-1 z-50 max-h-72 overflow-y-auto">
                {searchResults.map((athlete) => (
                  <button
                    key={athlete.id}
                    onClick={() => {
                      navigate(`/dashboard/athletes/${athlete.id}`);
                      clearSearch();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 text-xs font-semibold flex-shrink-0">
                      {(athlete.first_name?.[0] || '')}{(athlete.last_name?.[0] || '')}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-medium truncate">{athlete.first_name} {athlete.last_name}</p>
                      <p className="text-xs text-slate-400 truncate">{athlete.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showSearchResults && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute top-full mt-2 w-full bg-white dark:bg-coach-elevated rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-lg py-4 z-50 text-center text-sm text-slate-400">
                Sin resultados
              </div>
            )}
          </div>
        </div>

        {/* Right — notifications + avatar floating pill */}
        <div className="flex items-center gap-2 h-11 rounded-2xl bg-white dark:bg-coach-elevated border border-black/[0.06] dark:border-white/[0.08] shadow-sm px-2 ml-4 pointer-events-auto">
          <NotificationPanel accentColor="#1A6BFF" isCoach={true} />

          {/* User avatar + dropdown */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-sky-400 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
              aria-label="Menú de usuario"
            >
              {profile?.profile_image ? (
                <img
                  src={profile.profile_image}
                  alt={`${displayName} ${displayLastName}`}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-white text-[11px] font-semibold">
                  {displayName[0]}{displayLastName[0] || 'C'}
                </span>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-coach-elevated rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-lg py-1 z-50">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {displayName} {displayLastName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    Coach
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${
                      isExempt ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                        : 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
                    }`}>
                      {isExempt ? 'VIP' : isTrialing ? 'Trial' : planLabel}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => { navigate('/dashboard/profile'); setShowUserMenu(false); }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <FiUser className="w-4 h-4" />
                  <span>Mi Perfil</span>
                </button>
                <button
                  onClick={() => { navigate('/dashboard/messages'); setShowUserMenu(false); }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <FiMessageSquare className="w-4 h-4" />
                  <span>Mis Mensajes</span>
                </button>
                <div className="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-[62px] lg:pt-[80px] lg:pl-[88px] lg:pr-3 lg:pb-3">
        <main className="overflow-x-hidden pb-24 lg:pb-0">
          <TrialBanner />
          <PushNotificationBanner />
          <PlanSelectionGuard>
            <SubscriptionGuard>
              <Outlet />
            </SubscriptionGuard>
          </PlanSelectionGuard>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
