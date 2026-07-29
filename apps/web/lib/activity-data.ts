import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';

export type ActivityRunStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'escalated';

export interface ActivityEvent {
  id: number;
  run_id: string;
  stage: string;
  status: ActivityRunStatus | 'info';
  progress: number;
  total: number;
  message: string;
  detail: Json;
  created_at: string;
}

export interface ActivityAttempt {
  id: string;
  n: number;
  verdict: string;
  feedback: string;
  changed_files: string[];
  result: Json;
  created_at: string;
}

export interface ActivityRun {
  id: string;
  kind: 'tool' | 'remediation';
  tool_name: string | null;
  status: ActivityRunStatus;
  progress: number;
  total: number;
  current_stage: string;
  message: string;
  error_category: string | null;
  error_message: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  parent_run_id: string | null;
  contract_id: string | null;
  project_id: string | null;
  project_name: string | null;
  api_key_id: string | null;
  connection_name: string | null;
  client_name: string | null;
  events: ActivityEvent[];
  attempts: ActivityAttempt[];
}

export interface ActivitySnapshot {
  generatedAt: string;
  databaseLatencyMs: number;
  toolCount: number;
  runs: ActivityRun[];
}

const TOOL_COUNT = 11;

export async function loadActivitySnapshot(
  supabase: SupabaseClient<Database>,
  options: { projectId?: string; limit?: number } = {},
): Promise<ActivitySnapshot> {
  const started = performance.now();
  let query = supabase
    .from('mcp_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(Math.min(options.limit ?? 100, 250));

  if (options.projectId) query = query.eq('project_id', options.projectId);
  const { data: runRows, error } = await query;
  if (error) throw new Error(`Could not load MCP activity: ${error.message}`);

  const runs = runRows ?? [];
  const runIds = runs.map((run) => run.id);
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const resolvedProjectId = (run: (typeof runs)[number]) =>
    run.project_id
    ?? (run.parent_run_id ? runsById.get(run.parent_run_id)?.project_id ?? null : null);
  const projectIds = [...new Set(runs.flatMap((run) => {
    const id = resolvedProjectId(run);
    return id ? [id] : [];
  }))];
  const keyIds = [...new Set(runs.flatMap((run) => run.api_key_id ? [run.api_key_id] : []))];
  const contractIds = [...new Set(runs.flatMap((run) => run.contract_id ? [run.contract_id] : []))];

  const [eventsResult, projectsResult, keysResult, contractsResult] = await Promise.all([
    runIds.length
      ? supabase.from('mcp_run_events').select('*').in('run_id', runIds).order('id')
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase.from('projects').select('id, name').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
    keyIds.length
      ? supabase.from('api_keys').select('id, name').in('id', keyIds)
      : Promise.resolve({ data: [], error: null }),
    contractIds.length
      ? supabase.from('remediation_contracts').select('id, contract_id').in('contract_id', contractIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const contractRows = contractsResult.data ?? [];
  const contractRowIds = contractRows.map((contract) => contract.id);
  const attemptsResult = contractRowIds.length
    ? await supabase
        .from('remediation_attempts')
        .select('id, contract_row_id, n, verdict, feedback, changed_files, result, created_at')
        .in('contract_row_id', contractRowIds)
        .order('n')
    : { data: [], error: null };

  const projectNames = new Map((projectsResult.data ?? []).map((row) => [row.id, row.name]));
  const keyNames = new Map((keysResult.data ?? []).map((row) => [row.id, row.name]));
  const contractRowsById = new Map(contractRows.map((row) => [row.contract_id, row.id]));
  const eventsByRun = new Map<string, ActivityEvent[]>();
  for (const event of eventsResult.data ?? []) {
    const list = eventsByRun.get(event.run_id) ?? [];
    list.push(event as ActivityEvent);
    eventsByRun.set(event.run_id, list);
  }
  const attemptsByContractRow = new Map<string, ActivityAttempt[]>();
  for (const attempt of attemptsResult.data ?? []) {
    const list = attemptsByContractRow.get(attempt.contract_row_id) ?? [];
    list.push({
      id: attempt.id,
      n: attempt.n,
      verdict: attempt.verdict,
      feedback: attempt.feedback,
      changed_files: attempt.changed_files as unknown as string[],
      result: attempt.result,
      created_at: attempt.created_at,
    });
    attemptsByContractRow.set(attempt.contract_row_id, list);
  }

  return {
    generatedAt: new Date().toISOString(),
    databaseLatencyMs: Math.max(1, Math.round(performance.now() - started)),
    toolCount: TOOL_COUNT,
    runs: runs.map((run) => {
      const contractRowId = run.contract_id ? contractRowsById.get(run.contract_id) : undefined;
      const projectId = resolvedProjectId(run);
      return {
        ...run,
        kind: run.kind as ActivityRun['kind'],
        status: run.status as ActivityRunStatus,
        progress: Number(run.progress),
        total: Number(run.total),
        project_id: projectId,
        project_name: projectId ? projectNames.get(projectId) ?? null : null,
        connection_name: run.api_key_id ? keyNames.get(run.api_key_id) ?? null : null,
        events: eventsByRun.get(run.id) ?? [],
        attempts: contractRowId ? attemptsByContractRow.get(contractRowId) ?? [] : [],
      };
    }),
  };
}
