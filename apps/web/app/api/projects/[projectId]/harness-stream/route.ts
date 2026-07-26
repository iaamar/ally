import { createClient } from '@/lib/supabase/server';
import {
  subscribeToHarness,
  type HarnessSnapshot,
} from '@/lib/harness-event-bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ projectId: string }>;
}

function encodeStatus(snapshot: HarnessSnapshot): Uint8Array {
  return new TextEncoder().encode(
    `event: status\ndata: ${JSON.stringify(snapshot)}\n\n`,
  );
}

export async function GET(request: Request, { params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();
  if (!project) return new Response('Not found', { status: 404 });

  let unsubscribe = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('retry: 2000\n\n'));
      unsubscribe = subscribeToHarness(projectId, (snapshot) => {
        try {
          controller.enqueue(encodeStatus(snapshot));
        } catch {
          unsubscribe();
        }
      });
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
        } catch {
          unsubscribe();
        }
      }, 15_000);

      request.signal.addEventListener('abort', () => {
        unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // The client already closed the stream.
        }
      }, { once: true });
    },
    cancel() {
      unsubscribe();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
