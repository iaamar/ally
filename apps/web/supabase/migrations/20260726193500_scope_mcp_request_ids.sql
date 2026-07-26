-- JSON-RPC request IDs only identify calls within one client session and may
-- repeat. Local remediation run IDs are durable and remain idempotent.
drop index if exists public.mcp_runs_org_request_uidx;
create unique index mcp_runs_org_request_uidx
  on public.mcp_runs (org_id, request_id)
  where request_id is not null and kind = 'remediation';
