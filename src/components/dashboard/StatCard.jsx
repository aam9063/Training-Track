import { motion } from 'framer-motion';

const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue', trend }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
          )}
          {trend && (
            <div
              className={`mt-2 inline-flex items-center text-xs sm:text-sm font-medium ${
                trend > 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div
          className={`
            w-10 h-10 sm:w-12 sm:h-12 rounded-lg
            bg-gradient-to-br ${colorClasses[color]}
            flex items-center justify-center
            flex-shrink-0
          `}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
