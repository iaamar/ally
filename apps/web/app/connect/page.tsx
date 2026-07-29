import { redirect } from 'next/navigation';
import { ConnectorSetup } from '@/components/ConnectorSetup';
import { ensureOrg } from '@/lib/orgs';
import { PRODUCTION_SITE_URL } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Ally MCP — Ally' };

async function oauthServerReady(): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;
  try {
    const response = await fetch(
      `${new URL(supabaseUrl).origin}/.well-known/oauth-authorization-server/auth/v1`,
      { cache: 'no-store' },
    );
    if (!response.ok) return false;
    const metadata = await response.json() as {
      authorization_endpoint?: unknown;
      token_endpoint?: unknown;
      registration_endpoint?: unknown;
    };
    return typeof metadata.authorization_endpoint === 'string'
      && typeof metadata.token_endpoint === 'string'
      && typeof metadata.registration_endpoint === 'string';
  } catch {
    return false;
  }
}

export default async function ConnectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await ensureOrg(supabase, user);
  const oauthReady = await oauthServerReady();

  return (
    <section className="connect-page">
      <ConnectorSetup
        endpoint={`${PRODUCTION_SITE_URL}/api/mcp`}
        accountEmail={user.email ?? ''}
        oauthReady={oauthReady}
      />
    </section>
  );
}
