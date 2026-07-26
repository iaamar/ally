import { redirect } from 'next/navigation';
import { ConnectorSetup } from '@/components/ConnectorSetup';
import { ensureOrg } from '@/lib/orgs';
import { PRODUCTION_SITE_URL } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Ally MCP — Ally' };

export default async function ConnectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const org = await ensureOrg(supabase, user);
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, prefix, last_used_at')
    .eq('org_id', org.id)
    .order('last_used_at', { ascending: false, nullsFirst: false });

  const lastUsed = keys?.find((key) => key.last_used_at)?.last_used_at ?? null;
  const lastUsedLabel = lastUsed
    ? `${new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(lastUsed))} UTC`
    : 'Not connected yet';

  return (
    <section className="connect-page">
      <div className="connect-hero">
        <div>
          <p className="connect-eyebrow">Developer connectors</p>
          <h1>Ally MCP</h1>
          <p className="connect-intro">
            Add the hosted Ally MCP server to the coding agent you already use.
            Your source stays in the cloned repository; Ally returns WCAG guidance,
            scans supplied files, and syncs results to this workspace.
          </p>
        </div>
      </div>

      <div className="connect-trust-grid">
        <article className="connect-trust-card">
          <span className="connect-trust-card__number">1</span>
          <div>
            <h2>Create a private key</h2>
            <p>One account-scoped key authorizes MCP tools and scan synchronization.</p>
          </div>
        </article>
        <article className="connect-trust-card">
          <span className="connect-trust-card__number">2</span>
          <div>
            <h2>Install from your clone</h2>
            <p>Run the selected command from the repository your agent should inspect.</p>
          </div>
        </article>
        <article className="connect-trust-card">
          <span className="connect-trust-card__number">3</span>
          <div>
            <h2>Verify Ally</h2>
            <p>Start a new agent session and confirm Ally appears in its MCP tools.</p>
          </div>
        </article>
      </div>

      <ConnectorSetup
        endpoint={`${PRODUCTION_SITE_URL}/api/mcp`}
        accountEmail={user.email ?? ''}
        lastUsedLabel={lastUsedLabel}
      />
    </section>
  );
}
