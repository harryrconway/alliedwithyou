-- Foundation for the Allied With You CRM.
-- Staff accounts and approvals, practice settings, fees, tasks, the staff calendar,
-- feedback, error events, the audit trail and website form rate limits.
-- Client and clinical tables are added in later migrations, once the practice is ready.
-- Every table has Row Level Security switched on.

create extension if not exists btree_gist with schema extensions;

-- Keeps updated_at current on every change
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

------------------------------------------------------------------------------
-- Staff accounts
------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  full_name text not null default '' check (length(full_name) <= 120),
  role text not null default 'support' check (role in ('administrator', 'therapist', 'reception', 'support', 'developer')),
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'disabled')),
  title text not null default '' check (length(title) <= 120),
  phone text not null default '' check (length(phone) <= 40),
  registration text not null default '' check (length(registration) <= 40),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Addresses that get an administrator account without approval.
-- They are claimed by invitation only, so nobody else can register them first.
create table public.signup_allowlist (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('administrator', 'therapist', 'reception', 'support', 'developer')),
  created_at timestamptz not null default now()
);

insert into public.signup_allowlist (email, role) values
  ('admin@alliedwithyou.com.au', 'administrator'),
  ('jake@alliedwithyou.com.au', 'administrator'),
  ('chelsie@alliedwithyou.com.au', 'administrator');

-- Helpers used by the security policies
create or replace function public.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() = 'administrator', false)
$$;

-- Creates a profile for every new account
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reserved public.signup_allowlist%rowtype;
  is_reserved boolean;
begin
  select * into reserved from public.signup_allowlist where email = lower(new.email);
  is_reserved := found;
  if is_reserved and new.invited_at is null then
    raise exception 'This address is reserved for an invited account' using errcode = '42501';
  end if;
  insert into public.profiles (id, email, full_name, role, status, approved_at)
  values (
    new.id,
    lower(new.email),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    case when is_reserved then reserved.role else 'support' end,
    case when is_reserved then 'active' else 'pending' end,
    case when is_reserved then now() end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only administrators can change roles, status or approvals, and at least one
-- active administrator must always remain
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') and not public.is_admin() then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.email is distinct from old.email
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at then
      raise exception 'Only an administrator can change roles or account status' using errcode = '42501';
    end if;
  end if;
  if new.status = 'active' and old.status <> 'active' then
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.approved_at := now();
  end if;
  if old.role = 'administrator' and old.status = 'active'
    and (new.role <> 'administrator' or new.status <> 'active') then
    if not exists (
      select 1 from public.profiles
      where role = 'administrator' and status = 'active' and id <> old.id
    ) then
      raise exception 'There must always be at least one active administrator' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------
-- Practice settings and fees
------------------------------------------------------------------------------

create table public.settings (
  id text primary key default 'practice' check (id = 'practice'),
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.settings (id, data) values ('practice', jsonb_build_object(
  'business', jsonb_build_object(
    'name', 'Allied With You',
    'email', 'admin@alliedwithyou.com.au',
    'areaDetail', 'The Northern Rivers in New South Wales and the Gold Coast in Queensland'
  ),
  'services', jsonb_build_array('assessments', 'independence', 'home', 'technology', 'therapy', 'reports'),
  'acceptedFunding', jsonb_build_array('private', 'healthfund', 'medicare', 'sah', 'ndis_self', 'ndis_plan'),
  'durations', jsonb_build_object('initial', 120, 'therapy', 60, 'homevisit', 90, 'assessment', 120, 'equipment', 60, 'review', 30),
  'dayStart', '08:00',
  'dayEnd', '17:30',
  'travelBuffer', 15,
  'invoiceTerms', 14,
  'defaultTimeZone', 'Australia/Brisbane'
));

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

create table public.price_items (
  id uuid primary key default gen_random_uuid(),
  key text not null check (length(key) between 1 and 60),
  name text not null check (length(name) between 1 and 160),
  funding text not null check (funding in ('private', 'ndis', 'sah', 'medicare')),
  code text not null default '' check (length(code) <= 40),
  unit text not null check (unit in ('hour', 'session', 'each')),
  rate numeric(10, 2) not null check (rate >= 0),
  effective_from date not null,
  effective_to date,
  notes text not null default '' check (length(notes) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (key, effective_from)
);

-- The fees published on the website
insert into public.price_items (key, name, funding, unit, rate, effective_from, notes) values
  ('private_initial', 'Initial assessment, up to two hours', 'private', 'session', 380.00, '2026-10-19', 'Includes a short written summary.'),
  ('private_therapy', 'Therapy session', 'private', 'hour', 190.00, '2026-10-19', 'Around 60 minutes at home, in the community or by telehealth.'),
  ('private_short', 'Short review, around 30 minutes', 'private', 'session', 100.00, '2026-10-19', 'Often by telehealth.'),
  ('private_report', 'Report writing', 'private', 'hour', 190.00, '2026-10-19', 'An estimate is given before writing begins.'),
  ('private_travel', 'Travel beyond the first 20 minutes each way', 'private', 'hour', 95.00, '2026-10-19', '');

create trigger price_items_touch before update on public.price_items
  for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------
-- Tasks
------------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  description text not null default '' check (length(description) <= 2000),
  due_date date not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'done')),
  assigned_to uuid not null references public.profiles (id),
  -- Reserved for when client records are switched on. Kept empty until then.
  client_id uuid,
  automated boolean not null default false,
  reason text not null default '' check (length(reason) <= 200),
  kind text not null default '' check (length(kind) <= 40),
  created_by uuid references public.profiles (id) default auth.uid(),
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_no_client_details_yet check (client_id is null)
);

