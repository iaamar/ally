import { NextResponse } from 'next/server';
import { loadActivitySnapshot } from '@/lib/activity-data';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const requestedProject = url.searchParams.get('projectId');
  const projectId = requestedProject && /^[0-9a-f-]{36}$/i.test(requestedProject)
    ? requestedProject
    : undefined;
  try {
    const snapshot = await loadActivitySnapshot(supabase, { projectId });
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Activity snapshot failed:', error);
    return NextResponse.json({ error: 'activity unavailable' }, { status: 503 });
  }
}
