import { useMemo } from 'react';
import { calculateVdot, predictAllRaceTimes } from '../lib/trainingMetrics';

const PB_DISTANCE_MAP = {
  '1 km': { name: '1 km', meters: 1000 },
  '1k': { name: '1 km', meters: 1000 },
  '1 Milla': { name: '1 Milla', meters: 1609 },
  '1 mile': { name: '1 Milla', meters: 1609 },
  '5 km': { name: '5 km', meters: 5000 },
  '5k': { name: '5 km', meters: 5000 },
  '10 km': { name: '10 km', meters: 10000 },
  '10k': { name: '10 km', meters: 10000 },
  'Media Maratón': { name: 'Media Maratón', meters: 21097 },
  'Half-Marathon': { name: 'Media Maratón', meters: 21097 },
  'Maratón': { name: 'Maratón', meters: 42195 },
  'Marathon': { name: 'Maratón', meters: 42195 },
};

/**
 * Pure hook that merges Strava best efforts with DB personal bests, derives the
 * best VDOT, and returns race-time predictions via the Daniels-Gilbert model.
 */
export default function useRacePredictions({ bestEfforts, dbPersonalBests, storedVdot }) {
  return useMemo(() => {
    let vdot = storedVdot;

    if (!vdot) {
      const allEfforts = [...(bestEfforts || [])];

      if (dbPersonalBests?.length) {
        dbPersonalBests.forEach((pb) => {
          const mapped = PB_DISTANCE_MAP[pb.distance];
          if (!mapped) return;
          const existing = allEfforts.find((e) => e.name === mapped.name);
          if (!existing || pb.time_seconds < existing.time) {
            const idx = allEfforts.findIndex((e) => e.name === mapped.name);
            const entry = {
              name: mapped.name,
              distance: mapped.meters,
              time: pb.time_seconds,
              date: pb.date,
            };
            if (idx >= 0) allEfforts[idx] = entry;
            else allEfforts.push(entry);
          }
        });
      }

      if (!allEfforts.length) return null;

      let bestVdot = 0;
      let bestRef = null;
      for (const e of allEfforts) {
        if (!e.distance || !e.time) continue;
        const v = calculateVdot(e.distance, e.time / 60);
        if (v && v > bestVdot) {
          bestVdot = v;
          bestRef = e;
        }
      }

      if (!bestVdot || !bestRef) return null;
      vdot = bestVdot;
    }

    const predictions = predictAllRaceTimes(vdot);
    if (!predictions) return null;

    return { vdot: Math.round(vdot * 10) / 10, predictions };
  }, [bestEfforts, dbPersonalBests, storedVdot]);
}