create index tasks_assigned_idx on public.tasks (assigned_to, status, due_date);

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------
-- Staff calendar: availability and bookings, never client details
------------------------------------------------------------------------------

create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id),
  starts_at timestamptz not null,
  duration_mins integer not null check (duration_mins between 5 and 720),
  ends_at timestamptz not null,
  time_zone text not null default 'Australia/Brisbane' check (time_zone in ('Australia/Sydney', 'Australia/Brisbane')),
  kind text not null default 'booked' check (kind in ('booked', 'unavailable', 'leave', 'admin', 'travel')),
  note text not null default '' check (length(note) <= 140),
  created_by uuid references public.profiles (id) default auth.uid(),
  request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_blocks_no_overlap exclude using gist (staff_id with =, tstzrange(starts_at, ends_at) with &&)
);

create index calendar_blocks_staff_idx on public.calendar_blocks (staff_id, starts_at);

create or replace function public.calendar_blocks_set_end()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_mins);
  return new;
end $$;

create trigger calendar_blocks_end before insert or update on public.calendar_blocks
  for each row execute function public.calendar_blocks_set_end();
create trigger calendar_blocks_touch before update on public.calendar_blocks
  for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------
-- Feedback and reported issues
------------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  kind text not null default 'issue' check (kind in ('issue', 'bug', 'feature', 'suggestion')),
  title text not null check (length(title) between 1 and 200),
  description text not null default '' check (length(description) <= 4000),
  area text not null default '' check (length(area) <= 80),
  expected text not null default '' check (length(expected) <= 2000),
  actual text not null default '' check (length(actual) <= 2000),
  error_ref text not null default '' check (length(error_ref) <= 12),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'planned', 'in_progress', 'completed', 'declined')),
  response text not null default '' check (length(response) <= 2000),
  created_by uuid not null references public.profiles (id) default auth.uid(),
  request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_status_idx on public.feedback (status, created_at desc);

create trigger feedback_touch before update on public.feedback
  for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------
-- Error events: safe diagnostics only, never record contents
------------------------------------------------------------------------------

