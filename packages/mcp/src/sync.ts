import type { ScanReport } from '@ally/shared';
import { zScanIngest } from '@ally/shared';
import { zEvaluationIngest } from '@ally/shared';
import type { SprintContract } from './harness.js';
import type { RemediationEvaluation } from './state.js';

export async function pushReport(
  report: ScanReport,
  opts: { apiKey: string; baseUrl: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  const body = zScanIngest.parse({
    projectName: report.projectName,
    report,
  });

  const res = await fetch(`${opts.baseUrl}/api/v1/scans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

export type HarnessRunStatus = 'queued' | 'running' | 'waiting' | 'passed' | 'failed';
export type HarnessEventStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'skipped';

export async function pushHarnessEvent(
  event: {
    projectName: string;
    runId: string;
    scanId?: string;
    sourceScanRef?: string;
    runStatus: HarnessRunStatus;
    stage: string;
    eventStatus: HarnessEventStatus;
    message: string;
    detail?: Record<string, unknown>;
  },
  opts: { apiKey: string; baseUrl: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  const response = await fetch(`${opts.baseUrl}/api/v1/harness-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(5_000),
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await response.text(),
  };
}

export async function pushEvaluation(
  projectName: string,
  contract: SprintContract,
  evaluation: RemediationEvaluation,
  opts: { apiKey: string; baseUrl: string },
  scanId?: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const body = zEvaluationIngest.parse({
    projectName,
    scanId,
    contract,
    evaluation,
  });
  const response = await fetch(`${opts.baseUrl}/api/v1/evaluations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await response.text(),
  };
}
