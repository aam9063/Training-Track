import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/dashboard/Sidebar';
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <Sidebar onCollapse={setSidebarCollapsed} />

      {/* Main Content - Fixed: Use conditional classes instead of template literals */}
      <div
        className={`
          transition-all duration-300
          pt-16 lg:pt-0
          ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
        `}
      >
        <main className="min-h-screen overflow-x-hidden">
          <PushNotificationBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
