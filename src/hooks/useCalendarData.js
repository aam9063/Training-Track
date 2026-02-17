import { useState, useEffect, useCallback } from 'react';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Shared calendar data hook for both coach and athlete calendars.
 * @param {string} entityId - coachId or athleteId
 * @param {Function} fetchFn - (entityId, year, month, startDate, endDate) => Promise<{ sessions, competitions }>
 */
export default function useCalendarData(entityId, fetchFn) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const loadData = useCallback(async () => {
    if (!entityId) {
      setSessions([]);
      setCompetitions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const year = currentYear;
      const month = currentMonth + 1;
      const startDate = toLocalDateStr(new Date(year, month - 1, 1));
      const endDate = toLocalDateStr(new Date(year, month, 0));

      const result = await fetchFn(entityId, year, month, startDate, endDate);
      setSessions(result.sessions || []);
      setCompetitions(result.competitions || []);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setSessions([]);
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, currentMonth, currentYear, fetchFn]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  return {
    currentDate,
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
