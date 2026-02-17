import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAthletes } from '../services/athleteService';
import { getCurrentPMCStatus } from '../services/trainingLoadService';
import { toLocalDateStr } from '../lib/dateUtils';

export default function useCoachMetrics(profileId) {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [sessionsByAthlete, setSessionsByAthlete] = useState({});
  const [pmcByAthlete, setPmcByAthlete] = useState({});
  const [weeklyVolumeByAthlete, setWeeklyVolumeByAthlete] = useState({});

  const loadData = useCallback(async () => {
    if (!profileId) {
      setAthletes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: athletesData } = await getAthletes(profileId);
      setAthletes(athletesData || []);

      if (!athletesData?.length) {
        setSessionsByAthlete({});
        setPmcByAthlete({});
        setWeeklyVolumeByAthlete({});
        setLoading(false);
        return;
      }

      const athleteIds = athletesData.map(a => a.id);
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = toLocalDateStr(startDate);
      const endDateStr = toLocalDateStr(new Date());

      const sessionsPromise = supabase
        .from('training_sessions')
        .select('id, athlete_id, scheduled_date, status, training_type, title')
        .eq('coach_id', profileId)
        .gte('scheduled_date', startDateStr)
        .lte('scheduled_date', endDateStr)
        .in('athlete_id', athleteIds);

      const loadPromise = supabase
        .from('daily_training_load')
        .select('athlete_id, date, total_distance_m, total_duration_s, tss')
        .in('athlete_id', athleteIds)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      const pmcPromise = Promise.allSettled(
        athleteIds.map(async (id) => {
          const status = await getCurrentPMCStatus(id);
          return { athleteId: id, status };
        })
      );

      const [sessionsRes, loadRes, pmcResults] = await Promise.all([
        sessionsPromise,
        loadPromise,
        pmcPromise,
      ]);

      const sessMap = {};
      (sessionsRes.data || []).forEach(s => {
        if (!sessMap[s.athlete_id]) sessMap[s.athlete_id] = [];
        sessMap[s.athlete_id].push(s);
      });
      setSessionsByAthlete(sessMap);

      const volMap = {};
      (loadRes.data || []).forEach(d => {
        if (!volMap[d.athlete_id]) volMap[d.athlete_id] = [];
        volMap[d.athlete_id].push(d);
      });
      setWeeklyVolumeByAthlete(volMap);

      const pmcMap = {};
      pmcResults.forEach(r => {
        if (r.status === 'fulfilled') {
          pmcMap[r.value.athleteId] = r.value.status;
        }
      });
      setPmcByAthlete(pmcMap);
    } catch (error) {
      console.error('Error loading team metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    athletes,
    loading,
    dateRange,
    setDateRange,
    sessionsByAthlete,
    pmcByAthlete,
    weeklyVolumeByAthlete,
  };
}
