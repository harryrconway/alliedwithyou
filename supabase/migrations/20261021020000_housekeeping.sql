-- Error events, the audit trail and sent notification records have no limit on how many
-- rows they keep, so without this they would grow forever. A weekly job clears out what's
-- old enough not to be useful. These periods are a starting point, not a decided policy:
-- docs/audit.md already flags retention periods as needing legal and professional advice
-- before anything client or clinical is added, and these can be changed with a new
-- migration once that advice is in.
--
-- This runs as the database itself, not as any signed in person, the same as the
-- scheduled alerts already do. It doesn't change what the audit trail's own security
-- rules allow a person to do: nobody can edit or delete a row through the dashboard.

select cron.schedule(
  'housekeeping',
  '0 17 * * 0', -- Sunday 17:00 UTC, the small hours of Monday morning across Australia
  $job$
    delete from public.error_events where created_at < now() - interval '180 days';
    delete from public.audit_events where at < now() - interval '2 years';
    delete from public.notifications where created_at < now() - interval '180 days';
  $job$
);
