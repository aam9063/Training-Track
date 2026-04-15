import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState(null);
  // Monotonic counter for fetchProfile calls. Only the latest fetch's result
  // is allowed to update `profile` — stale in-flight fetches (e.g. from
  // onAuthStateChange racing with refreshProfile after a plan commit) are
  // discarded. Prevents a stale fetch from overwriting a fresh one.
  const fetchIdRef = useRef(0);
  // Snapshot of the current profile for the auth-change listener to read
  // without creating a React dependency loop. Updated every render.
  const profileRef = useRef(null);
  profileRef.current = profile;

  // Fetch user profile from our users table with role-specific data.
  // On error returns null and sets `profileError` so downstream guards can
  // react (e.g. render a retry UI instead of redirecting to /select-plan with
  // a stale fallback profile).
  const fetchProfile = useCallback(async (userId) => {
    try {
      // First get the base user info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        setProfileError(userError);
        return null;
      }

      // Check if account is deactivated
      if (userData.is_active === false) {
        await supabase.auth.signOut();
        return null;
      }

      // Then get role-specific data
      let roleData = null;
      if (userData.role === 'coach') {
        const { data: coachData, error: coachError } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', userId)
          .single();

        if (!coachError) roleData = coachData;
      } else if (userData.role === 'athlete') {
        const { data: athleteData, error: athleteError } = await supabase
          .from('athletes')
          .select(`
            *,
            coach_athlete_relationship(
              id,
              coach_id,
              status,
              start_date
            )
          `)
          .eq('id', userId)
          .single();

        if (!athleteError) roleData = athleteData;
      }

      // Fetch subscription data
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      setProfileError(null);
      return {
        ...userData,
        ...(userData.role === 'coach' ? { coach: roleData } : { athlete: roleData }),
        subscription: subscription || null,
      };
    } catch (err) {
      setProfileError(err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);

          // Set initial profile from metadata immediately
          const initialProfile = {
            id: session.user.id,
            email: session.user.email,
            role: session.user.user_metadata?.role || 'coach',
            first_name: session.user.user_metadata?.first_name || 'Usuario',
            last_name: session.user.user_metadata?.last_name || '',
            is_independent: session.user.user_metadata?.is_independent || false,
          };
          setProfile(initialProfile);
          setLoading(false);

          // Fetch full profile in background (non-blocking). On error,
          // fetchProfile sets `profileError` and returns null — we surface
          // that by setting profile to null so guards can render retry UI
          // instead of acting on stale metadata.
          const fetchId = ++fetchIdRef.current;
          fetchProfile(session.user.id)
            .then(dbProfile => {
              if (!mounted || fetchId !== fetchIdRef.current) return;
              setProfile(dbProfile);
            })
            .catch(() => {
              if (!mounted || fetchId !== fetchIdRef.current) return;
              setProfile(null);
            })
            .finally(() => {
              if (mounted && fetchId === fetchIdRef.current) setProfileLoaded(true);
            });
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
          setProfileLoaded(true);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          setProfileLoaded(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // TOKEN_REFRESHED fires when the browser tab regains focus after a
        // period of inactivity. We must NOT reset profile state here — doing
        // so would unmount the whole app (guards see `profileLoaded=false`
        // and show a loading screen), effectively re-navigating to the
        // dashboard home and losing any in-flight UI like AI modals.
        // Only update the `user` object quietly so the new JWT is picked up.
        if (event === 'TOKEN_REFRESHED') {
          if (session?.user) setUser(session.user);
          return;
        }

        // USER_UPDATED also fires on metadata changes; keep the user object
        // fresh but don't tear down the profile.
        if (event === 'USER_UPDATED') {
          if (session?.user) setUser(session.user);
          return;
        }

        // SIGNED_IN also fires when the tab regains focus and Supabase detects
        // an existing session. If the user id is the same as the one we already
        // have, skip the full re-fetch — we already have the profile loaded.
        // This is critical to avoid tearing down the app on tab switch / focus.
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          // If no profile yet (true first-time sign in), fall through to full
          // init. Otherwise, this is a re-sign-in for the same user — no-op.
          const currentProfile = profileRef.current;
          if (currentProfile && currentProfile.id === session.user.id) {
            return;
          }
        }

        if (session?.user) {
          setUser(session.user);

          // Set profile from metadata immediately
          const metadataProfile = {
            id: session.user.id,
            email: session.user.email,
            role: session.user.user_metadata?.role || 'coach',
            first_name: session.user.user_metadata?.first_name || 'Usuario',
            last_name: session.user.user_metadata?.last_name || '',
            is_independent: session.user.user_metadata?.is_independent || false,
          };
          setProfile(metadataProfile);
          setProfileLoaded(false);

          // Fetch full profile in background. On error, `dbProfile` will be
          // null — set profile accordingly so consumers don't act on stale
          // metadata (profileError is also set by fetchProfile).
          const fetchId = ++fetchIdRef.current;
          fetchProfile(session.user.id)
            .then(dbProfile => {
              if (!mounted || fetchId !== fetchIdRef.current) return;
              setProfile(dbProfile);
            })
            .catch(() => {
              if (!mounted || fetchId !== fetchIdRef.current) return;
              setProfile(null);
            })
            .finally(() => {
              if (mounted && fetchId === fetchIdRef.current) setProfileLoaded(true);
            });
        } else {
          setUser(null);
          setProfile(null);
          setProfileLoaded(false);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign up with email
  const signUp = useCallback(async ({ email, password, role, firstName, lastName, coachEmail, coachId, isIndependent }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            first_name: firstName,
            last_name: lastName,
            coach_email: coachEmail || null,
            coach_id: coachId || null,
            is_independent: isIndependent || false,
          },
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, []);

  // Sign in with email
  const signIn = useCallback(async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, []);

  // Sign in with Google
  // metadata: { role, coachId, coachEmail } — saved to localStorage for post-OAuth callback
  // pendingPlan: { planKey, billingInterval, role } — saved to sessionStorage so
  // AuthCallback can commit the plan after OAuth returns. Safe to call from
  // landing pages or entry points that don't manage sessionStorage themselves.
  const signInWithGoogle = useCallback(async (metadata = null, pendingPlan = null) => {
    try {
      // Store registration metadata before redirect (OAuth loses state)
      if (metadata) {
        localStorage.setItem('google_oauth_metadata', JSON.stringify(metadata));
      }

      // Store pending plan selection before redirect (tab-scoped)
      if (pendingPlan?.planKey) {
        try {
          sessionStorage.setItem(
            'pending_plan_selection',
            JSON.stringify({
              plan_key: pendingPlan.planKey,
              billing_interval: pendingPlan.billingInterval || 'month',
              role: pendingPlan.role || metadata?.role || null,
            }),
          );
        } catch {
          // sessionStorage unavailable — non-blocking.
        }
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      // Clean up on error
      localStorage.removeItem('google_oauth_metadata');
      try { sessionStorage.removeItem('pending_plan_selection'); } catch { /* ignore */ }
      return { data: null, error };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setProfile(null);
      return { error: null };
    } catch (error) {
      return { error };
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, []);

  // Update password
  const updatePassword = useCallback(async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    if (!user?.id) return { data: null, error: new Error('No user') };

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(prev => ({ ...prev, ...data }));
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [user?.id]);

  // Update coach-specific data
  const updateCoachProfile = useCallback(async (updates) => {
    if (profile?.role !== 'coach') {
      return { data: null, error: new Error('User is not a coach') };
    }

    try {
      const { data, error } = await supabase
        .from('coaches')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(prev => ({ ...prev, coach: { ...prev?.coach, ...data } }));
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [profile?.role, user?.id]);

  // Update athlete-specific data
  const updateAthleteProfile = useCallback(async (updates) => {
    if (profile?.role !== 'athlete') {
      return { data: null, error: new Error('User is not an athlete') };
    }

    try {
      const { data, error } = await supabase
        .from('athletes')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(prev => ({ ...prev, athlete: { ...prev?.athlete, ...data } }));
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [profile?.role, user?.id]);

  // Get coach's athletes
  const getMyAthletes = useCallback(async () => {
    if (profile?.role !== 'coach') {
      return { data: null, error: new Error('User is not a coach') };
    }

    try {
      // Fetch relationships first
      const { data: relationships, error: relError } = await supabase
        .from('coach_athlete_relationship')
        .select('id, athlete_id, status, start_date')
        .eq('coach_id', user.id)
        .eq('status', 'active');

      if (relError) throw relError;
      if (!relationships?.length) return { data: [], error: null };

      const athleteIds = relationships.map(r => r.athlete_id);

      // Fetch athletes and users separately
      const [athletesRes, usersRes] = await Promise.all([
        supabase.from('athletes').select('*').in('id', athleteIds),
        supabase.from('users').select('*').in('id', athleteIds),
      ]);

      const athletes = relationships.map(rel => {
        const athlete = athletesRes.data?.find(a => a.id === rel.athlete_id) || {};
        const userData = usersRes.data?.find(u => u.id === rel.athlete_id) || {};

        return {
          relationshipId: rel.id,
          status: rel.status,
          startDate: rel.start_date,
          ...athlete,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          profile_image: userData.profile_image,
        };
      });

      return { data: athletes, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [profile?.role, user?.id]);

  // Get athlete's coach
  const getMyCoach = useCallback(async () => {
    if (profile?.role !== 'athlete') {
      return { data: null, error: new Error('User is not an athlete') };
    }

    try {
      const { data: relationship, error: relError } = await supabase
        .from('coach_athlete_relationship')
        .select('id, coach_id, status, start_date')
        .eq('athlete_id', user.id)
        .eq('status', 'active')
        .single();

      if (relError && relError.code !== 'PGRST116') throw relError;
      if (!relationship) return { data: null, error: null };

      // Fetch coach and user data
      const [coachRes, userRes] = await Promise.all([
        supabase.from('coaches').select('*').eq('id', relationship.coach_id).single(),
        supabase.from('users').select('*').eq('id', relationship.coach_id).single(),
      ]);

      const coach = {
        relationshipId: relationship.id,
        status: relationship.status,
        startDate: relationship.start_date,
        ...coachRes.data,
        first_name: userRes.data?.first_name,
        last_name: userRes.data?.last_name,
        email: userRes.data?.email,
        profile_image: userRes.data?.profile_image,
      };

      return { data: coach, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [profile?.role, user?.id]);

  // Accept/reject coach-athlete relationship
  const updateRelationship = useCallback(async (relationshipId, status) => {
    try {
      const { data, error } = await supabase
        .from('coach_athlete_relationship')
        .update({
          status,
          ...(status === 'active' ? { start_date: toLocalDateStr(new Date()) } : {}),
        })
        .eq('id', relationshipId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, []);

  // Refresh profile data. Resets `profileLoaded` to false before fetching so
  // consumers (e.g. AuthCallback) can wait for the fresh value before acting.
  // Optional userIdOverride lets callers refetch a profile immediately after
  // signUp, before onAuthStateChange has finished propagating the new user
  // into the AuthContext state. Without this, refreshProfile would see
  // `user === null` and early-return, leaving the guard with a stale profile.
  const refreshProfile = useCallback(async (userIdOverride) => {
    const targetUserId = userIdOverride || user?.id;
    if (!targetUserId) return null;
    setProfileLoaded(false);
    const fetchId = ++fetchIdRef.current;
    try {
      const newProfile = await fetchProfile(targetUserId);
      // Only apply if no newer fetch has started while we were awaiting.
      if (fetchId === fetchIdRef.current) {
        setProfile(newProfile);
      }
      return newProfile;
    } finally {
      if (fetchId === fetchIdRef.current) {
        setProfileLoaded(true);
      }
    }
  }, [user, fetchProfile]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    profile,
    loading,
    profileLoaded,
    profileError,
    isCoach: profile?.role === 'coach',
    isAthlete: profile?.role === 'athlete',
    isIndependent: profile?.role === 'athlete' && profile?.is_independent === true,
    isAdmin: profile?.is_admin === true,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    updateCoachProfile,
    updateAthleteProfile,
    getMyAthletes,
    getMyCoach,
    updateRelationship,
    refreshProfile,
  }), [
    user,
    profile,
    loading,
    profileLoaded,
    profileError,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    updateCoachProfile,
    updateAthleteProfile,
    getMyAthletes,
    getMyCoach,
    updateRelationship,
    refreshProfile,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
