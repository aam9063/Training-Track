import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==================== Color Constants ====================

const PACE_COLORS = {
  RM:  [220, 38, 38],
  R10: [239, 68, 68],
  R9:  [248, 113, 113],
  R8:  [249, 115, 22],
  R7:  [251, 146, 60],
  R6:  [234, 179, 8],
  R5:  [250, 204, 21],
  R4:  [163, 230, 53],
  R3:  [132, 204, 22],
  R2:  [74, 222, 128],
  R1:  [34, 197, 94],
  RR:  [5, 150, 105],
};

const VAM_COLS = [
  { label: 'FCmax',  color: [239, 68, 68] },
  { label: 'VAM',    color: [168, 85, 247] },
  { label: 'VO2max', color: [59, 130, 246] },
  { label: 'MLSS',   color: [249, 115, 22] },
  { label: 'VT2',    color: [234, 179, 8] },
  { label: 'VT1',    color: [34, 197, 94] },
];

const PACE_ORDER = ['RM', 'R10', 'R9', 'R8', 'R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1', 'RR'];

const PCT_LABELS = {
  RM: '100%', R10: '92%', R9: '90%', R8: '88%', R7: '86%', R6: '84%',
  R5: '82%', R4: '78%', R3: '72%', R2: '62%', R1: '50%', RR: '42%',
};

const DAYS_HEADER = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

// Layout constants (mm)
const MARGIN = 5;
const PAGE_W = 297;
const RIGHT_X = 105; // Where VAM/Conconi tables start
const RIGHT_W = PAGE_W - MARGIN - RIGHT_X; // 187mm available for right tables

// ==================== Helpers ====================

const getISOWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};

const fmtPace = (secs) => {
  if (!secs || secs <= 0) return '-';
  const min = Math.floor(secs / 60);
  const sec = Math.round(secs % 60);
  return `${min}'${String(sec).padStart(2, '0')}"`;
};

const fmtDuration = (totalSeconds) => {
  if (!totalSeconds) return '-';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const fmtRecovery = (secs) => {
  if (!secs) return '';
  const min = Math.floor(secs / 60);
  const sec = secs % 60;
  return sec > 0 ? `${min}'${String(sec).padStart(2, '0')}"` : `${min}'`;
};

// ==================== Draw: Colored Header Table ====================
// Draws a table with colored header cells and data rows.
// labelCol: optional first column with row labels (not colored)

const drawTable = (doc, x, y, columns, rows, colWidth, rowHeight, labelCol) => {
  const headerH = 5;
  const labelW = labelCol ? 22 : 0;
  const tableX = x + labelW;

  // Header label cell (empty top-left corner)
  if (labelCol) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.15);
    doc.rect(x, y, labelW, headerH);
  }

  // Colored header cells
  columns.forEach((col, i) => {
    const cx = tableX + i * colWidth;
    doc.setFillColor(...col.color);
    doc.rect(cx, y, colWidth, headerH, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    // White right border between header cells
    if (i < columns.length - 1) {
      doc.line(cx + colWidth, y, cx + colWidth, y + headerH);
    }
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(col.label, cx + colWidth / 2, y + 3.3, { align: 'center' });
  });

  // Outer header border
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(tableX, y, colWidth * columns.length, headerH);

  // Data rows
  rows.forEach((row, ri) => {
    const ry = y + headerH + ri * rowHeight;
    const isAlt = ri % 2 === 1;

    // Row label
    if (labelCol) {
      if (isAlt) {
        doc.setFillColor(240, 240, 240);
        doc.rect(x, ry, labelW, rowHeight, 'F');
      }
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.15);
      doc.rect(x, ry, labelW, rowHeight);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text(labelCol[ri] || '', x + labelW - 1, ry + rowHeight / 2 + 1, { align: 'right' });
    }

    // Alt row background
    if (isAlt) {
      doc.setFillColor(245, 245, 245);
      doc.rect(tableX, ry, colWidth * columns.length, rowHeight, 'F');
    }

    // Cell values
    row.forEach((cellVal, ci) => {
      const cx = tableX + ci * colWidth;
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(String(cellVal || ''), cx + colWidth / 2, ry + rowHeight / 2 + 1, { align: 'center' });
    });

    // Row and cell borders
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.15);
    doc.rect(tableX, ry, colWidth * columns.length, rowHeight);
    for (let ci = 1; ci < columns.length; ci++) {
      doc.line(tableX + ci * colWidth, ry, tableX + ci * colWidth, ry + rowHeight);
    }
  });
};

