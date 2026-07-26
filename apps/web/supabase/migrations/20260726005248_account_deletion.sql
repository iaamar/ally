alter table public.scan_requests
  drop constraint if exists scan_requests_requested_by_fkey;

alter table public.scan_requests
  add constraint scan_requests_requested_by_fkey
  foreign key (requested_by) references auth.users(id) on delete set null;;
