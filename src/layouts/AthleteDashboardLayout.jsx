import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AthleteSidebar from '../components/athlete/AthleteSidebar';
import AthleteBottomNav from '../components/athlete/AthleteBottomNav';
import AthleteMobileHeader from '../components/athlete/AthleteMobileHeader';
import PushNotificationBanner from '../components/common/PushNotificationBanner';

const AthleteDashboardLayout = () => {
  const { user, loading, profile } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando...</p>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <AthleteSidebar onCollapse={setSidebarCollapsed} />
      <AthleteBottomNav />
      <AthleteMobileHeader />

      {/* Main Content */}
      <div
        className={`
          transition-all duration-300
          pt-[62px] lg:pt-0
          ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
        `}
      >
        <main className="overflow-x-hidden pb-[72px] lg:pb-0">
          <PushNotificationBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AthleteDashboardLayout;
