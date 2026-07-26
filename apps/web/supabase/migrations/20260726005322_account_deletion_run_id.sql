alter table public.scan_requests
  drop constraint if exists scan_requests_run_id_fkey;

alter table public.scan_requests
  add constraint scan_requests_run_id_fkey
  foreign key (run_id) references public.remediation_runs(id) on delete set null;;
