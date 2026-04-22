import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCoachPublicInfo } from '../services/athleteService';
import { commitPlanSelection } from '../services/subscriptionService';
import { showError, showSuccess } from '../lib/toast';

// Centralized cleanup so every exit path (success, failure, cancel) clears
// the pending plan hint. Prevents a stale key leaking to the next signup
// attempt in the same tab.
const clearPendingPlan = () => {
  try {
    sessionStorage.removeItem('pending_plan_selection');
  } catch {
    // sessionStorage unavailable — nothing to clean.
  }
};

const VALID_PLAN_KEYS = [
  'coach_free',
  'coach_pro',
  'coach_team',
  'athlete_free',
  'athlete_premium',
];
const VALID_INTERVALS = ['month', 'year'];

// Wizard steps: role -> plan -> form
const STEP_ROLE = 1;
const STEP_PLAN = 2;
const STEP_FORM = 3;

const registerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  email: z
    .string()
    .min(1, 'El email es requerido')
    .regex(/^[^\s@]+@[^\s@]+/, 'El email debe contener @'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  coachEmail: z.string().optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar los términos y condiciones' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export default function useRegisterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signInWithGoogle, refreshProfile } = useAuth();
  const [step, setStep] = useState(STEP_ROLE);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [inviteCoachId, setInviteCoachId] = useState(null);
  const [inviteCoachName, setInviteCoachName] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [plan, setPlan] = useState(null);
  const [billingInterval, setBillingInterval] = useState('month');

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      coachEmail: '',
      acceptTerms: false,
    },
  });

  // Read optional ?plan= and ?interval= once (validated against whitelist).
  // Invalid values are silently ignored so the wizard falls back to plan step.
  useEffect(() => {
    const planParam = searchParams.get('plan');
    const intervalParam = searchParams.get('interval');
    if (planParam && VALID_PLAN_KEYS.includes(planParam)) {
      setPlan(planParam);
    }
    if (intervalParam && VALID_INTERVALS.includes(intervalParam)) {
      setBillingInterval(intervalParam);
    }
  }, [searchParams]);

  // Detect invite link and fetch coach info
  useEffect(() => {
    const inviteId = searchParams.get('invite');
    if (inviteId) {
      setLoadingInvite(true);
      getCoachPublicInfo(inviteId)
        .then(({ data, error }) => {
          if (!error && data?.length > 0) {
            setInviteCoachId(inviteId);
            setInviteCoachName(`${data[0].first_name} ${data[0].last_name}`);
            setRole('athlete');
            // Coached athlete: force athlete_free, skip role AND plan step
            setPlan('athlete_free');
            setBillingInterval('month');
            setStep(STEP_FORM);
          }
          setLoadingInvite(false);
        });
      return;
    }

    // Pre-select role from query param (from pricing page)
    const roleParam = searchParams.get('role');
    const planParam = searchParams.get('plan');
    const hasValidPlanParam = planParam && VALID_PLAN_KEYS.includes(planParam);

    if (roleParam === 'coach') {
      setRole('coach');
      // If URL also carries a valid plan, skip plan step entirely
      setStep(hasValidPlanParam ? STEP_FORM : STEP_PLAN);
    } else if (roleParam === 'independent') {
      setRole('independent_athlete');
      setStep(hasValidPlanParam ? STEP_FORM : STEP_PLAN);
    } else if (roleParam === 'athlete') {
      // Coached athletes without invite go straight to the form; they will be
      // auto-committed to athlete_free after signup.
      setRole('athlete');
      setPlan('athlete_free');
      setBillingInterval('month');
      setStep(STEP_FORM);
    }
  }, [searchParams]);

  // Map RPC error codes to Spanish toasts. Returns true if navigation can
  // proceed (silent-success case: plan_already_selected).
  const handleCommitError = (error) => {
    switch (error.code) {
      case 'plan_already_selected':
        return true;
      case 'plan_role_mismatch':
        showError('El plan elegido no coincide con tu rol.');
        return false;
      case 'unauthorized':
        showError('Sesión no válida. Vuelve a iniciar sesión.');
        return false;
      case 'invalid_plan_key':
      case 'invalid_billing_interval':
        showError('Plan no válido. Contacta con soporte.');
        return false;
      default:
        showError('No se pudo guardar tu selección. Inténtalo de nuevo.');
        return false;
    }
  };

  const onSubmit = async (data) => {
    const isIndependentAthlete = role === 'independent_athlete';
    // "athlete" role in the wizard means the user selected the coached-athlete
    // path (or arrived via an invite link). Independent athletes live under
    // role === 'independent_athlete'. We still require that a coached athlete
    // without an invite types a valid coach email — the validation below
    // enforces that before we consider them a coached athlete for auto-commit.
    const isCoachedAthleteFlow = role === 'athlete';

    // Validate coachEmail for coached athletes without invite
    if (isCoachedAthleteFlow && !inviteCoachId && !data.coachEmail?.trim()) {
      form.setError('coachEmail', { message: 'El email de tu entrenador es requerido' });
      return;
    }
    if (isCoachedAthleteFlow && !inviteCoachId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.coachEmail)) {
      form.setError('coachEmail', { message: 'Email del entrenador inválido' });
      return;
    }

    // After validation, a coached athlete is guaranteed to have either an
    // invite or a valid coach email. This boolean gates auto-commit to
    // `athlete_free` — independent athletes skip this path and use the plan
    // they picked in the wizard.
    const isCoachedAthlete = isCoachedAthleteFlow && Boolean(inviteCoachId || data.coachEmail);

    // Resolve the plan key for this registration.
    const { planKey, interval } = isCoachedAthlete
      ? { planKey: 'athlete_free', interval: 'month' }
      : { planKey: plan, interval: billingInterval };

    // Non-coached users MUST have selected a plan by now.
    if (!isCoachedAthlete && !planKey) {
      form.setError('root', { message: 'Debes elegir un plan para continuar' });
      setStep(STEP_PLAN);
      return;
    }

    setIsLoading(true);

    try {
      // Persist a pending plan hint BEFORE signUp so AuthCallback can
      // auto-commit after email verification if the session is not immediate.
      try {
        sessionStorage.setItem(
          'pending_plan_selection',
          JSON.stringify({
            plan_key: planKey,
            billing_interval: interval,
            role: isIndependentAthlete ? 'athlete' : role,
          }),
        );
      } catch {
        // sessionStorage may be unavailable in private mode — non-blocking.
      }

      const { data: signUpData, error } = await signUp({
        email: data.email,
        password: data.password,
        role: isIndependentAthlete ? 'athlete' : role,
        firstName: data.firstName,
        lastName: data.lastName,
        coachEmail: isCoachedAthlete && !inviteCoachId ? data.coachEmail : null,
        coachId: inviteCoachId || null,
        isIndependent: isIndependentAthlete,
      });

      if (error) throw error;

      // Persist is_independent on public.users for the independent-athlete
      // path. Without this write the `IndependentRoute` guard in App.jsx would
      // reject access to /athlete/my-plan, /athlete/competitions and
      // /athlete/ai-assistant. We only attempt it when we have an immediate
      // session (otherwise RLS rejects anon writes); if verification is
      // required, the DB trigger (see migration 20260422_*_independent_athlete_flag.sql)
      // takes over and reads raw_user_meta_data.is_independent on first insert.
      if (isIndependentAthlete && signUpData?.session && signUpData?.user?.id) {
        const { error: flagErr } = await supabase
          .from('users')
          .update({ is_independent: true })
          .eq('id', signUpData.user.id);
        if (flagErr) {
          console.warn('[register] is_independent flag update failed', flagErr.message);
        }
      }

      // Branch on whether signUp returned an immediate session:
      //   - Session present → email verification disabled → commit plan
      //     inline and navigate straight to the dashboard.
      //   - Session null → email verification required → tell the user to
      //     check their inbox and redirect to /login. AuthCallback will pick
      //     up the pending plan hint on the first post-verification login.
      const hasSession = Boolean(signUpData?.session);
      if (hasSession) {
        // Double-check auth is ready before calling the RPC.
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          const { error: commitError } = await commitPlanSelection(planKey, interval);
          if (commitError) {
            const canProceed = handleCommitError(commitError);
            if (!canProceed) {
              clearPendingPlan();
              setIsLoading(false);
              return;
            }
          }
          clearPendingPlan();

          // Refresh the auth profile so PlanSelectionGuard sees the updated
          // plan_selected_at before we navigate to the protected dashboard.
          // Pass the user id from the signUp response directly: onAuthStateChange
          // may not have propagated the new user into AuthContext state yet,
          // and without an explicit override refreshProfile would early-return.
          await refreshProfile(sessionData.session.user.id);
        }

        // Happy path: account is live, plan is committed, go to the right
        // dashboard. Independent athletes live under the athlete dashboard.
        const dashboardPath = role === 'coach' ? '/dashboard' : '/athlete/dashboard';
        showSuccess('¡Bienvenido! Tu cuenta está lista.');
        navigate(dashboardPath, { replace: true });
        return;
      }

      // No session: email verification flow. Keep the pending plan hint so
      // AuthCallback can pick it up on first login after verification.
      showSuccess('Revisa tu email para confirmar tu cuenta');
      setSuccessMessage('Revisa tu email para confirmar tu cuenta.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      // Clear the pending plan so a failed signup does not leak to a second
      // attempt by a different user on the same tab.
      clearPendingPlan();
      form.setError('root', {
        message: err.message || 'Error al crear la cuenta. Intenta de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!role) {
      form.setError('root', { message: 'Por favor selecciona tu rol primero' });
      return;
    }

    // Persist a pending plan hint for AuthCallback to pick up after OAuth.
    const isCoachedAthlete = role === 'athlete';
    const planKey = isCoachedAthlete ? 'athlete_free' : plan;
    const interval = isCoachedAthlete ? 'month' : billingInterval;
    if (planKey) {
      try {
        sessionStorage.setItem(
          'pending_plan_selection',
          JSON.stringify({
            plan_key: planKey,
            billing_interval: interval,
            role: role === 'independent_athlete' ? 'athlete' : role,
          }),
        );
      } catch {
        // sessionStorage may be unavailable — non-blocking.
      }
    }

    try {
      const { error } = await signInWithGoogle({
        role,
        coachId: inviteCoachId || null,
        coachEmail: role === 'athlete' && !inviteCoachId ? form.getValues('coachEmail') : null,
      });
      if (error) throw error;
    } catch {
      form.setError('root', { message: 'Error al registrar con Google' });
    }
  };

  const selectRole = (selectedRole) => {
    setRole(selectedRole);
    if (selectedRole === 'athlete') {
      // Coached athlete: skip plan step, go straight to form (auto athlete_free)
      setPlan('athlete_free');
      setBillingInterval('month');
      setStep(STEP_FORM);
      return;
    }
    // Coach or independent athlete: show plan step unless ?plan= already valid
    const urlPlan = searchParams.get('plan');
    if (urlPlan && VALID_PLAN_KEYS.includes(urlPlan)) {
      setStep(STEP_FORM);
      return;
    }
    setStep(STEP_PLAN);
  };

  const selectPlan = (planKey) => {
    setPlan(planKey);
  };

  const confirmPlan = () => {
    if (!plan) {
      form.setError('root', { message: 'Debes elegir un plan para continuar' });
      return;
    }
    setStep(STEP_FORM);
  };

  const goBack = () => {
    if (step === STEP_FORM) {
      // If we came from the plan step (coach / independent), go back to plan.
      // Coached athletes go back to role selection.
      if (role === 'athlete') {
        setStep(STEP_ROLE);
        setRole(null);
        setPlan(null);
        return;
      }
      const urlPlan = searchParams.get('plan');
      if (urlPlan && VALID_PLAN_KEYS.includes(urlPlan)) {
        setStep(STEP_ROLE);
        setRole(null);
        return;
      }
      setStep(STEP_PLAN);
      return;
    }
    if (step === STEP_PLAN) {
      setStep(STEP_ROLE);
      setRole(null);
      setPlan(null);
      return;
    }
    setStep(STEP_ROLE);
    setRole(null);
  };

  return {
    form,
    step,
    role,
    isLoading,
    successMessage,
    inviteCoachId,
    inviteCoachName,
    loadingInvite,
    plan,
    billingInterval,
    onSubmit: form.handleSubmit(onSubmit),
    handleGoogleRegister,
    selectRole,
    selectPlan,
    setBillingInterval,
    confirmPlan,
    goBack,
  };
}
