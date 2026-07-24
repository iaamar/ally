import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatTile } from '@/components/StatTile';

function scoreStatus(score: number): 'good' | 'warn' | 'bad' {
  return score >= 90 ? 'good' : score >= 70 ? 'warn' : 'bad';
}

function scoreClass(score: number | null): string {
  if (score === null) return 'stat__value';
  const s = scoreStatus(score);
  return `stat__value stat__value--${s}`;
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Get projects for the user's org
  const { data: orgs } = await supabase
    .from('orgs')
    .select('id')
    .eq('owner_user', user.id);

  const orgIds = orgs?.map((o) => o.id) ?? [];

  if (orgIds.length === 0) {
    return (
      <section>
        <h1>Projects</h1>
        <p className="empty">No projects yet &mdash; sync a scan from the CLI.</p>
      </section>
    );
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, created_at')
    .in('org_id', orgIds)
    .order('created_at', { ascending: false });

  if (!projects || projects.length === 0) {
    return (
      <section>
        <h1>Projects</h1>
        <p className="empty">No projects yet &mdash; sync a scan from the CLI.</p>
      </section>
    );
  }

  // For each project, get latest scan info and total findings
  const projectRows = await Promise.all(
    projects.map(async (p) => {
      const { data: latestScan } = await supabase
        .from('scans')
        .select('id, score, created_at')
        .eq('project_id', p.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: findingsCount } = await supabase
        .from('findings')
        .select('id', { count: 'exact', head: true })
        .in(
          'scan_id',
          (
            await supabase.from('scans').select('id').eq('project_id', p.id)
          ).data?.map((s) => s.id) ?? [],
        );

      return {
        ...p,
        latestScore: latestScan?.score ?? null,
        totalFindings: findingsCount ?? 0,
        lastScan: latestScan?.created_at ?? null,
      };
    }),
  );

  // KPI aggregates (derived from already-fetched rows — no extra queries)
  const scored = projectRows.filter((p) => p.latestScore !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((a, p) => a + (p.latestScore as number), 0) / scored.length)
      : null;
  const totalFindings = projectRows.reduce((a, p) => a + p.totalFindings, 0);
  const lastScanDate = projectRows
    .map((p) => p.lastScan)
    .filter(Boolean)
    .sort()
    .at(-1) as string | undefined;

  return (
    <section>
      <h1>Projects</h1>
      <p className="text-muted" style={{ marginBottom: '0.5rem' }}>
        Accessibility health across your synced projects.
      </p>

      <div className="kpi-grid">
        <StatTile label="Projects" value={projectRows.length} />
        <StatTile
          label="Avg score"
          value={avgScore !== null ? avgScore : '—'}
          status={avgScore !== null ? scoreStatus(avgScore) : 'neutral'}
          meta={avgScore !== null ? `across ${scored.length} scanned` : 'no scans yet'}
        />
        <StatTile
          label="Open findings"
          value={totalFindings}
          status={totalFindings === 0 ? 'good' : totalFindings > 20 ? 'bad' : 'warn'}
        />
        <StatTile
          label="Last scan"
          value={lastScanDate ? new Date(lastScanDate).toLocaleDateString() : '—'}
          meta={lastScanDate ? new Date(lastScanDate).toLocaleTimeString() : undefined}
        />
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <caption className="visually-hidden">Projects and their latest scan results</caption>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem 1rem' }}>Project</th>
              <th style={{ padding: '0.75rem 1rem' }}>Latest score</th>
              <th style={{ padding: '0.75rem 1rem' }}>Findings</th>
              <th style={{ padding: '0.75rem 1rem' }}>Last scan</th>
            </tr>
          </thead>
          <tbody>
            {projectRows.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <a href={`/p/${p.id}`}>{p.name}</a>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span
                    className={scoreClass(p.latestScore)}
                    style={{ fontSize: '1rem', fontWeight: 650 }}
                  >
                    {p.latestScore !== null ? p.latestScore : '—'}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontVariantNumeric: 'tabular-nums' }}>
                  {p.totalFindings}
                </td>
                <td style={{ padding: '0.75rem 1rem' }} className="text-muted">
                  {p.lastScan ? new Date(p.lastScan).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
