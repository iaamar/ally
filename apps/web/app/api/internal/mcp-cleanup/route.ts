import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const supabase = createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from('mcp_runs')
    .delete()
    .lt('completed_at', cutoff)
    .in('status', ['succeeded', 'failed', 'cancelled', 'escalated'])
    .select('id');

  if (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'MCP telemetry cleanup failed',
      category: 'database_error',
    }));
    return NextResponse.json({ error: 'cleanup failed' }, { status: 500 });
  }

  console.log(JSON.stringify({
    level: 'info',
    message: 'MCP telemetry cleanup completed',
    deletedRuns: data?.length ?? 0,
    cutoff,
  }));
  return NextResponse.json({ deletedRuns: data?.length ?? 0, cutoff });
}
