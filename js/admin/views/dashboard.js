/* Dashboard overview: key figures, today's appointments and what needs attention. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const rules = AWY.rules;
  const access = AWY.access;
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

  function attentionItem(tone, iconName, title, detail, href, linkLabel) {
    return html`<li>
      <span class="icon-wrap tone-${tone}" aria-hidden="true">${icon(iconName)}</span>
      <div class="what"><a href="${href}">${title}</a>${detail ? html`<div class="meta">${detail}</div>` : ''}</div>
      <div class="end"><a class="btn btn-quiet btn-sm" href="${href}" aria-label="${linkLabel || 'View'}: ${title}">View</a></div>
    </li>`;
  }

  function apptRow(db, a, showStaff, canComplete) {
    const note = rules.noteFor(db, a.id);
    return html`<li>
      <div class="when">${fmt.time(a.start)}<small>${fmt.duration(a.duration)}</small></div>
      <div class="what">
        ${C.clientLink(db, a.clientId)}
        <div class="meta">
          <span>${C.label('appointmentType', a.type)}</span>
          <span>${icon(a.location === 'telehealth' ? 'video' : 'pin')}${a.location === 'home' ? 'Home visit' : C.label('location', a.location)}</span>
          ${a.travelMins ? html`<span>${icon('car')}${a.travelMins} min travel</span>` : ''}
          ${showStaff ? html`<span>${icon('user')}${rules.staffName(db, a.staffId)}</span>` : ''}
        </div>
      </div>
      <div class="end">
        ${C.badge('appointment', a.status)}
        ${a.status === 'completed' && note && note.status === 'final' ? html`<span class="tag">${icon('lock')}Note done</span>` : ''}
        ${canComplete && (a.status === 'scheduled' || a.status === 'rescheduled') ? html`<button type="button" class="btn btn-secondary btn-sm" data-complete="${a.id}">Mark completed</button>` : ''}
        <button type="button" class="btn btn-quiet btn-sm" data-appt="${a.id}">Open</button>
      </div>
    </li>`;
  }

  AWY.views.dashboard = {
    title: 'Dashboard',
    render(ctx) {
      const { db, today, user } = ctx;
      const d = rules.dashboard(db, today);
      const wide = user.role === 'owner' || user.role === 'admin';
      const mineAppt = (list) => (wide ? list : list.filter((a) => a.staffId === user.id));
      const clinical = access.can('clinical');
      const billing = access.can('billing');

      const upcoming = mineAppt(d.upcoming);
      const todays = mineAppt(d.today);
      const notes = wide ? d.notesOutstanding : d.notesOutstanding.filter((x) => x.appointment.staffId === user.id);
      const myOverdue = wide ? d.overdueTasks : d.overdueTasks.filter((t) => t.assignedTo === user.id);
      const overdueReports = d.reportsOutstanding.filter((r) => rules.reportOverdue(r, today));

      const figureList = [
        figure({ value: upcoming.length, label: 'Upcoming appointments', detail: 'Next 7 days' + (wide ? '' : ', yours'), href: '#/calendar' }),
        figure({ value: d.newReferrals.length, label: 'New referrals', detail: 'Waiting for first contact', href: '#/referrals?stage=new', hidden: !access.canSee('referrals') }),
        figure({ value: d.activeClients.length, label: 'Active clients', detail: db.clients.filter((c) => c.status === 'waitlist').length + ' on the waitlist', href: '#/clients' }),
        figure({ value: notes.length, label: 'Notes to finish', detail: 'Completed sessions without a final note', href: '#/notes?show=outstanding', tone: notes.length ? 'warning' : '', hidden: !clinical }),
        figure({ value: d.reportsOutstanding.length, label: 'Outstanding reports', detail: overdueReports.length ? overdueReports.length + ' past due' : d.reportsDueSoon.length + ' due this week', href: '#/reports', tone: overdueReports.length ? 'alert' : '', hidden: !access.canSee('reports') }),
        figure({ value: d.unsignedAgreements.length, label: 'Unsigned agreements', detail: d.staleAgreements.length ? d.staleAgreements.length + ' waiting over a week' : 'Draft or awaiting signature', href: '#/agreements?status=unsigned', tone: d.staleAgreements.length ? 'warning' : '', hidden: !access.canSee('agreements') }),
        figure({ value: myOverdue.length, label: 'Overdue tasks', detail: wide ? 'Across the practice' : 'Assigned to you', href: '#/tasks', tone: myOverdue.length ? 'alert' : '' }),
        figure({ value: fmt.money(d.unpaidTotal), label: 'Unpaid invoices', detail: fmt.plural(d.unpaid.length, 'invoice') + ', ' + d.overdueInvoices.length + ' overdue', href: '#/invoices?status=unpaid', tone: d.overdueInvoices.length ? 'alert' : '', hidden: !billing })
      ].filter(Boolean);
      /* Two even rows, with the last figure stretched when the count is odd */
      const n = figureList.length;
      const cols = n > 4 ? Math.ceil(n / 2) : n;
      if (n % 2 === 1 && n > 1) figureList[n - 1] = AWY.raw(String(figureList[n - 1]).replace('class="figure', 'class="figure span-2'));
      const figures = html`<div class="figures" style="--cols:${cols}" aria-label="Key figures">${figureList}</div>`;

      /* What needs attention, worked out from the records */
      const items = [];
      if (clinical && notes.length) items.push(attentionItem('warning', 'note', fmt.plural(notes.length, 'session note') + ' to finish', notes.slice(0, 3).map((x) => rules.clientNameById(db, x.appointment.clientId) + ', ' + fmt.date(x.appointment.date)).join('; '), '#/notes?show=outstanding'));
      overdueReports.slice(0, 3).forEach((r) => items.push(attentionItem('danger', 'report', 'Report past due: ' + r.title, rules.clientNameById(db, r.clientId) + ', was due ' + fmt.date(r.dueDate), '#/reports/' + r.id)));
      d.reportsDueSoon.filter((r) => !rules.reportOverdue(r, today)).slice(0, 2).forEach((r) => items.push(attentionItem('info', 'report', 'Report due soon: ' + r.title, rules.clientNameById(db, r.clientId) + ', due ' + fmt.date(r.dueDate), '#/reports/' + r.id)));
      if (access.canSee('agreements')) d.staleAgreements.forEach((a) => items.push(attentionItem('warning', 'signature', 'Agreement not signed after a week', rules.clientNameById(db, a.clientId) + ', sent ' + fmt.date(a.sentDate), '#/agreements/' + a.id)));
      if (myOverdue.length) items.push(attentionItem('danger', 'tasks', fmt.plural(myOverdue.length, 'overdue task'), myOverdue.slice(0, 3).map((t) => t.title).join('; '), '#/tasks'));
      if (billing && d.overdueInvoices.length) items.push(attentionItem('danger', 'receipt', fmt.plural(d.overdueInvoices.length, 'overdue invoice'), d.overdueInvoices.map((i) => 'Invoice ' + i.number + ', ' + fmt.money(i.total)).join('; '), '#/invoices?status=overdue'));
      if (access.canSee('funding') && d.logsToCheck.length) items.push(attentionItem('warning', 'wallet', fmt.plural(d.logsToCheck.length, 'delivered service') + ' to check', 'Recorded from completed appointments. Check them before invoicing.', '#/funding/services?status=recorded'));
      if (billing && d.readyToInvoice.length) {
        const clients = new Set(d.readyToInvoice.map((l) => l.clientId));
        items.push(attentionItem('info', 'receipt', 'Verified services ready to invoice', fmt.plural(clients.size, 'client') + ', ' + fmt.plural(d.readyToInvoice.length, 'service'), '#/invoices?ready=1'));
      }
      if (clinical && d.goalsDueReview.length) items.push(attentionItem('info', 'target', fmt.plural(d.goalsDueReview.length, 'goal') + ' due for review', d.goalsDueReview.slice(0, 3).map((g) => rules.clientNameById(db, g.clientId)).join(', '), '#/goals?due=1'));
      d.consentGaps.forEach((c) => items.push(attentionItem('danger', 'shield', 'No current consent recorded', rules.clientName(c) + ' is an active client without consent for assessment and therapy.', '#/clients/' + c.id + '/records')));
      if (access.canSee('referrals') && d.newReferrals.length) items.push(attentionItem('info', 'inbox', fmt.plural(d.newReferrals.length, 'new referral') + ' to follow up', d.newReferrals.map((r) => r.firstName + ' ' + r.lastName).join(', '), '#/referrals?stage=new'));

      const attention = html`<section class="panel" aria-labelledby="attTitle">
        <div class="panel-head"><h2 id="attTitle">Needs attention</h2><p>Worked out from the current records</p></div>
        ${items.length ? html`<ul class="rows attention">${items}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'checkCircle', title: 'All clear', text: 'Nothing needs attention right now.' })}</div>`}
      </section>`;

      const canComplete = clinical;
      const todayPanel = html`<section class="panel" aria-labelledby="todayTitle">
        <div class="panel-head">
          <h2 id="todayTitle">Today, ${fmt.dateFull(today)}</h2>
          <a class="btn btn-quiet btn-sm" href="#/calendar">Open calendar</a>
        </div>
        ${todays.length
          ? html`<ul class="rows">${todays.map((a) => apptRow(db, a, wide, canComplete))}</ul>`
          : html`<div class="panel-body">${C.empty({ icon: 'calendar', title: 'No appointments today', text: wide ? 'Nobody has appointments booked for today.' : 'You have nothing booked for today.' })}</div>`}
      </section>`;

      /* The rest of the week, grouped by day */
      const later = upcoming.filter((a) => a.date > today);
      const byDay = {};
      later.forEach((a) => (byDay[a.date] = byDay[a.date] || []).push(a));
      const weekPanel = html`<section class="panel" aria-labelledby="weekTitle">
        <div class="panel-head"><h2 id="weekTitle">Coming up this week</h2></div>
        ${later.length
          ? Object.keys(byDay).sort().map((day) => html`<div class="day-label">${fmt.dateLong(day)}</div><ul class="rows">${byDay[day].map((a) => apptRow(db, a, wide, false))}</ul>`)
          : html`<div class="panel-body">${C.empty({ icon: 'calendar', title: 'Nothing else booked this week' })}</div>`}
      </section>`;

      const myTasks = db.tasks.filter((t) => t.status === 'open' && t.assignedTo === user.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);
      const tasksPanel = html`<section class="panel" aria-labelledby="tasksTitle">
        <div class="panel-head"><h2 id="tasksTitle">Your tasks</h2><a class="btn btn-quiet btn-sm" href="#/tasks">All tasks</a></div>
        ${myTasks.length
          ? html`<ul class="rows">${myTasks.map((t) => AWY.actions.taskRow(db, t, today))}</ul>`
          : html`<div class="panel-body">${C.empty({ icon: 'checkCircle', title: 'No open tasks', text: 'Nothing is assigned to you.' })}</div>`}
      </section>`;

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: greeting() + ', ' + user.name.split(' ')[0],
          subtitle: fmt.dateLong(today) + '. Here is how the practice is looking.',
          actions: html`
            ${access.can('editClients') ? html`<button type="button" class="btn btn-secondary" data-new-client>${icon('userPlus')}New client</button>` : ''}
            <a class="btn" href="#/calendar?new=1">${icon('plus')}New appointment</a>`
        })}
        ${figures}
        <div class="columns">
          <div class="stack-panels">${todayPanel}${weekPanel}</div>
          <div class="stack-panels">${attention}${tasksPanel}</div>
        </div>
        <p class="small muted" style="margin-top:1.5rem">${icon('zap')} Items marked Automatic were created by the practice's automation rules. They never finalise notes, confirm services or send anything. Rules can be switched off in Settings.</p>
      `);

      AWY.actions.bindCommon(ctx);
    }
  };
})();
