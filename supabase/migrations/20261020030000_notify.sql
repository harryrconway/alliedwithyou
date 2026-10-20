-- Email alerts: a new account waiting for approval, and staff checks coming up for renewal.
--
-- Every 15 minutes the database calls the notify Edge Function, which works out what's due
-- and sends the emails. Each alert is recorded here before it's sent, under a unique key,
-- so nothing goes out twice. The function's address and its shared secret are kept in
-- Supabase Vault (names notify_url and notify_secret), set separately on each project.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.notifications (
  id bigint generated always as identity primary key,
  key text not null unique check (length(key) <= 200),
  kind text not null check (kind in ('signup', 'check')),
  recipients integer not null default 0,
  created_at timestamptz not null default now()
);

create index notifications_recent_idx on public.notifications (created_at desc);

-- Only the notify function, using the secret key, reads or writes these
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

select cron.schedule(
  'notify',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'notify_url')
  $job$
);
