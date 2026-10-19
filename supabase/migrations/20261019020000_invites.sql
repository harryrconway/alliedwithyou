-- Reserved addresses become active administrators only once they were invited and the
-- person has proved they own the mailbox by accepting the invitation. Supabase marks a
-- user as invited just after creating them, so this is checked when the account is
-- confirmed rather than when it's created. A reserved address registered any other way
-- stays pending and never activates on its own.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reserved_role text;
begin
  select role into reserved_role from public.signup_allowlist where email = lower(new.email);
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    lower(new.email),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    coalesce(reserved_role, 'support'),
    'pending'
  );
  return new;
end $$;

create or replace function public.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reserved_role text;
begin
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

create trigger on_auth_user_confirmed
  after update of email_confirmed_at, invited_at on auth.users
  for each row execute function public.handle_user_confirmed();
