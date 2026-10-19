/* Tasks and reminders for the practice. Client details stay out until client records are switched on. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const D = AWY.date;
  const A = AWY.actions;
  const rules = AWY.rules;
  const icon = (n) => raw(AWY.icon(n));

  AWY.views.tasks = {
    title: 'Tasks',
    render(ctx) {
      const { db, state, today, user, query } = ctx;
      if (state.who === undefined) state.who = user.role === 'administrator' ? '' : user.id;
      const weekEnd = D.addDays(today, 7);
      const base = db.tasks.filter((t) =>
        (!state.who || t.assignedTo === state.who) &&
        (!state.priority || t.priority === state.priority) &&
        C.matches(t, state.q, ['title', 'description'])
      );
      const open = base.filter((t) => t.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.priority === 'high' ? -1 : 1));
      const groups = [
        { key: 'overdue', title: 'Overdue', items: open.filter((t) => t.dueDate < today) },
        { key: 'today', title: 'Due today', items: open.filter((t) => t.dueDate === today) },
        { key: 'week', title: 'Next 7 days', items: open.filter((t) => t.dueDate > today && t.dueDate <= weekEnd) },
        { key: 'later', title: 'Later', items: open.filter((t) => t.dueDate > weekEnd) }
      ];
      const done = base.filter((t) => t.status === 'done').sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))).slice(0, 15);
      const people = rules.activeStaff(db).map((s) => ({ value: s.id, label: (s.name || s.email) + (s.id === user.id ? ' (you)' : '') }));

      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Tasks', subtitle: 'Follow up for the practice. Tick a task to complete it, or open it to reassign or reschedule.', actions: html`<button type="button" class="btn" data-new-task>${icon('plus')}New task</button>` })}
        <div class="notice" style="margin-bottom:1rem">${icon('info')}<div>${AWY.schema.NO_CLIENT_DETAILS}</div></div>
        <div class="toolbar">
          ${C.search(state.q, 'Search tasks')}
          ${C.select('who', 'Assigned to', people, state.who, 'Everyone')}
          ${C.select('priority', 'Priority', C.options('priority'), state.priority)}
        </div>
        <div class="stack-panels">
          ${groups.map((g) => html`<section class="panel" aria-labelledby="tg_${g.key}">
            <div class="panel-head"><h2 id="tg_${g.key}" style="${g.key === 'overdue' && g.items.length ? 'color:var(--color-danger)' : ''}">${g.title} <span class="muted" style="font-weight:500">${g.items.length}</span></h2></div>
            ${g.items.length ? html`<ul class="rows">${g.items.map((t) => A.taskRow(db, t, today))}</ul>` : html`<div class="panel-body"><p class="muted small">Nothing here.</p></div>`}
          </section>`)}
          <details class="panel">
            <summary class="panel-head" style="cursor:pointer;list-style:none"><h2>Recently completed <span class="muted" style="font-weight:500">${done.length}</span></h2>${icon('chevronDown')}</summary>
            ${done.length ? html`<ul class="rows">${done.map((t) => A.taskRow(db, t, today))}</ul>` : html`<div class="panel-body"><p class="muted small">No completed tasks.</p></div>`}
          </details>
        </div>
      `);
      C.bindFilters(ctx);
      A.bindCommon(ctx);

      /* Opened from search */
      if (query.task && state.openedFor !== query.task) {
        state.openedFor = query.task;
        AWY.router.replace(['tasks']);
        const t = db.tasks.find((x) => x.id === query.task);
        if (t && A.canEditTask(t)) A.taskForm(t);
      }
    }
  };
})();
