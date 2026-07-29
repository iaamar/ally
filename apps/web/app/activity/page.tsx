import { redirect } from 'next/navigation';
import { McpActivityDashboard } from '@/components/McpActivityDashboard';
import { loadActivitySnapshot } from '@/lib/activity-data';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Traces — Ally' };

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const snapshot = await loadActivitySnapshot(supabase);
  return (
    <section className="activity-page">
      <div className="page-heading page-heading--hero">
        <div>
          <p className="page-kicker">MCP observability</p>
          <h1>Traces</h1>
          <p className="text-muted">
            Live tool calls and remediation workflows across your organization.
          </p>
        </div>
      </div>
      <McpActivityDashboard initialSnapshot={snapshot} />
    </section>
  );
}
