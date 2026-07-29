import { NextResponse } from 'next/server';
import { getProtectedResourceMetadata } from '@/lib/mcp-oauth';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return NextResponse.json(
    getProtectedResourceMetadata(new URL(request.url).origin),
    {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
