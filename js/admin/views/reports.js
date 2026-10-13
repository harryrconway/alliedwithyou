/* Clinical reports: track, write, review and record delivery, with a printable preview. */
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

  /* Starting sections for a new report, filled from the client record where possible */
  function starterSections(db, clientId, type) {
    const c = rules.client(db, clientId);
    const assessment = db.assessments.filter((a) => a.clientId === clientId && (a.status === 'completed' || a.status === 'reviewed')).sort((a, b) => b.date.localeCompare(a.date))[0];
    const goals = db.goals.filter((g) => g.clientId === clientId && g.status !== 'discontinued');
    const base = [
      { heading: 'Reason for report', body: '' },
      { heading: 'Background', body: c ? [c.background, c.livingSituation].filter(Boolean).join(' ') : '' }
    ];
    if (type === 'progress' || type === 'discharge') {
      return base.concat([
        { heading: 'Goals and progress', body: goals.map((g) => '"' + g.description + '": now ' + rules.goalLatest(db, g) + ' of 10, target ' + g.target + '.').join('\n') },
        { heading: 'Therapy provided', body: '' },
        { heading: 'Recommendations', body: '' }
      ]);
    }
    return base.concat([
      { heading: 'Assessment and findings', body: assessment ? assessment.findings : '' },
      { heading: 'Functional impact', body: assessment ? assessment.functionalNeeds : '' },
      { heading: 'Recommendations', body: assessment ? assessment.recommendations : '' }
    ]);
  }

  A.reportForm = function (existing, prefill) {
    const db = AWY.app.db;
    const isNew = !existing;
    C.openForm({
      title: isNew ? 'New report' : 'Edit report details',
      subtitle: 'Report templates are drafts for the therapist to approve.',
      fields: schema.tables.reports.fields,
      values: Object.assign({ dueDate: D.addDays(D.today(), 14), authorId: access.user().role === 'admin' ? '' : access.user().id }, prefill || {}, existing || {}),
      db: db,
      submitLabel: isNew ? 'Create draft report' : 'Save details',
      async onSubmit(values) {
        if (isNew) {
          const rec = await store.create('reports', Object.assign(values, {
            status: 'draft',
            title: C.label('reportType', values.type),
            sections: starterSections(db, values.clientId, values.type).map((s, i) => (i === 0 && values.summary ? Object.assign(s, { body: values.summary }) : s))
          }));
          AWY.ui.toast('Draft report created.');
          AWY.router.go(['reports', rec.id]);
        } else {
          await store.update('reports', existing.id, Object.assign(values, { title: existing.title || C.label('reportType', values.type) }));
          AWY.ui.toast('Report details saved.');
        }
      }
    });
  };

  AWY.views.reports = {
    title: 'Clinical reports',
    render(ctx) {
      const { db, state, today } = ctx;
      if (state.status === undefined) state.status = 'outstanding';
      if (state.sort === undefined) state.sort = 'due';
      const counts = {};
      db.reports.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
      const seg = [
        { value: 'outstanding', label: 'Outstanding', count: rules.reportsOutstanding(db).length },
        { value: 'overdue', label: 'Past due', count: db.reports.filter((r) => rules.reportOverdue(r, today)).length }
      ].concat(Object.keys(schema.statuses.report).map((k) => ({ value: k, label: schema.status('report', k).label, count: counts[k] || 0 })))
        .concat([{ value: 'all', label: 'All', count: db.reports.length }]);
      const rows = db.reports.filter((r) =>
        (state.status === 'all' || (state.status === 'outstanding' ? r.status !== 'delivered' : state.status === 'overdue' ? rules.reportOverdue(r, today) : r.status === state.status)) &&
        (!state.type || r.type === state.type) &&
        C.matches(r, state.q, ['title', (x) => rules.clientNameById(db, x.clientId), 'recipient'])
      );
      const columns = [
        { key: 'title', label: 'Report', sortValue: (r) => r.title, render: (r) => html`${r.title}<span class="sub">Ref ${r.ref}${r.recipient ? ', for ' + r.recipient : ''}</span>` },
        { key: 'client', label: 'Client', sortValue: (r) => rules.clientNameById(db, r.clientId), render: (r) => C.clientLink(db, r.clientId, 'reports') },
        { key: 'author', label: 'Author', sortValue: (r) => rules.staffName(db, r.authorId), render: (r) => rules.staffName(db, r.authorId) },
        { key: 'due', label: 'Due', sortValue: (r) => r.dueDate, render: (r) => html`${C.due(r.dueDate, today, r.status === 'completed' || r.status === 'delivered')}<span class="sub">${r.status === 'delivered' ? 'Delivered ' + fmt.date(r.deliveredDate) : fmt.relative(r.dueDate)}</span>` },
        { key: 'status', label: 'Status', sortValue: (r) => Object.keys(schema.statuses.report).indexOf(r.status), render: (r) => C.badge('report', r.status) }
      ];
      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Clinical reports',
          subtitle: 'Functional capacity, progress and recommendation reports, from draft to delivery.',
          actions: access.can('assess') ? html`<button type="button" class="btn" data-new-report>${icon('plus')}New report</button>` : ''
        })}
        ${C.seg('status', seg, state.status)}
        <div class="toolbar">
          ${C.search(state.q, 'Search reports or clients')}
          ${C.select('type', 'Type', C.options('reportType'), state.type)}
        </div>
        ${C.table({ columns, rows, sort: state.sort, caption: 'Reports', rowHref: (r) => '#/reports/' + r.id, empty: C.empty({ icon: 'report', title: 'No reports here' }) })}
      `);
      C.bindFilters(ctx);
      C.bindRows(ctx.el);
      AWY.on(ctx.el, 'click', '[data-new-report]', () => A.reportForm(null, {}));
    }
  };

  AWY.views.report = {
    title: (ctx) => {
      const r = ctx.db.reports.find((x) => x.id === ctx.params.id);
      return r ? r.title : 'Report';
    },
    render(ctx) {
      const { db, today, state, user } = ctx;
      const r = db.reports.find((x) => x.id === ctx.params.id);
      if (!r) {
        ctx.el.innerHTML = String(html`${C.pageHead({ title: 'Report not found', back: { href: '#/reports', label: 'Clinical reports' } })}`);
        return;
      }
      const c = rules.client(db, r.clientId);
      const clinical = access.can('clinical');
      const canWrite = access.can('assess');
      const editable = canWrite && (r.status === 'draft' || r.status === 'review');
      const editing = editable && state.editing;
      const overdue = rules.reportOverdue(r, today);

      const workflow = [];
      if (canWrite && r.status === 'draft') workflow.push(html`<button type="button" class="btn" data-step="review">${icon('eye')}Send for review</button>`);
      if (r.status === 'review' && access.can('reviewReports')) workflow.push(html`<button type="button" class="btn" data-step="completed">${icon('checkCircle')}Mark reviewed and completed</button>`);
      if (r.status === 'review' && canWrite) workflow.push(html`<button type="button" class="btn btn-secondary" data-step="draft">Back to draft</button>`);
      if (r.status === 'completed' && (canWrite || access.can('billing'))) workflow.push(html`<button type="button" class="btn" data-step="deliver">${icon('send')}Record delivery</button>`);

      const statusNote = {
        draft: 'Draft. Not yet reviewed.',
        review: access.can('reviewReports') ? 'Waiting for your review.' : 'Waiting for review by the practice owner.',
        completed: 'Reviewed by ' + rules.staffName(db, r.reviewedBy) + '. Not yet delivered.',
        delivered: 'Delivered to ' + (r.deliveredTo || r.recipient) + ' on ' + fmt.date(r.deliveredDate) + ' by ' + C.label('deliveryMethod', r.deliveryMethod).toLowerCase() + '. Recorded in the demo only.'
      }[r.status];

      const meta = html`<dl class="doc-meta">
        <div><dt>Client</dt><dd>${c ? rules.clientFullName(c) : 'Deleted client'}</dd></div>
        <div><dt>Date of birth</dt><dd>${c && c.dob ? fmt.dateFull(c.dob) : 'Not recorded'}</dd></div>
        ${c && c.ndisNumber ? html`<div><dt>NDIS number</dt><dd>${c.ndisNumber}</dd></div>` : ''}
        <div><dt>Prepared by</dt><dd>${rules.staffName(db, r.authorId)}, ${(db.staff.find((s) => s.id === r.authorId) || {}).title || ''}</dd></div>
        <div><dt>Prepared for</dt><dd>${r.recipient || 'Not set'}</dd></div>
        <div><dt>${r.status === 'delivered' ? 'Delivered' : 'Due'}</dt><dd>${fmt.dateFull(r.status === 'delivered' ? r.deliveredDate : r.dueDate)}</dd></div>
      </dl>`;

      const sections = (r.sections || []).map((s, i) => editing
        ? html`<section class="doc-section field"><label for="sec${i}"><strong>${s.heading}</strong></label><textarea class="textarea" id="sec${i}" data-section="${i}" rows="5">${s.body}</textarea></section>`
        : html`<section class="doc-section"><h2>${s.heading}</h2><p>${s.body || html`<span class="muted">Not written yet.</span>`}</p></section>`);

      ctx.el.innerHTML = String(html`
        <div class="doc-actions">
          <a class="back-link" style="margin:0" href="#/reports">${icon('arrowLeft')}Clinical reports</a>
          <div class="btn-row">
            ${editable && !editing && clinical ? html`<button type="button" class="btn btn-secondary" data-edit-content>${icon('edit')}Edit content</button>` : ''}
            ${editing ? html`<button type="button" class="btn btn-secondary" data-cancel-edit>Cancel</button><button type="button" class="btn" data-save-content>Save content</button>` : ''}
            ${canWrite || access.can('billing') ? html`<button type="button" class="btn btn-secondary" data-edit-details>Details</button>` : ''}
            ${clinical && !editing ? html`<button type="button" class="btn btn-secondary" data-print>${icon('printer')}Export as PDF</button>` : ''}
            ${!editing ? workflow : ''}
          </div>
        </div>
        <div class="doc-actions no-print" style="justify-content:flex-start">
          ${C.badge('report', r.status)}<span class="muted small">${statusNote}</span>
          ${overdue ? html`<span class="badge tone-danger">${icon('alert')}Past due</span>` : ''}
        </div>
        <div class="doc-wrap">
          <article class="doc">
            ${C.letterhead(ctx.settings)}
            <span class="doc-demo">Demo document. Fictional client.${r.status === 'draft' || r.status === 'review' ? ' Draft, not reviewed.' : ''}</span>
            <h1>${r.title}</h1>
            ${meta}
            ${clinical ? sections : html`<div class="notice">${icon('lock')}<div>Report content is only visible to clinical staff. In the live system this would be enforced by the server.</div></div>`}
            <div class="doc-sign">
              <div>${rules.staffName(db, r.authorId)}<br>${(db.staff.find((s) => s.id === r.authorId) || {}).title || ''}<br>AHPRA ${(db.staff.find((s) => s.id === r.authorId) || {}).registration || 'to be confirmed'}</div>
              <div>Date</div>
            </div>
            <p class="doc-foot">This report was prepared for the purpose stated above and should be read in full. Fictional record from the Allied With You demo.</p>
          </article>
        </div>
      `);

      const el = ctx.el;
      AWY.on(el, 'click', '[data-print]', () => C.print());
      AWY.on(el, 'click', '[data-edit-details]', () => A.reportForm(r));
      AWY.on(el, 'click', '[data-edit-content]', () => {
        state.editing = true;
        ctx.refresh();
      });
      AWY.on(el, 'click', '[data-cancel-edit]', () => {
        state.editing = false;
        ctx.refresh();
      });
      AWY.on(el, 'click', '[data-save-content]', async (event, btn) => {
        const sectionsNext = (r.sections || []).map((s, i) => Object.assign({}, s, { body: el.querySelector('[data-section="' + i + '"]').value.trim() }));
        await AWY.ui.busy(btn, () => C.save(store.update('reports', r.id, { sections: sectionsNext }), 'Report content saved.'));
        state.editing = false;
      });
      AWY.on(el, 'click', '[data-step]', async (event, btn) => {
        const step = btn.dataset.step;
        if (step === 'review') {
          const empty = (r.sections || []).filter((s) => !s.body).length;
          const ok = await AWY.ui.confirm({ title: 'Send for review?', message: 'The report will be marked as ready for the practice owner to review.', detail: empty ? fmt.plural(empty, 'section is', 'sections are') + ' still empty.' : '', confirmLabel: 'Send for review' });
          if (ok) C.save(store.update('reports', r.id, { status: 'review' }), 'Report marked as ready for review.');
        }
        if (step === 'draft') C.save(store.update('reports', r.id, { status: 'draft' }), 'Report moved back to draft.');
        if (step === 'completed') {
          const ok = await AWY.ui.confirm({ title: 'Mark as reviewed and completed?', message: 'This records that you have reviewed the report and it is ready to deliver. It does not send it anywhere.', confirmLabel: 'Mark reviewed' });
          if (ok) C.save(store.update('reports', r.id, { status: 'completed', reviewedBy: user.id, completedAt: D.now() }), 'Report marked as reviewed and completed.');
        }
        if (step === 'deliver') {
          C.openForm({
            title: 'Record delivery',
            subtitle: 'Records how and when the report was given to the recipient. The demo does not send anything.',
            fields: [
              { name: 'deliveredTo', label: 'Delivered to', type: 'text', required: true, span: 'all' },
              { name: 'deliveryMethod', label: 'How it was delivered', type: 'select', options: C.options('deliveryMethod'), required: true },
              { name: 'deliveredDate', label: 'Date', type: 'date', required: true }
            ],
            values: { deliveredTo: r.recipient, deliveredDate: today, deliveryMethod: 'email' },
            db: db,
            submitLabel: 'Record delivery',
            async onSubmit(v) {
              await store.update('reports', r.id, Object.assign(v, { status: 'delivered' }));
              await store.create('documents', { clientId: r.clientId, name: r.title + '.pdf', type: 'report', date: v.deliveredDate, status: 'current', size: 262144, source: 'generated', uploadedBy: user.id, linkedId: r.id, notes: 'Final version recorded as delivered to ' + v.deliveredTo + '.' }, { audit: false });
              AWY.ui.toast('Recorded as delivered. Nothing was sent from the demo.');
            }
          });
        }
      });
    }
  };
})();
