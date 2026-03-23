import { supabase } from '../lib/supabase';

/**
 * Service for admin dashboard operations.
 * All operations go through the admin-api Edge Function
 * which verifies admin role server-side and uses service_role.
 */

const callAdminApi = async (action, payload = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No session');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Admin API error: ${response.status}`);
  }

  return response.json();
};

// Get platform-wide statistics
export const getAdminStats = async () => {
  try {
    const data = await callAdminApi('get_stats');
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Get all users with role-specific data
export const getAllUsers = async ({ search = '', roleFilter = 'all', statusFilter = 'all' } = {}) => {
  try {
    let users = await callAdminApi('get_all_users', { roleFilter, statusFilter });

    // Client-side search filter (name or email)
    if (search.trim()) {
      const s = search.toLowerCase();
      users = users.filter(u =>
        u.first_name?.toLowerCase().includes(s) ||
        u.last_name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s)
      );
    }

    return { data: users, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

// Toggle user active status
export const toggleUserActive = async (userId, isActive) => {
  try {
    const data = await callAdminApi('toggle_user_active', { userId, isActive });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Update coach subscription plan
export const updateCoachSubscription = async (coachId, { subscription_plan, max_athletes }) => {
  try {
    const data = await callAdminApi('update_coach_subscription', {
      coachId,
      subscription_plan,
      max_athletes,
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Get waitlist entries
export const getWaitlist = async () => {
  try {
    const data = await callAdminApi('get_waitlist');
    return { data, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

// Delete waitlist entry
export const deleteWaitlistEntry = async (entryId) => {
  try {
    const data = await callAdminApi('delete_waitlist_entry', { entryId });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Get detailed user info
export const getUserDetail = async (userId) => {
  try {
    const data = await callAdminApi('get_user_detail', { userId });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};
