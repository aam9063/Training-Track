import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Color Constants ─────────────────────────────────────────────────────────

const C = {
  primary:    [2, 132, 199],     // sky-600
  primaryL:   [14, 165, 233],    // sky-500
  success:    [34, 197, 94],     // green-500
  successD:   [22, 163, 74],     // green-600
  warning:    [234, 179, 8],     // yellow-500
  danger:     [239, 68, 68],     // red-500
  dangerD:    [185, 28, 28],     // red-700
  orange:     [249, 115, 22],    // orange-500
  purple:     [168, 85, 247],    // purple-500
  dark:       [31, 41, 55],      // gray-800
  gray:       [107, 114, 128],   // gray-500
  grayL:      [156, 163, 175],   // gray-400
  grayBg:     [243, 244, 246],   // gray-100
  grayBg2:    [229, 231, 235],   // gray-200
  white:      [255, 255, 255],
};

const PACE_COLORS = {
  RM:  [220, 38, 38],  R10: [239, 68, 68],  R9: [248, 113, 113],
  R8:  [249, 115, 22], R7:  [251, 146, 60], R6: [234, 179, 8],
  R5:  [250, 204, 21], R4:  [163, 230, 53], R3: [132, 204, 22],
  R2:  [74, 222, 128], R1:  [34, 197, 94],  RR: [5, 150, 105],
};

// ─── Layout Constants (A4 Portrait: 210×297mm) ──────────────────────────────

const M = 12; // margin
const PW = 210;
const PH = 297;
const CW = PW - 2 * M; // content width = 186mm
const HEADER_H = 18;
const FOOTER_H = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const setColor = (doc, rgb, type = 'fill') => {
  if (type === 'fill') doc.setFillColor(...rgb);
  else if (type === 'text') doc.setTextColor(...rgb);
  else if (type === 'draw') doc.setDrawColor(...rgb);
};

const riskColor = (level) => {
  const map = { bajo: C.success, moderado: C.warning, alto: C.orange, 'muy alto': C.danger };
  return map[level] || C.gray;
};

// ─── Page Header / Footer ────────────────────────────────────────────────────

const drawPageHeader = (doc, athleteName, pageNum, totalPages, genDate) => {
  // Background bar
  setColor(doc, C.primary, 'fill');
  doc.rect(0, 0, PW, HEADER_H, 'F');

  // Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, C.white, 'text');
  doc.text('TRAINING TRACK', M, 7.5);

  // Athlete name
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(athleteName.toUpperCase(), M, 13);

  // Right: page number + date
  doc.setFontSize(7);
  const rightText = `${fmtDate(genDate)}  |  ${pageNum}/${totalPages}`;
  doc.text(rightText, PW - M, 7.5, { align: 'right' });
};

