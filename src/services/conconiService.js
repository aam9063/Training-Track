import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';
import Papa from 'papaparse';

/**
 * Format pace from seconds per km to "m:ss/km" string
 */
export const formatPace = (secondsPerKm) => {
  if (!secondsPerKm || secondsPerKm <= 0) return '-';
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}:${String(sec).padStart(2, '0')}/km`;
};

/**
 * Parse a Conconi test CSV file
 * Expected columns: serie/serie_number, tiempo/time_seconds (supports mm:ss), fc/heart_rate, recuperacion/recovery_time_120ppm
 * Returns { data: series[], error }
 */
export const parseConconiCSV = (file) => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            throw new Error('El archivo CSV está vacío');
          }

          const series = results.data.map((row, index) => {
            // Normalize column names (trim, lowercase)
            const normalized = {};
            Object.keys(row).forEach((key) => {
              normalized[key.trim().toLowerCase().replace(/\s+/g, '_')] = row[key]?.trim();
            });

            // Parse series number
            const seriesNumber =
              parseInt(
                normalized['serie_number'] ||
                  normalized['serie'] ||
                  normalized['series'] ||
                  normalized['numero']
              ) || index + 1;

            // Parse time: support mm:ss and raw seconds
            const timeValue =
              normalized['time_seconds'] ||
              normalized['tiempo'] ||
              normalized['time'] ||
              normalized['tiempo_segundos'];
            let timeSeconds;
            if (timeValue && timeValue.includes(':')) {
              const parts = timeValue.split(':').map(Number);
              timeSeconds = parts[0] * 60 + (parts[1] || 0);
            } else {
              timeSeconds = parseInt(timeValue);
            }

            // Parse heart rate
            const heartRate = parseInt(
              normalized['heart_rate'] || normalized['fc'] || normalized['hr'] || normalized['frecuencia_cardiaca']
            );

            // Parse recovery time (optional)
            const recoveryTime =
              parseInt(
                normalized['recovery_time_120ppm'] ||
                  normalized['recovery'] ||
                  normalized['recuperacion'] ||
                  normalized['tiempo_recuperacion']
              ) || null;

            // Validation
            if (isNaN(timeSeconds) || timeSeconds <= 0) {
              throw new Error(`Fila ${index + 1}: tiempo inválido "${timeValue}"`);
            }
            if (isNaN(heartRate) || heartRate <= 0) {
              throw new Error(`Fila ${index + 1}: frecuencia cardíaca inválida`);
            }

            return {
              series_number: seriesNumber,
              distance_meters: 200,
              time_seconds: timeSeconds,
              heart_rate: heartRate,
              recovery_time_seconds: recoveryTime,
              max_heart_rate_reached: false,
            };
          });

          if (series.length < 5) {
            throw new Error(`Se necesitan al menos 5 series para calcular ritmos (tienes ${series.length})`);
          }

          // Sort by series number
          series.sort((a, b) => a.series_number - b.series_number);

          // Mark max HR series
          const maxHR = Math.max(...series.map((s) => s.heart_rate));
          series.forEach((s) => {
            s.max_heart_rate_reached = s.heart_rate >= maxHR;
          });

          resolve({ data: series, error: null });
        } catch (error) {
          resolve({ data: null, error });
        }
      },
      error: (error) => {
        resolve({ data: null, error: new Error(`Error al leer el archivo: ${error.message}`) });
      },
    });
  });
};

/**
 * Create a Conconi test with series, then calculate paces via SQL RPC
 * Returns { data: { test, paces }, error }
 */
export const createConconiTest = async (athleteId, coachId, testMeta, series) => {
  if (!athleteId || !coachId) {
    return { data: null, error: new Error('Faltan athleteId o coachId') };
  }

  try {
    // 1. Insert test
    const { data: test, error: testError } = await supabase
      .from('conconi_tests')
      .insert({
        athlete_id: athleteId,
        coach_id: coachId,
        test_date: testMeta.test_date || toLocalDateStr(new Date()),
        location: testMeta.location || null,
        weather_conditions: testMeta.weather_conditions || null,
        notes: testMeta.notes || null,
      })
      .select()
      .single();

    if (testError) throw testError;

    // 2. Insert series
    const seriesWithTestId = series.map((s) => ({
      ...s,
      test_id: test.id,
    }));

    const { error: seriesError } = await supabase
      .from('conconi_test_series')
      .insert(seriesWithTestId);

    if (seriesError) throw seriesError;

    // 3. Call calculate_conconi_paces RPC
    const { data: paces, error: rpcError } = await supabase.rpc('calculate_conconi_paces', {
      p_test_id: test.id,
    });

    if (rpcError) throw rpcError;

    return { data: { test, paces }, error: null };
  } catch (error) {
    console.error('Error creating Conconi test:', error);
    return { data: null, error };
  }
};

/**
 * Get all Conconi tests for an athlete (with series)
 */
export const getConconiTests = async (athleteId) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('conconi_tests')
      .select('*, conconi_test_series(*)')
      .eq('athlete_id', athleteId)
      .order('test_date', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching Conconi tests:', error);
    return { data: [], error };
  }
};

// ==================== VAM Tests ====================

/**
 * Create a VAM test
 * Returns { data: vamTest (with computed vam_kmh and pace_seconds_per_km), error }
 */
export const createVAMTest = async (athleteId, coachId, testData) => {
  if (!athleteId || !coachId) {
    return { data: null, error: new Error('Faltan athleteId o coachId') };
  }

  const distanceMeters = parseInt(testData.distance_meters);
  const durationSeconds = parseInt(testData.duration_seconds);

  if (!distanceMeters || distanceMeters <= 0) {
    return { data: null, error: new Error('Distancia inválida') };
  }
  if (!durationSeconds || durationSeconds <= 0) {
    return { data: null, error: new Error('Duración inválida') };
  }

  try {
    const { data, error } = await supabase
      .from('vam_tests')
      .insert({
        athlete_id: athleteId,
        coach_id: coachId,
        test_date: testData.test_date || toLocalDateStr(new Date()),
        distance_meters: distanceMeters,
        duration_seconds: durationSeconds,
        location: testData.location || null,
        notes: testData.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating VAM test:', error);
    return { data: null, error };
  }
};

/**
 * Get VAM tests for an athlete
 */
export const getVAMTests = async (athleteId) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('vam_tests')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('test_date', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching VAM tests:', error);
    return { data: [], error };
  }
};
