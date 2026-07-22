import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

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
        <p>No projects yet &mdash; sync a scan from the CLI.</p>
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
        <p>No projects yet &mdash; sync a scan from the CLI.</p>
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

  return (
    <section>
      <h1>Projects</h1>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>Project Name</th>
              <th style={thStyle}>Latest Score</th>
              <th style={thStyle}>Total Findings</th>
              <th style={thStyle}>Last Scan</th>
            </tr>
          </thead>
          <tbody>
            {projectRows.map((p) => (
              <tr key={p.id}>
                <td style={tdStyle}>
                  <a href={`/p/${p.id}`}>{p.name}</a>
                </td>
                <td style={tdStyle}>{p.latestScore !== null ? p.latestScore : '--'}</td>
                <td style={tdStyle}>{p.totalFindings}</td>
                <td style={tdStyle}>
                  {p.lastScan ? new Date(p.lastScan).toLocaleDateString() : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  borderBottom: '2px solid var(--border)',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border)',
};
