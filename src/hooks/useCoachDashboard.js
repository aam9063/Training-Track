import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCoachStats,
  getCoachWeekSessions,
  getRecentAthletes,
} from '../services/dashboardService';
import { getWeekStartDate } from '../services/weeklyTrainingService';

const EMPTY_STATS = { totalAthletes: 0, weekSessions: 0, completedSessions: 0, completionRate: 0 };

export default function useCoachDashboard(profileId) {
  const [stats, setStats] = useState(null);
  const [recentAthletes, setRecentAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStartDate(new Date()));
  const [weekSessions, setWeekSessions] = useState([]);
  const [weekLoading, setWeekLoading] = useState(false);

  const hasFetched = useRef(false);
  const currentProfileId = useRef(null);

  const loadDashboardData = useCallback(async (id) => {
    if (!id) {
      setStats(EMPTY_STATS);
      setRecentAthletes([]);
      setLoading(false);
      return;
    }

    if (hasFetched.current && currentProfileId.current === id) return;

    setLoading(true);
    setError(null);
    hasFetched.current = true;
    currentProfileId.current = id;

    try {
      const [statsRes, athletesRes] = await Promise.all([
        getCoachStats(id),
        getRecentAthletes(id, 5),
      ]);

      setStats(statsRes.data || EMPTY_STATS);
      setRecentAthletes(athletesRes.data || []);
    } catch (err) {
      console.error('Dashboard: Error loading data:', err);
      setError(err.message);
      setStats(EMPTY_STATS);
      setRecentAthletes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileId && profileId !== currentProfileId.current) {
      hasFetched.current = false;
      loadDashboardData(profileId);
    } else if (!profileId && !hasFetched.current) {
      const timer = setTimeout(() => {
        if (!profileId) {
          setLoading(false);
          setStats(EMPTY_STATS);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [profileId, loadDashboardData]);

  const loadWeekSessions = useCallback(async (weekStart) => {
    if (!profileId) return;
    setWeekLoading(true);
    try {
      const res = await getCoachWeekSessions(profileId, weekStart);
      setWeekSessions(res.data || []);
    } catch (err) {
      console.error('Error loading week sessions:', err);
      setWeekSessions([]);
    } finally {
      setWeekLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (profileId) {
      loadWeekSessions(currentWeekStart);
    }
  }, [currentWeekStart, profileId, loadWeekSessions]);

  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setCurrentWeekStart(getWeekStartDate(new Date()));
  }, []);

  return {
    stats,
    recentAthletes,
    loading,
    error,
    currentWeekStart,
    weekSessions,
    weekLoading,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
  };
}
