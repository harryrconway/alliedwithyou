-- Downloads appear in the change history, so administrators can see who took a copy of what.
-- Spreadsheets and the full copy hold staff contact details and check numbers.

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in ('insert', 'update', 'delete', 'download'));

-- Called by the dashboard just before a file is saved. Active staff only.
create or replace function public.log_download(p_what text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.audit_events (actor_id, action, table_name, summary)
  values (auth.uid(), 'download', 'downloads', left(coalesce(nullif(trim(p_what), ''), 'Downloaded a file'), 200));
end $$;

revoke all on function public.log_download(text) from public, anon;
grant execute on function public.log_download(text) to authenticated;
