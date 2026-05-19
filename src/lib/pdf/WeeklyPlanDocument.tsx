import { Document, Page, Text as PDFText, View } from '@react-pdf/renderer';
import { PdfxThemeProvider } from '../pdfx-theme-context';
import { theme } from '../pdfx-theme';
import { Heading } from '../../components/pdfx/heading/pdfx-heading';
import { Section } from '../../components/pdfx/section/pdfx-section';
import { Text } from '../../components/pdfx/text/pdfx-text';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '../../components/pdfx/table/pdfx-table';
import { PdfImage } from '../../components/pdfx/pdf-image/pdfx-pdf-image';

export interface WeeklyPlanSession {
  day: string;
  type: string;
  title: string;
  distanceKm: number | null;
  targetPace: string | null;
  description: string | null;
}

export interface AthletePaceRow {
  pace_code: string;
  pace_seconds_per_km: number;
  heart_rate_min?: number | null;
  heart_rate_max?: number | null;
  description?: string | null;
}

export type AthletePaces = AthletePaceRow[];

export interface LatestVam {
  vam_kmh?: number | null;
  vo2_max?: number | null;
  mlss_kmh?: number | null;
  vt2_kmh?: number | null;
  vt1_kmh?: number | null;
  fc_max?: number | null;
  [key: string]: number | string | null | undefined;
}

export interface LatestConconiTest {
  vam_kmh?: number | null;
  vo2_max?: number | null;
  mlss_kmh?: number | null;
  fc_max?: number | null;
  max_hr_reached?: number | null;
  [key: string]: number | string | null | undefined;
}

export interface WeeklyPlanDocumentProps {
  athleteName: string;
  coachName?: string;
  weekStart: Date;
  weekEnd: Date;
  sessions: WeeklyPlanSession[];
  totalKm: number;
  totalSessions: number;
  activeDays: number;
  dominantType: string;
  coachNotes?: string;
  athletePaces?: AthletePaces | null | undefined;
  latestVam?: LatestVam | null;
  latestConconiTest?: LatestConconiTest | null;
  weekNumber?: number;
}

