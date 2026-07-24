import { Sparkline } from './Sparkline';

type StatStatus = 'good' | 'warn' | 'bad' | 'neutral';

interface StatTileProps {
  label: string;
  value: string | number;
  status?: StatStatus;
  meta?: string;
  series?: number[];
  seriesLabel?: string;
}

/**
 * A KPI tile: big tabular number up top, muted label, optional status color
 * and sparkline. Status is conveyed by color AND the number/text, never color
 * alone (SC 1.4.1).
 */
export function StatTile({
  label,
  value,
  status = 'neutral',
  meta,
  series,
  seriesLabel,
}: StatTileProps) {
  const valueClass =
    status === 'good'
      ? 'stat__value stat__value--good'
      : status === 'warn'
        ? 'stat__value stat__value--warn'
        : status === 'bad'
          ? 'stat__value stat__value--bad'
          : 'stat__value';

  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={valueClass}>{value}</span>
      {series && series.length > 1 && (
        <Sparkline data={series} ariaLabel={seriesLabel ?? `${label} trend`} />
      )}
      {meta && <span className="stat__meta">{meta}</span>}
    </div>
  );
}
