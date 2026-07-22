import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { TrendChart } from '@/components/TrendChart';
import { SeverityBars } from '@/components/SeverityBars';

interface Props {
  params: Promise<{ projectId: string }>;
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
    .select('id, score, created_at, summary')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);

  const latestScan = scans?.[0] ?? null;

  // Severity counts from latest scan's findings
  let severityCounts: Record<string, number> = {};
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

  // Trend data (oldest first for the chart)
  const trendScores = (scans ?? [])
    .slice()
    .reverse()
    .map((s) => ({
      date: new Date(s.created_at).toLocaleDateString(),
      score: s.score,
    }));

  return (
    <section>
      <h1>{project.name}</h1>

      {latestScan ? (
        <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 1.5rem' }}>
          Score: {latestScan.score}
        </p>
      ) : (
        <p>No scans yet.</p>
      )}

      <h2>Severity Breakdown</h2>
      <SeverityBars counts={severityCounts} />

      <h2 style={{ marginTop: '2rem' }}>Score Trend</h2>
      <TrendChart scores={trendScores} />

      <h2 style={{ marginTop: '2rem' }}>Recent Scans</h2>
      {scans && scans.length > 0 ? (
        <ul style={{ listStyle: 'none' }}>
          {scans.map((s) => (
            <li key={s.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <a href={`/p/${projectId}/scans/${s.id}`}>
                {new Date(s.created_at).toLocaleString()} &mdash; Score: {s.score}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No scans yet.</p>
      )}
    </section>
  );
}
