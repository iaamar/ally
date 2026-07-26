import { revokeApiKeyAction } from '@/app/keys/actions';
import { ensureOrg } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const org = await ensureOrg(supabase, user);
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, prefix, created_at, last_used_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false });

  return (
    <section>
      <p className="connect-eyebrow">Credential inventory</p>
      <h1>API Keys</h1>
      <p className="text-muted api-keys-intro">
        Keys are created from the Ally MCP page. Review every active coding-agent
        credential here and revoke access when it is no longer needed.
      </p>

      {keys && keys.length > 0 ? (
        <div className="card api-keys-table">
          <table>
            <caption className="visually-hidden">Existing Ally MCP API keys</caption>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Created</th>
                <th>Last used</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td><code>{key.prefix}…</code></td>
                  <td className="text-muted">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-muted">
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td>
                    <form action={revokeApiKeyAction}>
                      <input type="hidden" name="keyId" value={key.id} />
                      <button type="submit" className="btn-danger">Revoke</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          No API keys yet. Create one from <a href="/connect">Ally MCP</a>.
        </div>
      )}
    </section>
  );
}
