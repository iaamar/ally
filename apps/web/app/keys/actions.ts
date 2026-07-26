'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/keys';
import { ensureOrg } from '@/lib/orgs';

export interface CreateApiKeyState {
  raw?: string;
  error?: string;
}

export async function createApiKeyAction(
  _previous: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Enter a name for this connection.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in again before creating an API key.' };

  const org = await ensureOrg(supabase, user);
  const { raw, hash, prefix } = generateApiKey();
  const { error } = await supabase.from('api_keys').insert({
    org_id: org.id,
    name: name.slice(0, 120),
    key_hash: hash,
    prefix,
  });
  if (error) return { error: 'The API key could not be created. Try again.' };

  revalidatePath('/keys');
  revalidatePath('/connect');
  return { raw };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const keyId = String(formData.get('keyId') ?? '');
  if (!keyId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const org = await ensureOrg(supabase, user);
  await supabase
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('org_id', org.id);

  revalidatePath('/connect');
  revalidatePath('/keys');
}
