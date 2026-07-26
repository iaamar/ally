import { createClient } from '@/lib/supabase/server';
import { resolveSiteUrl } from '@/lib/site-url';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const siteUrl = resolveSiteUrl(origin);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl}/`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_failed`);
}
