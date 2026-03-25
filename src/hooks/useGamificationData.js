import { useState, useEffect, useCallback } from 'react';
import { checkAchievements, getStreak } from '../services/gamificationService';
import { showError } from '../lib/toast';

/**
 * Hook that provides gamification data: streak counters and unlocked achievements.
 * Designed for independent athletes.
 *
 * @param {string|null} userId - athlete's auth UUID
 * @returns {{ loading, dailyStreak, weeklyStreak, achievements, refresh }}
 */
export default function useGamificationData(userId) {
  const [loading, setLoading] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [weeklyStreak, setWeeklyStreak] = useState(0);
  const [achievements, setAchievements] = useState([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [streakResult, achievementsResult] = await Promise.all([
        getStreak(userId),
        checkAchievements(userId),
      ]);

      if (!streakResult.error) {
        setDailyStreak(streakResult.data.dailyStreak);
        setWeeklyStreak(streakResult.data.weeklyStreak);
      }

      if (!achievementsResult.error) {
        setAchievements(achievementsResult.data);
      }
    } catch {
      showError('Error al cargar logros');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, dailyStreak, weeklyStreak, achievements, refresh: load };
}
