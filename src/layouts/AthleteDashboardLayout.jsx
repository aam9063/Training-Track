import { useState, useRef, useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useSubscription from '../hooks/useSubscription';
import AthleteSidebar from '../components/athlete/AthleteSidebar';
import AthleteBottomNav from '../components/athlete/AthleteBottomNav';
import AthleteMobileHeader from '../components/athlete/AthleteMobileHeader';
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

const AthleteDashboardLayout = () => {
  const { user, loading, profile, profileLoaded, signOut, isIndependent } = useAuth();
  const { planLabel, isTrialing, isExempt } = useSubscription();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const searchRef = useRef(null);

  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Atleta';
  const displayLastName = profile?.last_name || user?.user_metadata?.last_name || '';

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    try { await signOut(); } catch { /* ignore */ }
    localStorage.clear();
    window.location.href = '/login';
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ath-base">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ath-border-accent mx-auto"></div>
          <p className="mt-4 text-ath-text-secondary">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Wait until the authoritative profile is loaded before deciding a redirect.
  // Otherwise F5 / tab return (profile momentarily null) would bounce the user
  // to the coach dashboard and lose the current athlete sub-route.
  if (profileLoaded && profile?.role === 'coach') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-ath-base">
      <AthleteSidebar />
      <AthleteBottomNav />
      <AthleteMobileHeader />

      {/* Desktop floating topbar — separate floating elements */}
      <div className="hidden lg:flex items-center justify-between fixed top-3 left-[88px] right-3 z-20 pointer-events-none">
        {/* Search — center floating pill */}
        <div className="flex-1 flex justify-center pointer-events-none">
          <div ref={searchRef} className="relative w-full max-w-sm pointer-events-auto">
            <div className="relative h-11 rounded-2xl bg-white dark:bg-ath-elevated border border-black/[0.06] dark:border-white/[0.08] shadow-sm flex items-center px-4 gap-2">
              <FiSearch className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right — notifications + avatar floating pill */}
        <div className="flex items-center gap-2 h-11 rounded-2xl bg-white dark:bg-ath-elevated border border-black/[0.06] dark:border-white/[0.08] shadow-sm px-2 ml-4 pointer-events-auto">
          <NotificationPanel accentColor="#16a34a" isCoach={false} />

          {/* User avatar + dropdown */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-400 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
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
                  {displayName[0]}{displayLastName[0] || 'A'}
                </span>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-ath-elevated rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-lg py-1 z-50">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {displayName} {displayLastName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
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
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <FiUser className="w-4 h-4" />
                  <span>Mi Perfil</span>
                </button>
                {!isIndependent && (
                  <button
                    onClick={() => { navigate('/athlete/messages'); setShowUserMenu(false); }}
                    className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <FiMessageSquare className="w-4 h-4" />
                    <span>Mis Mensajes</span>
                  </button>
                )}
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

export default AthleteDashboardLayout;
