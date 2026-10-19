-- Removing a staff account shouldn't be blocked by records that merely mention who
-- approved or created something. Those links are cleared instead. Staff are normally
-- disabled rather than removed, and their assigned tasks must be reassigned first.

alter table public.profiles drop constraint profiles_approved_by_fkey;
alter table public.profiles add constraint profiles_approved_by_fkey
  foreign key (approved_by) references public.profiles (id) on delete set null;

alter table public.settings drop constraint settings_updated_by_fkey;
alter table public.settings add constraint settings_updated_by_fkey
  foreign key (updated_by) references public.profiles (id) on delete set null;

alter table public.tasks drop constraint tasks_created_by_fkey;
alter table public.tasks add constraint tasks_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.tasks drop constraint tasks_completed_by_fkey;
alter table public.tasks add constraint tasks_completed_by_fkey
  foreign key (completed_by) references public.profiles (id) on delete set null;

alter table public.calendar_blocks drop constraint calendar_blocks_created_by_fkey;
alter table public.calendar_blocks add constraint calendar_blocks_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.feedback alter column created_by drop not null;
alter table public.feedback drop constraint feedback_created_by_fkey;
alter table public.feedback add constraint feedback_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
