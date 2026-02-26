import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/dashboard/Sidebar';
import BottomNav from '../components/dashboard/BottomNav';
import MobileHeader from '../components/dashboard/MobileHeader';
import PushNotificationBanner from '../components/common/PushNotificationBanner';

const DashboardLayout = () => {
  const { user, loading, profile } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Show loading only while truly loading and no user yet
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
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
    <div className="min-h-screen bg-brand-bg dark:bg-gray-900 overflow-x-hidden">
      <Sidebar onCollapse={setSidebarCollapsed} />
      <BottomNav />
      <MobileHeader />

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

export default DashboardLayout;
