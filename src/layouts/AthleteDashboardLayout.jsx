import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AthleteSidebar from '../components/athlete/AthleteSidebar';
import AthleteBottomNav from '../components/athlete/AthleteBottomNav';
import AthleteMobileHeader from '../components/athlete/AthleteMobileHeader';
import NotificationPanel from '../components/common/NotificationPanel';
import PushNotificationBanner from '../components/common/PushNotificationBanner';
import { TrialBanner } from '../components/common/TrialBanner';
import { SubscriptionGuard } from '../components/common/SubscriptionGuard';

const AthleteDashboardLayout = () => {
  const { user, loading, profile } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const userRole = profile?.role || user?.user_metadata?.role || 'athlete';
  if (userRole === 'coach') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-ath-base">
      <AthleteSidebar onCollapse={setSidebarCollapsed} />
      <AthleteBottomNav />
      <AthleteMobileHeader />

      {/* Desktop top bar — fixed, visible en todas las vistas */}
      <div
        className={`
          hidden lg:flex items-center justify-end px-8
          bg-ath-surface border-b border-ath-border
          h-[52px] fixed top-0 right-0 z-20
          transition-all duration-300
          ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-64'}
        `}
      >
        <NotificationPanel accentColor="#16a34a" isCoach={false} />
      </div>

      {/* Main Content */}
      <div
        className={`
          transition-all duration-300
          pt-[62px] lg:pt-[52px]
          ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
        `}
      >
        <main className="overflow-x-hidden pb-[72px] lg:pb-0">
          <TrialBanner />
          <PushNotificationBanner />
          <SubscriptionGuard>
            <Outlet />
          </SubscriptionGuard>
        </main>
      </div>
    </div>
  );
};

export default AthleteDashboardLayout;
