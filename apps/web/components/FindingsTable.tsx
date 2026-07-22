import type { Tables } from '@/lib/database.types';

const SEVERITY_COLORS: Record<string, string> = {
  blocker: '#991b1b',
  critical: '#dc2626',
  serious: '#ea580c',
  moderate: '#ca8a04',
  minor: '#65a30d',
};

interface FindingsTableProps {
  findings: Tables<'findings'>[];
}

export function FindingsTable({ findings }: FindingsTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption style={{ textAlign: 'left', fontWeight: 600, marginBottom: '0.5rem' }}>
          {findings.length} finding{findings.length !== 1 ? 's' : ''}
        </caption>
        <thead>
          <tr>
            <th style={thStyle}>Severity</th>
            <th style={thStyle}>Rule</th>
            <th style={thStyle}>WCAG</th>
            <th style={thStyle}>Location</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Message</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.id}>
              <td style={tdStyle}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: SEVERITY_COLORS[f.severity] ?? 'var(--muted)',
                    marginRight: '0.375rem',
                    verticalAlign: 'middle',
                  }}
                />
                {f.severity}
              </td>
              <td style={tdStyle}>{f.rule_id}</td>
              <td style={tdStyle}>
                {f.wcag.map((sc) => (
                  <a
                    key={sc}
                    href={`https://www.w3.org/WAI/WCAG22/Understanding/${sc.toLowerCase().replace(/\./g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginRight: '0.25rem' }}
                  >
                    {sc}
                  </a>
                ))}
              </td>
              <td style={tdStyle}>
                {f.file}
                {f.line > 0 ? `:${f.line}` : ''}
              </td>
              <td style={tdStyle}>{f.status}</td>
              <td style={tdStyle}>
                {f.snippet ? (
                  <details>
                    <summary>{f.message || f.rule_id}</summary>
                    <pre style={{ marginTop: '0.25rem', fontSize: '0.8rem', overflowX: 'auto' }}>
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
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  borderBottom: '2px solid var(--border)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
};