// ==================== Section: Athlete Header (Left Block) ====================

const drawAthleteHeader = (doc, athleteName, personalBests) => {
  const x = MARGIN;
  const y = MARGIN;
  const blockW = RIGHT_X - MARGIN - 3; // 97mm

  // Athlete name box
  doc.setFillColor(55, 65, 81);
  doc.rect(x, y, blockW, 10, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(athleteName || 'ATLETA', x + blockW / 2, y + 7, { align: 'center' });

  // PRUEBAS header
  let cy = y + 12;
  doc.setFillColor(230, 230, 230);
  doc.rect(x, cy, blockW, 4.5, 'F');
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(x, cy, blockW, 4.5);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('PRUEBAS', x + 2, cy + 3.2);
  cy += 4.5;

  // Race distances with PBs
  const distances = ['3000m', '5K RUTA', '10K RUTA', '1/2 MARATON', 'MARATON'];
  const distColW = blockW * 0.6;
  const pbColW = blockW - distColW;

  distances.forEach((dist) => {
    const pb = personalBests?.find(
      (p) => {
        const pName = (p.distance_name || '').toUpperCase();
        const dKey = dist.split(' ')[0];
        return pName.includes(dKey) || pName === dist;
      }
    );
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.15);
    doc.rect(x, cy, distColW, 3.8);
    doc.rect(x + distColW, cy, pbColW, 3.8);

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(`  > ${dist}`, x + 1, cy + 2.7);

    if (pb) {
      doc.setFont('helvetica', 'bold');
      doc.text(
        pb.time_formatted || fmtDuration(pb.time_seconds),
        x + distColW + pbColW / 2,
        cy + 2.7,
        { align: 'center' }
      );
    }
    cy += 3.8;
  });

  // MARCAS Y OBJETIVOS header
  cy += 0.5;
  doc.setFillColor(230, 230, 230);
  doc.rect(x, cy, blockW, 4.5, 'F');
  doc.setDrawColor(180, 180, 180);
  doc.rect(x, cy, blockW, 4.5);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('MARCAS Y OBJETIVOS', x + 2, cy + 3.2);
};

// ==================== Section: VAM Table ====================

const drawVamTable = (doc, latestVam, latestConconiTest) => {
  const x = RIGHT_X;
  const y = MARGIN;
  const colW = Math.floor(RIGHT_W / VAM_COLS.length); // ~31mm per column

  const maxHr = latestConconiTest?.max_hr_reached;
  const vamKmh = latestVam ? parseFloat(latestVam.vam_kmh) : null;
  const paceSecsKm = latestVam?.pace_seconds_per_km;
  const vo2max = vamKmh ? (vamKmh * 3.5).toFixed(1) : '-';
  const mlssKmh = vamKmh ? (vamKmh * 0.88).toFixed(1) : '-';
  const mlssPace = vamKmh ? Math.round(3600 / (vamKmh * 0.88)) : null;
  const vt2Kmh = vamKmh ? (vamKmh * 0.875).toFixed(1) : '-';
  const vt2Pace = vamKmh ? Math.round(3600 / (vamKmh * 0.875)) : null;
  const vt1Kmh = vamKmh ? (vamKmh * 0.775).toFixed(1) : '-';
  const vt1Pace = vamKmh ? Math.round(3600 / (vamKmh * 0.775)) : null;

  const rows = [
    [maxHr ? String(maxHr) : '-', vamKmh ? vamKmh.toFixed(1) : '-', vo2max, mlssKmh, vt2Kmh, vt1Kmh],
    [maxHr ? 'ppm' : '', 'km/h', 'ml/kg/min', 'km/h', 'km/h', 'km/h'],
    ['', paceSecsKm ? fmtPace(paceSecsKm) : '-', '', mlssPace ? fmtPace(mlssPace) : '-', vt2Pace ? fmtPace(vt2Pace) : '-', vt1Pace ? fmtPace(vt1Pace) : '-'],
    ['', 'min/km', '', 'min/km', 'min/km', 'min/km'],
  ];

  drawTable(doc, x, y, VAM_COLS, rows, colW, 3.8);
};

