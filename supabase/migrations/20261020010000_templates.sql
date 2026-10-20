-- Templates library and staff checks.
--
-- Templates are blank documents such as agreements, forms, letters and policies that staff
-- download and fill in. Administrators add templates, upload new versions and approve them.
-- Everyone else sees approved templates only. Every version is kept, and files live in a
-- private storage bucket, downloaded through short lived signed links.
--
-- Staff checks record each person's screening checks, registrations, insurance and
-- certificates: details and expiry dates only, never copies of the documents.

------------------------------------------------------------------------------
-- Templates
------------------------------------------------------------------------------

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 160),
  category text not null check (category in ('agreement', 'consent', 'intake', 'form', 'letter', 'policy', 'contract', 'other')),
  funding text not null default 'any' check (funding in ('any', 'ndis', 'sah', 'private')),
  description text not null default '' check (length(description) <= 1000),
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  current_version_id uuid,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  version_no integer not null,
  file_path text not null unique check (length(file_path) between 1 and 300),
  file_name text not null check (length(file_name) between 1 and 200),
  mime_type text not null default '' check (length(mime_type) <= 120),
  size_bytes integer not null default 0 check (size_bytes between 0 and 26214400),
  note text not null default '' check (length(note) <= 500),
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (template_id, version_no)
);

alter table public.templates add constraint templates_current_version_fkey
  foreign key (current_version_id) references public.template_versions (id) on delete set null;

create index template_versions_template_idx on public.template_versions (template_id, version_no desc);

create trigger templates_touch before update on public.templates
  for each row execute function public.touch_updated_at();

-- Approval is stamped by the database, and a template needs a file before it can be approved
create or replace function public.templates_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.current_version_id is null then
      raise exception 'Upload a file before approving this template' using errcode = '23514';
    end if;
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.approved_at := now();
  elsif new.status = 'draft' then
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end $$;

create trigger templates_guard before update on public.templates
  for each row execute function public.templates_guard();

-- Versions are numbered in order for each template, one at a time
create or replace function public.template_versions_number()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform 1 from public.templates where id = new.template_id for update;
  select coalesce(max(version_no), 0) + 1 into new.version_no
    from public.template_versions where template_id = new.template_id;
  return new;
end $$;

create trigger template_versions_number before insert on public.template_versions
  for each row execute function public.template_versions_number();

-- The newest version becomes the one staff download
create or replace function public.template_versions_current()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.templates set current_version_id = new.id where id = new.template_id;
  return new;
end $$;

create trigger template_versions_current after insert on public.template_versions
  for each row execute function public.template_versions_current();

create trigger templates_audit after insert or update or delete on public.templates
  for each row execute function public.audit_row('template');
create trigger template_versions_audit after insert or update or delete on public.template_versions
  for each row execute function public.audit_row('template version');

alter table public.templates enable row level security;
alter table public.template_versions enable row level security;

create policy templates_read on public.templates for select to authenticated
  using (public.is_active() and (status = 'approved' or public.is_admin()));
create policy templates_insert on public.templates for insert to authenticated
  with check (public.is_admin());
create policy templates_update on public.templates for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy template_versions_read on public.template_versions for select to authenticated
  using (public.is_active() and exists (
    select 1 from public.templates t
     where t.id = template_id and (t.status = 'approved' or public.is_admin())
  ));
create policy template_versions_insert on public.template_versions for insert to authenticated
  with check (public.is_admin());

-- Template files: a private bucket, read through the same rules as the versions
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('templates', 'templates', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.text',
  'text/plain'
])
on conflict (id) do nothing;

create policy templates_files_read on storage.objects for select to authenticated
  using (
    bucket_id = 'templates' and public.is_active() and exists (
      select 1 from public.template_versions v
        join public.templates t on t.id = v.template_id
       where v.file_path = storage.objects.name and (t.status = 'approved' or public.is_admin())
    )
  );
create policy templates_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'templates' and public.is_admin());
-- Only a file that never became a version can be removed, for example after a failed save
create policy templates_files_remove on storage.objects for delete to authenticated
  using (
    bucket_id = 'templates' and public.is_admin() and not exists (
      select 1 from public.template_versions v where v.file_path = storage.objects.name
    )
  );

------------------------------------------------------------------------------
-- Staff checks: screening checks, registrations, insurance and certificates
------------------------------------------------------------------------------

create table public.staff_checks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'ndis_screening', 'wwcc_nsw', 'blue_card', 'police', 'ahpra', 'indemnity', 'first_aid',
    'cpr', 'ota', 'licence', 'car_insurance', 'vaccination', 'training', 'other'
  )),
  details text not null default '' check (length(details) <= 120),
  reference text not null default '' check (length(reference) <= 60),
  issued_on date,
  expires_on date,
  sighted_on date,
  notes text not null default '' check (length(notes) <= 300),
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

create index staff_checks_staff_idx on public.staff_checks (staff_id, expires_on);

create trigger staff_checks_touch before update on public.staff_checks
  for each row execute function public.touch_updated_at();
create trigger staff_checks_audit after insert or update or delete on public.staff_checks
  for each row execute function public.audit_row('staff check');

alter table public.staff_checks enable row level security;

create policy staff_checks_read on public.staff_checks for select to authenticated
  using ((staff_id = auth.uid() and public.is_active()) or public.is_admin());
create policy staff_checks_insert on public.staff_checks for insert to authenticated
  with check (public.is_admin());
create policy staff_checks_update on public.staff_checks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy staff_checks_delete on public.staff_checks for delete to authenticated
  using (public.is_admin());

revoke all on public.templates, public.template_versions, public.staff_checks from anon;
