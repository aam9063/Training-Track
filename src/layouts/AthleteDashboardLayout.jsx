import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AthleteSidebar from '../components/athlete/AthleteSidebar';

const AthleteDashboardLayout = () => {
  const { user, loading, profile } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Mostrar loading solo si realmente está cargando Y no hay usuario aún
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

  // Si no hay usuario después de cargar, redirigir a login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Verificar si es coach y redirigir a su dashboard
  const userRole = profile?.role || user?.user_metadata?.role || 'athlete';
  if (userRole === 'coach') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AthleteSidebar onCollapse={setSidebarCollapsed} />
      
      {/* Main Content with responsive margin */}
      <div className={`
        transition-all duration-300
        pt-16 lg:pt-0
        ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
      `}>
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AthleteDashboardLayout;
