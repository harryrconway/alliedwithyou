-- The rest of Stage 7: privacy requests, and a proper search of the database itself
-- rather than only what the dashboard has already loaded.

------------------------------------------------------------------------------
-- Privacy requests: what people ask under the Privacy Act, recorded by whoever
-- took the call or the email, and worked by administrators.
------------------------------------------------------------------------------

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  kind text not null default 'access' check (kind in ('access', 'correction', 'deletion', 'other')),
  requester_name text not null check (length(requester_name) between 1 and 160),
  requester_email text not null default '' check (length(requester_email) <= 160),
  requester_phone text not null default '' check (length(requester_phone) <= 40),
  details text not null default '' check (length(details) <= 2000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'completed', 'declined')),
  internal_notes text not null default '' check (length(internal_notes) <= 4000),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  resolved_at timestamptz,
  request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index privacy_requests_status_idx on public.privacy_requests (status, created_at desc);

create trigger privacy_requests_touch before update on public.privacy_requests
  for each row execute function public.touch_updated_at();

create trigger privacy_requests_audit after insert or update or delete on public.privacy_requests
  for each row execute function public.audit_row('privacy request');

-- Due within 30 days of being received, matching the privacy policy's own promise
create or replace function public.privacy_requests_resolved()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('completed', 'declined') and old.status not in ('completed', 'declined') then
    new.resolved_at := now();
  elsif new.status not in ('completed', 'declined') then
    new.resolved_at := null;
  end if;
  return new;
end $$;

create trigger privacy_requests_resolved before update on public.privacy_requests
  for each row execute function public.privacy_requests_resolved();

alter table public.privacy_requests enable row level security;

-- Whoever logged it can see it again, administrators see and work every one
create policy privacy_requests_read on public.privacy_requests for select to authenticated
  using (created_by = auth.uid() or public.is_admin());
create policy privacy_requests_insert on public.privacy_requests for insert to authenticated
  with check (public.is_active() and created_by = auth.uid());
create policy privacy_requests_update on public.privacy_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.privacy_requests from anon;

------------------------------------------------------------------------------
-- Search: reads the database directly, so it finds things the dashboard hasn't
-- already loaded, such as an older task or a departed staff member. Runs as
-- whoever calls it, so Row Level Security decides what each person's search
-- can find, exactly as it decides what every other read can find.
------------------------------------------------------------------------------

create or replace function public.global_search(q text)
returns table (kind text, id uuid, ref text, title text, meta1 text, meta2 text, created_at timestamptz)
language sql stable set search_path = '' as $$
  select * from (
    select 'task' as kind, t.id, null::text as ref, t.title, t.due_date::text as meta1, coalesce(p.full_name, p.email, '') as meta2, t.created_at
      from public.tasks t left join public.profiles p on p.id = t.assigned_to
     where t.title ilike '%' || q || '%' or t.description ilike '%' || q || '%'
    union all
    select 'staff', s.id, null::text, coalesce(s.full_name, s.email), s.role, s.title, s.created_at
      from public.profiles s
     where s.status = 'active' and (s.full_name ilike '%' || q || '%' or s.email ilike '%' || q || '%' or s.title ilike '%' || q || '%')
    union all
    select 'template', tp.id, null::text, tp.title, tp.category, tp.status, tp.created_at
      from public.templates tp
     where tp.status <> 'retired' and (tp.title ilike '%' || q || '%' or tp.description ilike '%' || q || '%')
    union all
    select 'feedback', f.id, f.ref, f.title, f.kind, f.status, f.created_at
      from public.feedback f
     where f.title ilike '%' || q || '%' or f.description ilike '%' || q || '%' or f.ref ilike '%' || q || '%'
    union all
    select 'privacy', pr.id, pr.ref, pr.requester_name, pr.kind, pr.status, pr.created_at
      from public.privacy_requests pr
     where pr.requester_name ilike '%' || q || '%' or pr.details ilike '%' || q || '%' or pr.ref ilike '%' || q || '%'
  ) matches
  where length(coalesce(q, '')) >= 2
  order by created_at desc
  limit 30
$$;

revoke all on function public.global_search(text) from public, anon;
grant execute on function public.global_search(text) to authenticated;
