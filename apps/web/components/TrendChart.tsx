interface TrendChartProps {
  scores: { date: string; score: number }[];
}

export function TrendChart({ scores }: TrendChartProps) {
  if (scores.length === 0) {
    return <p>No scan data yet.</p>;
  }

  const width = 400;
  const height = 200;
  const padding = 40;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = scores.map((s, i) => ({
    x: padding + (scores.length === 1 ? chartW / 2 : (i / (scores.length - 1)) * chartW),
    y: padding + chartH - (s.score / 100) * chartH,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  const description = `Score trend: ${scores
    .map((s) => `${s.date}: ${s.score}`)
    .join(', ')}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={description}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      {/* Y axis labels */}
      <text x={padding - 8} y={padding} textAnchor="end" fontSize="10" fill="var(--muted)">
        100
      </text>
      <text x={padding - 8} y={padding + chartH / 2} textAnchor="end" fontSize="10" fill="var(--muted)">
        50
      </text>
      <text x={padding - 8} y={padding + chartH} textAnchor="end" fontSize="10" fill="var(--muted)">
        0
      </text>

      {/* Grid lines */}
      <line x1={padding} y1={padding} x2={padding + chartW} y2={padding} stroke="var(--border)" strokeDasharray="4" />
      <line x1={padding} y1={padding + chartH / 2} x2={padding + chartW} y2={padding + chartH / 2} stroke="var(--border)" strokeDasharray="4" />
      <line x1={padding} y1={padding + chartH} x2={padding + chartW} y2={padding + chartH} stroke="var(--border)" />

      {/* Line */}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={polyline} />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" />
      ))}
    </svg>
  );
}
