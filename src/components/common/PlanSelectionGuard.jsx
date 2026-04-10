import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Blocks access to protected layouts until the authenticated user has committed
 * a plan selection. Prevents flash-redirects by rendering a neutral loading
 * placeholder while the profile is still being fetched.
 *
 * Pass-through cases:
 *   - No user: other auth guards handle redirection.
 *   - Admin profile: full access regardless of plan selection.
 *   - Profile has plan_selected_at (including grandfathered users): access granted.
 *
 * Block case:
 *   - profileLoaded AND user AND profile.plan_selected_at IS NULL → redirect to /select-plan.
 */
const PlanSelectionGuard = ({ children }) => {
  const { user, profile, profileLoaded, profileError } = useAuth();

  // No user yet — let the outer auth guard handle redirection.
  if (!user) {
    return children;
  }

  // Profile still loading — render a neutral placeholder to avoid flash-redirects.
  if (!profileLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg dark:bg-coach-base">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  // Profile fetch errored — show retry UI instead of redirecting. Prevents
  // grandfathered users from getting kicked to /select-plan just because the
  // users table query failed transiently.
  if (profileError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <p className="text-slate-700 mb-4">No pudimos cargar tu perfil.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Admin users bypass plan selection entirely.
  if (profile?.is_admin === true) {
    return children;
  }

  // Profile loaded but plan not committed yet → redirect to the selector.
  if (!profile?.plan_selected_at) {
    return <Navigate to="/select-plan" replace />;
  }

  return children;
};

export default PlanSelectionGuard;
