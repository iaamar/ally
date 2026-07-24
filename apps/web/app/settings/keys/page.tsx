import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { generateApiKey, hashApiKey } from '@/lib/keys';
import { ensureOrg } from '@/lib/orgs';

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const sp = await searchParams;
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

  async function createKey(formData: FormData) {
    'use server';
    const name = (formData.get('name') as string)?.trim();
    if (!name) return;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const org = await ensureOrg(supabase, user);
    const { raw, hash, prefix } = generateApiKey();

    await supabase.from('api_keys').insert({
      org_id: org.id,
      name,
      key_hash: hash,
      prefix,
    });

    redirect(`/settings/keys?created=${encodeURIComponent(raw)}`);
  }

  async function revokeKey(formData: FormData) {
    'use server';
    const keyId = formData.get('keyId') as string;
    if (!keyId) return;

    const supabase = await createClient();
    await supabase.from('api_keys').delete().eq('id', keyId);
    revalidatePath('/settings/keys');
  }

  return (
    <section>
      <h1>API Keys</h1>
      <p className="text-muted" style={{ marginBottom: '0.5rem' }}>
        Keys authorize the Ally CLI/MCP server to sync scans to this dashboard.
      </p>

      {sp.created && (
        <aside role="status" className="notice">
          <p>
            <strong>New key created.</strong> Copy it now &mdash; it will not be shown again.
          </p>
          <output
            style={{
              display: 'block',
              marginTop: '0.6rem',
              padding: '0.6rem 0.75rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              wordBreak: 'break-all',
            }}
          >
            {sp.created}
          </output>
        </aside>
      )}

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <h2 style={{ marginTop: 0 }}>Create a new key</h2>
        <form
          action={createKey}
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 16rem' }}>
            <label htmlFor="key-name">Key name</label>
            <input type="text" id="key-name" name="name" required placeholder="e.g. CI pipeline" />
          </div>
          <button type="submit" className="btn-primary">
            Create key
          </button>
        </form>
      </div>

      <h2>Existing keys</h2>
      {keys && keys.length > 0 ? (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <caption className="visually-hidden">Existing API keys</caption>
            <thead>
              <tr>
                <th style={cellPad}>Name</th>
                <th style={cellPad}>Prefix</th>
                <th style={cellPad}>Created</th>
                <th style={cellPad}>Last used</th>
                <th style={cellPad}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={cellPad}>{k.name}</td>
                  <td style={{ ...cellPad, fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                    {k.prefix}…
                  </td>
                  <td style={cellPad} className="text-muted">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td style={cellPad} className="text-muted">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={cellPad}>
                    <form action={revokeKey} style={{ display: 'inline' }}>
                      <input type="hidden" name="keyId" value={k.id} />
                      <button type="submit" className="btn-danger" style={{ fontSize: '0.82rem' }}>
                        Revoke
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No API keys yet.</p>
      )}
    </section>
  );
}

const cellPad: React.CSSProperties = {
  padding: '0.6rem 1rem',
};