create table public.error_events (
  id bigint generated always as identity primary key,
  ref text not null check (length(ref) <= 12),
  category text not null check (category in ('validation', 'network', 'permission', 'server', 'uncertain', 'unexpected')),
  area text not null default '' check (length(area) <= 60),
  operation text not null default '' check (length(operation) <= 80),
  message text not null default '' check (length(message) <= 500),
  app_version text not null default '' check (length(app_version) <= 20),
  fingerprint text not null default '' check (length(fingerprint) <= 64),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index error_events_recent_idx on public.error_events (created_at desc);
create index error_events_fingerprint_idx on public.error_events (fingerprint, created_at desc);

-- Signed in staff log errors through this function, limited to 30 an hour each
create or replace function public.log_error(
  p_ref text, p_category text, p_area text, p_operation text,
  p_message text, p_app_version text, p_fingerprint text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active() then
    return;
  end if;
  if (select count(*) from public.error_events
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    return;
  end if;
  insert into public.error_events (ref, category, area, operation, message, app_version, fingerprint, user_id)
  values (
    left(coalesce(p_ref, ''), 12),
    case when p_category in ('validation', 'network', 'permission', 'server', 'uncertain', 'unexpected') then p_category else 'unexpected' end,
    left(coalesce(p_area, ''), 60),
    left(coalesce(p_operation, ''), 80),
    left(coalesce(p_message, ''), 500),
    left(coalesce(p_app_version, ''), 20),
    left(coalesce(p_fingerprint, ''), 64),
    auth.uid()
  );
end $$;

------------------------------------------------------------------------------
-- Audit trail: written by triggers, never edited
------------------------------------------------------------------------------

create table public.audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id text not null default '',
  summary text not null default '',
  fields text[] not null default '{}'
);

create index audit_events_record_idx on public.audit_events (table_name, record_id);
create index audit_events_at_idx on public.audit_events (at desc);

-- Records who changed what. Only column names are kept, never the values,
-- except account role and status changes.
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changed text[] := '{}';
  label text := coalesce(tg_argv[0], tg_table_name);
  summary text;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into changed
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('updated_at', 'ends_at') and (to_jsonb(old) -> n.key) is distinct from n.value;
    if coalesce(array_length(changed, 1), 0) = 0 then
      return new;
    end if;
  end if;
  summary := case tg_op when 'INSERT' then 'Added ' when 'UPDATE' then 'Updated ' else 'Deleted ' end || label;
  if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      summary := summary || ', status ' || old.status || ' to ' || new.status;
    end if;
    if new.role is distinct from old.role then
      summary := summary || ', role ' || old.role || ' to ' || new.role;
    end if;
  end if;
  insert into public.audit_events (actor_id, action, table_name, record_id, summary, fields)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(to_jsonb(coalesce(new, old)) ->> 'id', ''),
    summary,
    changed
  );
  return coalesce(new, old);
end $$;

create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_row('staff account');
create trigger settings_audit after insert or update or delete on public.settings
  for each row execute function public.audit_row('practice settings');
create trigger price_items_audit after insert or update or delete on public.price_items
  for each row execute function public.audit_row('fee');
create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function public.audit_row('task');
create trigger calendar_blocks_audit after insert or update or delete on public.calendar_blocks
  for each row execute function public.audit_row('calendar entry');
create trigger signup_allowlist_audit after insert or update or delete on public.signup_allowlist
  for each row execute function public.audit_row('reserved address');

create or replace function public.audit_events_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Audit records cannot be changed or deleted' using errcode = '42501';
end $$;

create trigger audit_events_no_change before update or delete on public.audit_events
  for each row execute function public.audit_events_immutable();

------------------------------------------------------------------------------
-- Website form rate limits: hashed visitor addresses and times only
------------------------------------------------------------------------------

create table public.form_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null check (length(ip_hash) = 64),
  created_at timestamptz not null default now()
);

create index form_limits_lookup_idx on public.form_limits (ip_hash, created_at desc);

------------------------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.signup_allowlist enable row level security;
alter table public.settings enable row level security;
alter table public.price_items enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_blocks enable row level security;
alter table public.feedback enable row level security;
alter table public.error_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.form_limits enable row level security;

-- Visitors who aren't signed in get nothing directly
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant execute on function public.my_role(), public.is_active(), public.is_admin() to authenticated;
grant execute on function public.log_error(text, text, text, text, text, text, text) to authenticated;

-- Profiles: your own always, the whole team once you're active, changes by administrators
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy allowlist_admin on public.signup_allowlist for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.settings for select to authenticated
  using (public.is_active());
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy price_items_read on public.price_items for select to authenticated
  using (public.is_active());
create policy price_items_insert on public.price_items for insert to authenticated
  with check (public.is_admin());
create policy price_items_update on public.price_items for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy price_items_delete on public.price_items for delete to authenticated
  using (public.is_admin());

create policy tasks_read on public.tasks for select to authenticated
  using (public.is_active());
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_active() and created_by = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_active() and (assigned_to = auth.uid() or created_by = auth.uid() or public.is_admin()))
  with check (public.is_active());
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_active() and (created_by = auth.uid() or public.is_admin()));

create policy calendar_read on public.calendar_blocks for select to authenticated
  using (public.is_active());
create policy calendar_insert on public.calendar_blocks for insert to authenticated
  with check (public.is_active() and (staff_id = auth.uid() or public.is_admin()));
create policy calendar_update on public.calendar_blocks for update to authenticated
  using (public.is_active() and (staff_id = auth.uid() or public.is_admin()))
  with check (public.is_active() and (staff_id = auth.uid() or public.is_admin()));
create policy calendar_delete on public.calendar_blocks for delete to authenticated
  using (public.is_active() and (staff_id = auth.uid() or public.is_admin()));

create policy feedback_insert on public.feedback for insert to authenticated
  with check (public.is_active() and created_by = auth.uid());
create policy feedback_read on public.feedback for select to authenticated
  using (created_by = auth.uid() or public.my_role() in ('administrator', 'developer'));
create policy feedback_update on public.feedback for update to authenticated
  using (public.my_role() in ('administrator', 'developer'))
  with check (public.my_role() in ('administrator', 'developer'));

create policy error_events_read on public.error_events for select to authenticated
  using (public.my_role() in ('administrator', 'developer'));

create policy audit_events_read on public.audit_events for select to authenticated
  using (public.is_admin());

-- form_limits has no policies: only the enquiry Edge Function, using the secret key, can use it
