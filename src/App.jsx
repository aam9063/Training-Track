import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import AthleteDashboardLayout from './layouts/AthleteDashboardLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
// Coach pages
import Dashboard from './pages/dashboard/Dashboard';
import Athletes from './pages/dashboard/Athletes';
import AthleteProfile from './pages/dashboard/AthleteProfile';
import AthleteMetricsView from './pages/dashboard/AthleteMetricsView';
import Metrics from './pages/dashboard/Metrics';
import Calendar from './pages/dashboard/Calendar';
import Profile from './pages/dashboard/Profile';
import CoachMessages from './pages/dashboard/Messages';
// Athlete pages
import AthleteDashboard from './pages/athlete/Dashboard';
import Training from './pages/athlete/Training';
import AthleteMetrics from './pages/athlete/Metrics';
import Devices from './pages/athlete/Devices';
import AthleteMessages from './pages/athlete/Messages';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
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

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
