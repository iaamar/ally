-- Durable hosted MCP workflows, tool activity, remediation contracts, and attempts.
-- Submitted source is intentionally never stored in these tables.

alter table public.findings
  add column if not exists match_key text,
  add column if not exists ordinal int;

-- Older deployments stored small source excerpts. Hosted activity retains only
-- paths, hashes, finding metadata, and sanitized feedback.
update public.findings set snippet = '' where snippet <> '';

create table if not exists public.mcp_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  parent_run_id uuid references public.mcp_runs(id) on delete cascade,
  kind text not null check (kind in ('tool', 'remediation')),
  tool_name text,
  contract_id text,
  request_id text,
  client_name text,
  status text not null default 'queued'
    check (status in ('queued','running','waiting','succeeded','failed','cancelled','escalated')),
  progress numeric not null default 0 check (progress >= 0),
  total numeric not null default 100 check (total > 0),
  current_stage text not null default 'queued',
  message text not null default '',
  error_category text,
  error_message text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms int
);

create index if not exists mcp_runs_org_created_idx
  on public.mcp_runs (org_id, started_at desc);
create index if not exists mcp_runs_org_status_idx
  on public.mcp_runs (org_id, status, updated_at desc);
create index if not exists mcp_runs_parent_idx
  on public.mcp_runs (parent_run_id, started_at);
create index if not exists mcp_runs_contract_idx
  on public.mcp_runs (org_id, contract_id);
create unique index if not exists mcp_runs_org_request_uidx
  on public.mcp_runs (org_id, request_id)
  where request_id is not null;

create table if not exists public.mcp_run_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.mcp_runs(id) on delete cascade,
  event_key text not null,
  stage text not null,
  status text not null
    check (status in ('queued','running','waiting','succeeded','failed','cancelled','escalated','info')),
  progress numeric not null default 0 check (progress >= 0),
  total numeric not null default 100 check (total > 0),
  message text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, event_key)
);

create index if not exists mcp_run_events_run_idx
  on public.mcp_run_events (run_id, id);

create table if not exists public.remediation_contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workflow_run_id uuid references public.mcp_runs(id) on delete set null,
  contract_id text not null,
  project_name text not null default '',
  baseline jsonb not null,
  scope jsonb not null,
  targets jsonb not null,
  acceptance jsonb not null,
  knowledge jsonb not null default '[]'::jsonb,
  guidance text not null default '',
  created_at timestamptz not null default now(),
  unique (org_id, contract_id)
);

-- Earlier harness experiments created these two tables without the durable
-- workflow link and result payload. Keep their data and extend them in place.
alter table public.remediation_contracts
  add column if not exists workflow_run_id uuid
    references public.mcp_runs(id) on delete set null;

create index if not exists remediation_contracts_org_idx
  on public.remediation_contracts (org_id, created_at desc);

create table if not exists public.remediation_attempts (
  id uuid primary key default gen_random_uuid(),
  contract_row_id uuid not null references public.remediation_contracts(id) on delete cascade,
  n int not null,
  verdict text not null,
  progress_signature text not null default '',
  feedback text not null default '',
  changed_files jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (contract_row_id, n)
);

alter table public.remediation_attempts
  add column if not exists result jsonb not null default '{}'::jsonb;

create index if not exists remediation_attempts_contract_idx
  on public.remediation_attempts (contract_row_id, n);

alter table public.mcp_runs enable row level security;
alter table public.mcp_run_events enable row level security;
alter table public.remediation_contracts enable row level security;
alter table public.remediation_attempts enable row level security;

drop policy if exists mcp_runs_owner on public.mcp_runs;
create policy mcp_runs_owner on public.mcp_runs for all
  using (exists (
    select 1 from public.orgs o
    where o.id = mcp_runs.org_id and o.owner_user = auth.uid()
  ))
  with check (exists (
    select 1 from public.orgs o
    where o.id = mcp_runs.org_id and o.owner_user = auth.uid()
  ));

drop policy if exists mcp_run_events_owner on public.mcp_run_events;
create policy mcp_run_events_owner on public.mcp_run_events for all
  using (exists (
    select 1 from public.mcp_runs r
    join public.orgs o on o.id = r.org_id
    where r.id = mcp_run_events.run_id and o.owner_user = auth.uid()
  ))
  with check (exists (
    select 1 from public.mcp_runs r
    join public.orgs o on o.id = r.org_id
    where r.id = mcp_run_events.run_id and o.owner_user = auth.uid()
  ));

drop policy if exists remediation_contracts_owner on public.remediation_contracts;
create policy remediation_contracts_owner on public.remediation_contracts for all
  using (exists (
    select 1 from public.orgs o
    where o.id = remediation_contracts.org_id and o.owner_user = auth.uid()
  ))
  with check (exists (
    select 1 from public.orgs o
    where o.id = remediation_contracts.org_id and o.owner_user = auth.uid()
  ));

drop policy if exists remediation_attempts_owner on public.remediation_attempts;
create policy remediation_attempts_owner on public.remediation_attempts for all
  using (exists (
    select 1 from public.remediation_contracts c
    join public.orgs o on o.id = c.org_id
    where c.id = remediation_attempts.contract_row_id and o.owner_user = auth.uid()
  ))
  with check (exists (
    select 1 from public.remediation_contracts c
    join public.orgs o on o.id = c.org_id
    where c.id = remediation_attempts.contract_row_id and o.owner_user = auth.uid()
  ));

alter table public.mcp_runs replica identity full;
alter table public.mcp_run_events replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mcp_runs'
  ) then
    alter publication supabase_realtime add table public.mcp_runs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mcp_run_events'
  ) then
    alter publication supabase_realtime add table public.mcp_run_events;
  end if;
end $$;
