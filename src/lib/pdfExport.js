import React from 'react';
import * as Sentry from '@sentry/react';
import { pdf } from '@react-pdf/renderer';
import { WeeklyPlanDocument } from './pdf/WeeklyPlanDocument';
import { AIWeeklyReportDocument } from './pdf/AIWeeklyReportDocument';
import { showError } from './toast';

// ==================== Shared helpers ====================

const slugify = (str) =>
  (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const fmtFileDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const triggerBlobDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // small delay so the browser can pick the blob before revoke
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ==================== Weekly plan mappers ====================

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TYPE_LABEL_MAP = {
  easy: 'Easy',
  rodaje: 'Easy',
  suave: 'Easy',
  tempo: 'Tempo',
  umbral: 'Tempo',
  interval: 'Interval',
  series: 'Interval',
  vo2: 'Interval',
  long: 'Long',
  largo: 'Long',
  tirada: 'Long',
  recovery: 'Recovery',
  rest: 'Recovery',
  descanso: 'Recovery',
  recuperacion: 'Recovery',
  fuerza: 'Fuerza',
  gym: 'Fuerza',
};

const normalizeType = (type) => {
  if (!type) return '—';
  const lower = String(type).toLowerCase().trim();
  for (const [k, v] of Object.entries(TYPE_LABEL_MAP)) {
    if (lower.includes(k)) return v;
  }
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

/**
 * Build the array of session rows from the trainings-by-day-index map produced
 * by useWeeklyTrainings.
 */
const buildSessionsList = (trainings) => {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const t = trainings?.[i];
    if (!t) continue;
    if (t.type === 'rest') {
      out.push({
        day: DAY_LABELS[i],
        type: 'Recovery',
        title: t.title || 'Descanso',
        distanceKm: null,
        targetPace: null,
        description: t.description || 'Descanso',
      });
      continue;
    }

    const distanceKm =
      typeof t.totalDistanceMeters === 'number' && t.totalDistanceMeters > 0
        ? t.totalDistanceMeters / 1000
        : null;

    // Build a target-pace string from unique paceCodes
    const paceCodes = (t.exercises || [])
      .map((ex) => ex.paceCode)
      .filter(Boolean);
    const uniquePaces = [...new Set(paceCodes)];
    const targetPace = uniquePaces.length > 0 ? uniquePaces.join(' / ') : null;

    out.push({
      day: DAY_LABELS[i],
      type: normalizeType(t.type),
      title: t.title || 'Entrenamiento',
      distanceKm,
      targetPace,
      description: t.description || t.title || null,
    });
  }
  return out;
};

const computeWeeklySummary = (trainings) => {
  let totalKm = 0;
  let totalSessions = 0;
  let activeDays = 0;
  const typeCounter = {};

  for (let i = 0; i < 7; i++) {
    const t = trainings?.[i];
    if (!t) continue;
    if (t.type === 'rest') continue;

    totalSessions += 1;
    activeDays += 1;
    if (typeof t.totalDistanceMeters === 'number') {
      totalKm += t.totalDistanceMeters / 1000;
    }
    const norm = normalizeType(t.type);
    typeCounter[norm] = (typeCounter[norm] || 0) + 1;
  }

  const dominantType =
    Object.entries(typeCounter).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  return { totalKm, totalSessions, activeDays, dominantType };
};

const collectCoachNotes = (trainings) => {
  const notes = [];
  for (let i = 0; i < 7; i++) {
    const t = trainings?.[i];
    if (!t || !t.notes) continue;
    notes.push(`${DAY_LABELS[i]}: ${t.notes}`);
  }
  return notes.join('\n');
};

// ==================== Main exports ====================

/**
 * Generate the weekly training plan PDF.
 * Async because @react-pdf/renderer's pdf().toBlob() returns a Promise.
 *
 * Signature preserved from the original jsPDF version:
 * { athleteName, personalBests, athletePaces, latestVam, latestConconiTest, trainings, weekDays }
 *
 * personalBests is currently ignored by the weekly plan PDF.
 * athletePaces / latestVam / latestConconiTest are forwarded to the document
 * so they can be rendered alongside the weekly summary.
 */
export const generateWeeklyPDF = async ({
  athleteName,
  trainings,
  weekDays,
  coachName,
  coachNotes: coachNotesProp,
  athletePaces,
  latestVam,
  latestConconiTest,
  // legacy (ignored): personalBests
} = {}) => {
  try {
    if (!Array.isArray(weekDays) || weekDays.length === 0) {
      showError('No hay datos de la semana para exportar');
      return;
    }

    const weekStart = weekDays[0] instanceof Date ? weekDays[0] : new Date(weekDays[0]);
    const weekEnd =
      weekDays[6] instanceof Date ? weekDays[6] : new Date(weekDays[weekDays.length - 1]);

    const sessions = buildSessionsList(trainings || {});
    const { totalKm, totalSessions, activeDays, dominantType } = computeWeeklySummary(
      trainings || {}
    );
    const coachNotes = coachNotesProp || collectCoachNotes(trainings || {});

    const docProps = {
      athleteName: (athleteName || 'Atleta').trim(),
      coachName: coachName || '',
      weekStart,
      weekEnd,
      sessions,
      totalKm,
      totalSessions,
      activeDays,
      dominantType,
      coachNotes,
      athletePaces: athletePaces || null,
      latestVam: latestVam || null,
      latestConconiTest: latestConconiTest || null,
    };
    const docElement = React.createElement(WeeklyPlanDocument, docProps);

    const blob = await pdf(docElement).toBlob();

    const namePart = slugify(athleteName) || 'atleta';
    const fileName = `plan-semanal-${namePart}-${fmtFileDate(weekStart)}.pdf`;
    triggerBlobDownload(blob, fileName);
  } catch (err) {
    console.error('[generateWeeklyPDF] Error:', err);
    Sentry.captureException(err, { extra: { fn: 'generateWeeklyPDF' } });
    showError(`Error al generar el PDF del plan semanal: ${err?.message || err}`);
  }
};

// ==================== AI Report ====================

const stripHtml = (s) =>
  typeof s === 'string'
    ? s
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

/**
 * Map the legacy report shape (ai_analysis with resumen/alertas/recomendaciones/comparativa)
 * to the new AIWeeklyReportDocument props.
 */
const mapReportToDocProps = ({ report, athleteName }) => {
  // communication-agent D10 (Phase 8): generateAIReportPDF's only call site
  // (confirmed by grep — see design.md) is the athlete's own "Descargar
  // PDF" button in src/pages/athlete/MyReports.jsx, which now calls the
  // get_weekly_ai_reports RPC. Whatever the caller's query already resolved
  // for `ai_analysis` is already correctly masked server-side — no
  // app-layer fallback needed here. If a future coach-facing caller of
  // generateAIReportPDF is added, it must pass a `report` whose
  // `ai_analysis` already carries the coach-facing (wide) value from its
  // own query — this function trusts whatever it is given.
  const ai = report?.ai_analysis || {};
  const alertas = Array.isArray(ai.alertas) ? ai.alertas : [];
  const recomendaciones = Array.isArray(ai.recomendaciones) ? ai.recomendaciones : [];
  const comparativa = ai.comparativa || {};

  const weekStart = report?.week_start
    ? new Date(`${report.week_start}T00:00:00`)
    : new Date();
  const weekEnd = report?.week_end ? new Date(`${report.week_end}T00:00:00`) : new Date();

  const totalKm = Number(comparativa.km_ejecutado ?? report?.actual_km ?? 0) || 0;
  const totalSessions = Number(comparativa.sesiones_ejecutadas ?? report?.sessions_done ?? 0) || 0;
  const avgHr = report?.avg_hr ?? null;
  const sufferScore = report?.suffer_score ?? null;
  const acwr = report?.acwr ?? null;

  const kpis = {
    totalKm,
    totalSessions,
    avgPace: report?.avg_pace || (report?.avg_rpe ? `RPE ${report.avg_rpe}/10` : '—'),
    avgHr,
    sufferScore,
    acwr,
  };

  // Weekly load: prefer history if provided, else 1-bar fallback with current week
  const weeklyLoad = Array.isArray(report?.weekly_load_history) && report.weekly_load_history.length > 0
    ? report.weekly_load_history.map((w) => ({
        week: w.label || w.week || '',
        km: Number(w.km ?? w.value ?? 0),
      }))
    : totalKm > 0
    ? [{ week: 'Esta sem.', km: totalKm }]
    : [];

  // HR zone distribution
  const hrZoneDistribution = Array.isArray(report?.hr_zone_distribution)
    ? report.hr_zone_distribution.map((z) => ({
        label: z.label || z.zone || '',
        value: Number(z.value ?? z.percent ?? z.minutes ?? 0),
      }))
    : [];

  const vdotProgression = Array.isArray(report?.vdot_progression)
    ? report.vdot_progression.map((v) => ({
        week: v.week || v.label || '',
        vdot: Number(v.vdot ?? v.value ?? 0),
      }))
    : undefined;

  // Build report sections from ai.resumen, alertas, recomendaciones, plus any pre-built sections
  const reportSections = [];

  if (Array.isArray(ai.sections) && ai.sections.length > 0) {
    ai.sections.forEach((s) => {
      reportSections.push({
        type: s.type,
        content: s.content,
        items: s.items,
        label: s.label,
        value: s.value,
        delta: s.delta,
        priority: s.priority,
      });
    });
  } else {
    if (alertas.length > 0) {
      reportSections.push({ type: 'heading', content: 'Alertas' });
      alertas.forEach((a) => {
        const tipo = a.tipo ? `${a.tipo}: ` : '';
        const desc = stripHtml(a.descripcion || '');
        const priority = a.nivel === 'critical' ? 'high' : a.nivel === 'attention' ? 'medium' : 'low';
        reportSections.push({
          type: 'recommendation',
          content: `${tipo}${desc}`,
          priority,
        });
      });
    }

    const kmExec = comparativa.km_ejecutado ?? report?.actual_km ?? null;
    const kmPlan = comparativa.km_planificado ?? report?.planned_km ?? null;
    const sessExec = comparativa.sesiones_ejecutadas ?? report?.sessions_done ?? null;
    const sessPlan = comparativa.sesiones_planificadas ?? report?.sessions_planned ?? null;

    if (kmPlan != null || sessPlan != null) {
      reportSections.push({ type: 'heading', content: 'Ejecutado vs planificado' });
      if (kmPlan != null) {
        reportSections.push({
          type: 'kpi',
          label: 'Kilómetros',
          value: `${kmExec ?? 0} / ${kmPlan ?? 0} km`,
        });
      }
      if (sessPlan != null) {
        reportSections.push({
          type: 'kpi',
          label: 'Sesiones',
          value: `${sessExec ?? 0} / ${sessPlan ?? 0}`,
        });
      }
    }

    if (recomendaciones.length > 0) {
      reportSections.push({ type: 'heading', content: 'Recomendaciones' });
      reportSections.push({
        type: 'list',
        items: recomendaciones.map((r) => stripHtml(r)),
      });
    }
  }

  return {
    athleteName: (athleteName || 'Atleta').trim(),
    weekStart,
    weekEnd,
    executiveSummary: stripHtml(ai.resumen || ''),
    kpis,
    weeklyLoad,
    hrZoneDistribution,
    vdotProgression,
    reportSections,
    generatedDate: new Date(),
  };
};

/**
 * Generate the AI weekly report PDF.
 * Async because @react-pdf/renderer's pdf().toBlob() returns a Promise.
 *
 * Signature preserved: { report, athleteName }.
 */
export const generateAIReportPDF = async ({ report, athleteName } = {}) => {
  try {
    if (!report) {
      showError('No hay informe para exportar');
      return;
    }

    const docProps = mapReportToDocProps({ report, athleteName });
    const docElement = React.createElement(AIWeeklyReportDocument, docProps);

    const blob = await pdf(docElement).toBlob();

    const datePart = fmtFileDate(docProps.weekStart) || 'sin-fecha';
    const fileName = `informe-ia-${datePart}.pdf`;
    triggerBlobDownload(blob, fileName);
  } catch (err) {
    console.error('[generateAIReportPDF] Error:', err);
    Sentry.captureException(err, { extra: { fn: 'generateAIReportPDF' } });
    showError(`Error al generar el PDF del informe IA: ${err?.message || err}`);
  }
};
