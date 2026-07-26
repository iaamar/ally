create table if not exists public.remediation_contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  contract_id text not null,
  project_name text not null default '',
  baseline jsonb not null,
  scope jsonb not null,
  targets jsonb not null,
  acceptance jsonb not null,
  knowledge jsonb not null default '[]'::jsonb,
  guidance text not null default '',
  run_id uuid references public.remediation_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, contract_id)
);

create table if not exists public.remediation_attempts (
  id uuid primary key default gen_random_uuid(),
  contract_row_id uuid not null
    references public.remediation_contracts(id) on delete cascade,
  n int not null,
  verdict text not null,
  progress_signature text not null default '',
  feedback text not null default '',
  changed_files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (contract_row_id, n)
);

create index if not exists remediation_contracts_org_idx
  on public.remediation_contracts (org_id, created_at desc);
create index if not exists remediation_attempts_contract_idx
  on public.remediation_attempts (contract_row_id, n);

alter table public.remediation_contracts enable row level security;
alter table public.remediation_attempts enable row level security;

create policy remediation_contracts_owner on public.remediation_contracts
  for all
  using (exists (
    select 1 from public.orgs o
    where o.id = remediation_contracts.org_id and o.owner_user = auth.uid()
  ))
  with check (exists (
    select 1 from public.orgs o
    where o.id = remediation_contracts.org_id and o.owner_user = auth.uid()
  ));

create policy remediation_attempts_owner on public.remediation_attempts
  for all
  using (exists (
    select 1
    from public.remediation_contracts c
    join public.orgs o on o.id = c.org_id
    where c.id = remediation_attempts.contract_row_id and o.owner_user = auth.uid()
  ))
  with check (exists (
    select 1
    from public.remediation_contracts c
    join public.orgs o on o.id = c.org_id
    where c.id = remediation_attempts.contract_row_id and o.owner_user = auth.uid()
  ));;
