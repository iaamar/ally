import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createAdminClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let confirmation = '';
  try {
    const body = await request.json() as { confirm?: string };
    confirmation = body.confirm?.trim() ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (
    !user.email ||
    confirmation.toLowerCase() !== user.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: 'Type your email address exactly to confirm deletion.' },
      { status: 400 },
    );
  }

  const admin = adminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'Account deletion is not configured on this server.' },
      { status: 500 },
    );
  }

  const { error: workspaceError } = await admin
    .from('orgs')
    .delete()
    .eq('owner_user', user.id);
  if (workspaceError) {
    return NextResponse.json(
      { error: `Could not delete workspace data: ${workspaceError.message}` },
      { status: 500 },
    );
  }

  const { error: accountError } = await admin.auth.admin.deleteUser(user.id);
  if (accountError) {
    return NextResponse.json(
      { error: `Could not delete the account: ${accountError.message}` },
      { status: 500 },
    );
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
