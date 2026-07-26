
create table if not exists scan_requests (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  project_name text not null default '',
  params      jsonb not null default '{}',
  status      text not null default 'queued'
                check (status in ('queued','claimed','running','done','failed','expired')),
  requested_by uuid references auth.users(id),
  claimed_by   text,
  run_id       uuid references remediation_runs(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '1 hour'
);

alter table scan_requests enable row level security;
alter table scan_requests replica identity full;

create policy "owner can manage scan_requests"
  on scan_requests for all
  using (org_id in (select id from orgs where owner_user = auth.uid()))
  with check (org_id in (select id from orgs where owner_user = auth.uid()));

create table if not exists agent_heartbeats (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  agent_id    text not null,
  project_name text not null default '',
  last_seen_at timestamptz not null default now(),
  metadata    jsonb not null default '{}',
  constraint agent_heartbeats_org_agent unique (org_id, agent_id)
);

alter table agent_heartbeats enable row level security;
alter table agent_heartbeats replica identity full;

create policy "owner can read heartbeats"
  on agent_heartbeats for all
  using (org_id in (select id from orgs where owner_user = auth.uid()))
  with check (org_id in (select id from orgs where owner_user = auth.uid()));

alter publication supabase_realtime add table scan_requests;
alter publication supabase_realtime add table agent_heartbeats;
;
