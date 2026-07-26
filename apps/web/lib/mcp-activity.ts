import { createClient } from '@supabase/supabase-js';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { CallToolResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Database, Json } from './database.types';

export type HostedToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;
export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'escalated';

export function validProgressToken(value: unknown): value is string | number {
  return (typeof value === 'string' && value.length > 0)
    || (typeof value === 'number' && Number.isInteger(value));
}

function platformClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error('Ally platform storage is not configured.');
  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function safeError(error: unknown): { category: string; message: string } {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { category: 'cancelled', message: 'The MCP client cancelled this tool call.' };
  }
  if (error instanceof Error) {
    return {
      category: error.name === 'Error' ? 'tool_error' : error.name,
      message: error.message.slice(0, 500),
    };
  }
  return { category: 'tool_error', message: 'The tool call failed.' };
}

function sanitize(value: unknown, key = ''): Json {
  if (/(source|content|snippet|authorization|token|api.?key|secret)/i.test(key)) {
    return '[redacted]';
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([name, item]) => [name, sanitize(item, name)]),
    );
  }
  return String(value);
}

function authContext(extra: HostedToolExtra) {
  const orgId = extra.authInfo?.extra?.orgId;
  const keyId = extra.authInfo?.extra?.keyId;
  const keyName = extra.authInfo?.extra?.keyName;
  const clientName = extra.authInfo?.extra?.clientName;
  if (typeof orgId !== 'string' || typeof keyId !== 'string') {
    throw new Error('Authenticated Ally organization context is missing.');
  }
  return {
    orgId,
    keyId,
    keyName: typeof keyName === 'string' ? keyName : undefined,
    clientName: typeof clientName === 'string' ? clientName : undefined,
  };
}

export interface ToolActivity {
  runId: string | null;
  orgId: string;
  keyId: string;
  signal: AbortSignal;
  progress(
    value: number,
    message: string,
    stage: string,
    detail?: Record<string, unknown>,
  ): Promise<void>;
  link(fields: {
    projectId?: string;
    parentRunId?: string;
    contractId?: string;
  }): Promise<void>;
  createWorkflow(projectId: string | undefined, message: string): Promise<string>;
  workflowEvent(
    workflowRunId: string,
    stage: string,
    status: RunStatus | 'info',
    message: string,
    progress: number,
    detail?: Record<string, unknown>,
  ): Promise<void>;
}

async function appendEvent(
  runId: string,
  stage: string,
  status: RunStatus | 'info',
  message: string,
  progress: number,
  detail?: Record<string, unknown>,
): Promise<void> {
  const eventKey = `${stage}:${status}:${progress}:${message}`;
  const { error } = await platformClient().from('mcp_run_events').upsert({
    run_id: runId,
    event_key: eventKey,
    stage,
    status,
    progress,
    total: 100,
    message: message.slice(0, 500),
    detail: sanitize(detail ?? {}) as Json,
  }, { onConflict: 'run_id,event_key', ignoreDuplicates: true });
  if (error) throw new Error(`Could not record MCP progress: ${error.message}`);
}

