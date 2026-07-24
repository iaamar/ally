import type { Tables } from '@/lib/database.types';

const SEVERITY_CLASS: Record<string, string> = {
  blocker: 'sev-dot sev-dot--blocker',
  critical: 'sev-dot sev-dot--critical',
  serious: 'sev-dot sev-dot--serious',
  moderate: 'sev-dot sev-dot--moderate',
  minor: 'sev-dot sev-dot--minor',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'badge badge--warn',
  confirmed: 'badge badge--bad',
  dismissed: 'badge',
};

interface FindingsTableProps {
  findings: Tables<'findings'>[];
}

export function FindingsTable({ findings }: FindingsTableProps) {
  return (
    <table>
      <caption
        style={{ textAlign: 'left', fontWeight: 600, padding: '0.9rem 1rem 0.5rem' }}
      >
        {findings.length} finding{findings.length !== 1 ? 's' : ''}
      </caption>
      <thead>
        <tr>
          <th style={cellPad}>Severity</th>
          <th style={cellPad}>Rule</th>
          <th style={cellPad}>WCAG</th>
          <th style={cellPad}>Location</th>
          <th style={cellPad}>Status</th>
          <th style={cellPad}>Message</th>
        </tr>
      </thead>
      <tbody>
        {findings.map((f) => (
          <tr key={f.id}>
            <td style={cellPad}>
              <span className={SEVERITY_CLASS[f.severity] ?? 'sev-dot'} aria-hidden="true" />
              {f.severity}
            </td>
            <td style={{ ...cellPad, fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
              {f.rule_id}
            </td>
            <td style={cellPad}>
              {f.wcag.map((sc) => (
                <a
                  key={sc}
                  href={`https://www.w3.org/WAI/WCAG22/Understanding/${sc.toLowerCase().replace(/\./g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginRight: '0.35rem' }}
                >
                  {sc}
                </a>
              ))}
            </td>
            <td style={{ ...cellPad, fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
              {f.file}
              {f.line > 0 ? `:${f.line}` : ''}
            </td>
            <td style={cellPad}>
              <span className={STATUS_BADGE[f.status] ?? 'badge'}>
                <span className="badge__dot" aria-hidden="true" />
                {f.status}
              </span>
            </td>
            <td style={cellPad}>
              {f.snippet ? (
                <details>
                  <summary>{f.message || f.rule_id}</summary>
                  <pre style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                    <code>{f.snippet}</code>
                  </pre>
                </details>
              ) : (
                f.message || f.rule_id
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const cellPad: React.CSSProperties = {
  padding: '0.6rem 1rem',
  verticalAlign: 'top',
};
