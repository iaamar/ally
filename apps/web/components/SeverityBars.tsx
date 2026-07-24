const SEVERITY_VAR: Record<string, string> = {
  blocker: 'var(--sev-blocker)',
  critical: 'var(--sev-critical)',
  serious: 'var(--sev-serious)',
  moderate: 'var(--sev-moderate)',
  minor: 'var(--sev-minor)',
};

const SEVERITY_ORDER = ['blocker', 'critical', 'serious', 'moderate', 'minor'] as const;

interface SeverityBarsProps {
  counts: Record<string, number>;
}

export function SeverityBars({ counts }: SeverityBarsProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <p className="empty">No findings.</p>;
  }

  return (
    <div>
      <div
        style={{ display: 'flex', height: '1.5rem', borderRadius: '6px', overflow: 'hidden' }}
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
                background: SEVERITY_VAR[severity],
                minWidth: '2px',
              }}
              title={`${severity}: ${count}`}
            />
          );
        })}
      </div>
      <ul
        className="list-plain"
        style={{
          display: 'flex',
          gap: '1.25rem',
          listStyle: 'none',
          marginTop: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        {SEVERITY_ORDER.map((severity) => {
          const count = counts[severity] ?? 0;
          if (count === 0) return null;
          return (
            <li
              key={severity}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  background: SEVERITY_VAR[severity],
                }}
              />
              <span style={{ color: 'var(--muted)' }}>{severity}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
