-- Feedback and reported issues become tickets that can be tracked through to fixed:
-- a priority, the person working on it, private notes for administrators and developers,
-- and a history of every change, written by the database.

alter table public.feedback
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists resolved_at timestamptz;

-- Notes stay as written, like the audit trail
create table public.feedback_notes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (length(body) between 1 and 2000),
  request_id uuid unique,
  created_at timestamptz not null default now()
);

create index feedback_notes_feedback_idx on public.feedback_notes (feedback_id, created_at);

create table public.feedback_events (
  id bigint generated always as identity primary key,
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  field text not null check (field in ('created', 'status', 'priority', 'assigned_to')),
  old_value text not null default '',
  new_value text not null default '',
  at timestamptz not null default now()
);

create index feedback_events_feedback_idx on public.feedback_events (feedback_id, at);

-- Records each change to a ticket, and when it was resolved
create or replace function public.feedback_track()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.feedback_events (feedback_id, actor_id, field, new_value) values (new.id, auth.uid(), 'created', new.status);
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.feedback_events (feedback_id, actor_id, field, old_value, new_value) values (new.id, auth.uid(), 'status', old.status, new.status);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.feedback_events (feedback_id, actor_id, field, old_value, new_value) values (new.id, auth.uid(), 'priority', old.priority, new.priority);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.feedback_events (feedback_id, actor_id, field, old_value, new_value)
    values (new.id, auth.uid(), 'assigned_to', coalesce(old.assigned_to::text, ''), coalesce(new.assigned_to::text, ''));
  end if;
  return null;
end $$;

create trigger feedback_track after insert or update on public.feedback
  for each row execute function public.feedback_track();

create or replace function public.feedback_resolved()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('completed', 'declined') and old.status not in ('completed', 'declined') then
    new.resolved_at := now();
  elsif new.status not in ('completed', 'declined') then
    new.resolved_at := null;
  end if;
  return new;
end $$;

create trigger feedback_resolved before update on public.feedback
  for each row execute function public.feedback_resolved();

alter table public.feedback_notes enable row level security;
alter table public.feedback_events enable row level security;

create policy feedback_notes_read on public.feedback_notes for select to authenticated
  using (public.my_role() in ('administrator', 'developer'));
create policy feedback_notes_insert on public.feedback_notes for insert to authenticated
  with check (public.my_role() in ('administrator', 'developer') and author_id = auth.uid());
create policy feedback_events_read on public.feedback_events for select to authenticated
  using (public.my_role() in ('administrator', 'developer'));

revoke all on public.feedback_notes, public.feedback_events from anon;
revoke all on function public.feedback_track() from public, anon;
