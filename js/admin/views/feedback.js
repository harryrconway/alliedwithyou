/*
  Feedback and issues. Everyone sees what they've sent and any reply.
  For administrators and developers each report is a ticket: a status, a priority, the
  person working on it, private notes and a history of every change. Error reports are
  grouped by problem, with how often each one happens, and can be turned into tickets.
  The latest results of the service checks are shown alongside them.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const rules = AWY.rules;
  const access = AWY.access;
  const store = AWY.store;
  const schema = AWY.schema;
  const icon = (n) => raw(AWY.icon(n));

  const OPEN = ['submitted', 'under_review', 'planned', 'in_progress'];
  const RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

  const person = (db, id) => (id ? rules.staffName(db, id) : 'Former staff member');
  const reviewers = (db) => rules.activeStaff(db).filter((s) => s.role === 'administrator' || s.role === 'developer');

  /* Error reports grouped by the problem they share */
  function errorGroups(db) {
    const groups = new Map();
    db.errorEvents.forEach((e) => {
      const key = e.fingerprint || e.ref;
      const g = groups.get(key) || { key: key, events: [] };
      g.events.push(e);
      groups.set(key, g);
    });
    return Array.from(groups.values()).map((g) => {
      g.events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      g.latest = g.events[0];
      g.first = g.events[g.events.length - 1];
      g.people = new Set(g.events.map((e) => e.userId).filter(Boolean)).size;
      g.refs = new Set(g.events.map((e) => e.ref));
      g.ticket = db.feedback.find((f) => f.errorRef && g.refs.has(f.errorRef)) || null;
      return g;
    }).sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
  }

  function groupFor(db, ref) {
    return ref ? errorGroups(db).find((g) => g.refs.has(ref)) || null : null;
  }

  const fieldLabel = { created: 'Reported', status: 'Status', priority: 'Priority', assigned_to: 'Assigned to' };
  function eventText(db, e) {
    if (e.field === 'created') return 'Reported';
    if (e.field === 'status') return 'Status ' + schema.status('feedback', e.oldValue).label.toLowerCase() + ' to ' + schema.status('feedback', e.newValue).label.toLowerCase();
    if (e.field === 'priority') return 'Priority ' + C.label('ticketPriority', e.oldValue).toLowerCase() + ' to ' + C.label('ticketPriority', e.newValue).toLowerCase();
    if (e.field === 'assigned_to') return e.newValue ? 'Assigned to ' + person(db, e.newValue) : 'No longer assigned';
    return fieldLabel[e.field] || e.field;
  }

  /* The person who sent it sees the details and any reply */
  function openOwn(db, f) {
    AWY.ui.modal({
      title: f.title,
      body: html`${C.kv([
        ['Reference', f.ref],
        ['Type', C.label('feedbackKind', f.kind)],
        ['Status', C.badge('feedback', f.status)],
        ['Sent', fmt.stamp(f.createdAt)],
        ['What happened', f.description]
      ])}
      ${f.response ? html`<div class="notice notice-success" style="margin-top:1rem">${icon('message')}<div><strong>Reply from the practice</strong>${f.response}</div></div>` : ''}`,
      footer: html`<button type="button" class="btn btn-secondary" data-close>Close</button>`
    });
  }

  /* Administrators and developers work the ticket */
  function openTicket(db, f) {
    const group = groupFor(db, f.errorRef);
    const notes = db.feedbackNotes.filter((n) => n.feedbackId === f.id);
    const events = db.feedbackEvents.filter((e) => e.feedbackId === f.id).sort((a, b) => a.at.localeCompare(b.at));
    const assignees = reviewers(db).map((s) => ({ value: s.id, label: s.name || s.email }));

    C.openForm({
      title: f.title,
      subtitle: 'Reference ' + f.ref + ', sent by ' + (f.createdBy ? person(db, f.createdBy) : 'a former staff member') + ' on ' + fmt.stamp(f.createdAt),
      area: 'feedback',
      size: 'wide',
      intro: html`${C.kv([
        ['Type', C.label('feedbackKind', f.kind)],
        ['Screen', f.area],
        ['What happened', f.description],
        ['Resolved', f.resolvedAt ? fmt.stamp(f.resolvedAt) : '']
      ])}
      ${group ? html`<div class="notice" style="margin-top:1rem">${icon('alertCircle')}<div><strong>Error ${f.errorRef}: ${C.label('errorCategory', group.latest.category)}</strong>
        ${group.latest.area || 'Unknown screen'}${group.latest.operation ? ', while trying to ' + group.latest.operation : ''}. Happened ${fmt.plural(group.events.length, 'time')} for ${fmt.plural(group.people, 'person', 'people')}, most recently ${fmt.stamp(group.latest.createdAt)}. ${group.latest.message}</div></div>` : ''}`,
      fields: [
        { name: 'status', label: 'Status', type: 'select', options: schema.statusOptions('feedback'), required: true },
        { name: 'priority', label: 'Priority', type: 'select', options: schema.options.ticketPriority, required: true },
        { name: 'assignedTo', label: 'Who is working on it', type: 'select', options: assignees },
        { name: 'response', label: 'Reply to the person who sent it', type: 'textarea', span: 'all', rows: 3, hint: 'They see this when they open their report.' }
      ],
      values: f,
      db: db,
      submitLabel: 'Save ticket',
      after: html`
        <section class="ticket-notes" aria-labelledby="notesTitle">
          <h3 id="notesTitle">Private notes</h3>
          <p class="small muted">Only administrators and developers see these. Notes can't be edited once added.</p>
          <ul class="note-list">${notes.length ? notes.map((n) => html`<li><div class="meta"><strong>${n.authorId ? person(db, n.authorId) : 'Former staff member'}</strong><span>${fmt.stamp(n.createdAt)}</span></div><p>${n.body}</p></li>`) : html`<li class="muted small">No notes yet.</li>`}</ul>
          <div class="field"><label for="ticketNote">Add a note</label><textarea class="textarea" id="ticketNote" name="noteBody" rows="2" maxlength="2000"></textarea></div>
          <div><button type="button" class="btn btn-secondary btn-sm" data-add-note>${icon('plus')}Add note</button></div>
        </section>
        <section class="ticket-history" aria-labelledby="historyTitle">
          <h3 id="historyTitle">History</h3>
          <ul class="timeline-list">${events.map((e) => html`<li><span>${eventText(db, e)}</span><span class="muted small">${e.actorId ? person(db, e.actorId) + ', ' : ''}${fmt.stamp(e.at)}</span></li>`)}</ul>
        </section>`,
      onOpen(modal) {
        const add = modal.el.querySelector('[data-add-note]');
        add.addEventListener('click', async () => {
          const box = modal.el.querySelector('#ticketNote');
          const body = box.value.trim();
          if (!body) {
            AWY.validate.showError(box, 'Please write a note first');
            return;
          }
          const saved = await AWY.ui.busy(add, () => C.save(store.create('feedbackNotes', { feedbackId: f.id, body: body }, { requestId: AWY.uuid() }), 'Note added.', { area: 'feedback', operation: 'add note' }));
          if (saved) {
            const list = modal.el.querySelector('.note-list');
            const empty = list.querySelector('.muted');
            if (empty) empty.remove();
            list.insertAdjacentHTML('beforeend', String(html`<li><div class="meta"><strong>${person(AWY.app.db, saved.authorId)}</strong><span>${fmt.stamp(saved.createdAt)}</span></div><p>${saved.body}</p></li>`));
            box.value = '';
          }
        });
      },
      async onSubmit(v) {
        await store.update('feedback', f.id, { status: v.status, priority: v.priority, assignedTo: v.assignedTo, response: v.response });
        AWY.ui.toast('Ticket ' + f.ref + ' saved.');
      }
    });
  }

  /* An error report turned into a ticket, with its reference attached */
  function ticketFromError(db, g) {
    const e = g.latest;
    C.openForm({
      title: 'Create a ticket for this error',
      subtitle: 'Error ' + e.ref + ', ' + fmt.plural(g.events.length, 'time') + ' so far',
      area: 'feedback',
      fields: [
        { name: 'title', label: 'Short summary', type: 'text', required: true, span: 'all' },
        { name: 'priority', label: 'Priority', type: 'select', options: schema.options.ticketPriority, required: true },
        { name: 'description', label: 'Details', type: 'textarea', span: 'all', rows: 4 }
      ],
      values: {
        title: (e.area || 'Dashboard') + ': ' + (e.operation || 'error'),
        priority: g.events.length >= 5 ? 'high' : 'normal',
        description: C.label('errorCategory', e.category) + '. ' + e.message
      },
      db: db,
      submitLabel: 'Create ticket',
      async onSubmit(v, modal) {
        const rec = await store.create('feedback', { kind: 'bug', title: v.title, description: v.description, area: e.area, errorRef: e.ref, priority: v.priority }, { requestId: modal.requestId });
        AWY.ui.toast('Ticket ' + rec.ref + ' created.');
      }
    });
  }

  function reportList(db, list, review) {
    if (!list.length) return C.empty({ icon: 'message', title: 'Nothing here', text: review ? 'No tickets match.' : "You haven't sent anything yet. Use Report an issue at the top of the page." });
    return html`<section class="panel"><ul class="rows">${list.map((f) => html`<li>
      <div class="what">
        <button type="button" class="link-button" data-open-report="${f.id}">${f.title}</button>
        <div class="meta">
          <span>Reference ${f.ref}</span>
          <span>${fmt.relative(f.createdAt.slice(0, 10))}</span>
          ${review ? html`<span>${icon('user')}${f.createdBy ? person(db, f.createdBy) : 'Former staff member'}</span>` : ''}
          ${review && f.assignedTo ? html`<span>${icon('tasks')}${person(db, f.assignedTo)}</span>` : ''}
          ${f.errorRef ? html`<span>${icon('alertCircle')}Error ${f.errorRef}</span>` : ''}
          ${f.response && !review ? html`<span>${icon('message')}Reply received</span>` : ''}
        </div>
      </div>
      <div class="end">${review && (f.priority === 'high' || f.priority === 'urgent') ? C.badge('priority', f.priority) : ''}${C.badge('feedback', f.status)}</div>
    </li>`)}</ul></section>`;
  }

  function serviceChecks(db) {
    if (!db.monitorChecks.length) return '';
    return html`<section class="panel" style="margin-bottom:1rem" aria-labelledby="checksTitle">
      <div class="panel-head"><div><h2 id="checksTitle">Service checks</h2><p>Checked every 15 minutes. An email goes out after two failures in a row, and again when it's working.</p></div></div>
      <ul class="rows">${db.monitorChecks.map((m) => html`<li>
        <div class="what"><strong>${C.label('monitorCheck', m.name)}</strong><div class="meta"><span>Checked ${fmt.stamp(m.checkedAt)}</span>${!m.ok && m.detail ? html`<span>${m.detail}</span>` : ''}</div></div>
        <div class="end">${m.ok ? html`<span class="badge tone-success">${icon('checkCircle')}Working</span>` : html`<span class="badge tone-danger">${icon('alert')}Not working</span>`}</div>
      </li>`)}</ul>
    </section>`;
  }

  function errorsTab(db, state) {
    const groups = errorGroups(db).filter((g) => C.matches(g.latest, state.q, ['ref', 'area', 'operation', 'message', (x) => [...g.refs].join(' ')]));
    return html`
      ${serviceChecks(db)}
      <div class="notice" style="margin-bottom:1rem">${icon('info')}<div>Every error shows the person a reference, so a reported issue can be matched to what went wrong. Errors are grouped by problem. Only safe details are kept, never record contents, passwords or personal information. The latest 200 are shown.</div></div>
      <div class="toolbar">${C.search(state.q, 'Search by reference, screen or details')}</div>
      ${groups.length ? html`<section class="panel"><ul class="rows">${groups.map((g) => html`<li>
        <div class="what"><strong>${g.latest.area || 'Unknown screen'}${g.latest.operation ? ', ' + g.latest.operation : ''}</strong>
          <div class="meta"><span>${C.label('errorCategory', g.latest.category)}</span><span>${fmt.plural(g.events.length, 'time')}</span><span>${fmt.plural(g.people, 'person', 'people')}</span><span>Last ${fmt.stamp(g.latest.createdAt)}</span><span>Reference ${g.latest.ref}</span></div>
          ${g.latest.message ? html`<div class="meta" style="margin-top:0.2rem"><span>${g.latest.message}</span></div>` : ''}
        </div>
        <div class="end">${g.ticket
          ? html`<button type="button" class="btn btn-quiet btn-sm" data-open-report="${g.ticket.id}">Ticket ${g.ticket.ref}</button>`
          : html`<button type="button" class="btn btn-secondary btn-sm" data-ticket-from="${g.key}">${icon('plus')}Create ticket</button>`}</div>
      </li>`)}</ul></section>` : C.empty({ icon: 'checkCircle', title: 'No error reports' })}`;
  }

  AWY.views.feedback = {
    title: 'Feedback and issues',
    render(ctx) {
      const { db, state, user, query, params } = ctx;
      const review = access.can('reviewFeedback');
      const errors = access.can('viewErrors');
      const tab = errors && params.id === 'errors' ? 'errors' : 'reports';
      if (state.show === undefined) state.show = 'open';

      let body;
      if (tab === 'errors') {
        body = errorsTab(db, state);
      } else if (review) {
        const counts = { open: 0, mine: 0, completed: 0, declined: 0 };
        db.feedback.forEach((f) => {
          if (OPEN.includes(f.status)) counts.open += 1;
          if (OPEN.includes(f.status) && f.assignedTo === user.id) counts.mine += 1;
          if (f.status === 'completed' || f.status === 'declined') counts[f.status] += 1;
        });
        const list = db.feedback.filter((f) =>
          (state.show === 'all' || (state.show === 'open' ? OPEN.includes(f.status) : state.show === 'mine' ? OPEN.includes(f.status) && f.assignedTo === user.id : f.status === state.show)) &&
          (!state.priority || f.priority === state.priority) &&
          C.matches(f, state.q, ['title', 'description', 'ref', 'errorRef'])
        ).sort((a, b) => (OPEN.includes(a.status) && OPEN.includes(b.status) ? RANK[a.priority] - RANK[b.priority] : 0) || b.createdAt.localeCompare(a.createdAt));
        body = html`
          ${C.seg('show', [
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'mine', label: 'Assigned to me', count: counts.mine },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'declined', label: 'Declined', count: counts.declined },
            { value: 'all', label: 'All', count: db.feedback.length }
          ], state.show)}
          <div class="toolbar">${C.search(state.q, 'Search tickets or a reference')}${C.select('priority', 'Priority', schema.options.ticketPriority, state.priority, 'Any')}</div>
          ${reportList(db, list, true)}`;
      } else {
        body = reportList(db, db.feedback.filter((f) => f.createdBy === user.id), false);
      }

      const down = (db.monitorChecks || []).filter((m) => !m.ok).length;
      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Feedback and issues',
          subtitle: review ? 'Problems and ideas from the team, tracked through to fixed.' : 'Problems and ideas you have sent, and any replies.',
          actions: html`<button type="button" class="btn" data-action="report">${icon('plus')}Report an issue</button>`
        })}
        ${errors ? html`<div class="tabs-wrap">${C.tabs([
          { key: 'reports', label: 'Tickets', href: '#/feedback', count: db.feedback.filter((f) => f.status === 'submitted').length },
          { key: 'errors', label: down ? 'Errors and service checks, ' + down + ' not working' : 'Errors and service checks', href: '#/feedback/errors' }
        ], tab)}</div>` : ''}
        ${body}
      `);

      C.bindFilters(ctx);
      AWY.on(ctx.el, 'click', '[data-open-report]', (event, btn) => {
        const f = db.feedback.find((x) => x.id === btn.dataset.openReport);
        if (review) openTicket(db, f);
        else openOwn(db, f);
      });
      AWY.on(ctx.el, 'click', '[data-ticket-from]', (event, btn) => ticketFromError(db, errorGroups(db).find((g) => g.key === btn.dataset.ticketFrom)));

      /* Opened from the dashboard */
      C.openLinked(ctx, { path: ['feedback'], list: db.feedback, table: 'feedback', open: (f) => (review ? openTicket : openOwn)(db, f) });
    }
  };
})();
