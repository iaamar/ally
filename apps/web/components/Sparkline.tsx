interface SparklineProps {
  data: number[];
  ariaLabel: string;
  width?: number;
  height?: number;
}

/**
 * Tiny, uncrowded line chart for KPI tiles. Dark-clean: one accent stroke,
 * no axes or gridlines. Always labelled for screen readers (SC 1.1.1).
 */
export function Sparkline({ data, ariaLabel, width = 120, height = 36 }: SparklineProps) {
  if (data.length === 0) {
    return null;
  }

  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  const points = data.map((v, i) => {
    const x = pad + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w);
    const y = pad + h - ((v - min) / span) * h;
    return { x, y };
  });

  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <polyline
        points={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="2" fill="var(--accent)" />
    </svg>
  );
}
