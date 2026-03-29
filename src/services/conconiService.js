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
 *
 * Excel time quirk: a cell formatted as "h:mm" (e.g. 2:30 meaning 2h30m) stores
 * the value as 0.1041... (= 2.5/24). A duration cell formatted as "[mm]:ss" or
 * "m:ss" with value 2'30" stores 0.001736 (= 150/86400).
 * We first try the raw seconds result; if it's unreasonably large for a Conconi
 * series (>900s = 15min), we divide by 60 to re-interpret hours→minutes.
 */
const parseTimeStr = (val) => {
  if (val == null) return null;

  // Excel day fraction: a number < 1 representing time as fraction of 24h
  if (typeof val === 'number') {
    if (val > 0 && val < 1) {
      const totalSeconds = Math.round(val * 86400);
      // If result is plausible for a Conconi series (30s–900s), return as-is
      if (totalSeconds >= 30 && totalSeconds <= 900) return totalSeconds;
      // Otherwise the cell may be formatted as h:mm — divide by 60 to get minutes→seconds
      // e.g. 0.1041 (= 2:30 as hour fraction) → 9000s → /60 → 150s ✓
      const reinterpreted = Math.round(totalSeconds / 60);
      if (reinterpreted >= 30 && reinterpreted <= 900) return reinterpreted;
      return null;
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
    // Convert back to Excel day fraction so parseTimeStr can handle it
    const totalSeconds = v.getUTCHours() * 3600 + v.getUTCMinutes() * 60 + v.getUTCSeconds();
    if (totalSeconds > 0) return totalSeconds / 86400;
    // Date-only values (e.g. calendar dates at midnight) → skip
    return '';
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
 *
 * Expected layout (series in columns, rows are: time, pulso, recovery):
 *   Col A/B: metadata (date, labels like "1.000m", "Pulso", "r: 120p")
 *   Col C+:  one column per series with the actual values
 *
 * The label row for time may contain "1.000m", "1000m", "1000", "tiempo", etc.
 * Pulso row: "Pulso", "FC", "frecuencia", "heartrate"
 * Recovery row: "r: 120p", "r:120p", "recupera", "120"
 *
 * Returns array of series objects or null if format not detected.
 */
const extractTransposedConconi = (worksheet, distanceMeters = 800) => {
  const rowCount = worksheet.rowCount;
  if (rowCount < 2) return null;

  // Build a map of row→{labelCol, labelText} for each row that has a known label
  // Strategy: find the "Pulso" row first (most unambiguous), then infer time/recovery
  // by looking at adjacent rows (typically: time = pulso-1, recovery = pulso+1)

  let pulsoRowIdx = -1;
  let pulsoLabelCol = 1;

  // Pass 1: find "Pulso" row — most unique label
  for (let r = 1; r <= rowCount && pulsoRowIdx < 0; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 8; c++) {
      const cell = getCellText(row.getCell(c)).trim().toLowerCase().replace(/[\s.:]+/g, '');
      if (cell === 'pulso' || cell === 'fc' || cell.includes('frecuencia') || cell.includes('pulsaciones')) {
        pulsoRowIdx = r;
        pulsoLabelCol = c;
        break;
      }
    }
  }

  if (pulsoRowIdx < 0) {
    console.warn('[Conconi] No se encontró fila "Pulso"');
    return null;
  }

  // Pass 2: find time row — search BACKWARDS from pulsoRow (closest match wins)
  // This avoids picking up the legend table rows further above
  let timeRowIdx = -1;
  let timeLabelCol = pulsoLabelCol;

  for (let r = pulsoRowIdx - 1; r >= Math.max(1, pulsoRowIdx - 3); r--) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 8; c++) {
      const cell = getCellText(row.getCell(c)).trim().toLowerCase().replace(/[\s.:]+/g, '');
      if (cell.includes('1000') || cell === '1km') {
        timeRowIdx = r;
        timeLabelCol = c;
        break;
      }
    }
    if (timeRowIdx > 0) break;
  }

  // If still no time row, assume the row just before pulso
  if (timeRowIdx < 0) {
    timeRowIdx = pulsoRowIdx - 1;
    timeLabelCol = pulsoLabelCol;
  }

  // Pass 3: find recovery row — look after pulso for "120p" / "r:" label
  let recoveryRowIdx = -1;
  let recoveryLabelCol = pulsoLabelCol;

  for (let r = pulsoRowIdx + 1; r <= Math.min(rowCount, pulsoRowIdx + 4); r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 8; c++) {
      const cell = getCellText(row.getCell(c)).trim().toLowerCase().replace(/[\s.:]+/g, '');
      if (cell.startsWith('r:') || cell.startsWith('r120') || cell === 'r120p' || cell === '120p' || cell.includes('recupera')) {
        recoveryRowIdx = r;
        recoveryLabelCol = c;
        break;
      }
    }
    if (recoveryRowIdx > 0) break;
  }

  // Data starts one column after the rightmost label column found
  const maxLabelCol = Math.max(pulsoLabelCol, timeLabelCol, recoveryLabelCol);
  let dataStartCol = maxLabelCol + 1;

  // Refine dataStartCol by scanning the time row for the first actual time value.
  // ExcelJS stores time-of-day cells (e.g. 2:30) as Date objects with the time encoded
  // in UTC hours/minutes. getCellRaw converts them to a day fraction.
  // We must NOT skip Date cells here — we use getCellRaw to get the fraction, then parseTimeStr.
  // We only skip cells whose raw value is a large integer (calendar day serial > 1).
  if (timeRowIdx > 0) {
    const timeRow = worksheet.getRow(timeRowIdx);
    for (let c = dataStartCol; c <= dataStartCol + 10; c++) {
      const cell = timeRow.getCell(c);
      // getCellRaw handles Date → fraction conversion
      const raw = getCellRaw(cell);
      // Skip empty or text labels
      if (raw === '' || typeof raw === 'string') continue;
      const parsed = parseTimeStr(raw);
      // Accept values that look like race times (30s–900s)
      if (parsed != null && parsed >= 30 && parsed <= 900) { dataStartCol = c; break; }
    }
  }

  const colCount = worksheet.columnCount;

  // First pass: collect all candidate columns with their data
  const candidates = [];
  for (let c = dataStartCol; c <= colCount; c++) {
    const timeVal = timeRowIdx > 0
      ? parseTimeStr(getCellRaw(worksheet.getRow(timeRowIdx).getCell(c)))
      : null;
    if (timeVal == null || timeVal <= 0) continue;

    const pulsoRaw = String(getCellRaw(worksheet.getRow(pulsoRowIdx).getCell(c)) ?? '').trim();
    if (pulsoRaw.toUpperCase() === 'X' || pulsoRaw === '-') continue;

    const hrVal = parseInt(pulsoRaw);
    const hrValid = !isNaN(hrVal) && hrVal > 30 && hrVal <= 250;

    const recVal = recoveryRowIdx > 0
      ? parseTimeStr(getCellRaw(worksheet.getRow(recoveryRowIdx).getCell(c)))
      : null;

    candidates.push({ timeVal, hrVal: hrValid ? hrVal : 0, recVal });
  }

  // If any column has a valid HR, the test has been (at least partially) performed:
  // only include columns where the athlete actually recorded their HR.
  // If no HR anywhere, it's a blank template: include all columns (time-only preview).
  const hasAnyHR = candidates.some((c) => c.hrVal > 0);

  const series = candidates
    .filter((c) => !hasAnyHR || c.hrVal > 0)
    .map((c, i) => ({
      series_number: i + 1,
      distance_meters: distanceMeters,
      time_seconds: c.timeVal,
      heart_rate: c.hrVal,
      recovery_time_seconds: c.recVal,
      max_heart_rate_reached: false,
    }));

  if (series.length < 2) return null;

  const maxHR = Math.max(...series.map((s) => s.heart_rate).filter((h) => h > 0));
  series.forEach((s) => {
    s.max_heart_rate_reached = s.heart_rate > 0 && s.heart_rate >= maxHR;
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
  if (!athleteId) {
    return { data: null, error: new Error('Falta athleteId') };
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
        coach_id: coachId || null,
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
