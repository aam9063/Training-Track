import { Document, Page } from '@react-pdf/renderer';
import { PdfxThemeProvider } from '../pdfx-theme-context';
import { theme } from '../pdfx-theme';
import { PageHeader } from '../../components/pdfx/page-header/pdfx-page-header';
import { PageFooter } from '../../components/pdfx/page-footer/pdfx-page-footer';
import { Heading } from '../../components/pdfx/heading/pdfx-heading';
import { Text } from '../../components/pdfx/text/pdfx-text';
import { Section } from '../../components/pdfx/section/pdfx-section';
import { KeyValue } from '../../components/pdfx/key-value/pdfx-key-value';
import { PdfAlert } from '../../components/pdfx/alert/pdfx-alert';
import { PdfGraph } from '../../components/pdfx/graph/pdfx-graph';
import { PdfList } from '../../components/pdfx/list/pdfx-list';

export type AIReportSectionType = 'heading' | 'text' | 'list' | 'kpi' | 'recommendation';

export interface AIReportSection {
  type: AIReportSectionType;
  content?: string;
  items?: string[];
  label?: string;
  value?: string | number;
  delta?: string | number;
  priority?: 'low' | 'medium' | 'high';
}

export interface AIWeeklyReportDocumentProps {
  athleteName: string;
  weekStart: Date;
  weekEnd: Date;
  executiveSummary: string;
  kpis: {
    totalKm: number;
    totalSessions: number;
    avgPace: string;
    avgHr: number | null;
    sufferScore: number | null;
    acwr: number | null;
  };
  weeklyLoad: Array<{ week: string; km: number }>;
  hrZoneDistribution: Array<{ label: string; value: number }>;
  vdotProgression?: Array<{ week: string; vdot: number }>;
  reportSections: AIReportSection[];
  generatedDate: Date;
}

const formatLongDate = (start: Date, end: Date): string => {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'long' });
  const fullFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  if (sameMonth) {
    return `${start.getDate()} al ${end.getDate()} de ${monthFmt.format(end)} de ${end.getFullYear()}`;
  }
  if (sameYear) {
    const startShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(start);
    return `${startShort} al ${fullFmt.format(end)}`;
  }
  return `${fullFmt.format(start)} al ${fullFmt.format(end)}`;
};

const formatGenDate = (d: Date): string =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);

