/* Dashboard overview: your tasks, the week ahead, accounts waiting for approval and recent feedback. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const rules = AWY.rules;
  const access = AWY.access;
  const A = AWY.actions;
  const icon = (n) => raw(AWY.icon(n));

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function figure(opts) {
    if (opts.hidden) return '';
    const cls = opts.tone ? ' is-' + opts.tone : '';
    return html`<a class="figure${cls}" href="${opts.href}">
      <span class="value">${opts.value}</span>
      <span class="label">${opts.label}</span>
      ${opts.detail ? html`<span class="detail">${opts.detail}</span>` : ''}
    </a>`;
  }

  function blockRow(db, b, showStaff) {
    return html`<li>
      <div class="when">${fmt.time(b.start)}<small>${fmt.duration(b.duration)}</small></div>
      <div class="what">
        <button type="button" class="link-button" data-block="${b.id}">${C.label('blockKind', b.kind)}</button>
        <div class="meta">${A.zoneTag(b)}${showStaff ? html`<span>${icon('user')}${rules.staffName(db, b.staffId)}</span>` : ''}${b.note ? html`<span>${b.note}</span>` : ''}</div>
      </div>
    </li>`;
  }

  AWY.views.dashboard = {
    title: 'Dashboard',
    render(ctx) {
      const { db, today, user } = ctx;
      const tasksOn = access.canSee('tasks');
      const calendarOn = access.canSee('calendar');
      const approvals = access.can('manageStaff');
      const review = access.can('reviewFeedback');
      const weekEnd = rules.weekAhead(today);

      const myOpen = tasksOn ? rules.openTasks(db, user.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) : [];
      const myOverdue = myOpen.filter((t) => t.dueDate < today);
      const myWeek = calendarOn ? rules.blocksBetween(db, today, weekEnd, user.id) : [];
      const pending = approvals ? rules.pendingStaff(db).filter((s) => s.emailConfirmedAt) : [];
      const newFeedback = review ? db.feedback.filter((f) => f.status === 'submitted') : [];
      const myFeedback = db.feedback.filter((f) => f.createdBy === user.id);

      const figureList = [
        figure({ value: myOpen.length, label: 'Your open tasks', detail: myOpen.filter((t) => t.dueDate <= weekEnd).length + ' due this week', href: '#/tasks', hidden: !tasksOn }),
        figure({ value: myOverdue.length, label: 'Overdue tasks', detail: 'Assigned to you', href: '#/tasks', tone: myOverdue.length ? 'alert' : '', hidden: !tasksOn }),
        figure({ value: myWeek.length, label: 'Calendar entries', detail: 'Yours, in the next 7 days', href: '#/calendar', hidden: !calendarOn }),
        figure({ value: pending.length, label: 'Waiting for approval', detail: 'New accounts', href: '#/staff', tone: pending.length ? 'warning' : '', hidden: !approvals }),
        figure({ value: newFeedback.length, label: 'New feedback', detail: 'Not looked at yet', href: '#/feedback', tone: newFeedback.length ? 'warning' : '', hidden: !review })
      ].filter(Boolean);
      const n = figureList.length;
      const figures = n ? html`<div class="figures" style="--cols:${n}" aria-label="Key figures">${figureList}</div>` : '';

      /* The week ahead, grouped by day */
      const byDay = {};
      myWeek.forEach((b) => (byDay[b.date] = byDay[b.date] || []).push(b));
      const weekPanel = calendarOn ? html`<section class="panel" aria-labelledby="weekTitle">
        <div class="panel-head"><h2 id="weekTitle">Your week</h2><a class="btn btn-quiet btn-sm" href="#/calendar">Open calendar</a></div>
        ${myWeek.length
          ? Object.keys(byDay).sort().map((day) => html`<div class="day-label">${day === today ? 'Today, ' + fmt.dateFull(day) : fmt.dateLong(day)}</div><ul class="rows">${byDay[day].map((b) => blockRow(db, b, false))}</ul>`)
          : html`<div class="panel-body">${C.empty({ icon: 'calendar', title: 'Nothing in your calendar this week', action: html`<button type="button" class="btn btn-secondary btn-sm" data-new-block>${icon('plus')}New entry</button>` })}</div>`}
      </section>` : '';

      const tasksPanel = tasksOn ? html`<section class="panel" aria-labelledby="tasksTitle">
        <div class="panel-head"><h2 id="tasksTitle">Your tasks</h2><a class="btn btn-quiet btn-sm" href="#/tasks">All tasks</a></div>
        ${myOpen.length
          ? html`<ul class="rows">${myOpen.slice(0, 8).map((t) => A.taskRow(db, t, today))}</ul>`
          : html`<div class="panel-body">${C.empty({ icon: 'checkCircle', title: 'No open tasks', text: 'Nothing is assigned to you.' })}</div>`}
      </section>` : '';

      const approvalPanel = approvals && pending.length ? html`<section class="panel" aria-labelledby="approveTitle">
        <div class="panel-head"><h2 id="approveTitle">Waiting for approval</h2><a class="btn btn-quiet btn-sm" href="#/staff">Team and access</a></div>
        <ul class="rows">${pending.slice(0, 5).map((s) => html`<li>
          <span class="avatar" aria-hidden="true">${fmt.initials(s.name || s.email)}</span>
          <div class="what"><a href="#/staff">${s.name || s.email}</a><div class="meta"><span>${s.email}</span><span>Signed up ${fmt.relative(s.createdAt.slice(0, 10)).toLowerCase()}</span></div></div>
        </li>`)}</ul>
      </section>` : '';

      const feedbackList = review ? db.feedback.slice(0, 5) : myFeedback.slice(0, 5);
      const feedbackPanel = html`<section class="panel" aria-labelledby="fbTitle">
        <div class="panel-head"><h2 id="fbTitle">${review ? 'Recent feedback' : 'Your feedback'}</h2><a class="btn btn-quiet btn-sm" href="#/feedback">${review ? 'All feedback' : 'View'}</a></div>
        ${feedbackList.length
          ? html`<ul class="rows">${feedbackList.map((f) => html`<li>
            <div class="what"><a href="#/feedback?open=${f.id}">${f.title}</a><div class="meta"><span>Reference ${f.ref}</span><span>${fmt.relative(f.createdAt.slice(0, 10))}</span>${review ? html`<span>${rules.staffName(db, f.createdBy)}</span>` : ''}</div></div>
            <div class="end">${C.badge('feedback', f.status)}</div>
          </li>`)}</ul>`
          : html`<div class="panel-body">${C.empty({ icon: 'message', title: 'Nothing yet', text: 'Found a problem, or have an idea? Use Report an issue at the top of the page.' })}</div>`}
      </section>`;

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: greeting() + ', ' + (user.name || user.email).split(' ')[0],
          subtitle: fmt.dateLong(today) + '.',
          actions: html`
            ${calendarOn ? html`<button type="button" class="btn btn-secondary" data-new-block>${icon('calendar')}New calendar entry</button>` : ''}
            ${tasksOn ? html`<button type="button" class="btn" data-new-task>${icon('plus')}New task</button>` : ''}`
        })}
        ${figures}
        <div class="columns">
          <div class="stack-panels">${weekPanel}${tasksPanel}</div>
          <div class="stack-panels">${approvalPanel}${feedbackPanel}</div>
        </div>
        <p class="small muted" style="margin-top:1.5rem">${icon('lock')} Client records, clinical notes and billing aren't switched on yet. They're greyed out in the menu, and will open once the practice is ready to keep that information here.</p>
      `);

      A.bindCommon(ctx);
    }
  };
})();