const LOGO_URL =
  'https://lusirdkixfliydimemre.supabase.co/storage/v1/object/public/site-assets/email-logo.png';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const formatShortRange = (start: Date, end: Date): string => {
  const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'short' });
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startMonth = monthFmt.format(start).replace('.', '');
  const endMonth = monthFmt.format(end).replace('.', '');
  if (sameMonth) {
    return `${start.getDate()} - ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
};

const formatGenDate = (d: Date): string =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);

const isoWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

// ---------------------------------------------------------------------------
// Pace / metrics helpers
// ---------------------------------------------------------------------------

const numOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatPaceMmSs = (sec: number): string => {
  if (!Number.isFinite(sec) || sec <= 0) return '-';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const kmhToMinKm = (kmh: number | null): string => {
  if (kmh == null || kmh <= 0) return '-';
  const secPerKm = 3600 / kmh;
  return formatPaceMmSs(secPerKm);
};

// Map day labels coming from pdfExport.js (Lun/Mar/Mié/...) to our 7 columns
const DAY_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const DAY_HEADERS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
const DAY_LABEL_TO_KEY: Record<string, (typeof DAY_KEYS)[number]> = {
  Lun: 'lunes',
  Mar: 'martes',
  Mié: 'miercoles',
  Jue: 'jueves',
  Vie: 'viernes',
  Sáb: 'sabado',
  Dom: 'domingo',
  // Tolerant fallbacks
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miercoles',
  miércoles: 'miercoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sabado',
  sábado: 'sabado',
  domingo: 'domingo',
};

// ---------------------------------------------------------------------------
// Static configuration
// ---------------------------------------------------------------------------

interface MetricDef {
  key: string;
  label: string;
  color: string;
  unit: string;
}

const METRICS: MetricDef[] = [
  { key: 'fcmax', label: 'FCmax', color: '#4A5568', unit: 'bpm' },
  { key: 'vam', label: 'VAM', color: '#9F7AEA', unit: 'km/h' },
  { key: 'vo2max', label: 'VO2max', color: '#4299E1', unit: 'ml/kg/min' },
  { key: 'mlss', label: 'MLSS', color: '#48BB78', unit: 'km/h' },
  { key: 'vt2', label: 'VT2', color: '#ED8936', unit: 'km/h' },
  { key: 'vt1', label: 'VT1', color: '#38A169', unit: 'km/h' },
];

interface ZoneDef {
  code: string;
  color: string;
}

// Order from RM (max effort) → RR (recovery) — matches old PDF format
const ZONES: ZoneDef[] = [
  { code: 'RM', color: '#1A202C' },
  { code: 'R10', color: '#2D3748' },
  { code: 'R9', color: '#742A2A' },
  { code: 'R8', color: '#9B2C2C' },
  { code: 'R7', color: '#C53030' },
  { code: 'R6', color: '#DD6B20' },
  { code: 'R5', color: '#D69E2E' },
  { code: 'R4', color: '#38A169' },
  { code: 'R3', color: '#319795' },
  { code: 'R2', color: '#3182CE' },
  { code: 'R1', color: '#553C9A' },
  { code: 'RR', color: '#702459' },
];

const PRUEBAS = [
  '> 3000m',
  '> 5K RUTA',
  '> 10K RUTA',
  '> 1/2 MARATON',
  '> MARATON',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeeklyPlanDocument(props: WeeklyPlanDocumentProps) {
  const {
    athleteName,
    coachName,
    weekStart,
    weekEnd,
    sessions,
    totalKm,
    coachNotes,
    athletePaces,
    latestVam,
    latestConconiTest,
    weekNumber,
  } = props;

  // ---------- Metric values ----------
  const fcMax =
    numOrNull(latestVam?.fc_max) ??
    numOrNull(latestConconiTest?.fc_max) ??
    numOrNull(latestConconiTest?.max_hr_reached);
  const vam = numOrNull(latestVam?.vam_kmh) ?? numOrNull(latestConconiTest?.vam_kmh);
  const vo2max = numOrNull(latestVam?.vo2_max) ?? numOrNull(latestConconiTest?.vo2_max);
  const mlss = numOrNull(latestVam?.mlss_kmh) ?? numOrNull(latestConconiTest?.mlss_kmh);
  const vt2 = numOrNull(latestVam?.vt2_kmh);
  const vt1 = numOrNull(latestVam?.vt1_kmh);

  const metricValues: Record<string, { value: string; minKm: string }> = {
    fcmax: {
      value: fcMax != null ? Math.round(fcMax).toString() : '-',
      minKm: '-',
    },
    vam: {
      value: vam != null ? vam.toFixed(1) : '-',
      minKm: kmhToMinKm(vam),
    },
    vo2max: {
      value: vo2max != null ? vo2max.toFixed(0) : '-',
      minKm: '-',
    },
    mlss: {
      value: mlss != null ? mlss.toFixed(1) : '-',
      minKm: kmhToMinKm(mlss),
    },
    vt2: {
      value: vt2 != null ? vt2.toFixed(1) : '-',
      minKm: kmhToMinKm(vt2),
    },
    vt1: {
      value: vt1 != null ? vt1.toFixed(1) : '-',
      minKm: kmhToMinKm(vt1),
    },
  };

  // ---------- Zone values ----------
  const paceByCode: Record<string, AthletePaceRow> = {};
  if (Array.isArray(athletePaces)) {
    for (const p of athletePaces) {
      if (p?.pace_code) paceByCode[p.pace_code] = p;
    }
  }

  const zoneCells = ZONES.map((z) => {
    const p = paceByCode[z.code];
    const paceTxt =
      p && Number.isFinite(p.pace_seconds_per_km) && p.pace_seconds_per_km > 0
        ? formatPaceMmSs(p.pace_seconds_per_km)
        : '-';
    let hrTxt = '-';
    if (p?.heart_rate_min != null && p?.heart_rate_max != null) {
      hrTxt = `${Math.round(p.heart_rate_min)}-${Math.round(p.heart_rate_max)}`;
    } else if (p?.heart_rate_max != null) {
      hrTxt = `<${Math.round(p.heart_rate_max)}`;
    }
    return { code: z.code, color: z.color, paceTxt, hrTxt };
  });

  // ---------- Sessions by day ----------
  const sessionsByDay: Partial<Record<(typeof DAY_KEYS)[number], WeeklyPlanSession>> = {};
  for (const s of sessions || []) {
    const key = DAY_LABEL_TO_KEY[s.day];
    if (key) sessionsByDay[key] = s;
  }

  const computedWeekNumber = weekNumber ?? isoWeekNumber(weekStart);
  const weekRangeText = `Semana: ${formatShortRange(weekStart, weekEnd)}`;
  const subtitleText = coachName ? `Coach: ${coachName}` : 'Plan independiente';

  // ---------- Day-table column widths (landscape: ~794pt usable) ----------
  // 40 (Sem) + 7*98 (days) + 50 (Vol.) = 776pt
  const COL_SEM = 40;
  const COL_DAY = 98;
  const COL_VOL = 50;

  return (
    <PdfxThemeProvider theme={theme}>
      <Document>
        <Page
          size="A4"
          orientation="landscape"
          style={{
            paddingTop: 24,
            paddingBottom: 36,
            paddingLeft: 24,
            paddingRight: 24,
            fontFamily: 'Helvetica',
            fontSize: 10,
            color: theme.colors.foreground,
          }}
        >
          {/* ====================================================== */}
          {/* ZONA 1 — Header de datos del atleta                    */}
          {/* ====================================================== */}
          <View
            style={{
              flexDirection: 'row',
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginBottom: 10,
            }}
          >
            {/* ---- Columna izquierda: ATLETA ---- */}
            <View
              style={{
                width: 220,
                borderRightWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              {/* Logo + heading */}
              <View
                style={{
                  backgroundColor: '#2D3748',
                  padding: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PdfImage src={LOGO_URL} width={22} />
                <PDFText
                  style={{
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 'bold',
                    marginLeft: 8,
                    letterSpacing: 1,
                  }}
                >
                  ATLETA
                </PDFText>
              </View>

              {/* Athlete name */}
              <View
                style={{
                  padding: 6,
                  borderBottomWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: '#F7FAFC',
                }}
              >
                <PDFText style={{ fontSize: 10, fontWeight: 'bold' }}>
                  {athleteName || 'Atleta'}
                </PDFText>
              </View>

              {/* Pruebas list */}
              <View style={{ padding: 8 }}>
                <PDFText style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 4 }}>
                  PRUEBAS
                </PDFText>
                {PRUEBAS.map((p) => (
                  <PDFText key={p} style={{ fontSize: 9, marginBottom: 1 }}>
                    {p}
                  </PDFText>
                ))}
              </View>

              {/* Marcas y Objetivos heading */}
              <View
                style={{
                  backgroundColor: '#EDF2F7',
                  padding: 6,
                  borderTopWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <PDFText style={{ fontSize: 9, fontWeight: 'bold' }}>
                  MARCAS Y OBJETIVOS
                </PDFText>
              </View>
            </View>

            {/* ---- Columna derecha: Métricas + zonas ---- */}
            <View style={{ flex: 1 }}>
              {/* Metrics header row (colored) */}
              <View style={{ flexDirection: 'row' }}>
                {METRICS.map((m) => (
                  <View
                    key={m.key}
                    style={{
                      flex: 1,
                      backgroundColor: m.color,
                      paddingVertical: 5,
                      paddingHorizontal: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PDFText
                      style={{
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    >
                      {m.label}
                    </PDFText>
                  </View>
                ))}
              </View>

              {/* Metrics value row */}
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                {METRICS.map((m) => (
                  <View
                    key={m.key}
                    style={{
                      flex: 1,
                      paddingVertical: 5,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PDFText style={{ fontSize: 11, fontWeight: 'bold' }}>
                      {metricValues[m.key].value}
                    </PDFText>
                  </View>
                ))}
              </View>

              {/* Metrics unit row */}
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: '#F7FAFC',
                }}
              >
                {METRICS.map((m) => (
                  <View
                    key={m.key}
                    style={{
                      flex: 1,
                      paddingVertical: 3,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PDFText
                      style={{ fontSize: 8, color: theme.colors.mutedForeground }}
                    >
                      {m.unit || '-'}
                    </PDFText>
                  </View>
                ))}
              </View>

              {/* Metrics min/km row */}
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                {METRICS.map((m) => (
                  <View
                    key={m.key}
                    style={{
                      flex: 1,
                      paddingVertical: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PDFText style={{ fontSize: 9 }}>
                      {metricValues[m.key].minKm !== '-'
                        ? `${metricValues[m.key].minKm} /km`
                        : '-'}
                    </PDFText>
                  </View>
                ))}
              </View>

              {/* ---- Zones table ---- */}
              {/* Zone code header */}
              <View style={{ flexDirection: 'row' }}>
                <View
                  style={{
                    width: 80,
                    backgroundColor: '#2D3748',
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    justifyContent: 'center',
                  }}
                >
                  <PDFText
                    style={{ color: '#ffffff', fontSize: 8, fontWeight: 'bold' }}
                  >
                    Zona
                  </PDFText>
                </View>
                {zoneCells.map((z) => (
                  <View
                    key={z.code}
                    style={{
                      flex: 1,
                      backgroundColor: z.color,
                      paddingVertical: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PDFText
                      style={{ color: '#ffffff', fontSize: 9, fontWeight: 'bold' }}
                    >
                      {z.code}
                    </PDFText>
                  </View>
                ))}
              </View>

              {/* Ritmo/1.000m row */}
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <View
                  style={{
                    width: 80,
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    justifyContent: 'center',
                    backgroundColor: '#F7FAFC',
                  }}
                >
                  <PDFText style={{ fontSize: 8 }}>Ritmo/1.000m</PDFText>
                </View>
                {zoneCells.map((z) => (
                  <View
                    key={z.code}
                    style={{
                      flex: 1,
                      paddingVertical: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PDFText style={{ fontSize: 9 }}>{z.paceTxt}</PDFText>
                  </View>
                ))}
              </View>

              {/* Pulso row */}
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <View
                  style={{
                    width: 80,
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    justifyContent: 'center',
                    backgroundColor: '#F7FAFC',
                  }}
                >
                  <PDFText style={{ fontSize: 8 }}>Pulso</PDFText>
                </View>
                {zoneCells.map((z) => (
                  <View
                    key={z.code}
                    style={{
                      flex: 1,
                      paddingVertical: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PDFText style={{ fontSize: 8 }}>{z.hrTxt}</PDFText>
                  </View>
                ))}
              </View>

              {/* Recu. a 120p row */}
              <View style={{ flexDirection: 'row' }}>
                <View
                  style={{
                    width: 80,
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    justifyContent: 'center',
                    backgroundColor: '#F7FAFC',
                  }}
                >
                  <PDFText style={{ fontSize: 8 }}>Recu. a 120p</PDFText>
                </View>
                {zoneCells.map((z) => (
                  <View
                    key={z.code}
                    style={{
                      flex: 1,
                      paddingVertical: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PDFText style={{ fontSize: 8 }}>-</PDFText>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* ====================================================== */}
          {/* ZONA 2 — Plan semanal                                   */}
          {/* ====================================================== */}
          <PDFText style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
            {weekRangeText}
            {subtitleText ? `   |   ${subtitleText}` : ''}
          </PDFText>

          <Table variant="grid">
            <TableHeader>
              <TableRow header>
                <TableCell header width={COL_SEM} align="center">
                  Sem
                </TableCell>
                {DAY_HEADERS.map((d) => (
                  <TableCell key={d} header width={COL_DAY} align="center">
                    {d}
                  </TableCell>
                ))}
                <TableCell header width={COL_VOL} align="right">
                  Vol.
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell width={COL_SEM} align="center">
                  <PDFText style={{ fontSize: 11, fontWeight: 'bold' }}>
                    {String(computedWeekNumber)}
                  </PDFText>
                </TableCell>
                {DAY_KEYS.map((dk) => {
                  const s = sessionsByDay[dk];
                  return (
                    <TableCell key={dk} width={COL_DAY}>
                      {s ? (
                        <View>
                          <PDFText
                            style={{
                              fontSize: 9,
                              fontWeight: 'bold',
                              marginBottom: 2,
                            }}
                          >
                            {s.title || '—'}
                          </PDFText>
                          {s.description ? (
                            <PDFText
                              style={{
                                fontSize: 8,
                                color: theme.colors.mutedForeground,
                                lineHeight: 1.3,
                              }}
                            >
                              {s.description}
                            </PDFText>
                          ) : null}
                          {s.distanceKm != null && s.distanceKm > 0 ? (
                            <PDFText
                              style={{
                                fontSize: 8,
                                color: theme.colors.mutedForeground,
                                marginTop: 2,
                              }}
                            >
                              {`Vol: ${s.distanceKm.toFixed(1)} km`}
                            </PDFText>
                          ) : null}
                        </View>
                      ) : (
                        <PDFText
                          style={{
                            fontSize: 8,
                            color: theme.colors.mutedForeground,
                          }}
                        >
                          {' '}
                        </PDFText>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell width={COL_VOL} align="right">
                  <PDFText style={{ fontSize: 11, fontWeight: 'bold' }}>
                    {totalKm > 0 ? totalKm.toFixed(1) : '-'}
                  </PDFText>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* ---- Coach notes (optional) ---- */}
          {coachNotes && coachNotes.trim().length > 0 ? (
            <Section
              variant="callout"
              accentColor={theme.colors.primary}
              spacing="md"
              padding="md"
            >
              <Heading level={5} noMargin>
                Notas del coach
              </Heading>
              <Text variant="sm">{coachNotes}</Text>
            </Section>
          ) : null}

          {/* ---- Footer ---- */}
          <PDFText
            fixed
            style={{
              position: 'absolute',
              bottom: 12,
              left: 24,
              right: 24,
              textAlign: 'center',
              fontSize: 8,
              color: theme.colors.mutedForeground,
            }}
          >
            {`Generado el ${formatGenDate(new Date())} | Training Track`}
          </PDFText>
        </Page>
      </Document>
    </PdfxThemeProvider>
  );
}

export default WeeklyPlanDocument;
