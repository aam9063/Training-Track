import { supabase } from '../lib/supabase';

/**
 * Service for admin dashboard operations.
 * All functions require the caller to be an admin (enforced by RLS).
 */

// Get platform-wide statistics
export const getAdminStats = async () => {
  try {
    const [usersRes, coachesRes, athletesRes, activeRelsRes, sessionsRes] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'athlete'),
      supabase.from('coach_athlete_relationship').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('training_sessions').select('*', { count: 'exact', head: true }),
    ]);

    return {
      data: {
        totalUsers: usersRes.count || 0,
        totalCoaches: coachesRes.count || 0,
        totalAthletes: athletesRes.count || 0,
        activeRelationships: activeRelsRes.count || 0,
        totalSessions: sessionsRes.count || 0,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return { data: null, error };
  }
};

// Get all users with role-specific data
export const getAllUsers = async ({ search = '', roleFilter = 'all', statusFilter = 'all' } = {}) => {
  try {
    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }
    if (statusFilter !== 'all') {
      query = query.eq('is_active', statusFilter === 'active');
    }

    const { data: users, error: usersError } = await query;
    if (usersError) throw usersError;
    if (!users || users.length === 0) return { data: [], error: null };

    // Fetch coaches and athletes data in parallel
    const coachIds = users.filter(u => u.role === 'coach').map(u => u.id);
    const athleteIds = users.filter(u => u.role === 'athlete').map(u => u.id);

    const [coachesRes, athletesRes] = await Promise.all([
      coachIds.length > 0
        ? supabase.from('coaches').select('id, subscription_plan, max_athletes').in('id', coachIds)
        : { data: [] },
      athleteIds.length > 0
        ? supabase.from('athletes').select('id, specialties').in('id', athleteIds)
        : { data: [] },
    ]);

    // Combine
    let combined = users.map(user => {
      if (user.role === 'coach') {
        const coach = coachesRes.data?.find(c => c.id === user.id);
        return { ...user, coach };
      } else {
        const athlete = athletesRes.data?.find(a => a.id === user.id);
        return { ...user, athlete };
      }
    });

    // Client-side search filter (name or email)
    if (search.trim()) {
      const s = search.toLowerCase();
      combined = combined.filter(u =>
        u.first_name?.toLowerCase().includes(s) ||
        u.last_name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s)
      );
    }

    return { data: combined, error: null };
  } catch (error) {
    console.error('Error fetching all users:', error);
    return { data: [], error };
  }
};

// Toggle user active status
export const toggleUserActive = async (userId, isActive) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error toggling user active:', error);
    return { data: null, error };
  }
};

// Update coach subscription plan
export const updateCoachSubscription = async (coachId, { subscription_plan, max_athletes }) => {
  try {
    const updates = {};
    if (subscription_plan !== undefined) updates.subscription_plan = subscription_plan;
    if (max_athletes !== undefined) updates.max_athletes = max_athletes;

    const { data, error } = await supabase
      .from('coaches')
      .update(updates)
      .eq('id', coachId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating coach subscription:', error);
    return { data: null, error };
  }
};

// Get detailed user info
export const getUserDetail = async (userId) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    let roleData = null;
    let relationships = [];

    if (user.role === 'coach') {
      const [coachRes, relsRes] = await Promise.all([
        supabase.from('coaches').select('*').eq('id', userId).single(),
        supabase.from('coach_athlete_relationship').select('id, athlete_id, status, start_date').eq('coach_id', userId),
      ]);
      roleData = coachRes.data;
      relationships = relsRes.data || [];

      if (relationships.length > 0) {
        const athleteIds = relationships.map(r => r.athlete_id);
        const { data: athleteUsers } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', athleteIds);

        relationships = relationships.map(r => {
          const au = athleteUsers?.find(u => u.id === r.athlete_id);
          return {
            ...r,
            name: au ? `${au.first_name} ${au.last_name}` : 'Desconocido',
            email: au?.email || '',
          };
        });
      }
    } else if (user.role === 'athlete') {
      const [athleteRes, relsRes] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', userId).single(),
        supabase.from('coach_athlete_relationship').select('id, coach_id, status, start_date').eq('athlete_id', userId),
      ]);
      roleData = athleteRes.data;
      relationships = relsRes.data || [];

      if (relationships.length > 0) {
        const coachIds = relationships.map(r => r.coach_id);
        const { data: coachUsers } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', coachIds);

        relationships = relationships.map(r => {
          const cu = coachUsers?.find(u => u.id === r.coach_id);
          return {
            ...r,
            name: cu ? `${cu.first_name} ${cu.last_name}` : 'Desconocido',
            email: cu?.email || '',
          };
        });
      }
    }

    return {
      data: { ...user, roleData, relationships },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching user detail:', error);
    return { data: null, error };
  }
};