export async function runWithMcpActivity(
  toolName: string,
  extra: HostedToolExtra,
  work: (activity: ToolActivity) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const { orgId, keyId, keyName, clientName } = authContext(extra);
  const started = Date.now();
  const span = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? trace.getTracer('ally-hosted-mcp').startSpan(`mcp.tool.${toolName}`, {
        attributes: { 'mcp.tool.name': toolName },
      })
    : null;
  let runId: string | null = null;
  try {
    const { data, error } = await platformClient().from('mcp_runs').insert({
      org_id: orgId,
      api_key_id: keyId,
      kind: 'tool',
      tool_name: toolName,
      request_id: String(extra.requestId),
      client_name: clientName ?? null,
      status: 'running',
      progress: 0,
      current_stage: 'start',
      message: `Using tool: ${toolName}`,
    }).select('id').single();
    if (!error && data) {
      runId = data.id;
      await appendEvent(runId, 'start', 'running', `Using tool: ${toolName}`, 0);
    }
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warning',
      message: 'MCP activity persistence unavailable',
      tool: toolName,
      error: safeError(error).message,
    }));
  }

  let lastProgress = 0;
  const workflowProgress = new Map<string, number>();
  const activity: ToolActivity = {
    runId,
    orgId,
    keyId,
    signal: extra.signal,
    async progress(value, message, stage, detail) {
      if (extra.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const next = Math.max(lastProgress, Math.min(100, value));
      lastProgress = next;
      const progressToken = extra._meta?.progressToken;
      if (validProgressToken(progressToken)) {
        try {
          await extra.sendNotification({
            method: 'notifications/progress',
            params: { progressToken, progress: next, total: 100, message },
          });
        } catch {
          // Native progress is best-effort. Durable Supabase progress remains authoritative.
        }
      }
      if (!runId) return;
      await platformClient().from('mcp_runs').update({
        progress: next,
        current_stage: stage,
        message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq('id', runId);
      await appendEvent(runId, stage, 'running', message, next, detail);
    },
    async link(fields) {
      if (!runId) return;
      await platformClient().from('mcp_runs').update({
        ...(fields.projectId ? { project_id: fields.projectId } : {}),
        ...(fields.parentRunId ? { parent_run_id: fields.parentRunId } : {}),
        ...(fields.contractId ? { contract_id: fields.contractId } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', runId);
    },
    async createWorkflow(projectId, message) {
      const { data, error } = await platformClient().from('mcp_runs').insert({
        org_id: orgId,
        api_key_id: keyId,
        project_id: projectId ?? null,
        kind: 'remediation',
        client_name: clientName ?? null,
        status: 'running',
        progress: 0,
        current_stage: 'plan',
        message,
      }).select('id').single();
      if (error || !data) throw new Error(`Could not create remediation run: ${error?.message}`);
      await appendEvent(data.id, 'plan', 'running', message, 0);
      workflowProgress.set(data.id, 0);
      return data.id;
    },
    async workflowEvent(workflowRunId, stage, status, message, progress, detail) {
      const terminal = ['succeeded', 'failed', 'cancelled', 'escalated'].includes(status);
      const now = new Date().toISOString();
      const nextProgress = Math.max(
        workflowProgress.get(workflowRunId) ?? 0,
        Math.min(100, progress),
      );
      workflowProgress.set(workflowRunId, nextProgress);
      await platformClient().from('mcp_runs').update({
        status: status === 'info' ? 'running' : status,
        progress: nextProgress,
        current_stage: stage,
        message: message.slice(0, 500),
        updated_at: now,
        ...(terminal ? { completed_at: now } : {}),
      }).eq('id', workflowRunId);
      await appendEvent(workflowRunId, stage, status, message, nextProgress, detail);
    },
  };

  console.log(JSON.stringify({
    level: 'info',
    message: 'MCP tool started',
    tool: toolName,
    runId,
    requestId: String(extra.requestId),
  }));

  try {
    const result = await work(activity);
    if (extra.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const duration = Date.now() - started;
    if (runId) {
      const now = new Date().toISOString();
      const toolError = result.isError
        ? result.content.find((item) => item.type === 'text')?.text.slice(0, 500)
          ?? 'Tool returned an error.'
        : null;
      await platformClient().from('mcp_runs').update({
        status: result.isError ? 'failed' : 'succeeded',
        progress: 100,
        current_stage: result.isError ? 'failed' : 'complete',
        message: toolError ?? 'Tool completed.',
        error_category: result.isError ? 'tool_result' : null,
        error_message: toolError,
        updated_at: now,
        completed_at: now,
        duration_ms: duration,
      }).eq('id', runId);
      await appendEvent(
        runId,
        result.isError ? 'failed' : 'complete',
        result.isError ? 'failed' : 'succeeded',
        toolError ?? 'Tool completed.',
        100,
      );
    }
    console.log(JSON.stringify({
      level: result.isError ? 'error' : 'info',
      message: result.isError ? 'MCP tool returned an error' : 'MCP tool completed',
      tool: toolName,
      runId,
      durationMs: duration,
    }));
    span?.setAttribute('mcp.run.status', result.isError ? 'failed' : 'succeeded');
    span?.setAttribute('mcp.run.duration_ms', duration);
    span?.setStatus({
      code: result.isError ? SpanStatusCode.ERROR : SpanStatusCode.OK,
    });
    span?.end();
    return result;
  } catch (error) {
    const duration = Date.now() - started;
    const safe = safeError(error);
    const status: RunStatus = safe.category === 'cancelled' ? 'cancelled' : 'failed';
    if (runId) {
      const now = new Date().toISOString();
      await platformClient().from('mcp_runs').update({
        status,
        current_stage: status,
        message: safe.message,
        error_category: safe.category,
        error_message: safe.message,
        updated_at: now,
        completed_at: now,
        duration_ms: duration,
      }).eq('id', runId);
      await appendEvent(runId, status, status, safe.message, lastProgress);
    }
    console.error(JSON.stringify({
      level: 'error',
      message: 'MCP tool failed',
      tool: toolName,
      runId,
      category: safe.category,
      error: safe.message,
      durationMs: duration,
    }));
    span?.setAttribute('mcp.run.status', status);
    span?.setAttribute('mcp.run.duration_ms', duration);
    span?.setAttribute('mcp.error.category', safe.category);
    span?.setStatus({ code: SpanStatusCode.ERROR, message: safe.message });
    span?.end();
    return {
      isError: true,
      content: [{ type: 'text', text: safe.message }],
    };
  }
}

export function getMcpPlatformClient() {
  return platformClient();
}
