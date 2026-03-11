import { useState, useEffect, useCallback } from 'react';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Shared calendar data hook for both coach and athlete calendars.
 * Loads data for the full month + 7-day padding on each side (for weekly views
 * that straddle month boundaries).
 * @param {string} entityId - coachId or athleteId
 * @param {Function} fetchFn - (entityId, year, month, startDate, endDate) => Promise<{ sessions, competitions }>
 */
export default function useCalendarData(entityId, fetchFn) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const loadData = useCallback(async () => {
    if (!entityId) {
      setSessions([]);
      setCompetitions([]);
      setLoading(false);
      return;
    }

    // Only show full-page spinner on initial load, not on refreshes (e.g. after DnD)
    if (initialLoad) setLoading(true);
    try {
      const year = currentYear;
      const month = currentMonth + 1;
      // Pad ±7 days for weekly views that cross month boundaries
      const padStart = new Date(year, month - 1, 1);
      padStart.setDate(padStart.getDate() - 7);
      const padEnd = new Date(year, month, 0);
      padEnd.setDate(padEnd.getDate() + 7);

      const startDate = toLocalDateStr(padStart);
      const endDate = toLocalDateStr(padEnd);

      const result = await fetchFn(entityId, year, month, startDate, endDate);
      setSessions(result.sessions || []);
      setCompetitions(result.competitions || []);
    } catch (error) {
      console.error('Error loading calendar data:', error);
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
