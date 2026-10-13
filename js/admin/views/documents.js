/*
  Documents and consent.
  The demo stores document details only, never file contents, so no real files
  are kept in the browser. In the live system, documents will sit in private
  storage with controlled downloads.
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

  function linkFor(doc, db) {
    if (!doc.linkedId) return '';
    if (db.agreements.some((a) => a.id === doc.linkedId)) return '#/agreements/' + doc.linkedId;
    if (db.reports.some((r) => r.id === doc.linkedId)) return '#/reports/' + doc.linkedId;
    if (db.consents.some((x) => x.id === doc.linkedId)) return '#/clients/' + doc.clientId + '/records';
    return '';
  }

  function docRows(db, docs, showClient) {
    if (!docs.length) return html`<div class="panel-body">${C.empty({ icon: 'folder', title: 'No documents yet' })}</div>`;
    return html`<ul class="rows">${docs.map((d) => html`<li>
      <span class="icon-wrap" aria-hidden="true" style="display:grid;place-items:center;width:2rem;height:2rem;border-radius:8px;background:var(--color-blue-pale);color:var(--color-blue)">${icon(d.type === 'report' ? 'report' : d.type === 'consent' ? 'shield' : d.type === 'agreement' ? 'signature' : 'note')}</span>
      <div class="what">
        <button type="button" style="all:unset;cursor:pointer;font-weight:680;word-break:break-word" data-doc="${d.id}">${d.name}</button>
        <div class="meta">
          ${showClient ? html`<span>${C.clientLink(db, d.clientId, 'records')}</span>` : ''}
          <span>${C.label('documentType', d.type)}</span><span>${fmt.date(d.date)}</span><span>${fmt.fileSize(d.size)}</span>
          <span>${d.source === 'generated' ? 'Created in the app' : 'Added by ' + rules.staffName(db, d.uploadedBy)}</span>
        </div>
      </div>
      <div class="end">${C.badge('document', d.status)}<button type="button" class="btn btn-quiet btn-sm" data-doc="${d.id}">View</button></div>
    </li>`)}</ul>`;
  }

  A.openDocument = function (id) {
    const db = AWY.app.db;
    const d = db.documents.find((x) => x.id === id);
    if (!d) return;
    const link = linkFor(d, db);
    const modal = AWY.ui.modal({
      title: d.name,
      subtitle: rules.clientNameById(db, d.clientId),
      body: html`
        <div class="notice" style="margin-bottom:1rem">${icon('lock')}<div>File previews aren't part of the demo. Only the document details are stored, so no real files are kept in this browser. In the live system, documents will be held in private storage and every download will be logged.</div></div>
        ${C.kv([
          ['Type', C.label('documentType', d.type)],
          ['Status', C.badge('document', d.status)],
          ['Date', fmt.dateFull(d.date)],
          ['Size', fmt.fileSize(d.size)],
          ['Source', d.source === 'generated' ? 'Created in the app' : 'Added by ' + rules.staffName(db, d.uploadedBy)],
          ['Linked record', link ? html`<a href="${link}" data-close>Open the linked record</a>` : ''],
          ['Notes', d.notes]
        ])}`,
      footer: html`
        ${access.can('deleteRecords') ? html`<button type="button" class="btn btn-danger spacer" data-act="delete">${icon('trash')}Delete</button>` : ''}
        <button type="button" class="btn btn-secondary" data-close>Close</button>
        <button type="button" class="btn" data-act="edit">${icon('edit')}Edit details</button>`
    });
    AWY.on(modal.el, 'click', '[data-act]', (event, btn) => {
      modal.close();
      if (btn.dataset.act === 'edit') A.documentForm(d);
      if (btn.dataset.act === 'delete') C.confirmDelete({ table: 'documents', id: d.id, label: 'this document' });
    });
  };

  A.documentForm = function (existing, prefill) {
    const db = AWY.app.db;
    const isNew = !existing;
    const fields = schema.tables.documents.fields.filter((f) => !(f.name === 'clientId' && prefill && prefill.clientId));
    C.openForm({
      title: isNew ? 'Add a document' : 'Edit document details',
      subtitle: isNew ? 'Choose a file to fill in its name and size. The file itself is not stored in the demo, so please don\'t use real documents.' : '',
      fields: fields,
      values: Object.assign({ date: D.today(), status: 'current', type: 'correspondence' }, prefill || {}, existing || {}),
      db: db,
      intro: isNew ? html`<div class="field"><label for="docFile">File <span class="optional">(optional)</span></label><input class="input" type="file" id="docFile" aria-describedby="docFileHint"><p class="hint" id="docFileHint">Only the file name and size are read. Nothing is uploaded.</p></div>` : '',
      submitLabel: isNew ? 'Save document details' : 'Save',
      onOpen(modal) {
        const file = modal.form.querySelector('#docFile');
        if (!file) return;
        file.addEventListener('change', () => {
          const f = file.files[0];
          if (!f) return;
          modal.form.elements.name.value = f.name;
          modal.form.dataset.size = f.size;
        });
      },
      async onSubmit(values, modal) {
        if (isNew) {
          await store.create('documents', Object.assign({ clientId: prefill && prefill.clientId }, values, { size: Number(modal.form.dataset.size) || 102400, source: 'uploaded', uploadedBy: access.user().id, linkedId: null }));
          AWY.ui.toast('Document details saved. The file itself was not stored.');
        } else {
          await store.update('documents', existing.id, values);
          AWY.ui.toast('Document details updated.');
        }
      }
    });
  };

  A.consentForm = function (existing, prefill) {
    const db = AWY.app.db;
    const isNew = !existing;
    const clientId = (existing || prefill || {}).clientId;
    const client = rules.client(db, clientId);
    const fields = (clientId ? [] : [{ name: 'clientId', label: 'Client', type: 'client', required: true }]).concat(schema.tables.consents.fields);
    C.openForm({
      title: isNew ? 'Record consent' : 'Edit consent record',
      subtitle: client ? rules.clientName(client) + '. Record exactly what was agreed, by whom and any limits.' : 'Record exactly what was agreed, by whom and any limits.',
      fields: fields,
      values: Object.assign({ date: D.today(), status: 'current', method: 'written', givenBy: client ? rules.clientFullName(client) : '' }, prefill || {}, existing || {}),
      db: db,
      size: 'wide',
      validate(v) {
        if (v.status === 'withdrawn' && !v.withdrawnNote) return { withdrawnNote: 'Record when and how consent was withdrawn' };
        return {};
      },
      async onSubmit(values) {
        if (values.status === 'withdrawn' && (!existing || existing.status !== 'withdrawn')) values.withdrawnDate = D.today();
        if (isNew) {
          await store.create('consents', Object.assign({ clientId: clientId, recordedBy: access.user().id }, values));
          AWY.ui.toast('Consent recorded.');
        } else {
          await store.update('consents', existing.id, values);
          AWY.ui.toast(values.status === 'withdrawn' && existing.status !== 'withdrawn' ? 'Consent marked as withdrawn.' : 'Consent record updated.');
        }
      }
    });
  };

  function bindDocs(el) {
    AWY.on(el, 'click', '[data-doc]', (event, btn) => A.openDocument(btn.dataset.doc));
  }

  AWY.views.documents = {
    title: 'Documents and consent',
    docRows: docRows,
    bindDocs: bindDocs,
    render(ctx) {
      const { db, state, today } = ctx;
      if (!state.tab) state.tab = ctx.query.tab || 'documents';

      let body;
      if (state.tab === 'documents') {
        const docs = db.documents.filter((d) =>
          (!state.type || d.type === state.type) &&
          (!state.docStatus || d.status === state.docStatus) &&
          C.matches(d, state.q, ['name', (x) => rules.clientNameById(db, x.clientId)])
        ).sort((a, b) => b.date.localeCompare(a.date));
        body = html`<div class="toolbar">
            ${C.search(state.q, 'Search by document or client')}
            ${C.select('type', 'Type', C.options('documentType'), state.type)}
            ${C.select('docStatus', 'Status', AWY.schema.statusOptions('document'), state.docStatus)}
          </div>
          <p class="result-count">${fmt.plural(docs.length, 'document')}</p>
          <section class="panel">${docRows(db, docs.slice(0, 80), true)}</section>
          ${docs.length > 80 ? html`<p class="small muted" style="margin-top:0.5rem">Showing the 80 most recent. Search to narrow the list.</p>` : ''}`;
      } else {
        const consents = db.consents.filter((x) =>
          (!state.consentType || x.type === state.consentType) &&
          (!state.consentStatus || rules.consentStatus(x, today) === state.consentStatus) &&
          C.matches(x, state.q2, [(r) => rules.clientNameById(db, r.clientId), 'givenBy', 'limitations'])
        );
        const columns = [
          { key: 'client', label: 'Client', sortValue: (x) => rules.clientNameById(db, x.clientId), render: (x) => C.clientLink(db, x.clientId, 'records') },
          { key: 'type', label: 'Consent for', sortValue: (x) => C.label('consentType', x.type), render: (x) => html`${C.label('consentType', x.type)}${x.limitations ? html`<span class="sub">Limits: ${x.limitations}</span>` : ''}` },
          { key: 'given', label: 'Given by', render: (x) => html`${x.givenBy}<span class="sub">${C.label('consentMethod', x.method)}</span>` },
          { key: 'date', label: 'Recorded', sortValue: (x) => x.date, render: (x) => fmt.date(x.date) },
          { key: 'status', label: 'Status', sortValue: (x) => rules.consentStatus(x, today), render: (x) => html`${C.badge('consent', rules.consentStatus(x, today))}${x.status === 'withdrawn' && x.withdrawnDate ? html`<span class="sub">${fmt.date(x.withdrawnDate)}</span>` : ''}` },
          { key: 'edit', label: '', render: (x) => html`<button type="button" class="btn btn-quiet btn-sm" data-consent="${x.id}">Edit</button>` }
        ];
        const gaps = rules.consentGaps(db, today);
        body = html`
          ${gaps.length ? html`<div class="notice notice-danger" style="margin-bottom:1rem">${icon('alertCircle')}<div><strong>Active clients without consent for assessment and therapy</strong>${gaps.map((c) => html`<a href="#/clients/${c.id}/records" style="display:block">${rules.clientName(c)}</a>`)}</div></div>` : ''}
          <div class="toolbar">
            ${C.search(state.q2, 'Search by client or limits', 'q2')}
            ${C.select('consentType', 'Consent for', C.options('consentType'), state.consentType)}
            ${C.select('consentStatus', 'Status', AWY.schema.statusOptions('consent'), state.consentStatus)}
          </div>
          ${C.table({ columns, rows: consents, sort: state.sort || 'client', caption: 'Consent records', empty: C.empty({ icon: 'shield', title: 'No consent records match' }) })}`;
      }

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Documents and consent',
          subtitle: 'Consent forms, agreements, reports and correspondence for every client.',
          actions: state.tab === 'documents'
            ? html`<button type="button" class="btn" data-new-document>${icon('upload')}Add document</button>`
            : html`<button type="button" class="btn" data-new-consent>${icon('plus')}Record consent</button>`
        })}
        ${C.seg('tab', [{ value: 'documents', label: 'Documents', count: db.documents.length }, { value: 'consents', label: 'Consent records', count: db.consents.length }], state.tab)}
        ${body}
      `);
      C.bindFilters(ctx);
      bindDocs(ctx.el);
      AWY.on(ctx.el, 'click', '[data-new-document]', () => A.documentForm(null, {}));
      AWY.on(ctx.el, 'click', '[data-new-consent]', () => A.consentForm(null, {}));
      AWY.on(ctx.el, 'click', '[data-consent]', (event, btn) => A.consentForm(db.consents.find((x) => x.id === btn.dataset.consent)));
    }
  };
})();
