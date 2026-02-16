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
 * Process raw rows (from CSV or XLSX) into Conconi series objects.
 * Each row is an object with string keys/values.
 */
const processRows = (rows, distanceMeters = 800) => {
  if (!rows || rows.length === 0) {
    throw new Error('El archivo está vacío');
  }

  const series = rows.map((row, index) => {
    // Normalize column names (trim, lowercase)
    const normalized = {};
    Object.keys(row).forEach((key) => {
      const val = row[key];
      normalized[key.trim().toLowerCase().replace(/\s+/g, '_')] = typeof val === 'string' ? val.trim() : String(val ?? '');
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
      distance_meters: distanceMeters,
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

  return series;
};

/**
 * Parse a time value into seconds.
 * Handles: "2'30", "1'28", "57"", "1:03", raw seconds,
 * and Excel day fractions (small decimals like 0.001736).
 */
const parseTimeStr = (val) => {
  if (val == null) return null;

  // Excel day fraction: a number < 1 representing time as fraction of 24h
  if (typeof val === 'number') {
    if (val > 0 && val < 1) {
      // Day fraction → seconds: val * 24 * 3600
      return Math.round(val * 86400);
    }
    // Could be raw seconds (e.g. 150) — only valid if reasonable (< 3600)
    if (val > 0 && val < 3600) return Math.round(val);
    return null;
  }

  const s = String(val).trim().replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"');
  if (!s || s === '' || s.toUpperCase() === 'X' || s === '-') return null;

  // Format: m'ss" or m'ss
  const mApos = s.match(/^(\d+)'(\d+)"?$/);
  if (mApos) return parseInt(mApos[1]) * 60 + parseInt(mApos[2]);

  // Format: ss" (seconds only)
  const secOnly = s.match(/^(\d+)"$/);
  if (secOnly) return parseInt(secOnly[1]);

  // Format: h:mm:ss or m:ss
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    return parts[0] * 60 + (parts[1] || 0);
  }

  // Raw number (seconds)
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  // Small decimal → Excel day fraction
  if (n > 0 && n < 1) return Math.round(n * 86400);
  return n > 0 && n < 3600 ? Math.round(n) : null;
};

/**
 * Get the raw value of an ExcelJS cell.
 * Handles Date objects (Excel day fractions stored as Date by ExcelJS),
 * rich text, formula results, and plain values.
 */
const getCellRaw = (cell) => {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  // ExcelJS returns Date objects for time-formatted cells
  if (v instanceof Date) {
    // Convert back to Excel day fraction for parseTimeStr
    const totalSeconds = v.getUTCHours() * 3600 + v.getUTCMinutes() * 60 + v.getUTCSeconds();
    return totalSeconds > 0 ? totalSeconds / 86400 : '';
  }
  // Formula result
  if (typeof v === 'object' && v.result != null) return v.result;
  // Rich text
  if (typeof v === 'object' && v.richText) return v.richText.map((r) => r.text).join('');
  return v;
};

/**
 * Get the formatted text of an ExcelJS cell (for label detection).
 */
const getCellText = (cell) => {
  if (!cell || cell.value == null) return '';
  return String(cell.text ?? cell.value ?? '');
};

/**
 * Detect and extract Conconi data from a transposed XLSX worksheet (ExcelJS).
 * Looks for rows containing labels like "1.000m"/"1000m" (time), "Pulso" (HR),
 * and "r: 120p"/"r:120p"/"120" (recovery).
 * Series are in columns; each column = one series.
 * Returns array of series objects or null if format not detected.
 */
const extractTransposedConconi = (worksheet, distanceMeters = 800) => {
  const rowCount = worksheet.rowCount;
  if (rowCount < 2) return null;

  let timeRowIdx = -1;
  let pulsoRowIdx = -1;
  let recoveryRowIdx = -1;
  let maxLabelCol = -1;

  // Scan first 6 columns of each row for known labels
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 6; c++) {
      const cell = getCellText(row.getCell(c)).trim().toLowerCase().replace(/[\s.]+/g, '');
      if (cell.includes('1000') && timeRowIdx < 0) {
        timeRowIdx = r;
        maxLabelCol = Math.max(maxLabelCol, c);
      }
      if ((cell === 'pulso' || cell === 'fc' || cell.includes('frecuencia') || cell.includes('heartrate')) && pulsoRowIdx < 0) {
        pulsoRowIdx = r;
        maxLabelCol = Math.max(maxLabelCol, c);
      }
      if ((cell.includes('120') || cell.includes('recupera')) && recoveryRowIdx < 0) {
        recoveryRowIdx = r;
        maxLabelCol = Math.max(maxLabelCol, c);
      }
    }
  }

  if (pulsoRowIdx < 0) return null;
  if (timeRowIdx < 0 && pulsoRowIdx > 1) {
    timeRowIdx = pulsoRowIdx - 1;
  }

  const dataStartCol = maxLabelCol + 1;
  const colCount = worksheet.columnCount;
  const series = [];

  for (let c = dataStartCol; c <= colCount; c++) {
    const timeVal = timeRowIdx > 0 ? parseTimeStr(getCellRaw(worksheet.getRow(timeRowIdx).getCell(c))) : null;
    const pulsoRaw = String(getCellRaw(worksheet.getRow(pulsoRowIdx).getCell(c)) ?? '').trim();
    const hrVal = parseInt(pulsoRaw);
    const recVal = recoveryRowIdx > 0 ? parseTimeStr(getCellRaw(worksheet.getRow(recoveryRowIdx).getCell(c))) : null;

    if (pulsoRaw.toUpperCase() === 'X' || pulsoRaw === '') continue;
    if (isNaN(hrVal) || hrVal <= 0 || hrVal > 250) continue;

    series.push({
      series_number: series.length + 1,
      distance_meters: distanceMeters,
      time_seconds: timeVal || 0,
      heart_rate: hrVal,
      recovery_time_seconds: recVal,
      max_heart_rate_reached: false,
    });
  }

  if (series.length < 5) return null;

  const maxHR = Math.max(...series.map((s) => s.heart_rate));
  series.forEach((s) => {
    s.max_heart_rate_reached = s.heart_rate >= maxHR;
  });

  return series;
};

/**
 * Parse a Conconi test file (CSV or XLSX)
 * Supports both:
 *  - Simple row-per-series format (CSV/XLSX with columns: serie, tiempo, fc, recuperacion)
 *  - Transposed spreadsheet format (XLSX with rows: 1.000m, Pulso, r:120p and series in columns)
 * Returns { data: series[], error }
 */
export const parseConconiFile = async (file, distanceMeters = 800) => {
  const isXlsx = file.name.match(/\.xlsx?$/i);

  if (isXlsx) {
    try {
      const { default: ExcelJS } = await import('exceljs');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        return { data: null, error: new Error('El archivo no contiene hojas') };
      }

      // Try transposed format first (the typical coach spreadsheet)
      const transposed = extractTransposedConconi(worksheet, distanceMeters);
      if (transposed) {
        return { data: transposed, error: null };
      }

      // Fallback to simple row-per-series format
      // Convert worksheet to array of row objects (similar to sheet_to_json)
      const headerRow = worksheet.getRow(1);
      const headers = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = getCellText(cell).trim();
      });

      const rows = [];
      for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const obj = {};
        let hasData = false;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const key = headers[colNumber] || `col_${colNumber}`;
          const val = getCellRaw(cell);
          obj[key] = val;
          if (val !== '' && val != null) hasData = true;
        });
        if (hasData) rows.push(obj);
      }

      return { data: processRows(rows, distanceMeters), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  // CSV fallback
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          resolve({ data: processRows(results.data, distanceMeters), error: null });
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

// Legacy alias
export const parseConconiCSV = parseConconiFile;

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
