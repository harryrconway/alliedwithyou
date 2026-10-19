/*
  Feedback and reported issues. Everyone sees what they've sent and any reply.
  Administrators and developers see everything, update the status, and can look up
  the error report behind a reference code.
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

  function errorFor(db, ref) {
    return ref ? db.errorEvents.find((e) => e.ref === ref) : null;
  }

  function openReport(db, f) {
    const review = access.can('reviewFeedback');
    const err = review ? errorFor(db, f.errorRef) : null;
    const details = C.kv([
      ['Reference', f.ref],
      ['Type', C.label('feedbackKind', f.kind)],
      ['Status', C.badge('feedback', f.status)],
      ['Sent', fmt.stamp(f.createdAt) + (review ? ', by ' + (f.createdBy ? rules.staffName(db, f.createdBy) : 'a former staff member') : '')],
      ['Screen', f.area],
      ['Error reference', f.errorRef],
      ['What happened', f.description]
    ]);
    const errorBlock = err ? html`<div class="notice" style="margin-top:1rem">${icon('info')}<div><strong>Error report ${err.ref}</strong>${C.label('errorCategory', err.category)} on ${err.area || 'an unknown screen'}${err.operation ? ', while trying to ' + err.operation : ''}, ${fmt.stamp(err.createdAt)}. ${err.message}</div></div>` : '';

    if (!review) {
      AWY.ui.modal({
        title: f.title,
        body: html`${details}${f.response ? html`<div class="notice notice-success" style="margin-top:1rem">${icon('message')}<div><strong>Reply from the practice</strong>${f.response}</div></div>` : ''}`,
        footer: html`<button type="button" class="btn btn-secondary" data-close>Close</button>`
      });
      return;
    }
    C.openForm({
      title: f.title,
      area: 'feedback',
      intro: html`${details}${errorBlock}`,
      fields: [
        { name: 'status', label: 'Status', type: 'select', options: schema.statusOptions('feedback'), required: true },
        { name: 'response', label: 'Reply', type: 'textarea', span: 'all', rows: 3, hint: 'The person who sent this sees the reply when they open it.' }
      ],
      values: f,
      db: db,
      size: 'wide',
      submitLabel: 'Save',
      async onSubmit(v) {
        await store.update('feedback', f.id, { status: v.status, response: v.response });
        AWY.ui.toast('Report ' + f.ref + ' updated.');
      }
    });
  }

  function reportList(db, list, review) {
    if (!list.length) return C.empty({ icon: 'message', title: 'Nothing here', text: review ? 'No feedback matches.' : "You haven't sent anything yet. Use Report an issue at the top of the page." });
    return html`<section class="panel"><ul class="rows">${list.map((f) => html`<li>
      <div class="what">
        <button type="button" class="link-button" data-open-report="${f.id}">${f.title}</button>
        <div class="meta">
          <span>${C.label('feedbackKind', f.kind)}</span>
          <span>Reference ${f.ref}</span>
          <span>${fmt.relative(f.createdAt.slice(0, 10))}</span>
          ${review ? html`<span>${icon('user')}${f.createdBy ? rules.staffName(db, f.createdBy) : 'Former staff member'}</span>` : ''}
          ${f.errorRef ? html`<span>${icon('alertCircle')}Error ${f.errorRef}</span>` : ''}
          ${f.response && !review ? html`<span>${icon('message')}Reply received</span>` : ''}
        </div>
      </div>
      <div class="end">${C.badge('feedback', f.status)}</div>
    </li>`)}</ul></section>`;
  }

  function errorTable(db, state) {
    const rows = db.errorEvents.filter((e) => C.matches(e, state.q, ['ref', 'area', 'operation', 'message', (x) => rules.staffName(db, x.userId)]));
    const columns = [
      { key: 'when', label: 'When', sortValue: (e) => e.createdAt, render: (e) => html`${fmt.stamp(e.createdAt)}<span class="sub">Reference ${e.ref}</span>` },
      { key: 'category', label: 'Kind', sortValue: (e) => e.category, render: (e) => C.label('errorCategory', e.category) },
      { key: 'where', label: 'Where', sortValue: (e) => e.area, render: (e) => html`${e.area || 'Unknown'}${e.operation ? html`<span class="sub">${e.operation}</span>` : ''}` },
      { key: 'message', label: 'Details', render: (e) => html`<span class="small">${e.message}</span>` },
      { key: 'who', label: 'Person', sortValue: (e) => rules.staffName(db, e.userId), render: (e) => (e.userId ? rules.staffName(db, e.userId) : 'Unknown') }
    ];
    return html`
      <div class="notice" style="margin-bottom:1rem">${icon('info')}<div>Every error shows the person a reference code, so a reported issue can be matched to what went wrong. Only safe details are kept: never record contents, passwords or personal information. The latest 200 are shown.</div></div>
      <div class="toolbar">${C.search(state.q, 'Search by reference, screen or person')}</div>
      ${C.table({ columns: columns, rows: rows, sort: state.sort || '-when', caption: 'Error reports', empty: C.empty({ icon: 'checkCircle', title: 'No error reports' }) })}`;
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
        body = errorTable(db, state);
      } else if (review) {
        const counts = { open: 0, completed: 0, declined: 0 };
        db.feedback.forEach((f) => {
          if (OPEN.includes(f.status)) counts.open += 1;
          else counts[f.status] = (counts[f.status] || 0) + 1;
        });
        const list = db.feedback.filter((f) =>
          (state.show === 'all' || (state.show === 'open' ? OPEN.includes(f.status) : f.status === state.show)) &&
          C.matches(f, state.q, ['title', 'description', 'ref', 'errorRef'])
        );
        body = html`
          ${C.seg('show', [{ value: 'open', label: 'Open', count: counts.open }, { value: 'completed', label: 'Completed', count: counts.completed }, { value: 'declined', label: 'Declined', count: counts.declined }, { value: 'all', label: 'All', count: db.feedback.length }], state.show)}
          <div class="toolbar">${C.search(state.q, 'Search feedback or a reference')}</div>
          ${reportList(db, list, true)}`;
      } else {
        body = reportList(db, db.feedback.filter((f) => f.createdBy === user.id), false);
      }

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Feedback and issues',
          subtitle: review ? 'Problems and ideas sent in by the team.' : 'Problems and ideas you have sent, and any replies.',
          actions: html`<button type="button" class="btn" data-action="report">${icon('plus')}Report an issue</button>`
        })}
        ${errors ? html`<div class="tabs-wrap">${C.tabs([
          { key: 'reports', label: 'Feedback and issues', href: '#/feedback', count: db.feedback.filter((f) => f.status === 'submitted').length },
          { key: 'errors', label: 'Error reports', href: '#/feedback/errors' }
        ], tab)}</div>` : ''}
        ${body}
      `);

      C.bindFilters(ctx);
      C.bindRows(ctx.el);
      AWY.on(ctx.el, 'click', '[data-open-report]', (event, btn) => openReport(db, db.feedback.find((f) => f.id === btn.dataset.openReport)));

      /* Opened from the dashboard */
      if (query.open && state.openedFor !== query.open) {
        state.openedFor = query.open;
        AWY.router.replace(['feedback']);
        const f = db.feedback.find((x) => x.id === query.open);
        if (f) openReport(db, f);
      }
    }
  };
})();
