-- Two step sign in, enforced by the database.
--
-- Administrators always need it. A practice setting (mfaFor = 'everyone') extends it to
-- every account. Until the person has entered a code from their authenticator app, their
-- session counts as not active, so every rule that depends on an active account refuses
-- them. Their own profile stays readable, so the dashboard can ask for the code.
-- The profile also records whether two step sign in is set up, for the team list.

alter table public.profiles add column if not exists mfa_enabled boolean not null default false;

update public.profiles p
   set mfa_enabled = exists (
     select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified'
   );

-- Keeps the profile in step with the person's authenticator app factors
create or replace function public.sync_mfa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles
     set mfa_enabled = exists (select 1 from auth.mfa_factors where user_id = uid and status = 'verified')
   where id = uid;
  return null;
end $$;

create trigger on_mfa_factor_change
  after insert or update or delete on auth.mfa_factors
  for each row execute function public.sync_mfa();

-- Whether the signed in person must use two step sign in
create or replace function public.mfa_required()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.role = 'administrator'
        or coalesce((select s.data ->> 'mfaFor' from public.settings s where s.id = 'practice'), 'administrators') = 'everyone'
      from public.profiles p
     where p.id = auth.uid() and p.status = 'active'
  ), false)
$$;

-- True when the session has passed two step sign in, or the person doesn't need it
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' or not public.mfa_required()
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and status = 'active' and public.mfa_ok()
$$;

create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active') and public.mfa_ok()
$$;

revoke all on function public.mfa_required(), public.mfa_ok(), public.sync_mfa() from public, anon;
grant execute on function public.mfa_required(), public.mfa_ok() to authenticated;

-- The two step flag is set by the sign in service only, like the email confirmation time
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  trusted boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if not trusted and (new.email_confirmed_at is distinct from old.email_confirmed_at or new.mfa_enabled is distinct from old.mfa_enabled) then
    raise exception 'This is set by the sign in service' using errcode = '42501';
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
