-- Fixes from reviewing the 21 October changes.

-- A switched off account could still read the privacy requests it had logged. Every other
-- read needs an active account, so this one does too.
alter policy privacy_requests_read on public.privacy_requests
  using (public.is_active() and (created_by = auth.uid() or public.is_admin()));

-- Privacy request reminders are recorded like every other alert, but the record didn't allow
-- that kind. Once any request came within 7 days of its deadline, the alerts function would
-- have failed before sending anything, every alert stopping until the request was closed.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('signup', 'check', 'weekly', 'monitor', 'privacy'));

-- The weekly clean up keeps the change history. Its rows can't be deleted by design, so
-- deleting them would have failed once any were two years old, and stopped the rest of the
-- clean up with it. How long to keep it is for the practice to decide with advice, and
-- health records are commonly kept for at least seven years.
select cron.schedule(
  'housekeeping',
  '0 17 * * 0', -- Sunday 17:00 UTC, the small hours of Monday morning across Australia
  $job$
    delete from public.error_events where created_at < now() - interval '180 days';
    delete from public.notifications where created_at < now() - interval '180 days';
  $job$
);

-- Search, second version. Each result carries its status separately, best matches come
-- first (a title that starts with what was typed, then one that contains it, then a match
-- in the details), and % or _ typed in the box are searched for literally. Administrators
-- also find people whose accounts are waiting, declined or switched off.
drop function public.global_search(text);

create function public.global_search(q text)
returns table (kind text, id uuid, ref text, title text, meta1 text, meta2 text, status text, created_at timestamptz)
language sql stable set search_path = '' as $$
  with term as (
    select '%' || e || '%' as anywhere, e || '%' as start
      from (select replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') as e) escaped
     where length(trim(coalesce(q, ''))) >= 2
  )
  select m.kind, m.id, m.ref, m.title, m.meta1, m.meta2, m.status, m.created_at from (
    select 'task' as kind, t.id, null::text as ref, t.title, t.due_date::text as meta1,
           coalesce(nullif(p.full_name, ''), p.email, '') as meta2, t.status, t.created_at,
           case when t.title ilike term.start then 0 when t.title ilike term.anywhere then 1 else 2 end as rank
      from public.tasks t cross join term
      left join public.profiles p on p.id = t.assigned_to
     where t.title ilike term.anywhere or t.description ilike term.anywhere
    union all
    select 'staff', s.id, null, coalesce(nullif(s.full_name, ''), s.email), s.role, s.title, s.status, s.created_at,
           case when s.full_name ilike term.start or s.email ilike term.start then 0 when s.full_name ilike term.anywhere then 1 else 2 end
      from public.profiles s cross join term
     where (s.status = 'active' or public.is_admin())
       and (s.full_name ilike term.anywhere or s.email ilike term.anywhere or s.title ilike term.anywhere)
    union all
    select 'template', tp.id, null, tp.title, tp.category, tp.funding, tp.status, tp.created_at,
           case when tp.title ilike term.start then 0 when tp.title ilike term.anywhere then 1 else 2 end
      from public.templates tp cross join term
     where tp.status <> 'retired' and (tp.title ilike term.anywhere or tp.description ilike term.anywhere)
    union all
    select 'feedback', f.id, f.ref, f.title, f.kind, f.priority, f.status, f.created_at,
           case when f.ref ilike term.start or f.title ilike term.start then 0 when f.title ilike term.anywhere then 1 else 2 end
      from public.feedback f cross join term
     where f.title ilike term.anywhere or f.description ilike term.anywhere or f.ref ilike term.anywhere
    union all
    select 'privacy', pr.id, pr.ref, pr.requester_name, pr.kind, null, pr.status, pr.created_at,
           case when pr.ref ilike term.start or pr.requester_name ilike term.start then 0 when pr.requester_name ilike term.anywhere then 1 else 2 end
      from public.privacy_requests pr cross join term
     where pr.requester_name ilike term.anywhere or pr.details ilike term.anywhere or pr.ref ilike term.anywhere
  ) m
  order by m.rank, m.created_at desc
  limit 40
$$;

revoke all on function public.global_search(text) from public, anon;
grant execute on function public.global_search(text) to authenticated;
