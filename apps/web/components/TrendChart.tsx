interface TrendChartProps {
  scores: { date: string; score: number }[];
}

export function TrendChart({ scores }: TrendChartProps) {
  if (scores.length === 0) {
    return <p className="empty">No scan data yet.</p>;
  }

  const width = 720;
  const height = 200;
  const padding = 36;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = scores.map((s, i) => ({
    x: padding + (scores.length === 1 ? chartW / 2 : (i / (scores.length - 1)) * chartW),
    y: padding + chartH - (s.score / 100) * chartH,
  }));

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area =
    `${padding},${padding + chartH} ` +
    points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` ${padding + chartW},${padding + chartH}`;

  const description = `Score trend: ${scores.map((s) => `${s.date}: ${s.score}`).join(', ')}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={description}
      style={{ width: '100%', height: 'auto', maxHeight: '220px' }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      {[0, 50, 100].map((v) => {
        const y = padding + chartH - (v / 100) * chartH;
        return (
          <g key={v}>
            <line
              x1={padding}
              y1={y}
              x2={padding + chartW}
              y2={y}
              stroke="var(--border)"
              strokeDasharray={v === 0 ? undefined : '4'}
            />
            <text x={padding - 10} y={y + 3} textAnchor="end" fontSize="11" fill="var(--muted)">
              {v}
            </text>
          </g>
        );
      })}

      {/* Area + line */}
      <polygon points={area} fill="url(#trendFill)" />
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={polyline} />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" />
      ))}
    </svg>
  );
}
