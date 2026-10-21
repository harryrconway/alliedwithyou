-- Tightens the tasks table's update policy to match the calendar's: whoever is allowed to
-- open a task for editing must still be its assignee, its creator, or an administrator once
-- the edit is saved, not just when it started. Found during a security review on 21 October
-- 2026. Low impact, since tasks hold no client details and the whole team can already read
-- them, but the calendar policy already used the stronger pattern.

alter policy tasks_update on public.tasks
  using (public.is_active() and (assigned_to = auth.uid() or created_by = auth.uid() or public.is_admin()))
  with check (public.is_active() and (assigned_to = auth.uid() or created_by = auth.uid() or public.is_admin()));