const drawPageFooter = (doc, genDate) => {
  const y = PH - 7;
  setColor(doc, C.grayL, 'text');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el ${fmtDate(genDate)} | Training Track | Informe generado con IA`, PW / 2, y, { align: 'center' });
};

// ─── Reusable Drawing Functions ──────────────────────────────────────────────

const drawSectionTitle = (doc, title, y, color = C.primary) => {
  setColor(doc, color, 'fill');
  doc.roundedRect(M, y, CW, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, C.white, 'text');
  doc.text(title.toUpperCase(), M + 4, y + 5.5);
  return y + 11;
};

const drawSubTitle = (doc, title, y, color = C.dark) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(doc, color, 'text');
  doc.text(title, M, y);
  return y + 5;
};

const drawParagraph = (doc, text, y, maxWidth = CW, fontSize = 7.5) => {
  if (!text) return y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  setColor(doc, C.dark, 'text');
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, M, y);
  return y + lines.length * (fontSize * 0.4) + 2;
};

const drawBulletList = (doc, items, y, color = C.primary, maxWidth = CW - 8) => {
  if (!items || items.length === 0) return y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  items.forEach(item => {
    if (y > PH - 25) return; // prevent overflow
    // Bullet
    setColor(doc, color, 'fill');
    doc.circle(M + 2, y - 1, 1, 'F');
    // Text
    setColor(doc, C.dark, 'text');
    const lines = doc.splitTextToSize(String(item), maxWidth);
    doc.text(lines, M + 6, y);
    y += lines.length * 3.2 + 1;
  });

  return y + 1;
};

const drawMetricBox = (doc, label, value, unit, x, y, w, h, color = C.primary) => {
  // Background
  setColor(doc, C.grayBg, 'fill');
  doc.roundedRect(x, y, w, h, 2, 2, 'F');

  // Top color bar
  setColor(doc, color, 'fill');
  doc.roundedRect(x, y, w, 3, 2, 2, 'F');
  doc.rect(x, y + 1.5, w, 1.5, 'F'); // fill bottom corners of bar

  // Value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setColor(doc, C.dark, 'text');
  const valueStr = String(value ?? '-');
  doc.text(valueStr, x + w / 2, y + h / 2 + 1, { align: 'center' });

  // Unit (if any)
  if (unit) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(doc, C.gray, 'text');
    doc.text(unit, x + w / 2, y + h / 2 + 5.5, { align: 'center' });
  }

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  setColor(doc, C.gray, 'text');
  doc.text(label, x + w / 2, y + h - 2.5, { align: 'center' });
};

const drawRiskBar = (doc, score, level, y) => {
  const barX = M;
  const barW = CW;
  const barH = 12;
  const color = riskColor(level);

  // Background
  setColor(doc, C.grayBg, 'fill');
  doc.roundedRect(barX, y, barW, barH, 2, 2, 'F');

  // Filled portion
  const fillW = Math.min(Math.max((score / 10) * barW, 0), barW);
  setColor(doc, color, 'fill');
  doc.roundedRect(barX, y, fillW, barH, 2, 2, 'F');
  // Fix right corners if not full
  if (fillW < barW && fillW > 4) {
    doc.rect(barX + fillW - 2, y, 2, barH, 'F');
  }

  // Text overlay
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, score > 5 ? C.white : C.dark, 'text');
  doc.text(`${(level || '').toUpperCase()}  -  ${score}/10`, barX + barW / 2, y + barH / 2 + 1.5, { align: 'center' });

  return y + barH + 4;
};

// ─── Page Builders ───────────────────────────────────────────────────────────

const buildPage1 = (doc, athleteName, reportData, ai, genDate) => {
  const totalPages = 4;
  drawPageHeader(doc, athleteName, 1, totalPages, genDate);
  drawPageFooter(doc, genDate);

  let y = HEADER_H + 6;

  // Cover Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setColor(doc, C.primary, 'text');
  doc.text('Informe de Rendimiento', M, y);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, C.gray, 'text');
  doc.text(`${athleteName}  |  ${fmtDate(genDate)}`, M, y);
  y += 10;

  // Executive Summary Section
  y = drawSectionTitle(doc, 'Resumen Ejecutivo', y);

  // 3 Metric boxes
  const boxW = (CW - 8) / 3;
  const boxH = 22;
  const resumen = ai.resumen_ejecutivo || {};
  const carga = ai.gestion_carga || {};
  const riesgo = ai.riesgo_lesion || {};

  drawMetricBox(doc, 'Nivel Fitness', resumen.puntuacion_global || '-', `/10 - ${resumen.nivel_fitness || ''}`, M, y, boxW, boxH, C.primary);
  drawMetricBox(doc, 'ACWR', carga.acwr ?? reportData.load.acwr ?? '-', 'Ratio Carga', M + boxW + 4, y, boxW, boxH, C.orange);
  drawMetricBox(doc, 'Riesgo Lesion', riesgo.puntuacion_riesgo || '-', `/10 - ${riesgo.nivel_riesgo || ''}`, M + (boxW + 4) * 2, y, boxW, boxH, riskColor(riesgo.nivel_riesgo));
  y += boxH + 6;

  // General summary text
  y = drawParagraph(doc, resumen.resumen_general, y, CW, 7.5);
  y += 3;

  // Achievements
  if (resumen.logros?.length > 0) {
    y = drawSubTitle(doc, 'Logros', y, C.successD);
    y = drawBulletList(doc, resumen.logros, y, C.success);
    y += 2;
  }

  // Areas to improve
  if (resumen.areas_mejora?.length > 0) {
    y = drawSubTitle(doc, 'Areas de Mejora', y, C.orange);
    y = drawBulletList(doc, resumen.areas_mejora, y, C.orange);
  }
};

const buildPage2 = (doc, athleteName, reportData, ai, genDate) => {
  doc.addPage();
  drawPageHeader(doc, athleteName, 2, 4, genDate);
  drawPageFooter(doc, genDate);

  let y = HEADER_H + 6;

  // Volume Analysis
  y = drawSectionTitle(doc, 'Analisis de Volumen', y);

  const vol = ai.analisis_volumen || {};
  const strava = reportData.strava || {};

  // 4 Metric boxes
  const boxW = (CW - 12) / 4;
  const boxH = 20;
  drawMetricBox(doc, 'Distancia Total', strava.totalDistanceKm || '-', 'km', M, y, boxW, boxH, C.primary);
  drawMetricBox(doc, 'Tiempo Total', strava.totalTime || '-', '', M + boxW + 4, y, boxW, boxH, C.purple);
  drawMetricBox(doc, 'Actividades', strava.totalActivities || '-', '', M + (boxW + 4) * 2, y, boxW, boxH, C.orange);
  drawMetricBox(doc, 'Desnivel', strava.totalElevation || '-', 'm', M + (boxW + 4) * 3, y, boxW, boxH, C.success);
  y += boxH + 5;

  // Weekly table
  const weeklyStats = strava.weeklyStats || [];
  if (weeklyStats.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Semana', 'Distancia', 'Tiempo', 'Actividades', 'Desnivel']],
      body: weeklyStats.map(w => [
        w.weekNumber,
        `${w.distanceKm} km`,
        w.timeFormatted,
        w.activities,
        `${w.elevation} m`,
      ]),
      styles: { fontSize: 7, cellPadding: 2, font: 'helvetica' },
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.grayBg },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  // Volume insights
  y = drawParagraph(doc, vol.balance_volumen_intensidad, y);
  if (vol.insights?.length > 0) {
    y = drawBulletList(doc, vol.insights, y, C.primary);
  }
  y += 3;

  // Performance Progression
  y = drawSectionTitle(doc, 'Progresion de Rendimiento', y, C.orange);

  const prog = ai.progresion_rendimiento || {};

  y = drawParagraph(doc, prog.evolucion_ritmo, y);
  y = drawParagraph(doc, prog.eficiencia_cardiaca, y);
  y = drawParagraph(doc, prog.mejores_marcas_analisis, y);
  y = drawParagraph(doc, prog.predicciones_carrera, y);

  // Best efforts table
  const bestEfforts = reportData.bestEfforts || [];
  if (bestEfforts.length > 0 && y < PH - 50) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Distancia', 'Tiempo', 'Ritmo', 'Fecha']],
      body: bestEfforts.map(e => [e.name, e.time, e.pace, e.date ? fmtDate(e.date) : '-']),
      styles: { fontSize: 7, cellPadding: 2, font: 'helvetica' },
      headStyles: { fillColor: C.orange, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.grayBg },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  if (prog.insights?.length > 0 && y < PH - 30) {
    y = drawBulletList(doc, prog.insights, y, C.orange);
  }
};

const buildPage3 = (doc, athleteName, reportData, ai, genDate) => {
  doc.addPage();
  drawPageHeader(doc, athleteName, 3, 4, genDate);
  drawPageFooter(doc, genDate);

  let y = HEADER_H + 6;

  // Physiological Analysis
  y = drawSectionTitle(doc, 'Analisis Fisiologico', y, C.purple);

  const fisio = ai.analisis_fisiologico || {};
  const physData = reportData.physiological || {};
  const vam = physData.vam;

  // Metric boxes for physiological data
  const boxW = (CW - 12) / 4;
  const boxH = 20;

  drawMetricBox(doc, 'VAM', vam?.vam_kmh ?? '-', 'km/h', M, y, boxW, boxH, C.purple);
  drawMetricBox(doc, 'VO2max', vam?.vo2max ?? (reportData.profile.vo2max || '-'), 'ml/kg/min', M + boxW + 4, y, boxW, boxH, C.primary);
  drawMetricBox(doc, 'MLSS', vam?.mlss_kmh ?? '-', 'km/h', M + (boxW + 4) * 2, y, boxW, boxH, C.orange);
  drawMetricBox(doc, 'FC Max', physData.conconiMaxHR ?? (reportData.profile.maxHR || '-'), 'bpm', M + (boxW + 4) * 3, y, boxW, boxH, C.danger);
  y += boxH + 5;

  y = drawParagraph(doc, fisio.vam_vo2max, y);
  y = drawParagraph(doc, fisio.zonas_fc, y);
  y = drawParagraph(doc, fisio.umbrales, y);

  // Paces table
  const paces = physData.paces || [];
  if (paces.length > 0 && y < PH - 70) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Zona', 'Ritmo /km', 'FC (bpm)']],
      body: paces.map(p => [p.code, p.pace, p.hr ?? '-']),
      styles: { fontSize: 7, cellPadding: 2, font: 'helvetica' },
      headStyles: { fillColor: C.purple, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.grayBg },
      didDrawCell: (data) => {
        if (data.column.index === 0 && data.section === 'body') {
          const code = data.cell.raw;
          const color = PACE_COLORS[code];
          if (color) {
            doc.setFillColor(...color);
            doc.roundedRect(data.cell.x + 1, data.cell.y + 1, 3, data.cell.height - 2, 0.5, 0.5, 'F');
          }
        }
      },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  if (fisio.insights?.length > 0 && y < PH - 40) {
    y = drawBulletList(doc, fisio.insights, y, C.purple);
  }
  y += 3;

  // Load Management
  if (y < PH - 60) {
    y = drawSectionTitle(doc, 'Gestion de Carga', y, C.orange);

    const carga = ai.gestion_carga || {};
    const load = reportData.load || {};

    // 3 Metric boxes
    const boxW3 = (CW - 8) / 3;
    drawMetricBox(doc, 'ACWR', load.acwr ?? '-', '', M, y, boxW3, boxH, load.acwr > 1.5 ? C.danger : load.acwr >= 0.8 ? C.success : C.warning);
    drawMetricBox(doc, 'Monotonia', load.monotony ?? '-', '', M + boxW3 + 4, y, boxW3, boxH, C.orange);
    drawMetricBox(doc, 'Strain', load.strain ?? '-', '', M + (boxW3 + 4) * 2, y, boxW3, boxH, C.purple);
    y += boxH + 5;

    y = drawParagraph(doc, carga.interpretacion_acwr, y);
    y = drawParagraph(doc, carga.tendencia_carga || carga.monotonia, y);

    if (carga.insights?.length > 0 && y < PH - 25) {
      y = drawBulletList(doc, carga.insights, y, C.orange);
    }
  }
};

const buildPage4 = (doc, athleteName, reportData, ai, genDate) => {
  doc.addPage();
  drawPageHeader(doc, athleteName, 4, 4, genDate);
  drawPageFooter(doc, genDate);

  let y = HEADER_H + 6;

  // Injury Risk
  y = drawSectionTitle(doc, 'Riesgo de Lesion', y, C.danger);

  const riesgo = ai.riesgo_lesion || {};

  y = drawRiskBar(doc, riesgo.puntuacion_riesgo || 5, riesgo.nivel_riesgo || 'moderado', y);
  y += 2;

  if (riesgo.factores_riesgo?.length > 0) {
    y = drawSubTitle(doc, 'Factores de Riesgo', y, C.danger);
    y = drawBulletList(doc, riesgo.factores_riesgo, y, C.danger);
    y += 2;
  }

  if (riesgo.medidas_preventivas?.length > 0) {
    y = drawSubTitle(doc, 'Medidas Preventivas', y, C.success);
    y = drawBulletList(doc, riesgo.medidas_preventivas, y, C.success);
    y += 3;
  }

  // Recommendations
  y = drawSectionTitle(doc, 'Recomendaciones', y, C.success);

  const reco = ai.recomendaciones || {};

  if (reco.ajustes_entrenamiento?.length > 0) {
    y = drawSubTitle(doc, 'Ajustes de Entrenamiento', y);
    y = drawBulletList(doc, reco.ajustes_entrenamiento, y, C.primary);
    y += 2;
  }

  if (reco.areas_foco?.length > 0) {
    y = drawSubTitle(doc, 'Areas de Foco', y);
    y = drawBulletList(doc, reco.areas_foco, y, C.orange);
    y += 2;
  }

  if (reco.proximos_pasos?.length > 0) {
    y = drawSubTitle(doc, 'Proximos Pasos', y);
    y = drawBulletList(doc, reco.proximos_pasos, y, C.purple);
    y += 3;
  }

  // Motivational message
  if (reco.mensaje_motivacional && y < PH - 30) {
    setColor(doc, C.grayBg, 'fill');
    const msgLines = doc.splitTextToSize(reco.mensaje_motivacional, CW - 16);
    const msgH = msgLines.length * 3.5 + 8;
    doc.roundedRect(M, y, CW, msgH, 2, 2, 'F');

    // Left accent bar
    setColor(doc, C.primary, 'fill');
    doc.roundedRect(M, y, 3, msgH, 1.5, 1.5, 'F');
    doc.rect(M + 1.5, y, 1.5, msgH, 'F');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    setColor(doc, C.dark, 'text');
    doc.text(msgLines, M + 8, y + 6);
  }
};

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate the AI performance report as a multi-page PDF
 */
export const generateReportPDF = ({ athlete, athleteName, reportData, aiAnalysis, generatedDate }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const name = athleteName || 'Atleta';
  const genDate = generatedDate || new Date();

  // Build all 4 pages
  buildPage1(doc, name, reportData, aiAnalysis, genDate);
  buildPage2(doc, name, reportData, aiAnalysis, genDate);
  buildPage3(doc, name, reportData, aiAnalysis, genDate);
  buildPage4(doc, name, reportData, aiAnalysis, genDate);

  // Download
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Informe_IA_${safeName}_${fmtDate(genDate).replace(/\//g, '-')}.pdf`);
};
