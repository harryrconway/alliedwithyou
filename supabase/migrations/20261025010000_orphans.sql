-- Lets administrators see template files that no version points to any more, such as those
-- left after deleting a template, so the dashboard can remove them. Storage only removes
-- files the person can see, and the existing rule only shows files that belong to a version.

create policy templates_files_orphans on storage.objects for select to authenticated
  using (
    bucket_id = 'templates' and public.is_admin() and not exists (
      select 1 from public.template_versions v where v.file_path = storage.objects.name
    )
  );
