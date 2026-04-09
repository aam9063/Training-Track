// ---------------------------------------------------------------------------
// Shared test-calculation helpers for Conconi & VAM data
// Used by Training.jsx and MyPlan.jsx
// ---------------------------------------------------------------------------

/** Pace order from fastest to slowest */
export const PACE_ORDER = ['RM', 'R10', 'R9', 'R8', 'R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1', 'RR'];

/** Background colour class per pace code */
export const BG_COLORS = {
  RM: 'bg-red-600',
  R10: 'bg-red-500',
  R9: 'bg-red-400',
  R8: 'bg-orange-500',
  R7: 'bg-orange-400',
  R6: 'bg-yellow-500',
  R5: 'bg-yellow-400',
  R4: 'bg-lime-400',
  R3: 'bg-lime-500',
  R2: 'bg-green-400',
  R1: 'bg-green-500',
  RR: 'bg-emerald-600',
};

/** %FCMax labels per pace code */
export const PCT_LABELS = {
  RM: '100%',
  R10: '92%',
  R9: '90%',
  R8: '88%',
  R7: '86%',
  R6: '84%',
  R5: '82%',
  R4: '78%',
  R3: '72%',
  R2: '62%',
  R1: '50%',
  RR: '42%',
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format seconds-per-km as  m'ss"  (e.g. 4'05") */
export const fmtPaceTest = (secs) => {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
};

/** Format recovery time – same as fmtPaceTest but returns '' for falsy input
 *  and drops trailing seconds when they are zero (e.g. 2') */
export const fmtRecTest = (secs) => {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}'${String(s).padStart(2, '0')}"` : `${m}'`;
};

/** Alias kept for VAM display – identical to fmtPaceTest */
export const fmtVamP = fmtPaceTest;

// ---------------------------------------------------------------------------
// Conconi derived data
// ---------------------------------------------------------------------------

/**
 * Compute all Conconi-derived values from raw athlete paces and latest test.
 *
 * @param {Array}  athletePaces       – rows from athlete_paces
 * @param {Object} latestConconiTest  – latest conconi test row (nullable)
 * @returns {{ sortedPaces, seriesRecovery, conconiMaxHr, conconiR10, conconiFirstRecov }}
 */
export const computeConconiData = (athletePaces, latestConconiTest) => {
  const sortedPaces = PACE_ORDER
    .map((code) => athletePaces.find((p) => p.pace_code === code))
    .filter(Boolean);

  const seriesRecovery = (() => {
    const rec = {};
    if (latestConconiTest?.conconi_test_series) {
      const series = [...latestConconiTest.conconi_test_series].sort(
        (a, b) => a.series_number - b.series_number,
      );
      sortedPaces.forEach((pace, i) => {
        if (pace.pace_code === 'RR') return;
        const idx = Math.round((i / (sortedPaces.length - 1)) * (series.length - 1));
        const s = series[Math.min(idx, series.length - 1)];
        if (s?.recovery_time_seconds) rec[pace.pace_code] = s.recovery_time_seconds;
      });
    }
    return rec;
  })();

  const conconiMaxHr = latestConconiTest?.max_hr_reached;
  const conconiR10 = sortedPaces.find((p) => p.pace_code === 'R10');
  const conconiFirstRecov = Object.values(seriesRecovery)[0];

  return { sortedPaces, seriesRecovery, conconiMaxHr, conconiR10, conconiFirstRecov };
};

// ---------------------------------------------------------------------------
// VAM derived data
// ---------------------------------------------------------------------------

/**
 * Compute VAM-derived training zones.
 *
 * @param {Object} latestVam    – latest VAM test row (nullable)
 * @param {number} conconiMaxHr – max HR from Conconi (nullable, used elsewhere)
 * @returns {{ vamKmh, vamVo2max, vamMlssKmh, vamMlssPace, vamVt2Kmh, vamVt2Pace }}
 */
export const computeVamData = (latestVam) => {
  const vamKmh = latestVam ? parseFloat(latestVam.vam_kmh) : null;
  const vamVo2max = vamKmh ? (vamKmh * 3.5).toFixed(1) : null;
  const vamMlssKmh = vamKmh ? (vamKmh * 0.88).toFixed(1) : null;
  const vamMlssPace = vamKmh ? Math.round(3600 / (vamKmh * 0.88)) : null;
  const vamVt2Kmh = vamKmh ? (vamKmh * 0.875).toFixed(1) : null;
  const vamVt2Pace = vamKmh ? Math.round(3600 / (vamKmh * 0.875)) : null;

  return { vamKmh, vamVo2max, vamMlssKmh, vamMlssPace, vamVt2Kmh, vamVt2Pace };
};
