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
    <section>
      <div className="page-heading">
        <div>
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
