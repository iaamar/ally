import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ProjectDetailCharts } from '@/components/ProjectDetailCharts';
import { StatTile } from '@/components/StatTile';

interface Props {
  params: Promise<{ projectId: string }>;
}

const SEVERITY_ORDER = ['blocker', 'critical', 'serious', 'moderate', 'minor'] as const;

function scoreStatus(score: number): 'good' | 'warn' | 'bad' {
  return score >= 90 ? 'good' : score >= 70 ? 'warn' : 'bad';
}

export default async function ProjectOverview({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .single();

  if (!project) notFound();

  // Recent scans (last 10)
  const { data: scans } = await supabase
    .from('scans')
    .select('id, score, created_at, files_scanned, summary')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);

  const latestScan = scans?.[0] ?? null;

  // Severity counts from latest scan's findings
  const severityCounts: Record<string, number> = {};
  if (latestScan) {
    const { data: findings } = await supabase
      .from('findings')
      .select('severity')
      .eq('scan_id', latestScan.id);

    if (findings) {
      for (const f of findings) {
        severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
      }
    }
  }

  const chartScans = (scans ?? [])
    .slice()
    .reverse()
    .map((s) => ({
      id: s.id,
      score: s.score,
    }));

  const totalFindings = Object.values(severityCounts).reduce((a, b) => a + b, 0);
  const topSeverity = SEVERITY_ORDER.find((s) => (severityCounts[s] ?? 0) > 0) ?? '—';

  return (
    <section className="project-detail">
      <Breadcrumbs items={[
        { label: 'Projects', href: '/' },
        { label: project.name },
      ]} />
      <h1>{project.name}</h1>

      {latestScan ? (
        <>
          <div className="kpi-grid">
            <StatTile
              label="Accessibility score"
              value={latestScan.score}
              status={scoreStatus(latestScan.score)}
              series={chartScans.map((s) => s.score)}
              seriesLabel="Score over recent scans"
              meta={`Latest scan ${latestScan.id.slice(0, 8)}`}
            />
            <StatTile label="Files scanned" value={latestScan.files_scanned ?? 0} />
            <StatTile
              label="Open findings"
              value={totalFindings}
              status={totalFindings === 0 ? 'good' : totalFindings > 20 ? 'bad' : 'warn'}
            />
            <StatTile
              label="Top severity"
              value={topSeverity}
              status={
                topSeverity === '—'
                  ? 'good'
                  : topSeverity === 'blocker' || topSeverity === 'critical'
                    ? 'bad'
                    : topSeverity === 'serious' || topSeverity === 'moderate'
                      ? 'warn'
                      : 'neutral'
              }
            />
          </div>

          <ProjectDetailCharts
            scans={chartScans}
            severityCounts={severityCounts}
          />

          <div className="card recent-scans">
            <h2 style={{ marginTop: 0 }}>Recent scans</h2>
            {scans && scans.length > 0 ? (
              <ul className="scan-card-grid">
                {scans.map((s) => (
                  <li key={s.id}>
                    <a className="scan-id-link" href={`/p/${projectId}/scans/${s.id}`}>
                      <span className="scan-id-link__content">
                        <span>Scan</span>
                        <code>{s.id}</code>
                      </span>
                      <span
                        className={`stat__value stat__value--${scoreStatus(s.score)}`}
                      >
                        {s.score}
                      </span>
                      <span className="project-card__arrow" aria-hidden="true">›</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No scans yet.</p>
            )}
          </div>
        </>
      ) : (
        <p className="empty">No scans yet.</p>
      )}
    </section>
  );
}
