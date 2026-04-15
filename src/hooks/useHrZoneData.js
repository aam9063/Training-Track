import { useMemo } from 'react';
import { calculateHRZones } from '../lib/trainingMetrics';

/**
 * Pure hook that builds HR-zone data (Karvonen) and distributes activities
 * across zones by average_heartrate.
 */
export default function useHrZoneData({ rawActivities, maxHeartRate, restingHeartRate, estimatedAge }) {
  return useMemo(() => {
    const maxHR = maxHeartRate || (estimatedAge ? 220 - estimatedAge : null);
    if (!maxHR) return null;
    const restingHR = restingHeartRate || 60;
    const zones = calculateHRZones(maxHR, restingHR);

    const hrActivities = (rawActivities || []).filter((a) => a.average_heartrate);
    zones.forEach((z) => { z.count = 0; });
    hrActivities.forEach((a) => {
      const hr = a.average_heartrate;
      for (let i = zones.length - 1; i >= 0; i -= 1) {
        if (hr >= zones[i].bpmMin) {
          zones[i].count += 1;
          break;
        }
      }
    });

    return { zones, maxHR, restingHR, totalHRActivities: hrActivities.length };
  }, [rawActivities, maxHeartRate, restingHeartRate, estimatedAge]);
}
