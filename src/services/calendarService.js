import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Service for managing calendar events and sessions
 * Optimized queries without complex joins
 */

// Get sessions for a specific month
export const getMonthSessions = async (coachId, year, month, overrideStart, overrideEnd) => {
  if (!coachId) {
    console.warn('getMonthSessions: No coachId provided');
    return { data: [], error: null };
  }

  try {
    // Use overridden range if provided (for weekly views crossing month boundaries)
    const startDate = overrideStart || toLocalDateStr(new Date(year, month - 1, 1));
    const endDate = overrideEnd || toLocalDateStr(new Date(year, month, 0));

    // Step 1: Get sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('coach_id', coachId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return { data: [], error: sessionsError };
    }

    if (!sessions || sessions.length === 0) {
      return { data: [], error: null };
    }

    // Step 2: Get unique athlete IDs
    const athleteIds = [...new Set(sessions.map(s => s.athlete_id))];

    // Step 3: Fetch users for athletes
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, profile_image')
      .in('id', athleteIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    // Step 4: Transform data for calendar
    const transformedSessions = sessions.map(session => {
      const user = users?.find(u => u.id === session.athlete_id) || {};

      return {
        id: session.id,
        title: session.title,
        date: session.scheduled_date,
        time: session.scheduled_time,
        type: session.training_type,
        status: session.status,
        athleteId: session.athlete_id,
        athleteName: user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : 'Atleta',
        athleteImage: user.profile_image || null,
        description: session.description,
        notes_coach: session.notes_coach,
        notes_athlete: session.notes_athlete,
        estimated_duration_minutes: session.estimated_duration_minutes,
        actual_duration_minutes: session.actual_duration_minutes,
        rpe_score: session.rpe_score,
        rpe_notes: session.rpe_notes,
        completed_at: session.completed_at,
      };
    });

    return { data: transformedSessions, error: null };
  } catch (error) {
    console.error('Error fetching month sessions:', error);
    return { data: [], error };
  }
};

// Get a single session by ID
export const getSession = async (sessionId) => {
  if (!sessionId) {
    return { data: null, error: new Error('No sessionId provided') };
  }

  try {
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return { data: null, error: sessionError };
    }

    // Get athlete user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, profile_image')
      .eq('id', session.athlete_id)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
    }

    return {
      data: {
        ...session,
        athleteName: user ? `${user.first_name} ${user.last_name}` : 'Atleta',
        athleteImage: user?.profile_image || null,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching session:', error);
    return { data: null, error };
  }
};

// Create a new training session
export const createSession = async (sessionData) => {
  if (!sessionData) {
    return { data: null, error: new Error('No session data provided') };
  }

  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .insert([sessionData])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating session:', error);
    return { data: null, error };
  }
};

// Update a training session
export const updateSession = async (sessionId, updates) => {
  if (!sessionId) {
    return { data: null, error: new Error('No sessionId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating session:', error);
    return { data: null, error };
  }
};

// Delete a training session
export const deleteSession = async (sessionId) => {
  if (!sessionId) {
    return { error: new Error('No sessionId provided') };
  }

  try {
    const { error } = await supabase
      .from('training_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting session:', error);
    return { error };
  }
};

// Get sessions for a specific month (athlete perspective)
export const getAthleteMonthSessions = async (athleteId, year, month, overrideStart, overrideEnd) => {
  if (!athleteId) {
    console.warn('getAthleteMonthSessions: No athleteId provided');
    return { data: [], error: null };
  }

  try {
    // Use overridden range if provided (for weekly views crossing month boundaries)
    const startDate = overrideStart || toLocalDateStr(new Date(year, month - 1, 1));
    const endDate = overrideEnd || toLocalDateStr(new Date(year, month, 0));

    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('athlete_id', athleteId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (sessionsError) {
      console.error('Error fetching athlete sessions:', sessionsError);
      return { data: [], error: sessionsError };
    }

    if (!sessions || sessions.length === 0) {
      return { data: [], error: null };
    }

    const transformedSessions = sessions.map(session => ({
      id: session.id,
      title: session.title,
      date: session.scheduled_date,
      time: session.scheduled_time,
      type: session.training_type,
      status: session.status,
      description: session.description,
      notes_coach: session.notes_coach,
      notes_athlete: session.notes_athlete,
      estimated_duration_minutes: session.estimated_duration_minutes,
      actual_duration_minutes: session.actual_duration_minutes,
      rpe_score: session.rpe_score,
      rpe_notes: session.rpe_notes,
      completed_at: session.completed_at,
    }));

    return { data: transformedSessions, error: null };
  } catch (error) {
    console.error('Error fetching athlete month sessions:', error);
    return { data: [], error };
  }
};

// Reschedule a session to a new date (for drag & drop)
export const rescheduleSession = async (sessionId, newDate) => {
  if (!sessionId || !newDate) {
    return { data: null, error: new Error('Missing sessionId or newDate') };
  }

  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .update({ scheduled_date: newDate })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error rescheduling session:', error);
    return { data: null, error };
  }
};

// Get Conconi tests for calendar
export const getConconiTests = async (coachId, startDate, endDate) => {
  if (!coachId) {
    return { data: [], error: null };
  }

  try {
    // Get tests
    const { data: tests, error: testsError } = await supabase
      .from('conconi_tests')
      .select('*')
      .eq('coach_id', coachId)
      .gte('test_date', startDate)
      .lte('test_date', endDate)
      .order('test_date', { ascending: true });

    if (testsError) {
      console.error('Error fetching Conconi tests:', testsError);
      return { data: [], error: testsError };
    }

    if (!tests || tests.length === 0) {
      return { data: [], error: null };
    }

    // Get athlete IDs
    const athleteIds = [...new Set(tests.map(t => t.athlete_id))];

    // Get users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', athleteIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    // Transform
    const transformedTests = tests.map(test => {
      const user = users?.find(u => u.id === test.athlete_id) || {};
      return {
        ...test,
        athleteName: user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : 'Atleta',
      };
    });

    return { data: transformedTests, error: null };
  } catch (error) {
    console.error('Error fetching Conconi tests:', error);
    return { data: [], error };
  }
};
