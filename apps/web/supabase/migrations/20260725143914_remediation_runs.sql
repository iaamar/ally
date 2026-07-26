create table if not exists public.remediation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  kind text not null check (kind in ('scan', 'remediation')),
  project_name text not null default '',
  contract_id text,
  status text not null default 'active'
    check (status in ('active', 'settled', 'escalated', 'done', 'failed')),
  score_before int,
  score_after int,
  targets_total int not null default 0,
  targets_resolved int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists remediation_runs_org_idx
  on public.remediation_runs (org_id, created_at desc);

create table if not exists public.run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.remediation_runs(id) on delete cascade,
  seq int not null default 0,
  phase text not null
    check (phase in ('scan', 'plan', 'edit', 'evaluate', 'settle', 'error')),
  label text not null default '',
  status text not null check (status in ('running', 'ok', 'fail', 'info')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists run_events_run_idx on public.run_events (run_id, seq);

alter table public.remediation_runs enable row level security;
alter table public.run_events enable row level security;

create policy remediation_runs_owner on public.remediation_runs for all
  using (exists (
    select 1 from public.orgs o
    where o.id = remediation_runs.org_id and o.owner_user = auth.uid()
  ))
  with check (exists (
    select 1 from public.orgs o
    where o.id = remediation_runs.org_id and o.owner_user = auth.uid()
  ));

create policy run_events_owner on public.run_events for all
  using (exists (
    select 1 from public.remediation_runs r
    join public.orgs o on o.id = r.org_id
    where r.id = run_events.run_id and o.owner_user = auth.uid()
  ))
  with check (exists (
    select 1 from public.remediation_runs r
    join public.orgs o on o.id = r.org_id
    where r.id = run_events.run_id and o.owner_user = auth.uid()
  ));

alter table public.remediation_runs replica identity full;
alter table public.run_events replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'remediation_runs'
  ) then
    alter publication supabase_realtime add table public.remediation_runs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'run_events'
  ) then
    alter publication supabase_realtime add table public.run_events;
  end if;
end $$;;
