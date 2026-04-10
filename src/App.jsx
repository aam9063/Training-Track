import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Toaster } from 'sileo';
import DashboardLayout from './layouts/DashboardLayout';
import AthleteDashboardLayout from './layouts/AthleteDashboardLayout';
import PWAInstallPrompt from './components/common/PWAInstallPrompt';
import './index.css';

// Lazy-loaded pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));
const UseCases = lazy(() => import('./pages/UseCases'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Blog = lazy(() => import('./pages/blog/Blog'));
const BlogPost = lazy(() => import('./pages/blog/BlogPost'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const TermsConditions = lazy(() => import('./pages/TermsConditions'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const SelectPlan = lazy(() => import('./pages/SelectPlan'));

// Coach pages
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Athletes = lazy(() => import('./pages/dashboard/Athletes'));
const AthleteProfile = lazy(() => import('./pages/dashboard/AthleteProfile'));
const AthleteMetricsView = lazy(() => import('./pages/dashboard/AthleteMetricsView'));
const Metrics = lazy(() => import('./pages/dashboard/Metrics'));
const Calendar = lazy(() => import('./pages/dashboard/Calendar'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const CoachMessages = lazy(() => import('./pages/dashboard/Messages'));
const Planning = lazy(() => import('./pages/dashboard/Planning'));
const AIReports = lazy(() => import('./pages/dashboard/AIReports'));

// Admin pages
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminUserDetail = lazy(() => import('./pages/admin/UserDetail'));
const AdminWaitlist = lazy(() => import('./pages/admin/Waitlist'));

// Athlete pages
const AthleteDashboard = lazy(() => import('./pages/athlete/Dashboard'));
const Training = lazy(() => import('./pages/athlete/Training'));
const AthleteCalendar = lazy(() => import('./pages/athlete/AthleteCalendar'));
const AthleteMetrics = lazy(() => import('./pages/athlete/Metrics'));
const Devices = lazy(() => import('./pages/athlete/Devices'));
const AthleteMessages = lazy(() => import('./pages/athlete/Messages'));
const GymFiles = lazy(() => import('./pages/athlete/GymFiles'));
const MyReports = lazy(() => import('./pages/athlete/MyReports'));

// Independent athlete pages
const MyPlan = lazy(() => import('./pages/athlete/MyPlan'));
const Competitions = lazy(() => import('./pages/athlete/Competitions'));
const AIAssistant = lazy(() => import('./pages/athlete/AIAssistant'));

// Guard: only renders children when isIndependent is true, else redirects to dashboard
const IndependentRoute = ({ children }) => {
  const { isIndependent, loading } = useAuth();
  if (loading) return null;
  return isIndependent ? children : <Navigate to="/athlete/dashboard" replace />;
};

// Guard: requires an authenticated session but no specific role or plan.
// Used by /select-plan so anonymous visitors are redirected to /login instead
// of hitting commitPlanSelection and getting an `unauthorized` error. Must
// NOT be wrapped with PlanSelectionGuard (would cause a self-redirect loop).
const AuthenticatedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
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
        <NotificationProvider>
          <Router>
            <PWAInstallPrompt />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/casos-de-uso" element={<UseCases />} />
                <Route path="/privacidad" element={<PrivacyPolicy />} />
                <Route path="/terminos-y-condiciones" element={<TermsConditions />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/checkout/success" element={<CheckoutSuccess />} />
                <Route
                  path="/select-plan"
                  element={
                    <AuthenticatedRoute>
                      <SelectPlan />
                    </AuthenticatedRoute>
                  }
                />

                {/* Protected Coach Dashboard Routes */}
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="athletes" element={<Athletes />} />
                  <Route path="athletes/:athleteId" element={<AthleteProfile />} />
                  <Route path="athletes/:athleteId/metrics" element={<AthleteMetricsView />} />
                  <Route path="planning" element={<Planning />} />
                  <Route path="metrics" element={<Metrics />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="messages" element={<CoachMessages />} />
                  <Route path="ai-reports" element={<AIReports />} />
                </Route>

                {/* Protected Athlete Dashboard Routes */}
                <Route path="/athlete" element={<AthleteDashboardLayout />}>
                  <Route path="dashboard" element={<AthleteDashboard />} />
                  <Route path="training" element={<Training />} />
                  <Route path="calendar" element={<AthleteCalendar />} />
                  <Route path="metrics" element={<AthleteMetrics />} />
                  <Route path="devices" element={<Devices />} />
                  <Route path="messages" element={<AthleteMessages />} />
                  <Route path="gym-files" element={<GymFiles />} />
                  <Route path="my-reports" element={<MyReports />} />
                  <Route path="profile" element={<Profile />} />
                  {/* Independent athlete routes */}
                  <Route path="my-plan" element={<IndependentRoute><MyPlan /></IndependentRoute>} />
                  <Route path="competitions" element={<IndependentRoute><Competitions /></IndependentRoute>} />
                  <Route path="ai-assistant" element={<IndependentRoute><AIAssistant /></IndependentRoute>} />
                </Route>

                {/* Admin Login (public) */}
                <Route path="/admin/login" element={<AdminLogin />} />

                {/* Protected Admin Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="users/:userId" element={<AdminUserDetail />} />
                  <Route path="waitlist" element={<AdminWaitlist />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Router>
          {/* Mobile: bottom-center por encima del bottom nav */}
          <div className="lg:hidden">
            <Toaster position="bottom-center" offset={90} />
          </div>
          {/* Desktop: bottom-right */}
          <div className="hidden lg:block">
            <Toaster position="bottom-right" />
          </div>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
