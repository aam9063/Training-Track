import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { commitPlanSelection } from '../services/subscriptionService';
import { showError, showSuccess } from '../lib/toast';
import PlanSelectionStep from '../components/register/PlanSelectionStep';

/**
 * Fallback page shown when an authenticated user has no plan committed yet.
 * Reachable via PlanSelectionGuard (added in a later phase).
 */
export default function SelectPlan() {
  const navigate = useNavigate();
  const { user, profile, profileLoaded, refreshProfile } = useAuth();
  const [plan, setPlan] = useState(null);
  const [billingInterval, setBillingInterval] = useState('month');
  const [submitting, setSubmitting] = useState(false);

  const role = profile?.role === 'coach' ? 'coach' : 'athlete';
  const dashboardPath = profile?.role === 'coach' ? '/dashboard' : '/athlete/dashboard';

  // On mount, force a profile refetch so we catch any recently committed
  // plan that AuthContext's background fetch may have missed due to a
  // stale in-flight race (e.g. a signup that just finished committing a plan
  // right before navigating here).
  useEffect(() => {
    if (user) {
      refreshProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Redirect away if user already has a plan committed.
  useEffect(() => {
    if (!profileLoaded) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.plan_selected_at) {
      navigate(dashboardPath, { replace: true });
    }
  }, [profileLoaded, profile, user, navigate, dashboardPath]);

  const handleSubmit = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      const { error } = await commitPlanSelection(plan, billingInterval);
      if (error) {
        if (error.code === 'plan_already_selected') {
          // Silent success: refetch and navigate.
          await refreshProfile();
          navigate(dashboardPath, { replace: true });
          return;
        }
        if (error.code === 'plan_role_mismatch') {
          showError('El plan elegido no coincide con tu rol.');
          return;
        }
        if (error.code === 'unauthorized') {
          showError('Sesión no válida. Vuelve a iniciar sesión.');
          navigate('/login', { replace: true });
          return;
        }
        if (error.code === 'invalid_plan_key' || error.code === 'invalid_billing_interval') {
          showError('Plan no válido. Contacta con soporte.');
          return;
        }
        showError('No se pudo guardar tu selección. Inténtalo de nuevo.');
        return;
      }

      // Success: show role-appropriate toast, refetch profile, redirect.
      if (plan === 'coach_free' || plan === 'athlete_free') {
        showSuccess('¡Listo! Disfruta de tus 14 días de prueba.');
      } else {
        showSuccess('Tu prueba de 14 días ha comenzado. Completa el pago antes de que termine para mantener el acceso.');
      }
      try { sessionStorage.removeItem('pending_plan_selection'); } catch { /* ignore */ }
      await refreshProfile();
      navigate(dashboardPath, { replace: true });
    } catch {
      showError('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!profileLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center space-x-2">
            <img src="/img/logo.png" alt="TrainingTrack" className="w-12 h-12 object-contain" />
            <span className="text-3xl font-bold text-sky-600 dark:text-sky-400">
              Training Track
            </span>
          </Link>
        </div>

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            ¡Bienvenido! Elige tu plan para continuar
          </h1>
          <p className="mt-4 text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Todos los planes incluyen 14 días de prueba gratis. Puedes cambiar de plan en cualquier momento desde Mi Perfil.
          </p>
        </div>

        {/* Plan selector */}
        <PlanSelectionStep
          role={role}
          value={plan}
          onChange={setPlan}
          interval={billingInterval}
          onIntervalChange={setBillingInterval}
          onNext={handleSubmit}
          nextLabel="Continuar"
          nextLoading={submitting}
        />
      </div>
    </div>
  );
}
