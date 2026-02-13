import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiZap } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { getReadinessScore } from '../../services/trainingLoadService';

const getScoreColor = (score) => {
  if (score >= 80) return { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-500', stroke: '#10B981' };
  if (score >= 60) return { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', ring: 'ring-yellow-500', stroke: '#F59E0B' };
  if (score >= 40) return { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', ring: 'ring-orange-500', stroke: '#F97316' };
  return { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-500', stroke: '#EF4444' };
};

const getScoreLabel = (score) => {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bueno';
  if (score >= 40) return 'Moderado';
  return 'Baja disponibilidad';
};

const getRecommendation = (score) => {
  if (score >= 80) return 'Día ideal para sesión de calidad o competición';
  if (score >= 60) return 'Apto para entrenamiento normal';
  if (score >= 40) return 'Considera reducir intensidad hoy';
  return 'Prioriza descanso o rodaje suave';
};

export default function ReadinessScore({ onRefresh }) {
  const { user, profile } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadScore = async () => {
    const athleteId = profile?.id || user?.id;
    if (!athleteId) return;
    try {
      const result = await getReadinessScore(athleteId);
      setData(result);
    } catch (err) {
      console.error('Error loading readiness:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScore();
  }, [user, profile]);

  // Refresh when wellness is saved
  useEffect(() => {
    if (onRefresh) loadScore();
  }, [onRefresh]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-full w-16 mx-auto" />
      </div>
    );
  }

  if (!data) return null;

  const { score, tsb, ctl, atl, acwr } = data;
  const colors = getScoreColor(score);

  // SVG circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colors.bg} rounded-xl border border-gray-200 dark:border-gray-700 p-4`}
    >
      <div className="flex items-start gap-4">
        {/* Circular Score */}
        <div className="relative flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 48 48)"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${colors.text}`}>{score}</span>
            <span className="text-[9px] text-gray-500 dark:text-gray-400">/ 100</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FiZap className={`w-4 h-4 ${colors.text}`} />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Readiness Score</h3>
          </div>
          <p className={`text-lg font-bold ${colors.text} mb-1`}>{getScoreLabel(score)}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{getRecommendation(score)}</p>

          {/* Mini metrics */}
          <div className="flex gap-3 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
            {ctl !== null && <span>CTL: {Math.round(ctl)}</span>}
            {tsb !== null && <span>TSB: {Math.round(tsb) > 0 ? '+' : ''}{Math.round(tsb)}</span>}
            {acwr !== null && <span>ACWR: {acwr.toFixed(2)}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
