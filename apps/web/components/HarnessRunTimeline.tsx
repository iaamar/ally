'use client';

import type { ActivitySnapshot } from '@/lib/activity-data';
import { McpActivityDashboard } from './McpActivityDashboard';

export function HarnessRunTimeline({
  projectId,
  initialSnapshot,
}: {
  projectId: string;
  scanId: string;
  initialSnapshot: ActivitySnapshot;
}) {
  return (
    <div>
      <p className="text-muted" style={{ marginBottom: '0.75rem' }}>
        Durable MCP activity for this project. Updates continue across dashboard refreshes
        and server deployments.
      </p>
      <McpActivityDashboard
        initialSnapshot={initialSnapshot}
        projectId={projectId}
        compact
      />
    </div>
  );
}
