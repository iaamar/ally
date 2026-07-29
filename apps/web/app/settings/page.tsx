import { redirect } from 'next/navigation';
import { DeleteAccount } from '@/components/DeleteAccount';
import { ensureOrg } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Settings — Ally' };

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const org = await ensureOrg(supabase, user);
  const [{ count: projectCount }, { count: keyCount }, { data: projects }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id),
      supabase
        .from('api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id),
      supabase.from('projects').select('id').eq('org_id', org.id),
    ]);

  const projectIds = (projects ?? []).map((project) => project.id);
  let scanCount = 0;
  if (projectIds.length > 0) {
    const { count } = await supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projectIds);
    scanCount = count ?? 0;
  }

  return (
    <section className="settings-page">
      <header className="page-heading page-heading--hero">
        <div>
          <p className="page-kicker">Workspace administration</p>
          <h1>Settings</h1>
          <p className="text-muted">Manage your account, workspace, and data.</p>
        </div>
      </header>

      <div className="card settings-card">
        <h2 className="settings-card__title">Account</h2>
        <dl className="detail-grid">
          <div className="detail-row">
            <dt>Email</dt>
            <dd className="detail-mono">{user.email ?? '—'}</dd>
          </div>
          <div className="detail-row">
            <dt>User ID</dt>
            <dd className="detail-mono">{user.id}</dd>
          </div>
          <div className="detail-row">
            <dt>Signed up</dt>
            <dd>{formatDate(user.created_at)}</dd>
          </div>
          <div className="detail-row">
            <dt>Last signed in</dt>
            <dd>{formatDate(user.last_sign_in_at)}</dd>
          </div>
        </dl>
      </div>

      <div className="card settings-card">
        <h2 className="settings-card__title">Workspace</h2>
        <dl className="detail-grid">
          <div className="detail-row">
            <dt>Workspace ID</dt>
            <dd className="detail-mono">{org.id}</dd>
          </div>
          <div className="detail-row">
            <dt>Projects</dt>
            <dd>{projectCount ?? 0}</dd>
          </div>
          <div className="detail-row">
            <dt>Scans</dt>
            <dd>{scanCount}</dd>
          </div>
          <div className="detail-row">
            <dt>API keys</dt>
            <dd>{keyCount ?? 0}</dd>
          </div>
        </dl>
      </div>

      <DeleteAccount
        email={user.email ?? ''}
        counts={{
          projects: projectCount ?? 0,
          scans: scanCount,
          keys: keyCount ?? 0,
        }}
      />
    </section>
  );
}