// ==================== Section: Conconi Table ====================

const drawConconiTable = (doc, athletePaces, latestConconiTest) => {
  const y = 27;
  const rowH = 3.8;

  // Build column definitions
  const sorted = PACE_ORDER
    .map((code) => athletePaces?.find((p) => p.pace_code === code))
    .filter(Boolean);

  const columnsData = sorted.length > 0 ? sorted : null;
  const columns = PACE_ORDER.map((code) => ({
    label: code,
    color: PACE_COLORS[code] || [150, 150, 150],
  }));

  // Calculate column width: available space minus label column (22mm)
  const labelW = 22;
  const colW = Math.floor((RIGHT_W - labelW) / columns.length); // ~13.7mm
  const x = RIGHT_X;

  // Recovery mapping
  const seriesRecovery = {};
  if (latestConconiTest?.conconi_test_series && columnsData) {
    const series = [...latestConconiTest.conconi_test_series].sort((a, b) => a.series_number - b.series_number);
    const totalSeries = series.length;
    const totalPaces = columnsData.length;
    columnsData.forEach((pace, i) => {
      if (pace.pace_code === 'RR') return;
      const seriesIdx = Math.round((i / (totalPaces - 1)) * (totalSeries - 1));
      const s = series[Math.min(seriesIdx, totalSeries - 1)];
      if (s?.recovery_time_seconds) seriesRecovery[pace.pace_code] = s.recovery_time_seconds;
    });
  }

  const rows = [
    // Percentage
    PACE_ORDER.map((code) => columnsData ? (PCT_LABELS[code] || '') : ''),
    // Ritmo
    PACE_ORDER.map((code) => {
      const p = columnsData?.find((pp) => pp.pace_code === code);
      return p ? fmtPace(p.pace_seconds_per_km) : '-';
    }),
    // Pulso
    PACE_ORDER.map((code) => {
      const p = columnsData?.find((pp) => pp.pace_code === code);
      return p?.heart_rate_max ? String(p.heart_rate_max) : '';
    }),
    // Recovery
    PACE_ORDER.map((code) => seriesRecovery[code] ? fmtRecovery(seriesRecovery[code]) : ''),
  ];

  const labelCol = ['', 'Ritmo/1.000m', 'Pulso', 'Recu. a 120p'];

  drawTable(doc, x, y, columns, rows, colW, rowH, labelCol);
};

// ==================== Section: Weekly Training Grid ====================

const buildWeekRow = (trainings, weekDays) => {
  const weekNum = getISOWeekNumber(weekDays[0]);
  const row = [String(weekNum)];

  for (let i = 0; i < 7; i++) {
    const training = trainings[i];
    if (!training) {
      row.push('');
      continue;
    }
    if (training.type === 'rest') {
      row.push('DESCANSO');
      continue;
    }

    const lines = [];

    // Group exercises into a readable format
    if (training.exercises?.length > 0) {
      // First line: title if exists (with blank line separator)
      if (training.title && training.title !== 'Entrenamiento') {
        lines.push(training.title);
        lines.push(''); // blank line separator
      }

      // Format each exercise: Name SetsxReps r:Rest
      const exLines = [];
      training.exercises.forEach((ex) => {
        let desc = '';

        if (ex.distance) {
          // Running exercise: distance shorthand + pace code
          const d = ex.distance >= 1000
            ? `${ex.distance % 1000 === 0 ? (ex.distance / 1000) : (ex.distance / 1000).toFixed(1)}k`
            : `${ex.distance}m`;
          desc = d + (ex.paceCode || '');
          if (ex.sets && ex.sets > 1) desc = `${ex.sets}x${desc}`;
        } else {
          // Gym/other exercise: Name first, then setsxreps
          desc = ex.name || '';
          if (ex.sets && ex.reps) {
            desc += ` ${ex.sets}x${ex.reps}`;
          } else if (ex.sets && ex.sets > 1) {
            desc += ` ${ex.sets}x`;
          }
        }

        // Rest suffix
        if (ex.rest) {
          const r = ex.rest >= 60 ? `${Math.floor(ex.rest / 60)}'` : `${ex.rest}"`;
          desc += ` r:${r}`;
        }

        exLines.push(desc);
      });

      // Each exercise on its own line for readability
      lines.push(...exLines);
    }

    // Total distance
    if (training.totalDistance) {
      lines.push(`Vol: ${training.totalDistance}`);
    }

    row.push(lines.join('\n'));
  }

  // Volume column
  const totalMeters = Object.values(trainings).reduce(
    (sum, t) => sum + (t?.totalDistanceMeters || 0), 0
  );
  row.push(totalMeters > 0 ? `${(totalMeters / 1000).toFixed(1)}` : '-');

  return row;
};

