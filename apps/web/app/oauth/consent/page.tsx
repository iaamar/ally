import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Authorize MCP connection — Ally',
};

function consentPath(authorizationId: string): string {
  return `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
}

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>;
}) {
  const params = await searchParams;
  const authorizationId = params.authorization_id?.trim();
  if (!authorizationId) {
    return <ConsentError message="This authorization request is missing its identifier." />;
  }
  const validAuthorizationId = authorizationId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(consentPath(authorizationId))}`);
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(
    validAuthorizationId,
  );
  if (error || !data) {
    return (
      <ConsentError
        message={error?.message ?? 'Ally could not load this authorization request.'}
      />
    );
  }
  if ('redirect_url' in data) redirect(data.redirect_url);

  async function decide(formData: FormData) {
    'use server';
    const decision = formData.get('decision');
    const serverClient = await createClient();
    const result = decision === 'approve'
      ? await serverClient.auth.oauth.approveAuthorization(validAuthorizationId)
      : await serverClient.auth.oauth.denyAuthorization(validAuthorizationId);
    if (result.error || !result.data) {
      redirect(
        `${consentPath(validAuthorizationId)}&error=${encodeURIComponent(
          result.error?.message ?? 'Authorization failed.',
        )}`,
      );
    }
    redirect(result.data.redirect_url);
  }

  const scopes = data.scope.split(/\s+/).filter(Boolean);

  return (
    <section className="oauth-consent-page">
      <div className="oauth-consent-card">
        <Image
          className="oauth-consent-card__logo"
          src="/ally-mcp-icon.png"
          width={64}
          height={64}
          alt="Ally"
          priority
        />
        <p className="connect-eyebrow">Secure MCP authorization</p>
        <h1>Connect {data.client.name || 'this coding agent'} to Ally?</h1>
        <p className="text-muted">
          This connection will act as <strong>{data.user.email}</strong> and access
          only that account&apos;s Ally organization.
        </p>

        <div className="oauth-consent-summary">
          <div>
            <span>Client</span>
            <strong>{data.client.name || 'MCP client'}</strong>
          </div>
          <div>
            <span>Callback</span>
            <code>{data.redirect_uri}</code>
          </div>
        </div>

        <div className="oauth-permissions">
          <h2>Requested access</h2>
          <ul>
            <li>Search Ally&apos;s WCAG knowledge base</li>
            <li>Scan source explicitly supplied by the coding agent</li>
            <li>Create remediation plans and verify fixes</li>
            <li>Read and publish scans, findings, and progress traces</li>
          </ul>
          {scopes.length ? (
            <p className="oauth-scope">
              OAuth scope: <code>{scopes.join(' ')}</code>
            </p>
          ) : null}
        </div>

        {params.error ? <p className="danger-error" role="alert">{params.error}</p> : null}

        <form action={decide} className="oauth-consent-actions">
          <button className="btn-ghost" name="decision" value="deny" type="submit">
            Deny
          </button>
          <button className="btn-primary" name="decision" value="approve" type="submit">
            Authorize Ally
          </button>
        </form>
        <p className="oauth-consent-note">
          Ally never stores source submitted to hosted scan or verification tools.
          You can revoke this connection from your Ally account later.
        </p>
      </div>
    </section>
  );
}

function ConsentError({ message }: { message: string }) {
  return (
    <section className="oauth-consent-page">
      <div className="oauth-consent-card">
        <p className="connect-eyebrow">MCP authorization</p>
        <h1>Connection could not be authorized</h1>
        <p className="danger-error" role="alert">{message}</p>
        <a href="/connect">Return to Ally MCP</a>
      </div>
    </section>
  );
}
