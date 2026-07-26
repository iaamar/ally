import type {
  AttemptRecord,
  EvaluationResult,
  RemediationContract,
} from '@ally/shared';
import type { Json } from './database.types';
import { getMcpPlatformClient } from './mcp-activity';

export interface StoredContract {
  rowId: string;
  workflowRunId: string | null;
  projectName: string;
  contract: RemediationContract;
}

export async function saveHostedContract(
  orgId: string,
  projectName: string,
  workflowRunId: string,
  contract: RemediationContract,
): Promise<void> {
  const { error } = await getMcpPlatformClient().from('remediation_contracts').insert({
    org_id: orgId,
    project_name: projectName,
    workflow_run_id: workflowRunId,
    contract_id: contract.contractId,
    baseline: contract.baseline as unknown as Json,
    scope: contract.scope as unknown as Json,
    targets: contract.targets as unknown as Json,
    acceptance: contract.acceptance as unknown as Json,
    knowledge: contract.knowledge as unknown as Json,
    guidance: contract.guidance,
  });
  if (error) throw new Error(`Could not save remediation contract: ${error.message}`);
}

export async function loadHostedContract(
  orgId: string,
  contractId: string,
): Promise<StoredContract | null> {
  const { data } = await getMcpPlatformClient()
    .from('remediation_contracts')
    .select('id, workflow_run_id, project_name, contract_id, baseline, scope, targets, acceptance, knowledge, guidance, created_at')
    .eq('org_id', orgId)
    .eq('contract_id', contractId)
    .maybeSingle();
  if (!data) return null;
  return {
    rowId: data.id,
    workflowRunId: data.workflow_run_id,
    projectName: data.project_name,
    contract: {
      contractId: data.contract_id,
      createdAt: data.created_at,
      baseline: data.baseline as unknown as RemediationContract['baseline'],
      scope: data.scope as unknown as RemediationContract['scope'],
      targets: data.targets as unknown as RemediationContract['targets'],
      acceptance: data.acceptance as unknown as RemediationContract['acceptance'],
      knowledge: data.knowledge as unknown as RemediationContract['knowledge'],
      guidance: data.guidance,
    },
  };
}

export async function loadHostedAttempts(contractRowId: string): Promise<AttemptRecord[]> {
  const { data } = await getMcpPlatformClient()
    .from('remediation_attempts')
    .select('n, verdict, progress_signature, feedback, changed_files')
    .eq('contract_row_id', contractRowId)
    .order('n', { ascending: true });
  return (data ?? []).map((row) => ({
    n: row.n,
    verdict: row.verdict as AttemptRecord['verdict'],
    progressSignature: row.progress_signature,
    feedback: row.feedback,
    changedFiles: row.changed_files as unknown as string[],
  }));
}

export async function saveHostedAttempt(
  contractRowId: string,
  attempt: AttemptRecord,
  result: EvaluationResult,
): Promise<void> {
  const { error } = await getMcpPlatformClient().from('remediation_attempts').insert({
    contract_row_id: contractRowId,
    n: attempt.n,
    verdict: attempt.verdict,
    progress_signature: attempt.progressSignature,
    feedback: attempt.feedback,
    changed_files: attempt.changedFiles as unknown as Json,
    result: result as unknown as Json,
  });
  if (error) {
    throw new Error(
      error.code === '23505'
        ? 'Another verification for this contract is already in progress.'
        : `Could not save remediation attempt: ${error.message}`,
    );
  }
}
