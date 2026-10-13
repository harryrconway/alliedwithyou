/* Assessments: structured assessment records linked to each client. */
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
  const A = AWY.actions;
  const icon = (n) => raw(AWY.icon(n));

  A.assessmentForm = function (existing, prefill) {
    const db = AWY.app.db;
    const isNew = !existing;
    const canEdit = access.can('assess');
    const fields = (isNew && !(prefill && prefill.clientId) ? [{ name: 'clientId', label: 'Client', type: 'client', required: true }] : []).concat(schema.tables.assessments.fields);
    const reviewed = existing && existing.status === 'reviewed';
    C.openForm({
      title: isNew ? 'New assessment' : C.label('assessmentType', existing.type),
      subtitle: (existing || prefill) && (existing || prefill).clientId ? rules.clientNameById(db, (existing || prefill).clientId) + '. Assessment templates are drafts for the therapist to approve.' : 'Assessment templates are drafts for the therapist to approve.',
      fields: fields,
      values: Object.assign({ status: 'planned', date: D.today(), assessorId: access.user().role === 'admin' ? '' : access.user().id, methods: [] }, prefill || {}, existing || {}),
      db: db,
      size: 'wide',
      intro: reviewed ? html`<div class="notice notice-success">${icon('checkCircle')}<div>Reviewed by ${rules.staffName(db, existing.reviewedBy)} on ${fmt.stamp(existing.reviewedAt)}.</div></div>` : '',
      submitLabel: isNew ? 'Save assessment' : 'Save changes',
      footerStart: existing && existing.status === 'completed' && access.can('reviewReports') ? html`<button type="button" class="btn btn-secondary" data-mark-reviewed>${icon('checkCircle')}Mark as reviewed</button>` : '',
      onOpen(modal) {
        if (!canEdit) AWY.$$('input, select, textarea, [type="submit"]', modal.form).forEach((x) => (x.disabled = true));
        const btn = modal.el.querySelector('[data-mark-reviewed]');
        if (btn) btn.addEventListener('click', async () => {
          await C.save(store.update('assessments', existing.id, { status: 'reviewed', reviewedBy: access.user().id, reviewedAt: D.now() }), 'Assessment marked as reviewed.');
          modal.close();
        });
      },
      async onSubmit(values) {
        if (values.status === 'reviewed' && (!existing || existing.status !== 'reviewed')) {
          values.reviewedBy = access.user().id;
          values.reviewedAt = D.now();
        }
        if (isNew) {
          await store.create('assessments', Object.assign({ clientId: prefill && prefill.clientId }, values));
          AWY.ui.toast('Assessment saved.');
        } else {
          await store.update('assessments', existing.id, values);
          AWY.ui.toast('Assessment updated.');
        }
      }
    });
  };

  AWY.views.assessments = {
    title: 'Assessments',
    render(ctx) {
      const { db, state } = ctx;
      if (state.status === undefined) state.status = 'all';
      if (state.sort === undefined) state.sort = '-date';
      const counts = {};
      db.assessments.forEach((a) => (counts[a.status] = (counts[a.status] || 0) + 1));
      const seg = [{ value: 'all', label: 'All', count: db.assessments.length }].concat(Object.keys(schema.statuses.assessment).map((k) => ({ value: k, label: schema.status('assessment', k).label, count: counts[k] || 0 })));
      const rows = db.assessments.filter((a) =>
        (state.status === 'all' || a.status === state.status) &&
        (!state.type || a.type === state.type) &&
        C.matches(a, state.q, [(x) => rules.clientNameById(db, x.clientId), 'findings', 'recommendations'])
      );
      const columns = [
        { key: 'date', label: 'Date', sortValue: (a) => a.date, render: (a) => html`<button type="button" style="all:unset;cursor:pointer;font-weight:680" data-assessment="${a.id}">${fmt.date(a.date)}</button><span class="sub">${fmt.relative(a.date)}</span>` },
        { key: 'client', label: 'Client', sortValue: (a) => rules.clientNameById(db, a.clientId), render: (a) => C.clientLink(db, a.clientId, 'assessments') },
        { key: 'type', label: 'Assessment', sortValue: (a) => C.label('assessmentType', a.type), render: (a) => html`${C.label('assessmentType', a.type)}${(a.methods || []).length ? html`<span class="sub">${a.methods.map((m) => C.label('assessmentMethod', m)).join(', ')}</span>` : ''}` },
        { key: 'assessor', label: 'Assessor', sortValue: (a) => rules.staffName(db, a.assessorId), render: (a) => rules.staffName(db, a.assessorId) },
        { key: 'status', label: 'Status', sortValue: (a) => a.status, render: (a) => C.badge('assessment', a.status) },
        { key: 'open', label: '', render: (a) => html`<button type="button" class="btn btn-quiet btn-sm" data-assessment="${a.id}">Open</button>` }
      ];
      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Assessments',
          subtitle: 'Planned, in progress and completed assessments across all clients.',
          actions: access.can('assess') ? html`<button type="button" class="btn" data-new-assessment>${icon('plus')}New assessment</button>` : ''
        })}
        ${C.seg('status', seg, state.status)}
        <div class="toolbar">
          ${C.search(state.q, 'Search by client or findings')}
          ${C.select('type', 'Type', C.options('assessmentType'), state.type)}
        </div>
        ${C.table({ columns, rows, sort: state.sort, caption: 'Assessments', empty: C.empty({ icon: 'clipboard', title: 'No assessments match' }) })}
      `);
      C.bindFilters(ctx);
      AWY.on(ctx.el, 'click', '[data-assessment]', (event, btn) => A.assessmentForm(db.assessments.find((x) => x.id === btn.dataset.assessment)));
      AWY.on(ctx.el, 'click', '[data-new-assessment]', () => A.assessmentForm(null, {}));
    }
  };
})();
