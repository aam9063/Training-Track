import { useState, useEffect, useCallback } from 'react';
import { getTeamHealthSnapshot, updateAthleteInjuryStatus } from '../services/teamHealthService';

export default function useTeamHealth(coachId) {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    if (!coachId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await getTeamHealthSnapshot(coachId);
    setAthletes(data);
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const updateInjury = useCallback(async (athleteId, status, notes = '') => {
    setUpdatingId(athleteId);
    const { error } = await updateAthleteInjuryStatus(athleteId, status, notes);
    if (!error) {
      setAthletes(prev =>
        prev.map(a => a.id === athleteId ? { ...a, injuryStatus: status, injuryNotes: notes } : a)
      );
    }
    setUpdatingId(null);
    return { error };
  }, []);

  return { athletes, loading, updatingId, refresh: load, updateInjury };
}
