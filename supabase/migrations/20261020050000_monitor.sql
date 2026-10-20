-- Monitoring and the weekly summary.
--
-- The notify function also checks, every 15 minutes, that the website, sign in and the
-- enquiry form are answering. Each check's latest result is kept here, so an alert goes out
-- only after two failures in a row, and once more when it's working again.
-- The weekly summary uses the notifications record like the other alerts.

create table public.monitor_checks (
  name text primary key check (name in ('website', 'signin', 'enquiry')),
  ok boolean not null default true,
  failures integer not null default 0,
  alerted boolean not null default false,
  detail text not null default '' check (length(detail) <= 200),
  checked_at timestamptz not null default now(),
  changed_at timestamptz not null default now()
);

-- Only the notify function, using the secret key, uses this. Administrators and developers can read it.
alter table public.monitor_checks enable row level security;
create policy monitor_checks_read on public.monitor_checks for select to authenticated
  using (public.my_role() in ('administrator', 'developer'));
revoke all on public.monitor_checks from anon;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('signup', 'check', 'weekly', 'monitor'));
