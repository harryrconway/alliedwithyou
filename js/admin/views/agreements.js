/*
  Service agreements.
  Signatures are recorded by hand in the demo. Any electronic signing must be
  properly built and validated before the live system uses it.
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
  const A = AWY.actions;
  const icon = (n) => raw(AWY.icon(n));

  const RATE_KEYS = {
    ndis: ['ndis_ot', 'ndis_travel', 'ndis_report', 'ndis_cancel'],
    sah: ['sah_ot'],
    private: ['private_initial', 'private_therapy', 'private_short', 'private_report', 'private_travel']
  };

  /* Copies the rates in effect on the start date into the agreement */
  function ratesFor(db, template, startDate) {
    return (RATE_KEYS[template] || []).map((key) => {
      const item = rules.rateFor(db, key, startDate) || rules.itemVersions(db, key)[0];
      return item ? { key: key, itemId: item.id, name: item.name, rate: item.rate, unit: item.unit, code: item.code } : null;
    }).filter(Boolean);
  }

  A.agreementForm = function (prefill, existing) {
    const db = AWY.app.db;
    const isNew = !existing;
    const settings = db.settings[0] || {};
    const templates = settings.agreementTemplates || {};
    const clientId = (existing || prefill || {}).clientId;
    const client = rules.client(db, clientId);
    const defaultTemplate = client ? (rules.isNdis(client.fundingType) ? 'ndis' : client.fundingType === 'sah' ? 'sah' : 'private') : 'private';
    const fields = (clientId ? [] : [{ name: 'clientId', label: 'Client', type: 'client', required: true }]).concat(
      schema.tables.agreements.fields.map((f) => (f.name === 'status' ? Object.assign({}, f, { options: f.options.filter((o) => o.value === 'draft' || o.value === 'awaiting') }) : f))
    );
    const tpl = (existing && existing.template) || (prefill && prefill.template) || defaultTemplate;
    C.openForm({
      title: isNew ? 'New service agreement' : 'Edit agreement ' + existing.ref,
      subtitle: (client ? rules.clientName(client) + '. ' : '') + 'Rates are copied from the fee schedule in effect on the start date.',
      fields: fields,
      values: Object.assign({
        template: tpl,
        startDate: D.today(),
        endDate: D.addDays(D.addMonths(D.today(), 12), -1),
        status: 'draft',
        services: [],
        conditions: (templates[tpl] || {}).conditions,
        cancellationTerms: (templates[tpl] || {}).cancellation
      }, prefill || {}, existing || {}),
      db: db,
      size: 'wide',
      validate(v) {
        return v.endDate <= v.startDate ? { endDate: 'The end date should be after the start date' } : {};
      },
      onOpen(modal) {
        const f = modal.form;
        f.elements.template.addEventListener('change', () => {
          const t = templates[f.elements.template.value] || {};
          f.elements.conditions.value = t.conditions || '';
          f.elements.cancellationTerms.value = t.cancellation || '';
        });
      },
      async onSubmit(values) {
        const data = Object.assign({}, values, { rates: ratesFor(AWY.app.db, values.template, values.startDate) });
        if (values.status === 'awaiting') data.sentDate = D.today();
        if (isNew) {
          const rec = await store.create('agreements', Object.assign({ clientId: clientId, signedDate: '', signedBy: '', createdBy: access.user().id }, data));
          AWY.ui.toast(values.status === 'awaiting' ? 'Agreement created and marked as awaiting signature. Nothing was sent.' : 'Draft agreement created.');
          AWY.router.go(['agreements', rec.id]);
        } else {
          await store.update('agreements', existing.id, data);
          AWY.ui.toast('Agreement updated.');
        }
      }
    });
  };

  AWY.views.agreements = {
    title: 'Service agreements',
    render(ctx) {
      const { db, state, today } = ctx;
      if (state.status === undefined) state.status = ctx.query.status || 'all';
      if (state.sort === undefined) state.sort = '-start';
      const withStatus = db.agreements.map((a) => Object.assign({}, a, { _status: rules.agreementStatus(a, today) }));
      const counts = {};
      withStatus.forEach((a) => (counts[a._status] = (counts[a._status] || 0) + 1));
      const seg = [{ value: 'unsigned', label: 'Unsigned', count: (counts.draft || 0) + (counts.awaiting || 0) }]
        .concat(Object.keys(schema.statuses.agreement).map((k) => ({ value: k, label: schema.status('agreement', k).label, count: counts[k] || 0 })))
        .concat([{ value: 'all', label: 'All', count: withStatus.length }]);
      const rows = withStatus.filter((a) =>
        (state.status === 'all' || (state.status === 'unsigned' ? a._status === 'draft' || a._status === 'awaiting' : a._status === state.status)) &&
        C.matches(a, state.q, [(x) => rules.clientNameById(db, x.clientId), 'ref'])
      );
      const columns = [
        { key: 'ref', label: 'Agreement', sortValue: (a) => a.ref, render: (a) => html`Agreement ${a.ref}<span class="sub">${C.label('agreementTemplate', a.template)}</span>` },
        { key: 'client', label: 'Client', sortValue: (a) => rules.clientNameById(db, a.clientId), render: (a) => C.clientLink(db, a.clientId, 'records') },
        { key: 'start', label: 'Period', sortValue: (a) => a.startDate, render: (a) => html`${fmt.date(a.startDate)}<span class="sub">to ${fmt.date(a.endDate)}</span>` },
        { key: 'signed', label: 'Signature', render: (a) => (a.signedDate ? html`Signed ${fmt.date(a.signedDate)}<span class="sub">${a.signedBy}</span>` : a.status === 'awaiting' ? html`<span style="${rules.agreementStale(a, today) ? 'color:var(--color-warning);font-weight:680' : ''}">Waiting since ${fmt.date(a.sentDate)}</span>` : html`<span class="muted">Not sent</span>`) },
        { key: 'status', label: 'Status', sortValue: (a) => a._status, render: (a) => C.badge('agreement', a._status) }
      ];
      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Service agreements',
          subtitle: 'What each client has agreed to, at what rates, and whether it is signed.',
          actions: access.can('agreements') ? html`<button type="button" class="btn" data-new-agreement>${icon('plus')}New agreement</button>` : ''
        })}
        ${C.seg('status', seg, state.status)}
        <div class="toolbar">${C.search(state.q, 'Search by client or number')}</div>
        ${C.table({ columns, rows, sort: state.sort, caption: 'Service agreements', rowHref: (a) => '#/agreements/' + a.id, empty: C.empty({ icon: 'signature', title: 'No agreements here' }) })}
      `);
      C.bindFilters(ctx);
      C.bindRows(ctx.el);
      AWY.on(ctx.el, 'click', '[data-new-agreement]', () => A.agreementForm({}));
    }
  };

  AWY.views.agreement = {
    title: (ctx) => {
      const a = ctx.db.agreements.find((x) => x.id === ctx.params.id);
      return a ? 'Agreement ' + a.ref : 'Agreement';
    },
    render(ctx) {
      const { db, today } = ctx;
      const a = db.agreements.find((x) => x.id === ctx.params.id);
      if (!a) {
        ctx.el.innerHTML = String(html`${C.pageHead({ title: 'Agreement not found', back: { href: '#/agreements', label: 'Service agreements' } })}`);
        return;
      }
      const c = rules.client(db, a.clientId);
      const status = rules.agreementStatus(a, today);
      const manage = access.can('agreements');
      const rep = db.contacts.find((x) => x.clientId === a.clientId && x.kind === 'representative');
      const planManager = db.contacts.find((x) => x.clientId === a.clientId && x.kind === 'planmanager');

      const actions = [];
      if (manage && status === 'draft') {
        actions.push(html`<button type="button" class="btn btn-secondary" data-edit>${icon('edit')}Edit</button>`);
        actions.push(html`<button type="button" class="btn" data-send>${icon('send')}Mark as awaiting signature</button>`);
      }
      if (manage && status === 'awaiting') {
        actions.push(html`<button type="button" class="btn btn-secondary" data-back>Back to draft</button>`);
        actions.push(html`<button type="button" class="btn" data-sign>${icon('signature')}Record signature</button>`);
      }
      if (manage && (status === 'signed' || status === 'awaiting')) actions.push(html`<button type="button" class="btn btn-danger" data-cancel>Cancel agreement</button>`);
      if (manage && (status === 'expired' || status === 'cancelled')) actions.push(html`<button type="button" class="btn" data-renew>${icon('refresh')}Create a renewal</button>`);

      ctx.el.innerHTML = String(html`
        <div class="doc-actions">
          <a class="back-link" style="margin:0" href="#/agreements">${icon('arrowLeft')}Service agreements</a>
          <div class="btn-row">
            <button type="button" class="btn btn-secondary" data-print>${icon('printer')}Export as PDF</button>
            ${actions}
          </div>
        </div>
        <div class="doc-actions no-print" style="justify-content:flex-start">
          ${C.badge('agreement', status)}
          <span class="muted small">${status === 'awaiting' ? 'Marked as waiting for a signature on ' + fmt.date(a.sentDate) + '. Nothing was sent from the demo.' : status === 'signed' ? 'Signed by ' + a.signedBy + ' on ' + fmt.date(a.signedDate) + '. ' + a.signatureMethod + '.' : status === 'expired' ? 'Ended on ' + fmt.date(a.endDate) + '.' : status === 'cancelled' ? 'Cancelled. ' + (a.cancelReason || '') : 'Draft. Not yet given to the client.'}</span>
        </div>
        <div class="doc-wrap">
          <article class="doc">
            ${C.letterhead(ctx.settings)}
            <span class="doc-demo">Demo document. Fictional client. Sample rates.</span>
            <h1>Service agreement ${a.ref}</h1>
            <dl class="doc-meta">
              <div><dt>Client</dt><dd>${c ? rules.clientFullName(c) : 'Deleted client'}</dd></div>
              ${rep ? html`<div><dt>Representative</dt><dd>${rep.name}</dd></div>` : ''}
              ${c && c.ndisNumber ? html`<div><dt>NDIS number</dt><dd>${c.ndisNumber}</dd></div>` : ''}
              <div><dt>Agreement type</dt><dd>${C.label('agreementTemplate', a.template)}</dd></div>
              <div><dt>Period</dt><dd>${fmt.dateFull(a.startDate)} to ${fmt.dateFull(a.endDate)}</dd></div>
              ${planManager && a.template === 'ndis' ? html`<div><dt>Invoices sent to</dt><dd>${planManager.organisation}</dd></div>` : ''}
            </dl>
            <section class="doc-section"><h2>Services covered</h2><ul>${(a.services || []).map((s) => html`<li>${C.label('service', s)}</li>`)}</ul></section>
            <section class="doc-section"><h2>Rates</h2>
              <div class="doc-scroll"><table class="doc-table">
                <thead><tr><th>Support</th><th>Reference</th><th>Unit</th><th class="num">Rate</th></tr></thead>
                <tbody>${(a.rates || []).map((r) => html`<tr><td>${r.name}</td><td>${r.code || ''}</td><td>${C.label('unit', r.unit)}</td><td class="num">${fmt.money(r.rate)}</td></tr>`)}</tbody>
              </table></div>
              <p class="small muted" style="margin-top:0.5rem">Sample rates for testing. ${a.template === 'ndis' ? 'NDIS rates must be checked against the current NDIS Pricing Arrangements and Price Limits.' : 'Final rates to be confirmed by the business.'}</p>
            </section>
            <section class="doc-section"><h2>Conditions</h2><p>${a.conditions}</p></section>
            <section class="doc-section"><h2>Cancellations</h2><p>${a.cancellationTerms}</p></section>
            <section class="doc-section"><h2>Privacy and consent</h2><p>Information is collected, stored and shared as described in the Allied With You privacy policy and the client's consent records.</p></section>
            <div class="doc-sign">
              <div>${a.signedBy || 'Client or representative'}${a.signedDate ? html`<br>Signed ${fmt.dateFull(a.signedDate)}` : ''}</div>
              <div>For Allied With You${a.signedDate ? html`<br>${fmt.dateFull(a.signedDate)}` : ''}</div>
            </div>
            <p class="doc-foot">Fictional record from the Allied With You demo. Electronic signing is not part of the demo and would need to be built and checked properly before use.</p>
          </article>
        </div>
      `);

      const el = ctx.el;
      AWY.on(el, 'click', '[data-print]', () => C.print());
      AWY.on(el, 'click', '[data-edit]', () => A.agreementForm({}, a));
      AWY.on(el, 'click', '[data-send]', () => C.save(store.update('agreements', a.id, { status: 'awaiting', sentDate: D.today() }), 'Marked as awaiting signature. Nothing was sent to the client.'));
      AWY.on(el, 'click', '[data-back]', () => C.save(store.update('agreements', a.id, { status: 'draft' }), 'Agreement moved back to draft.'));
      AWY.on(el, 'click', '[data-renew]', () => A.agreementForm({ clientId: a.clientId, template: a.template, services: a.services, startDate: D.addDays(a.endDate, 1) > ctx.today ? D.addDays(a.endDate, 1) : ctx.today }));
      AWY.on(el, 'click', '[data-sign]', () => {
        C.openForm({
          title: 'Record signature',
          subtitle: 'Record a signature collected on paper or in person. Electronic signing is not part of the demo.',
          fields: [
            { name: 'signedBy', label: 'Signed by', type: 'text', required: true, span: 'all' },
            { name: 'signedDate', label: 'Date signed', type: 'date', required: true },
            { name: 'signatureMethod', label: 'How it was signed', type: 'select', required: true, options: [{ value: 'Signed paper copy', label: 'Signed paper copy' }, { value: 'Signed in person with the therapist', label: 'Signed in person with the therapist' }, { value: 'Signed copy returned by post', label: 'Signed copy returned by post' }] }
          ],
          values: { signedBy: rep ? rep.name + ' on behalf of ' + rules.clientFullName(c) : c ? rules.clientFullName(c) : '', signedDate: today, signatureMethod: 'Signed paper copy' },
          db: db,
          submitLabel: 'Record signature',
          async onSubmit(v) {
            await store.update('agreements', a.id, Object.assign(v, { status: 'signed' }));
            await store.create('documents', { clientId: a.clientId, name: 'Service agreement ' + a.ref + ', signed.pdf', type: 'agreement', date: v.signedDate, status: 'current', size: 176128, source: 'uploaded', uploadedBy: access.user().id, linkedId: a.id, notes: '' }, { audit: false });
            const followUps = store.peek().tasks.filter((t) => t.relatedId === a.id && t.status === 'open');
            for (const t of followUps) await store.update('tasks', t.id, { status: 'done', completedAt: D.now(), completedBy: access.user().id }, { audit: false });
            AWY.ui.toast('Signature recorded.' + (followUps.length ? ' The follow up task was closed.' : ''));
          }
        });
      });
      AWY.on(el, 'click', '[data-cancel]', () => {
        C.openForm({
          title: 'Cancel agreement ' + a.ref,
          fields: [{ name: 'cancelReason', label: 'Reason', type: 'textarea', required: true, span: 'all', rows: 3 }],
          values: {},
          db: db,
          submitLabel: 'Cancel agreement',
          async onSubmit(v) {
            await store.update('agreements', a.id, { status: 'cancelled', cancelReason: v.cancelReason });
            AWY.ui.toast('Agreement cancelled.');
          }
        });
      });
    }
  };
})();
