import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PLAN_FEATURES, canAccessFeature, getMaxPlanForRole, getFreePlanForRole } from '../lib/planFeatures';

/**
 * Hook that derives subscription state from the auth profile.
 * Provides plan info, trial status, and feature access helpers.
 *
 * Access priority:
 * 1. is_exempt → max plan for role (full access)
 * 2. Active subscription → plan from subscription
 * 3. Trialing (trial_ends_at > now) → max plan for role
 * 4. Default → free plan for role
 */
export default function useSubscription() {
  const { profile } = useAuth();

  return useMemo(() => {
    if (!profile) {
      return {
        plan: null,
        planLabel: '',
        status: 'loading',
        isExempt: false,
        isTrialing: false,
        trialDaysLeft: 0,
        trialExpired: false,
        hasActiveSubscription: false,
        canAccess: () => false,
        canAddAthlete: () => true,
        needsPaywall: false,
        subscription: null,
      };
    }

    const role = profile.role === 'coach' ? 'coach' : 'athlete';
    const isExempt = profile.is_exempt === true;
    const subscription = profile.subscription;

    // Trial calculation
    const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const now = new Date();
    const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - now) / 86400000)) : 0;
    const isTrialing = trialEndsAt && trialEndsAt > now && !subscription;
    const trialExpired = trialEndsAt && trialEndsAt <= now && !subscription;

    // Subscription status
    const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'trialing';
    const isPastDue = subscription?.status === 'past_due';

    // Determine effective plan
    let effectivePlan;
    if (isExempt) {
      effectivePlan = getMaxPlanForRole(role);
    } else if (hasActiveSubscription || isPastDue) {
      effectivePlan = subscription.plan_key;
    } else if (isTrialing) {
      effectivePlan = getMaxPlanForRole(role);
    } else {
      effectivePlan = getFreePlanForRole(role);
    }

    const planConfig = PLAN_FEATURES[effectivePlan];
    const planLabel = planConfig?.label || 'Gratis';

    // Feature access
    const canAccess = (feature) => {
      if (isExempt) return true;
      if (isTrialing) return true;
      return canAccessFeature(effectivePlan, feature);
    };

    // Coach athlete limit
    const canAddAthlete = (currentCount) => {
      if (isExempt) return true;
      if (isTrialing) return true;
      const max = planConfig?.maxAthletes ?? Infinity;
      return currentCount < max;
    };

    // Paywall needed?
    const needsPaywall = !isExempt && trialExpired && !hasActiveSubscription;

    return {
      plan: effectivePlan,
      planLabel,
      status: hasActiveSubscription ? 'active' : isTrialing ? 'trialing' : trialExpired ? 'expired' : 'free',
      isExempt,
      isTrialing: !!isTrialing,
      trialDaysLeft,
      trialExpired: !!trialExpired,
      hasActiveSubscription,
      canAccess,
      canAddAthlete,
      needsPaywall,
      subscription,
    };
  }, [profile]);
}
