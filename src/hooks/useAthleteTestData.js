import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function useAthleteTestData(athleteId) {
  const [athletePaces, setAthletePaces] = useState([]);
  const [latestVam, setLatestVam] = useState(null);
  const [latestConconiTest, setLatestConconiTest] = useState(null);
  const [personalBests, setPersonalBests] = useState([]);

  useEffect(() => {
    const loadTestData = async () => {
      if (!athleteId) return;
      try {
        const [pacesRes, vamRes, conconiRes, pbRes] = await Promise.all([
          supabase.from('athlete_paces').select('*').eq('athlete_id', athleteId).is('valid_until', null).order('pace_code', { ascending: true }),
          supabase.from('vam_tests').select('*').eq('athlete_id', athleteId).order('test_date', { ascending: false }).limit(1),
          supabase.from('conconi_tests').select('*, conconi_test_series(*)').eq('athlete_id', athleteId).order('test_date', { ascending: false }).limit(1),
          supabase.from('personal_bests').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
        ]);
        setAthletePaces(pacesRes.data || []);
        setLatestVam(vamRes.data?.[0] || null);
        setLatestConconiTest(conconiRes.data?.[0] || null);
        setPersonalBests(pbRes.data || []);
      } catch (err) {
        console.error('Error loading test data:', err);
      }
    };
    loadTestData();
  }, [athleteId]);

  return { athletePaces, latestVam, latestConconiTest, personalBests };
}
