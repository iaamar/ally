import type { SupabaseClient, User } from '@supabase/supabase-js';

export async function ensureOrg(
  supabase: SupabaseClient,
  user: User,
): Promise<{ id: string }> {
  const { data: existing } = await supabase
    .from('orgs')
    .select('id')
    .eq('owner_user', user.id)
    .single();

  if (existing) {
    return { id: existing.id };
  }

  const emailLocal = user.email?.split('@')[0] ?? 'user';
  const { data: created, error } = await supabase
    .from('orgs')
    .insert({ name: `${emailLocal}'s org`, owner_user: user.id })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create org: ${error?.message}`);
  }

  return { id: created.id };
}