const drawPaceIndicators = (doc, data, training) => {
  if (!training?.exercises?.length) return;

  const uniquePaces = [...new Set(
    training.exercises.filter((ex) => ex.paceCode).map((ex) => ex.paceCode)
  )];
  if (uniquePaces.length === 0) return;

  const cellX = data.cell.x;
  const cellY = data.cell.y + data.cell.height - 4;
  const maxW = data.cell.width - 2;
  const iW = Math.min(7, (maxW - uniquePaces.length + 1) / uniquePaces.length);

  uniquePaces.forEach((pace, idx) => {
    const color = PACE_COLORS[pace] || [150, 150, 150];
    const bx = cellX + 1 + idx * (iW + 0.5);
    doc.setFillColor(...color);
    doc.roundedRect(bx, cellY, iW, 3, 0.5, 0.5, 'F');
    doc.setFontSize(4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(pace, bx + iW / 2, cellY + 2.2, { align: 'center' });
  });
};

// ==================== Main Export ====================

export const generateWeeklyPDF = ({
  athleteName,
  personalBests,
  athletePaces,
  latestVam,
  latestConconiTest,
  trainings,
  weekDays,
}) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // --- Header: left block (athlete info) ---
  drawAthleteHeader(doc, athleteName, personalBests);

  // --- Header: right block (VAM + Conconi) ---
  drawVamTable(doc, latestVam, latestConconiTest);
  drawConconiTable(doc, athletePaces, latestConconiTest);

  // --- Week label ---
  const weekStart = weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const weekEnd = weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Semana: ${weekStart} - ${weekEnd}`, MARGIN, 52);

  // --- Weekly grid ---
  const gridStartY = 54;
  const weekRow = buildWeekRow(trainings, weekDays);

  autoTable(doc, {
    startY: gridStartY,
    head: [['Sem', ...DAYS_HEADER, 'Vol.']],
    body: [weekRow],
    theme: 'grid',
    tableWidth: PAGE_W - 2 * MARGIN,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 5.5,
      cellPadding: { top: 1.5, right: 1, bottom: 5, left: 1 },
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
      overflow: 'linebreak',
      font: 'helvetica',
      valign: 'top',
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
      cellPadding: 1.5,
      minCellHeight: 6,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 10 },
      1: { cellWidth: 35.5 },
      2: { cellWidth: 35.5 },
      3: { cellWidth: 35.5 },
      4: { cellWidth: 35.5 },
      5: { cellWidth: 35.5 },
      6: { cellWidth: 35.5 },
      7: { cellWidth: 35.5 },
      8: { cellWidth: 22, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8 },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index >= 1 && data.column.index <= 7) {
        drawPaceIndicators(doc, data, trainings[data.column.index - 1]);
      }
    },
  });

  // --- Footer ---
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generado el ${new Date().toLocaleDateString('es-ES')} | TrainingTrack Pro`,
    PAGE_W / 2,
    207,
    { align: 'center' }
  );

  // --- Save ---
  const fileName = `plan-${(athleteName || 'entrenamiento').toLowerCase().replace(/\s+/g, '-')}-sem${getISOWeekNumber(weekDays[0])}.pdf`;
  doc.save(fileName);
};
