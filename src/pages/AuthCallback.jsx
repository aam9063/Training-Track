import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { commitPlanSelection } from '../services/subscriptionService';
import { showError } from '../lib/toast';

const VALID_PLAN_KEYS = [
  'coach_free',
  'coach_pro',
  'coach_team',
  'athlete_free',
  'athlete_premium',
];
const VALID_INTERVALS = ['month', 'year'];

/**
 * Reads and clears the pending plan selection from sessionStorage.
 * Returns `null` when absent, malformed, or invalid.
 */
const readPendingPlan = () => {
  let raw = null;
  try {
    raw = sessionStorage.getItem('pending_plan_selection');
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const planKey = parsed.plan_key;
    const interval = parsed.billing_interval || 'month';
    const role = parsed.role || null;
    if (!VALID_PLAN_KEYS.includes(planKey)) return null;
    if (!VALID_INTERVALS.includes(interval)) return null;
    return { planKey, interval, role };
  } catch {
    return null;
  }
};

const clearPendingPlan = () => {
  try {
    sessionStorage.removeItem('pending_plan_selection');
  } catch {
    // ignore
  }
};

const planMatchesRole = (planKey, profileRole) => {
  if (!profileRole) return true;
  if (profileRole === 'coach') return planKey.startsWith('coach_');
  if (profileRole === 'athlete' || profileRole === 'independent_athlete') {
    return planKey.startsWith('athlete_');
  }
  return true;
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const { profileLoaded, profile, user, refreshProfile } = useAuth();
  const [error, setError] = useState(null);
  const hasHandledRef = useRef(false);
  const hydrationDoneRef = useRef(false);
  const [hydrationDone, setHydrationDone] = useState(false);

  // Step 1: hydrate user row (role, coach link) for Google OAuth signups.
  // Runs once when a session is available. Does NOT navigate.
  // Awaits refreshProfile() so that profileLoaded is guaranteed fresh before
  // Step 2 fires. Also flips hydrationDoneRef + hydrationDone state to trigger
  // the gated Step 2 effect.
  useEffect(() => {
    let cancelled = false;

    const hydrateOAuthUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        // No session yet — wait briefly, then fall back to login.
        if (!session) {
          await new Promise((r) => setTimeout(r, 1000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            if (!cancelled) navigate('/login');
            return;
          }
          await applyStoredMetadata(retrySession);
          return;
        }

        await applyStoredMetadata(session);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Error procesando el inicio de sesión');
        setTimeout(() => navigate('/login'), 3000);
      } finally {
        if (!cancelled) {
          hydrationDoneRef.current = true;
          setHydrationDone(true);
        }
      }
    };

    const applyStoredMetadata = async (session) => {
      const sessionUser = session.user;

      const storedMeta = localStorage.getItem('google_oauth_metadata');
      localStorage.removeItem('google_oauth_metadata');

      if (storedMeta) {
        // NEW registration via Google — apply role + coach link
        const meta = JSON.parse(storedMeta);
        const fullName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || '';
        const [firstName, ...lastParts] = fullName.split(' ');
        const lastName = lastParts.join(' ');

        await supabase.auth.updateUser({
          data: {
            role: meta.role,
            first_name: firstName || 'Usuario',
            last_name: lastName || '',
            coach_id: meta.coachId || null,
            coach_email: meta.coachEmail || null,
            auth_provider: 'google',
          },
        });

        const { data: existingUser } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', sessionUser.id)
          .maybeSingle();

        if (existingUser) {
          const { error: updateError } = await supabase
            .from('users')
            .update({
              role: meta.role,
              first_name: firstName || 'Usuario',
              last_name: lastName || '',
              auth_provider: 'google',
            })
            .eq('id', sessionUser.id);
          if (updateError) throw updateError;

          if (meta.role === 'athlete') {
            const { error: athErr } = await supabase
              .from('athletes')
              .upsert({ id: sessionUser.id }, { onConflict: 'id', ignoreDuplicates: true });
            if (athErr) throw athErr;

            if (meta.coachId) {
              const { error: relErr } = await supabase
                .from('coach_athlete_relationship')
                .upsert({
                  coach_id: meta.coachId,
                  athlete_id: sessionUser.id,
                  status: 'active',
                  start_date: toLocalDateStr(new Date()),
                }, { onConflict: 'coach_id,athlete_id', ignoreDuplicates: true });
              if (relErr) throw relErr;
            }
          } else if (meta.role === 'coach') {
            const { error: coachErr } = await supabase
              .from('coaches')
              .upsert({ id: sessionUser.id }, { onConflict: 'id', ignoreDuplicates: true });
            if (coachErr) throw coachErr;
          }
        }
      } else {
        // LOGIN via Google — ensure auth_provider is set
        const { error: provErr } = await supabase
          .from('users')
          .update({ auth_provider: 'google' })
          .eq('id', sessionUser.id)
          .is('auth_provider', null);
        if (provErr) throw provErr;
      }

      // Refresh profile so profileLoaded + profile reflect hydrated user row.
      // The plan-commit effect below will then run when profileLoaded flips.
      await refreshProfile();
    };

    hydrateOAuthUser();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2: once hydration has finished AND profile is freshly loaded, decide
  // plan-commit vs fallback redirect. Guarded by ref so it runs exactly once
  // per mount. hydrationDoneRef prevents firing against a stale profile that
  // existed before refreshProfile was awaited in Step 1.
  useEffect(() => {
    if (!hydrationDoneRef.current) return;
    if (!profileLoaded || !user || hasHandledRef.current) return;
    hasHandledRef.current = true;

    const finalize = async () => {
      try {
        const dashboardPath = profile?.role === 'coach' ? '/dashboard' : '/athlete/dashboard';

        // Case A: user already has a plan committed (returning user or grandfathered)
        if (profile?.plan_selected_at) {
          clearPendingPlan();
          navigate(dashboardPath, { replace: true });
          return;
        }

        // Case B: plan_selected_at IS NULL — read pending plan from sessionStorage
        const pending = readPendingPlan();

        if (!pending) {
          // No hint → fallback to SelectPlan page
          clearPendingPlan();
          navigate('/select-plan', { replace: true });
          return;
        }

        // Validate plan/role before calling RPC to avoid noisy errors
        if (!planMatchesRole(pending.planKey, profile?.role)) {
          clearPendingPlan();
          showError('El plan elegido no coincide con tu tipo de cuenta.');
          navigate('/select-plan', { replace: true });
          return;
        }

        // Commit plan selection via RPC (awaits — no guard race).
        const { error: commitError } = await commitPlanSelection(
          pending.planKey,
          pending.interval,
        );

        if (commitError) {
          clearPendingPlan();
          if (commitError.code === 'plan_already_selected') {
            // Idempotent: refresh and proceed.
            await refreshProfile();
            navigate(dashboardPath, { replace: true });
            return;
          }
          if (commitError.code === 'plan_role_mismatch') {
            showError('El plan elegido no coincide con tu tipo de cuenta.');
            navigate('/select-plan', { replace: true });
            return;
          }
          if (commitError.code === 'unauthorized') {
            navigate('/login', { replace: true });
            return;
          }
          showError('No pudimos guardar tu plan. Elige uno para continuar.');
          navigate('/select-plan', { replace: true });
          return;
        }

        // Success
        clearPendingPlan();
        await refreshProfile();
        navigate(dashboardPath, { replace: true });
      } catch {
        clearPendingPlan();
        navigate('/select-plan', { replace: true });
      }
    };

    finalize();
  }, [hydrationDone, profileLoaded, user, profile, navigate, refreshProfile]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0A]">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error al procesar el inicio de sesión</p>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-sm text-gray-400 mt-2">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0A]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Completando tu registro...</p>
      </div>
    </div>
  );
}
