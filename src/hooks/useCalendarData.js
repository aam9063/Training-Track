import { useState, useEffect, useCallback } from 'react';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Shared calendar data hook for both coach and athlete calendars.
 * Uses numeric month/year state to guarantee React re-renders on change.
 * (Date objects can cause React 19 bailouts due to Object.is comparison.)
 * @param {string} entityId - coachId or athleteId
 * @param {Function} fetchFn - (entityId, year, month, startDate, endDate) => Promise<{ sessions, competitions }>
 */
export default function useCalendarData(entityId, fetchFn) {
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return { m: now.getMonth(), y: now.getFullYear() };
  });
  const [sessions, setSessions] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const currentMonth = monthYear.m;
  const currentYear = monthYear.y;
  const currentDate = new Date(currentYear, currentMonth, 1);

  const loadData = useCallback(async () => {
    if (!entityId) {
      setSessions([]);
      setCompetitions([]);
      setLoading(false);
      return;
    }

    if (initialLoad) setLoading(true);
    try {
      const month = currentMonth + 1;
      const padStart = new Date(currentYear, currentMonth, 1);
      padStart.setDate(padStart.getDate() - 7);
      const padEnd = new Date(currentYear, currentMonth + 1, 0);
      padEnd.setDate(padEnd.getDate() + 7);

      const startDate = toLocalDateStr(padStart);
      const endDate = toLocalDateStr(padEnd);

      const result = await fetchFn(entityId, currentYear, month, startDate, endDate);
      setSessions(result.sessions || []);
      setCompetitions(result.competitions || []);
    } catch {
      setSessions([]);
      setCompetitions([]);
    } finally {
      setLoading(false);
      if (initialLoad) setInitialLoad(false);
    }
  }, [entityId, currentMonth, currentYear, fetchFn, initialLoad]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToPreviousMonth = useCallback(() => {
    setMonthYear(prev => {
      if (prev.m === 0) return { m: 11, y: prev.y - 1 };
      return { m: prev.m - 1, y: prev.y };
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonthYear(prev => {
      if (prev.m === 11) return { m: 0, y: prev.y + 1 };
      return { m: prev.m + 1, y: prev.y };
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setMonthYear({ m: now.getMonth(), y: now.getFullYear() });
  }, []);

  const setCurrentDate = useCallback((dateOrFn) => {
    const resolve = (d) => setMonthYear({ m: d.getMonth(), y: d.getFullYear() });
    if (typeof dateOrFn === 'function') {
      setMonthYear(prev => {
        const prevDate = new Date(prev.y, prev.m, 1);
        const next = dateOrFn(prevDate);
        return { m: next.getMonth(), y: next.getFullYear() };
      });
    } else {
      resolve(dateOrFn);
    }
  }, []);

  return {
    currentDate,
    setCurrentDate,
    currentMonth,
    currentYear,
    sessions,
    competitions,
    loading,
    loadData,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
  };
}
