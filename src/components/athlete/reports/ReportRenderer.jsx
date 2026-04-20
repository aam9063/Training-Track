import { FiTrendingUp, FiTrendingDown, FiMinus, FiAlertCircle, FiInfo, FiCheckCircle } from 'react-icons/fi';
import LineTrend from './charts/LineTrend';
import BarComparison from './charts/BarComparison';
import DonutDistribution from './charts/DonutDistribution';
import ProgressGauge from './charts/ProgressGauge';
import ZoneBar from './charts/ZoneBar';
import { tryRecoverReport } from '../../../lib/reportUtils';
import { PRIORITY_CLASSES, DELTA_CLASSES } from '../../../lib/themeClasses';

const CHART_COMPONENTS = {
  line_trend: LineTrend,
  bar_comparison: BarComparison,
  donut_distribution: DonutDistribution,
  progress_gauge: ProgressGauge,
  zone_bar: ZoneBar,
};

const PRIORITY_META = {
  high: {
    ...PRIORITY_CLASSES.high,
    icon: FiAlertCircle,
    text: 'Alta prioridad',
  },
  medium: {
    ...PRIORITY_CLASSES.medium,
    icon: FiInfo,
    text: 'Prioridad media',
  },
  low: {
    ...PRIORITY_CLASSES.low,
    icon: FiCheckCircle,
    text: 'Prioridad baja',
  },
};

function HeadingSection({ section }) {
  return (
    <h3 className="text-base sm:text-lg font-semibold text-ath-text-primary mt-2">
      {section.content}
    </h3>
  );
}

function TextSection({ section }) {
  return (
    <p className="text-sm text-ath-text-secondary leading-relaxed whitespace-pre-wrap">
      {section.content}
    </p>
  );
}

function ListSection({ section }) {
  if (!Array.isArray(section.items) || section.items.length === 0) return null;
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm text-ath-text-secondary">
      {section.items.map((item, i) => (
        <li key={`item-${i}-${String(item).slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  );
}

function KpiSection({ section }) {
  const hasDelta = typeof section.delta === 'number' && Number.isFinite(section.delta);
  const deltaValue = hasDelta ? section.delta : 0;
  let deltaClass = DELTA_CLASSES.neutral;
  let DeltaIcon = FiMinus;
  if (hasDelta) {
    if (deltaValue > 0) {
      deltaClass = DELTA_CLASSES.positive;
      DeltaIcon = FiTrendingUp;
    } else if (deltaValue < 0) {
      deltaClass = DELTA_CLASSES.negative;
      DeltaIcon = FiTrendingDown;
    }
  }

  return (
    <div className="rounded-xl border border-ath-border bg-ath-surface p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-ath-text-muted font-semibold">
          {section.label}
        </p>
        <p className="text-xl font-bold text-ath-text-primary mt-0.5 truncate">
          {section.value}
        </p>
      </div>
      {hasDelta && (
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${deltaClass}`}
        >
          <DeltaIcon className="w-3 h-3" />
          {deltaValue > 0 ? `+${deltaValue}` : deltaValue}
        </span>
      )}
    </div>
  );
}

function RecommendationSection({ section }) {
  const priority = ['high', 'medium', 'low'].includes(section.priority)
    ? section.priority
    : 'medium';
  const styles = PRIORITY_META[priority];
  const Icon = styles.icon;
  return (
    <div className={`rounded-xl border p-3 flex gap-3 ${styles.wrapper}`}>
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`w-4 h-4 ${styles.label}`} />
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={`inline-block text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full mb-1.5 ${styles.badge}`}
        >
          {styles.text}
        </span>
        <p className={`text-sm leading-relaxed ${styles.label}`}>
          {section.content}
        </p>
      </div>
    </div>
  );
}

function ChartSection({ section }) {
  const Cmp = CHART_COMPONENTS[section.chart_id];
  if (!Cmp) {
    if (section.caption) {
      return (
        <div className="rounded-xl border border-ath-border bg-ath-inset p-3">
          <p className="text-xs text-ath-text-muted">{section.caption}</p>
        </div>
      );
    }
    return null;
  }
  return <Cmp data={section.data} caption={section.caption} />;
}

function SectionRenderer({ section }) {
  if (!section || typeof section !== 'object') return null;
  switch (section.type) {
    case 'heading':
      return <HeadingSection section={section} />;
    case 'text':
      return <TextSection section={section} />;
    case 'list':
      return <ListSection section={section} />;
    case 'kpi':
      return <KpiSection section={section} />;
    case 'recommendation':
      return <RecommendationSection section={section} />;
    case 'chart':
      return <ChartSection section={section} />;
    default:
      return null;
  }
}

export function ReportRenderer({ report }) {
  const recovered = tryRecoverReport(report) ?? report;
  if (!recovered || !Array.isArray(recovered.sections) || recovered.sections.length === 0) {
    return (
      <p className="text-sm text-ath-text-muted italic">
        Sin contenido para mostrar.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {recovered.sections.map((section, idx) => (
        <SectionRenderer
          key={`${section?.type ?? 'unknown'}-${idx}`}
          section={section}
        />
      ))}
    </div>
  );
}
