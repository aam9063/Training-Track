import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Service for dashboard data and statistics
 * Optimized queries with proper error handling
 */

// Get coach dashboard statistics
export const getCoachStats = async (coachId) => {
  if (!coachId) {
    console.warn('getCoachStats: No coachId provided');
    return { data: { totalAthletes: 0, weekSessions: 0, completedSessions: 0, completionRate: 0 }, error: null };
  }

  try {
    // Get total athletes
    const { count: totalAthletes, error: athletesError } = await supabase
      .from('coach_athlete_relationship')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'active');

    if (athletesError) {
      console.error('Error fetching athletes count:', athletesError);
    }

    // Get start of week (Monday)
    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get total sessions this week
    const { count: weekSessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .gte('scheduled_date', toLocalDateStr(startOfWeek));

    if (sessionsError) {
      console.error('Error fetching week sessions:', sessionsError);
    }

    // Get completed sessions this week
    const { count: completedSessions, error: completedError } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'completed')
      .gte('scheduled_date', toLocalDateStr(startOfWeek));

    if (completedError) {
      console.error('Error fetching completed sessions:', completedError);
    }

    const total = totalAthletes || 0;
    const week = weekSessions || 0;
    const completed = completedSessions || 0;

    return {
      data: {
        totalAthletes: total,
        weekSessions: week,
        completedSessions: completed,
        completionRate: week > 0 ? Math.round((completed / week) * 100) : 0,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching coach stats:', error);
    return {
      data: { totalAthletes: 0, weekSessions: 0, completedSessions: 0, completionRate: 0 },
      error,
    };
  }
};

// Get today's sessions for coach
export const getTodaySessions = async (coachId) => {
  if (!coachId) {
    console.warn('getTodaySessions: No coachId provided');
    return { data: [], error: null };
  }

  try {
    const today = toLocalDateStr(new Date());

    // First get sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('coach_id', coachId)
      .eq('scheduled_date', today)
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return { data: [], error: sessionsError };
    }

    if (!sessions || sessions.length === 0) {
      return { data: [], error: null };
    }

    // Get athlete IDs
    const athleteIds = [...new Set(sessions.map(s => s.athlete_id))];

    // Fetch athletes and users separately
    const { data: athletes, error: athletesError } = await supabase
      .from('athletes')
      .select('id')
      .in('id', athleteIds);

    if (athletesError) {
      console.error('Error fetching athletes:', athletesError);
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, profile_image')
      .in('id', athleteIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    // Combine data
    const sessionsWithAthletes = sessions.map(session => {
      const user = users?.find(u => u.id === session.athlete_id) || {};
      return {
        ...session,
        athleteName: user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : 'Atleta',
        athleteImage: user.profile_image || null,
      };
    });

    return { data: sessionsWithAthletes, error: null };
  } catch (error) {
    console.error('Error fetching today sessions:', error);
    return { data: [], error };
  }
};

// Get recent athletes for quick access
export const getRecentAthletes = async (coachId, limit = 5) => {
  if (!coachId) {
    console.warn('getRecentAthletes: No coachId provided');
    return { data: [], error: null };
  }

  try {
    // First get relationships
    const { data: relationships, error: relError } = await supabase
      .from('coach_athlete_relationship')
      .select('id, athlete_id, start_date')
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(limit);

    if (relError) {
      console.error('Error fetching relationships:', relError);
      return { data: [], error: relError };
    }

    if (!relationships || relationships.length === 0) {
      return { data: [], error: null };
    }

    const athleteIds = relationships.map(r => r.athlete_id);

    // Fetch athletes data
    const { data: athletes, error: athletesError } = await supabase
      .from('athletes')
      .select('id, specialties')
      .in('id', athleteIds);

    if (athletesError) {
      console.error('Error fetching athletes:', athletesError);
    }

    // Fetch users data
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, profile_image')
      .in('id', athleteIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    // Combine data maintaining order
    const athletesList = relationships.map(rel => {
      const athlete = athletes?.find(a => a.id === rel.athlete_id) || {};
      const user = users?.find(u => u.id === rel.athlete_id) || {};

      return {
        id: rel.athlete_id,
        firstName: user.first_name || 'Sin',
        lastName: user.last_name || 'nombre',
        profileImage: user.profile_image || null,
        specialties: athlete.specialties || [],
      };
    });

    return { data: athletesList, error: null };
  } catch (error) {
    console.error('Error fetching recent athletes:', error);
    return { data: [], error };
  }
};

// Get week sessions for coach (for weekly calendar view)
export const getCoachWeekSessions = async (coachId, weekStartDate) => {
  if (!coachId) {
    return { data: [], error: null };
  }

  try {
    const startDateStr = toLocalDateStr(weekStartDate);
    const endDate = new Date(weekStartDate);
    endDate.setDate(endDate.getDate() + 6);
    const endDateStr = toLocalDateStr(endDate);

    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('coach_id', coachId)
      .gte('scheduled_date', startDateStr)
      .lte('scheduled_date', endDateStr)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (sessionsError) {
      console.error('Error fetching week sessions:', sessionsError);
      return { data: [], error: sessionsError };
    }

    if (!sessions || sessions.length === 0) {
      return { data: [], error: null };
    }

    const athleteIds = [...new Set(sessions.map(s => s.athlete_id))];

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, profile_image')
      .in('id', athleteIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    const sessionsWithAthletes = sessions.map(session => {
      const user = users?.find(u => u.id === session.athlete_id) || {};
      return {
        ...session,
        athleteName: user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : 'Atleta',
        athleteImage: user.profile_image || null,
      };
    });

    return { data: sessionsWithAthletes, error: null };
  } catch (error) {
    console.error('Error fetching coach week sessions:', error);
    return { data: [], error };
  }
};

// Get weekly training summary for all athletes
export const getWeeklySummary = async (coachId) => {
  if (!coachId) {
    console.warn('getWeeklySummary: No coachId provided');
    return { data: {}, error: null };
  }

  try {
    // Get last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const { data, error } = await supabase
      .from('training_sessions')
      .select('scheduled_date, status')
      .eq('coach_id', coachId)
      .gte('scheduled_date', toLocalDateStr(startDate))
      .lte('scheduled_date', toLocalDateStr(endDate));

    if (error) {
      console.error('Error fetching weekly summary:', error);
      return { data: {}, error };
    }

    // Group by date
    const summary = {};
    (data || []).forEach(session => {
      if (!summary[session.scheduled_date]) {
        summary[session.scheduled_date] = { total: 0, completed: 0 };
      }
      summary[session.scheduled_date].total++;
      if (session.status === 'completed') {
        summary[session.scheduled_date].completed++;
      }
    });

    return { data: summary, error: null };
  } catch (error) {
    console.error('Error fetching weekly summary:', error);
    return { data: {}, error };
  }
};
