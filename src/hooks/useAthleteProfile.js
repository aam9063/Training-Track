import { useState, useEffect, useCallback } from 'react';
import { getAthleteProfile } from '../services/athleteProfileService';

/**
 * Hook to fetch and manage an athlete's profile.
 * Returns profile data, loading/error states, and a refresh function.
 *
 * @param {string|null} userId - UUID of the athlete user
 */
export default function useAthleteProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getAthleteProfile(userId);

    if (fetchError) {
      setError(fetchError.message ?? 'Error al cargar el perfil');
      setProfile(null);
    } else {
      setProfile(data);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refresh: fetchProfile };
}
