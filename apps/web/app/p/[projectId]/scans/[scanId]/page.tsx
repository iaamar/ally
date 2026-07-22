import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { FindingsTable } from '@/components/FindingsTable';

interface Props {
  params: Promise<{ projectId: string; scanId: string }>;
  searchParams: Promise<{ severity?: string; status?: string; rule?: string }>;
}

export default async function ScanFindings({ params, searchParams }: Props) {
  const { projectId, scanId } = await params;
  const filters = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: scan } = await supabase
    .from('scans')
    .select('id, score, created_at, project_id')
    .eq('id', scanId)
    .single();

  if (!scan || scan.project_id !== projectId) notFound();

  // Build findings query
  let query = supabase
    .from('findings')
    .select('*')
    .eq('scan_id', scanId)
    .order('line', { ascending: true });

  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.rule) {
    query = query.eq('rule_id', filters.rule);
  }

  const { data: findings } = await query;

  // Get distinct values for filter dropdowns
  const { data: allFindings } = await supabase
    .from('findings')
    .select('severity, status, rule_id')
    .eq('scan_id', scanId);

  const severities = [...new Set(allFindings?.map((f) => f.severity) ?? [])].sort();
  const statuses = [...new Set(allFindings?.map((f) => f.status) ?? [])].sort();
  const rules = [...new Set(allFindings?.map((f) => f.rule_id) ?? [])].sort();

  return (
    <section>
      <h1>
        <a href={`/p/${projectId}`} style={{ textDecoration: 'none', color: 'var(--muted)' }}>
          Project
        </a>
        {' / '}
        Scan {new Date(scan.created_at).toLocaleString()}
      </h1>
      <p style={{ margin: '0.5rem 0 1.5rem' }}>
        Score: <strong>{scan.score}</strong>
      </p>

      <form method="get" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="filter-severity">Severity</label>
          <select id="filter-severity" name="severity" defaultValue={filters.severity ?? ''} style={selectStyle}>
            <option value="">All</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" name="status" defaultValue={filters.status ?? ''} style={selectStyle}>
            <option value="">All</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="filter-rule">Rule</label>
          <select id="filter-rule" name="rule" defaultValue={filters.rule ?? ''} style={selectStyle}>
            <option value="">All</option>
            {rules.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit">Filter</button>
        </div>
      </form>

      <FindingsTable findings={findings ?? []} />
    </section>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  fontSize: '1rem',
  background: 'var(--surface)',
  color: 'var(--fg)',
};
