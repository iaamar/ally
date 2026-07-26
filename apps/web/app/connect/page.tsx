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
      <ConnectorSetup
        endpoint={`${PRODUCTION_SITE_URL}/api/mcp`}
        accountEmail={user.email ?? ''}
        lastUsedLabel={lastUsedLabel}
      />
    </section>
  );
}
