-- Templates edited in the dashboard, a logo library, and deleting a template for good.
--
-- A version made in the dashboard keeps what it was built from in content, so it can be
-- opened and edited again. The Word file is still saved with every version, as before.
-- Versions uploaded as a file have no content and are edited outside the dashboard.
--
-- Logos are kept in a private bucket for administrators to put on templates. The main
-- logo is part of the website, so it is always there and never in this table.
--
-- Deleting a template removes it and every version. Change history keeps a record of
-- what was deleted, by whom and when. The dashboard then removes the files themselves.

------------------------------------------------------------------------------
-- What a version was built from
------------------------------------------------------------------------------

alter table public.template_versions
  add column content jsonb check (content is null or (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 500000));

-- Lets the dashboard know which versions can be edited without reading every version's content
alter table public.template_versions
  add column editable boolean generated always as (content is not null) stored;

------------------------------------------------------------------------------
-- Logo library
------------------------------------------------------------------------------

create table public.template_logos (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  file_path text not null unique check (length(file_path) between 1 and 300),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg')),
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create trigger template_logos_audit after insert or update or delete on public.template_logos
  for each row execute function public.audit_row('template logo');

alter table public.template_logos enable row level security;

create policy template_logos_read on public.template_logos for select to authenticated
  using (public.is_admin());
create policy template_logos_insert on public.template_logos for insert to authenticated
  with check (public.is_admin());
create policy template_logos_update on public.template_logos for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy template_logos_delete on public.template_logos for delete to authenticated
  using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy logos_files_read on storage.objects for select to authenticated
  using (bucket_id = 'logos' and public.is_admin());
create policy logos_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_admin());
create policy logos_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.is_admin());

------------------------------------------------------------------------------
-- Deleting a template for good
------------------------------------------------------------------------------

-- Returns the paths of the template's files, which the dashboard then removes from storage.
-- Once the versions are gone, the existing storage rule lets an administrator remove them.
create or replace function public.delete_template(target uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  t public.templates%rowtype;
  paths text[];
  n integer;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can delete templates' using errcode = '42501';
  end if;
  select * into t from public.templates where id = target for update;
  if not found then
    raise exception 'That template no longer exists' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(file_path), '{}'), count(*) into paths, n
    from public.template_versions where template_id = target;
  insert into public.audit_events (actor_id, action, table_name, record_id, summary)
  values (auth.uid(), 'delete', 'templates', target::text,
    'Deleted template for good: ' || t.title || ', with ' || n || case when n = 1 then ' version' else ' versions' end);
  delete from public.templates where id = target;
  return paths;
end $$;

revoke execute on function public.delete_template(uuid) from public, anon;
grant execute on function public.delete_template(uuid) to authenticated;
