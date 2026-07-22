const SEVERITY_COLORS: Record<string, string> = {
  blocker: '#991b1b',
  critical: '#dc2626',
  serious: '#ea580c',
  moderate: '#ca8a04',
  minor: '#65a30d',
};

const SEVERITY_ORDER = ['blocker', 'critical', 'serious', 'moderate', 'minor'] as const;

interface SeverityBarsProps {
  counts: Record<string, number>;
}

export function SeverityBars({ counts }: SeverityBarsProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <p>No findings.</p>;
  }

  return (
    <div>
      <div
        style={{ display: 'flex', height: '1.5rem', borderRadius: '4px', overflow: 'hidden' }}
        role="img"
        aria-label={`Severity breakdown: ${SEVERITY_ORDER.map(
          (s) => `${s} ${counts[s] ?? 0}`,
        ).join(', ')}`}
      >
        {SEVERITY_ORDER.map((severity) => {
          const count = counts[severity] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={severity}
              style={{
                width: `${pct}%`,
                background: SEVERITY_COLORS[severity],
                minWidth: '2px',
              }}
              title={`${severity}: ${count}`}
            />
          );
        })}
      </div>
      <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {SEVERITY_ORDER.map((severity) => {
          const count = counts[severity] ?? 0;
          if (count === 0) return null;
          return (
            <li key={severity} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  background: SEVERITY_COLORS[severity],
                }}
              />
              {severity}: {count}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
