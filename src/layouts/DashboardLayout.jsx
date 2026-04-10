import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/dashboard/Sidebar';
import BottomNav from '../components/dashboard/BottomNav';
import MobileHeader from '../components/dashboard/MobileHeader';
import NotificationPanel from '../components/common/NotificationPanel';
import PushNotificationBanner from '../components/common/PushNotificationBanner';
import { TrialBanner } from '../components/common/TrialBanner';
import { SubscriptionGuard } from '../components/common/SubscriptionGuard';
import PlanSelectionGuard from '../components/common/PlanSelectionGuard';

const DashboardLayout = () => {
  const { user, loading, profile } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // If no user after loading, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is athlete and redirect to athlete dashboard
  const userRole = profile?.role || user?.user_metadata?.role || 'coach';
  if (userRole === 'athlete') {
    return <Navigate to="/athlete/dashboard" replace />;
  }

  // Coach dashboard
  return (
    <div className="min-h-screen bg-brand-bg dark:bg-coach-base">
      <Sidebar onCollapse={setSidebarCollapsed} />
      <BottomNav />
      <MobileHeader />

      {/* Desktop top bar — fixed, visible en todas las vistas */}
      <div
        className={`
          hidden lg:flex items-center justify-end px-8
          bg-coach-surface border-b border-gray-200 dark:border-coach-border
          h-[52px] fixed top-0 right-0 z-20
          transition-all duration-300
          ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-64'}
        `}
      >
        <NotificationPanel accentColor="#1A6BFF" isCoach={true} />
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
