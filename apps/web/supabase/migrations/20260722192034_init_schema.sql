create extension if not exists pgcrypto;

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  tool_version text not null default '',
  files_scanned int not null default 0,
  score int not null default 0 check (score between 0 and 100),
  summary jsonb not null default '{}'::jsonb
);
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  fingerprint text not null,
  rule_id text not null,
  wcag text[] not null default '{}',
  level text not null check (level in ('A','AA','AAA')),
  severity text not null check (severity in ('blocker','critical','serious','moderate','minor')),
  confidence text not null check (confidence in ('certain','high','needs_review')),
  fix_class text not null check (fix_class in ('SAFE_AUTOFIX','SUGGEST','NEEDS_HUMAN')),
  status text not null default 'open' check (status in ('open','confirmed','dismissed')),
  cluster_key text not null default '',
  message text not null default '',
  file text not null default '',
  line int not null default 0,
  snippet text not null default ''
);
create index findings_scan_idx on public.findings (scan_id);
create index findings_fingerprint_idx on public.findings (fingerprint);
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.orgs enable row level security;
alter table public.projects enable row level security;
alter table public.scans enable row level security;
alter table public.findings enable row level security;
alter table public.api_keys enable row level security;

create policy orgs_owner on public.orgs for all
  using (owner_user = auth.uid()) with check (owner_user = auth.uid());
create policy projects_owner on public.projects for all
  using (exists (select 1 from public.orgs o where o.id = projects.org_id and o.owner_user = auth.uid()))
  with check (exists (select 1 from public.orgs o where o.id = projects.org_id and o.owner_user = auth.uid()));
create policy scans_owner on public.scans for all
  using (exists (select 1 from public.projects p join public.orgs o on o.id = p.org_id
                 where p.id = scans.project_id and o.owner_user = auth.uid()));
create policy findings_owner on public.findings for all
  using (exists (select 1 from public.scans s join public.projects p on p.id = s.project_id
                 join public.orgs o on o.id = p.org_id
                 where s.id = findings.scan_id and o.owner_user = auth.uid()));
create policy api_keys_owner on public.api_keys for all
  using (exists (select 1 from public.orgs o where o.id = api_keys.org_id and o.owner_user = auth.uid()))
  with check (exists (select 1 from public.orgs o where o.id = api_keys.org_id and o.owner_user = auth.uid()));;
