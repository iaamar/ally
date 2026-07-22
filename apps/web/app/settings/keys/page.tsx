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

      {sp.created && (
        <aside role="status" style={{
          margin: '1rem 0',
          padding: '1rem',
          border: '2px solid var(--accent)',
          borderRadius: '4px',
          background: 'var(--surface)',
        }}>
          <p><strong>New key created.</strong> Copy it now &mdash; it will not be shown again.</p>
          <output style={{
            display: 'block',
            marginTop: '0.5rem',
            padding: '0.5rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            background: 'var(--bg)',
            borderRadius: '4px',
            wordBreak: 'break-all',
          }}>
            {sp.created}
          </output>
        </aside>
      )}

      <h2 style={{ marginTop: '1.5rem' }}>Create a new key</h2>
      <form action={createKey} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="key-name">Key name</label>
          <input type="text" id="key-name" name="name" required placeholder="e.g. CI pipeline" />
        </div>
        <button type="submit">Create key</button>
      </form>

      <h2>Existing keys</h2>
      {keys && keys.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Prefix</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Last Used</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={tdStyle}>{k.name}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{k.prefix}...</td>
                  <td style={tdStyle}>{new Date(k.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={tdStyle}>
                    <form action={revokeKey} style={{ display: 'inline' }}>
                      <input type="hidden" name="keyId" value={k.id} />
                      <button
                        type="submit"
                        style={{ background: 'var(--danger)', fontSize: '0.875rem', padding: '0.25rem 0.75rem' }}
                      >
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
        <p>No API keys yet.</p>
      )}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  borderBottom: '2px solid var(--border)',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border)',
};
