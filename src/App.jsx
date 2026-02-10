import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import AthleteDashboardLayout from './layouts/AthleteDashboardLayout';
import './index.css';

// Lazy-loaded pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Coach pages
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Athletes = lazy(() => import('./pages/dashboard/Athletes'));
const AthleteProfile = lazy(() => import('./pages/dashboard/AthleteProfile'));
const AthleteMetricsView = lazy(() => import('./pages/dashboard/AthleteMetricsView'));
const Metrics = lazy(() => import('./pages/dashboard/Metrics'));
const Calendar = lazy(() => import('./pages/dashboard/Calendar'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const CoachMessages = lazy(() => import('./pages/dashboard/Messages'));

// Athlete pages
const AthleteDashboard = lazy(() => import('./pages/athlete/Dashboard'));
const Training = lazy(() => import('./pages/athlete/Training'));
const AthleteMetrics = lazy(() => import('./pages/athlete/Metrics'));
const Devices = lazy(() => import('./pages/athlete/Devices'));
const AthleteMessages = lazy(() => import('./pages/athlete/Messages'));

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Cargando...</p>
    </div>
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected Coach Dashboard Routes */}
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="athletes" element={<Athletes />} />
                <Route path="athletes/:athleteId" element={<AthleteProfile />} />
                <Route path="athletes/:athleteId/metrics" element={<AthleteMetricsView />} />
                <Route path="metrics" element={<Metrics />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="profile" element={<Profile />} />
                <Route path="messages" element={<CoachMessages />} />
              </Route>

              {/* Protected Athlete Dashboard Routes */}
              <Route path="/athlete" element={<AthleteDashboardLayout />}>
                <Route path="dashboard" element={<AthleteDashboard />} />
                <Route path="training" element={<Training />} />
                <Route path="metrics" element={<AthleteMetrics />} />
                <Route path="devices" element={<Devices />} />
                <Route path="messages" element={<AthleteMessages />} />
                <Route path="profile" element={<Profile />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
