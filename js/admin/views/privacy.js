/*
  Privacy requests: what people ask under the Privacy Act, logged by whoever took the
  call or the email. Administrators work them through to a reply, aiming to answer
  within 30 days as the privacy page promises.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const rules = AWY.rules;
  const access = AWY.access;
  const store = AWY.store;
  const schema = AWY.schema;
  const icon = (n) => raw(AWY.icon(n));

  const OPEN = ['received', 'in_progress'];

  function logRequest() {
    C.openForm({
      title: 'Log a privacy request',
      subtitle: 'For a request about seeing, correcting or deleting personal information, however it came in.',
      area: 'privacy',
      fields: schema.tables.privacyRequests.fields,
      values: {},
      db: AWY.app.db,
      size: 'wide',
      submitLabel: 'Log request',
      async onSubmit(values, modal) {
        const r = await store.create('privacyRequests', values, { requestId: modal.requestId });
        AWY.ui.toast('Logged as ' + r.ref + '.');
      }
    });
  }

  /* The person who logged it sees what they recorded, read only */
  function openOwn(db, p) {
    AWY.ui.modal({
      title: p.requesterName,
      body: html`${C.kv([
        ['Reference', p.ref],
        ['What they are asking for', C.label('privacyKind', p.kind)],
        ['Email', p.requesterEmail],
        ['Phone', p.requesterPhone],
        ['What they asked', p.details],
        ['Status', C.badge('privacyRequest', p.status)],
        ['Logged', fmt.stamp(p.createdAt)]
      ])}`,
      footer: html`<button type="button" class="btn btn-secondary" data-close>Close</button>`
    });
  }

  /* Administrators work the request through to a reply */
  function openManage(db, p) {
    const assignees = rules.activeStaff(db).map((s) => ({ value: s.id, label: s.name || s.email }));
    C.openForm({
      title: p.requesterName,
      subtitle: 'Reference ' + p.ref + ', logged by ' + (p.createdBy ? rules.staffName(db, p.createdBy) : 'a former staff member') + ' on ' + fmt.stamp(p.createdAt),
      area: 'privacy',
      fields: [
        { name: 'status', label: 'Status', type: 'select', options: schema.statusOptions('privacyRequest'), required: true },
        { name: 'assignedTo', label: 'Who is working on it', type: 'select', options: assignees },
        { name: 'internalNotes', label: 'Internal notes', type: 'textarea', span: 'all', rows: 4, hint: 'What was checked, what was sent, and when. Not seen by the person who asked.' }
      ],
      intro: html`${C.kv([
        ['What they are asking for', C.label('privacyKind', p.kind)],
        ['Email', p.requesterEmail],
        ['Phone', p.requesterPhone],
        ['What they asked', p.details],
        ['Due by', fmt.date(D.addDays(p.createdAt.slice(0, 10), 30))]
      ])}`,
      values: p,
      db: db,
      submitLabel: 'Save',
      async onSubmit(values) {
        await store.update('privacyRequests', p.id, { status: values.status, assignedTo: values.assignedTo, internalNotes: values.internalNotes });
        AWY.ui.toast(p.ref + ' saved.');
      }
    });
  }

  function row(db, p, manage) {
    const due = D.addDays(p.createdAt.slice(0, 10), 30);
    const today = D.today();
    return html`<li>
      <div class="what">
        <button type="button" class="link-button" data-open="${p.id}">${p.requesterName}</button>
        <div class="meta">
          <span>Reference ${p.ref}</span>
          <span>${C.label('privacyKind', p.kind)}</span>
          ${manage ? html`<span>${icon('clock')}Due ${C.due(due, today, !OPEN.includes(p.status))}</span>` : ''}
          ${manage && p.assignedTo ? html`<span>${icon('user')}${rules.staffName(db, p.assignedTo)}</span>` : ''}
        </div>
      </div>
      <div class="end">${C.badge('privacyRequest', p.status)}</div>
    </li>`;
  }

  AWY.views.privacy = {
    title: 'Privacy requests',
    render(ctx) {
      const { db, state, query } = ctx;
      const manage = access.can('managePrivacy');
      if (state.show === undefined) state.show = 'open';
      const counts = { open: 0, completed: 0, declined: 0 };
      db.privacyRequests.forEach((p) => {
        if (OPEN.includes(p.status)) counts.open += 1;
        if (p.status === 'completed' || p.status === 'declined') counts[p.status] += 1;
      });
      const list = db.privacyRequests.filter((p) =>
        (!manage || state.show === 'all' || (state.show === 'open' ? OPEN.includes(p.status) : p.status === state.show)) &&
        C.matches(p, state.q, ['requesterName', 'details', 'ref'])
      ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Privacy requests',
          subtitle: 'What people have asked under the Privacy Act, tracked through to a reply within 30 days.',
          actions: html`<button type="button" class="btn" data-log>${icon('plus')}Log a request</button>`
        })}
        ${manage ? C.seg('show', [
          { value: 'open', label: 'Open', count: counts.open },
          { value: 'completed', label: 'Completed', count: counts.completed },
          { value: 'declined', label: 'Declined', count: counts.declined },
          { value: 'all', label: 'All', count: db.privacyRequests.length }
        ], state.show) : ''}
        <div class="toolbar">${C.search(state.q, 'Search by name, reference or details')}</div>
        ${list.length
          ? html`<section class="panel"><ul class="rows">${list.map((p) => row(db, p, manage))}</ul></section>`
          : C.empty({ icon: 'lock', title: db.privacyRequests.length ? 'Nothing here' : 'No privacy requests yet', text: db.privacyRequests.length ? 'Try changing the filters.' : 'Log one as soon as someone asks, by phone, email or otherwise.' })}
      `);

      C.bindFilters(ctx);
      AWY.on(ctx.el, 'click', '[data-log]', () => logRequest());
      AWY.on(ctx.el, 'click', '[data-open]', (event, btn) => {
        const p = db.privacyRequests.find((x) => x.id === btn.dataset.open);
        if (!p) return;
        (manage ? openManage : openOwn)(db, p);
      });

      /* Opened from search or another screen */
      C.openLinked(ctx, { path: ['privacy'], list: db.privacyRequests, table: 'privacyRequests', open: (p) => (manage ? openManage : openOwn)(db, p) });
    }
  };
})();
