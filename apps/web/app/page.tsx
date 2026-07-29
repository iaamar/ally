import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProjectCharts } from '@/components/ProjectCharts';
import { StatTile } from '@/components/StatTile';

function scoreStatus(score: number): 'good' | 'warn' | 'bad' {
  return score >= 90 ? 'good' : score >= 70 ? 'warn' : 'bad';
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
      <section className="projects-page">
        <header className="page-heading page-heading--hero">
          <div>
            <p className="page-kicker">Workspace overview</p>
            <h1>Projects</h1>
            <p className="text-muted">Accessibility health across every connected codebase.</p>
          </div>
        </header>
        <div className="empty empty--feature">
          <span className="empty__icon" aria-hidden="true">⌁</span>
          <strong>Connect your first codebase</strong>
          <p>Run an Ally scan from your coding agent and this workspace will fill with findings, trends, and verified fixes.</p>
          <a className="btn-primary" href="/connect">Connect Ally MCP</a>
        </div>
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
      <section className="projects-page">
        <header className="page-heading page-heading--hero">
          <div>
            <p className="page-kicker">Workspace overview</p>
            <h1>Projects</h1>
            <p className="text-muted">Accessibility health across every connected codebase.</p>
          </div>
        </header>
        <div className="empty empty--feature">
          <span className="empty__icon" aria-hidden="true">⌁</span>
          <strong>Connect your first codebase</strong>
          <p>Run an Ally scan from your coding agent and this workspace will fill with findings, trends, and verified fixes.</p>
          <a className="btn-primary" href="/connect">Connect Ally MCP</a>
        </div>
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
    <section className="projects-page">
      <header className="page-heading page-heading--hero">
        <div>
          <p className="page-kicker">Workspace overview</p>
          <h1>Projects</h1>
          <p className="text-muted">
            Accessibility health across every connected codebase.
          </p>
        </div>
        <a className="btn-primary" href="/connect">Connect project</a>
      </header>

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

      <ProjectCharts
        projects={projectRows.map((project) => ({
          name: project.name,
          score: project.latestScore,
          findings: project.totalFindings,
        }))}
      />

      <div className="project-card-grid" aria-label="Projects">
        {projectRows.map((project) => (
          <a className="project-card" href={`/p/${project.id}`} key={project.id}>
            <div className="project-card__topline">
              <span className="project-card__eyebrow">Project</span>
              <span className="project-card__arrow" aria-hidden="true">›</span>
            </div>
            <h2>{project.name}</h2>
            <div className="project-card__metrics">
              <div>
                <span>Score</span>
                <strong className={project.latestScore === null ? '' : `stat__value--${scoreStatus(project.latestScore)}`}>
                  {project.latestScore ?? '—'}
                </strong>
              </div>
              <div>
                <span>Findings</span>
                <strong>{project.totalFindings}</strong>
              </div>
              <div>
                <span>Last scan</span>
                <strong>{project.lastScan ? new Date(project.lastScan).toLocaleDateString() : '—'}</strong>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