export function AIWeeklyReportDocument(props: AIWeeklyReportDocumentProps) {
  const {
    athleteName,
    weekStart,
    weekEnd,
    executiveSummary,
    kpis,
    weeklyLoad,
    hrZoneDistribution,
    vdotProgression,
    reportSections,
    generatedDate,
  } = props;

  const subtitle = `Semana del ${formatLongDate(weekStart, weekEnd)}`;

  const kpiItems = [
    { key: 'Km totales', value: `${(kpis.totalKm ?? 0).toFixed(1)} km` },
    { key: 'Sesiones', value: String(kpis.totalSessions ?? 0) },
    { key: 'Ritmo medio', value: kpis.avgPace || '—' },
    { key: 'FC media', value: kpis.avgHr != null ? `${Math.round(kpis.avgHr)} ppm` : '—' },
    { key: 'Suffer score', value: kpis.sufferScore != null ? String(kpis.sufferScore) : '—' },
    { key: 'ACWR', value: kpis.acwr != null ? kpis.acwr.toFixed(2) : '—' },
  ];

  const hasWeeklyLoad = Array.isArray(weeklyLoad) && weeklyLoad.length > 0;
  const hasHrZones = Array.isArray(hrZoneDistribution) && hrZoneDistribution.length > 0;
  const hasVdot = Array.isArray(vdotProgression) && vdotProgression.length > 1;
  const hasSections = Array.isArray(reportSections) && reportSections.length > 0;

  return (
    <PdfxThemeProvider theme={theme}>
      <Document>
        <Page
          size="A4"
          style={{
            paddingTop: 110,
            paddingBottom: 60,
            paddingLeft: 40,
            paddingRight: 40,
            fontFamily: 'Helvetica',
            fontSize: 11,
            color: theme.colors.foreground,
          }}
        >
          <PageHeader
            fixed
            variant="branded"
            title="Informe IA semanal"
            subtitle={subtitle}
            rightText={athleteName || 'Atleta'}
            rightSubText="Hermes IA"
            background={theme.colors.accent}
            titleColor="#FFFFFF"
          />

          {executiveSummary ? (
            <PdfAlert variant="info" title="Resumen Hermes">
              {executiveSummary}
            </PdfAlert>
          ) : null}

          <Section spacing="md">
            <KeyValue
              items={kpiItems}
              direction="horizontal"
              divided
              size="md"
              boldValue
            />
          </Section>

          {hasWeeklyLoad ? (
            <Section spacing="md">
              <Heading level={3}>Carga semanal</Heading>
              <PdfGraph
                variant="bar"
                data={weeklyLoad.map((w) => ({ label: w.week, value: w.km }))}
                title="Volumen semanal (km)"
                fullWidth
                showValues
                showGrid
                colors={[theme.colors.primary]}
              />
            </Section>
          ) : null}

          {hasHrZones ? (
            <Section spacing="md">
              <Heading level={3}>Distribución de zonas FC</Heading>
              <PdfGraph
                variant="donut"
                data={hrZoneDistribution.map((z) => ({ label: z.label, value: z.value }))}
                title="Tiempo en zonas FC"
                legend="right"
              />
            </Section>
          ) : null}

          {hasVdot ? (
            <Section spacing="md">
              <Heading level={3}>Evolución VDOT</Heading>
              <PdfGraph
                variant="line"
                data={(vdotProgression as Array<{ week: string; vdot: number }>).map((v) => ({
                  label: v.week,
                  value: v.vdot,
                }))}
                title="Evolución VDOT"
                fullWidth
                smooth
                showDots
                colors={[theme.colors.accent]}
              />
            </Section>
          ) : null}

          {hasSections ? (
            <Section spacing="md">
              <Heading level={3}>Análisis de Hermes</Heading>
              {reportSections.map((sec, idx) => {
                const key = `sec-${idx}`;
                if (sec.type === 'heading') {
                  return (
                    <Heading key={key} level={4}>
                      {sec.content || ''}
                    </Heading>
                  );
                }
                if (sec.type === 'text') {
                  return (
                    <Text key={key} variant="base">
                      {sec.content || ''}
                    </Text>
                  );
                }
                if (sec.type === 'list') {
                  const items = (sec.items || []).map((it) => ({ text: it }));
                  if (items.length === 0) return null;
                  return <PdfList key={key} items={items} variant="bullet" gap="sm" />;
                }
                if (sec.type === 'kpi') {
                  const label = sec.label || '';
                  const valueStr =
                    String(sec.value ?? '—') + (sec.delta ? ` (${sec.delta})` : '');
                  return (
                    <KeyValue
                      key={key}
                      items={[{ key: label, value: valueStr }]}
                      direction="horizontal"
                      size="md"
                      boldValue
                    />
                  );
                }
                if (sec.type === 'recommendation') {
                  const variant = sec.priority === 'high' ? 'warning' : 'info';
                  return (
                    <PdfAlert key={key} variant={variant} title="Recomendación">
                      {sec.content || ''}
                    </PdfAlert>
                  );
                }
                return null;
              })}
            </Section>
          ) : null}

          <PageFooter
            fixed
            variant="three-column"
            leftText="TrainingTrack"
            centerText={`Generado el ${formatGenDate(generatedDate || new Date())}`}
            rightText="Informe IA"
          />
        </Page>
      </Document>
    </PdfxThemeProvider>
  );
}

export default AIWeeklyReportDocument;
