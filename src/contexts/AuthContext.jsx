import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from our users table with role-specific data
  const fetchProfile = useCallback(async (userId, sessionUser) => {
    // Create fallback profile from session metadata
    const userMetadata = sessionUser?.user_metadata || {};
    const fallbackProfile = {
      id: userId,
      email: sessionUser?.email || '',
      role: userMetadata.role || 'coach',
      first_name: userMetadata.first_name || 'Usuario',
      last_name: userMetadata.last_name || '',
      created_at: sessionUser?.created_at,
    };

    try {
      // First get the base user info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        console.warn('Using fallback profile - DB error:', userError.message);
        return fallbackProfile;
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

      return {
        ...userData,
        ...(userData.role === 'coach' ? { coach: roleData } : { athlete: roleData }),
      };
    } catch (error) {
      console.warn('Using fallback profile - exception:', error.message);
      return fallbackProfile;
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
          };
          setProfile(initialProfile);
          setLoading(false);

          // Fetch full profile in background (non-blocking)
          fetchProfile(session.user.id, session.user)
            .then(dbProfile => {
              if (mounted && dbProfile) {
                setProfile(dbProfile);
              }
            })
            .catch(() => {
              // Keep metadata profile on error
            });
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);

          // Set profile from metadata immediately
          const metadataProfile = {
            id: session.user.id,
            email: session.user.email,
            role: session.user.user_metadata?.role || 'coach',
            first_name: session.user.user_metadata?.first_name || 'Usuario',
            last_name: session.user.user_metadata?.last_name || '',
          };
          setProfile(metadataProfile);

          // Fetch full profile in background
          fetchProfile(session.user.id, session.user)
            .then(dbProfile => {
              if (mounted && dbProfile) {
                setProfile(dbProfile);
              }
            })
            .catch(() => {});
        } else {
          setUser(null);
          setProfile(null);
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
  const signUp = useCallback(async ({ email, password, role, firstName, lastName, coachEmail, coachId }) => {
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
          },
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
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
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  }, []);

  // Sign in with Google
  // metadata: { role, coachId, coachEmail } — saved to localStorage for post-OAuth callback
  const signInWithGoogle = useCallback(async (metadata = null) => {
    try {
      // Store registration metadata before redirect (OAuth loses state)
      if (metadata) {
        localStorage.setItem('google_oauth_metadata', JSON.stringify(metadata));
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
      console.error('Google sign in error:', error);
      // Clean up on error
      localStorage.removeItem('google_oauth_metadata');
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
      console.error('Sign out error:', error);
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
      console.error('Reset password error:', error);
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
      console.error('Update password error:', error);
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
      console.error('Update profile error:', error);
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
      console.error('Update coach profile error:', error);
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
      console.error('Update athlete profile error:', error);
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
      console.error('Get athletes error:', error);
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
      console.error('Get coach error:', error);
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
      console.error('Update relationship error:', error);
      return { data: null, error };
    }
  }, []);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (user) {
      const newProfile = await fetchProfile(user.id, user);
      setProfile(newProfile);
      return newProfile;
    }
    return null;
  }, [user, fetchProfile]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isCoach: profile?.role === 'coach',
    isAthlete: profile?.role === 'athlete',
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
