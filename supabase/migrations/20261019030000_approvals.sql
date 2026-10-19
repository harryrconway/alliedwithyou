-- Approving an account now needs proof the person owns the email address.
-- Profiles are created the moment someone signs up, before they confirm their email,
-- so the confirmation time is copied onto the profile and checked on approval.
-- Reserved practice addresses can only become active through an invitation, so an
-- administrator can't approve one that someone else registered.

alter table public.profiles add column if not exists email_confirmed_at timestamptz;

update public.profiles p
   set email_confirmed_at = u.email_confirmed_at
  from auth.users u
 where u.id = p.id;

-- True when the account uses a reserved practice address but wasn't invited
create or replace function public.reserved_without_invite(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from auth.users u
      join public.signup_allowlist a on a.email = lower(u.email)
     where u.id = p_user and u.invited_at is null
  )
$$;

revoke all on function public.reserved_without_invite(uuid) from public, anon;
grant execute on function public.reserved_without_invite(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reserved_role text;
begin
  select role into reserved_role from public.signup_allowlist where email = lower(new.email);
  insert into public.profiles (id, email, full_name, role, status, email_confirmed_at)
  values (
    new.id,
    lower(new.email),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    coalesce(reserved_role, 'support'),
    'pending',
    new.email_confirmed_at
  );
  return new;
end $$;

create or replace function public.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reserved_role text;
begin
  update public.profiles
     set email_confirmed_at = new.email_confirmed_at
   where id = new.id and email_confirmed_at is distinct from new.email_confirmed_at;
  if new.email_confirmed_at is null or new.invited_at is null then
    return new;
  end if;
  select role into reserved_role from public.signup_allowlist where email = lower(new.email);
  if reserved_role is null then
    return new;
  end if;
  update public.profiles
     set status = 'active', role = reserved_role
   where id = new.id and status = 'pending';
  return new;
end $$;

create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  trusted boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if not trusted and new.email_confirmed_at is distinct from old.email_confirmed_at then
    raise exception 'The email confirmation time is set by the sign in service' using errcode = '42501';
  end if;
  if not trusted and not public.is_admin() then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.email is distinct from old.email
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at then
      raise exception 'Only an administrator can change roles or account status' using errcode = '42501';
    end if;
  end if;
  if not trusted and new.status = 'active' and old.status <> 'active' then
    if new.email_confirmed_at is null then
      raise exception 'This account can''t be approved until its email address is confirmed' using errcode = '23514';
    end if;
    if public.reserved_without_invite(new.id) then
      raise exception 'Reserved practice addresses can only be set up by invitation' using errcode = '42501';
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
