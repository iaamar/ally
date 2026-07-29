-- Remove the retired dashboard-to-local-agent polling queue.
-- Scans, findings, MCP runs, and durable activity events are unaffected.

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scan_requests'
  ) then
    alter publication supabase_realtime drop table public.scan_requests;
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'agent_heartbeats'
  ) then
    alter publication supabase_realtime drop table public.agent_heartbeats;
  end if;
end
$$;

drop table if exists public.scan_requests cascade;
drop table if exists public.agent_heartbeats cascade;
