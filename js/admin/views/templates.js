/*
  Templates: agreements, forms, letters and policies the team downloads and fills in.
  Administrators add templates, upload new versions and approve them. Everyone else sees
  approved templates only. Every version is kept, so nothing is ever overwritten.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const access = AWY.access;
  const store = AWY.store;
  const schema = AWY.schema;
  const rules = AWY.rules;
  const icon = (n) => raw(AWY.icon(n));

  const fileField = (label, hint) => ({ name: 'file', label: label, type: 'file', required: true, span: 'all', accept: AWY.files.accept, hint: hint });

  function current(db, t) {
    return db.templateVersions.find((v) => v.id === t.currentVersionId) || null;
  }

  function invalidFile(message) {
    return new store.StoreError(message, { category: 'validation', friendly: message, errors: { file: message } });
  }

  function chosenFile(modal) {
    const file = modal.form.elements.file.files[0];
    const problem = AWY.files.check(file);
    if (problem) throw invalidFile(problem);
    return file;
  }

  /* Uploads the file first, then records the version. A file left behind by a failed save is removed. */
  async function addVersion(templateId, file, note) {
    const ext = file.name.split('.').pop().toLowerCase();
    const path = templateId + '/' + AWY.uuid() + '.' + ext;
    await AWY.files.upload('templates', path, file);
    try {
      return await store.create('templateVersions', {
        templateId: templateId, filePath: path, fileName: file.name.slice(0, 200),
        mimeType: AWY.files.types[ext], sizeBytes: file.size, note: note
      });
    } catch (error) {
      await AWY.files.discard('templates', path);
      throw error;
    }
  }

  async function download(t, v, button) {
    const ext = v.fileName.split('.').pop();
    const name = t.title + ', version ' + v.versionNo + '.' + ext;
    const url = await AWY.ui.busy(button, () => C.save(AWY.files.link('templates', v.filePath, name), '', { area: 'templates', operation: 'download' }));
    if (url) window.location.href = url;
  }

  function newTemplate() {
    C.openForm({
      title: 'New template',
      subtitle: 'It starts as a draft, which only administrators can see. Approve it when it\'s ready for the team.',
      area: 'templates',
      fields: schema.tables.templates.fields.concat([fileField('File', 'PDF, Word, Excel or plain text, up to 25 MB.')]),
      values: { funding: 'any' },
      db: AWY.app.db,
      size: 'wide',
      submitLabel: 'Add template',
      async onSubmit(values, modal) {
        const file = chosenFile(modal);
        const t = await store.create('templates', { title: values.title, category: values.category, funding: values.funding, description: values.description, status: 'draft' }, { requestId: modal.requestId });
        await addVersion(t.id, file, 'First version');
        AWY.ui.toast(values.title + ' added as a draft.');
      }
    });
  }

  function newVersion(t) {
    C.openForm({
      title: 'Upload a new version',
      subtitle: t.title + (t.status === 'approved' ? '. The team will get this version straight away, and earlier versions stay in the history.' : '. Earlier versions stay in the history.'),
      area: 'templates',
      fields: [
        fileField('File', 'PDF, Word, Excel or plain text, up to 25 MB.'),
        { name: 'note', label: 'What changed', type: 'text', required: true, span: 'all', maxlength: 500, hint: 'For example, updated the cancellation terms' }
      ],
      values: {},
      db: AWY.app.db,
      submitLabel: 'Upload version',
      async onSubmit(values, modal) {
        const file = chosenFile(modal);
        const v = await addVersion(t.id, file, values.note);
        AWY.ui.toast('Version ' + v.versionNo + ' of ' + t.title + ' uploaded.');
      }
    });
  }

  function editTemplate(t) {
    C.openForm({
      title: 'Edit template details',
      subtitle: t.title,
      area: 'templates',
      fields: schema.tables.templates.fields,
      values: t,
      db: AWY.app.db,
      submitLabel: 'Save details',
      async onSubmit(values) {
        await store.update('templates', t.id, { title: values.title, category: values.category, funding: values.funding, description: values.description });
        AWY.ui.toast('Template details saved.');
      }
    });
  }

  async function setStatus(t, status) {
    const copy = {
      approved: { title: 'Approve ' + t.title + '?', message: 'The whole team will be able to see and download it. Check it has been reviewed first, especially agreements and contracts.', label: 'Approve', done: t.title + ' is approved and available to the team.' },
      retired: { title: 'Retire ' + t.title + '?', message: 'It will be hidden from the team, but kept with every version in case it\'s needed again.', label: 'Retire', done: t.title + ' has been retired.' },
      draft: { title: 'Move ' + t.title + ' back to draft?', message: 'Only administrators will be able to see it until it\'s approved again.', label: 'Move to draft', done: t.title + ' is back to draft.' }
    }[status];
    const ok = await AWY.ui.confirm({ title: copy.title, message: copy.message, confirmLabel: copy.label, danger: status === 'retired' });
    if (ok) await C.save(store.update('templates', t.id, { status: status }), copy.done, { area: 'templates', operation: 'set status ' + status });
  }

  /* The template's details and every version, with the administrator's actions */
  function openTemplate(id) {
    const db = AWY.app.db;
    const t = db.templates.find((x) => x.id === id);
    if (!t) return;
    const manage = access.can('manageTemplates');
    const versions = rules.templateVersions(db, t.id);
    const modal = AWY.ui.modal({
      title: t.title,
      subtitle: C.label('templateCategory', t.category) + ', for ' + { any: 'any client', ndis: 'NDIS', sah: 'Support at Home', private: 'private clients' }[t.funding],
      size: 'wide',
      body: html`
        ${t.description ? html`<p>${t.description}</p>` : ''}
        ${manage ? html`<p style="margin-top:0.75rem">${C.badge('template', t.status)}${t.approvedAt ? html` <span class="small muted">Approved ${fmt.stamp(t.approvedAt)}${t.approvedBy ? ' by ' + rules.staffName(db, t.approvedBy) : ''}</span>` : ''}</p>` : ''}
        <h3 style="margin-top:1.25rem">Versions</h3>
        ${versions.length ? html`<ul class="rows version-list">${versions.map((v) => html`<li>
          <div class="what"><strong>Version ${v.versionNo}${v.id === t.currentVersionId ? html` <span class="tag">Current</span>` : ''}</strong>
            <div class="meta"><span>${fmt.stamp(v.createdAt)}</span><span>${v.uploadedBy ? rules.staffName(db, v.uploadedBy) : 'Added at setup'}</span><span>${fmt.fileSize(v.sizeBytes)}</span></div>
            ${v.note ? html`<div class="meta" style="margin-top:0.2rem"><span>${v.note}</span></div>` : ''}
          </div>
          <div class="end"><button type="button" class="btn btn-quiet btn-sm" data-download-version="${v.id}">${icon('download')}Download</button></div>
        </li>`)}</ul>` : html`<p class="muted small">No file has been uploaded yet.</p>`}`,
      footer: manage
        ? html`<span class="spacer btn-row" style="gap:0.5rem">
            ${t.status === 'draft' ? html`<button type="button" class="btn btn-secondary" data-act="approved" ${raw(t.currentVersionId ? '' : 'disabled')}>${icon('checkCircle')}Approve</button>` : ''}
            ${t.status === 'approved' ? html`<button type="button" class="btn btn-secondary" data-act="retired">${icon('archive')}Retire</button>` : ''}
            ${t.status !== 'draft' ? html`<button type="button" class="btn btn-quiet" data-act="draft">Move to draft</button>` : ''}
          </span>
          <button type="button" class="btn btn-secondary" data-act="edit">${icon('edit')}Edit details</button>
          <button type="button" class="btn" data-act="version">${icon('upload')}New version</button>`
        : html`<button type="button" class="btn btn-secondary" data-close>Close</button>`
    });
    AWY.on(modal.el, 'click', '[data-download-version]', (event, btn) => download(t, versions.find((v) => v.id === btn.dataset.downloadVersion), btn));
    AWY.on(modal.el, 'click', '[data-act]', (event, btn) => {
      const act = btn.dataset.act;
      modal.close();
      if (act === 'version') newVersion(t);
      if (act === 'edit') editTemplate(t);
      if (['approved', 'retired', 'draft'].includes(act)) setStatus(t, act);
    });
  }

  function row(db, t, manage) {
    const v = current(db, t);
    return html`<li>
      <span class="icon-tile" aria-hidden="true">${icon(t.category === 'agreement' || t.category === 'contract' ? 'signature' : t.category === 'letter' ? 'mail' : 'clipboard')}</span>
      <div class="what">
        <button type="button" class="link-button" data-open-template="${t.id}">${t.title}</button>
        <div class="meta">
          <span>${C.label('templateFunding', t.funding)}</span>
          ${v ? html`<span>Version ${v.versionNo}, ${fmt.date(v.createdAt.slice(0, 10))}</span>` : html`<span>No file yet</span>`}
        </div>
        ${t.description ? html`<p class="small muted" style="margin-top:0.25rem">${t.description}</p>` : ''}
      </div>
      <div class="end">
        ${manage ? C.badge('template', t.status) : ''}
        ${v ? html`<button type="button" class="btn btn-secondary btn-sm" data-download="${t.id}" aria-label="Download ${t.title}">${icon('download')}Download</button>` : ''}
        <button type="button" class="btn btn-quiet btn-sm" data-open-template="${t.id}">${manage ? 'Manage' : 'Versions'}</button>
      </div>
    </li>`;
  }

  AWY.views.templates = {
    title: 'Templates',
    render(ctx) {
      const { db, state, query } = ctx;
      const manage = access.can('manageTemplates');
      if (state.show === undefined) state.show = 'inuse';
      const counts = { inuse: 0, draft: 0, retired: 0 };
      db.templates.forEach((t) => {
        if (t.status !== 'retired') counts.inuse += 1;
        if (t.status === 'draft') counts.draft += 1;
        if (t.status === 'retired') counts.retired += 1;
      });
      const list = db.templates.filter((t) =>
        (!manage || state.show === 'all' || (state.show === 'inuse' ? t.status !== 'retired' : t.status === state.show)) &&
        (!state.category || t.category === state.category) &&
        (!state.funding || t.funding === state.funding || t.funding === 'any') &&
        C.matches(t, state.q, ['title', 'description'])
      );
      const groups = schema.options.templateCategory
        .map((o) => ({ key: o.value, label: o.label, items: list.filter((t) => t.category === o.value).sort((a, b) => a.title.localeCompare(b.title)) }))
        .filter((g) => g.items.length);

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Templates',
          subtitle: 'Agreements, forms, letters and policies, ready to download and fill in. Every change is kept as a new version.',
          actions: manage ? html`<button type="button" class="btn" data-new-template>${icon('plus')}New template</button>` : ''
        })}
        ${manage ? html`<div class="notice" style="margin-bottom:1rem">${icon('info')}<div>Drafts are only visible to administrators. Approve a template when it has been reviewed and is ready for the team. Have agreements and contracts checked by a lawyer before their first use.</div></div>` : ''}
        ${manage ? C.seg('show', [
          { value: 'inuse', label: 'In use', count: counts.inuse },
          { value: 'draft', label: 'Drafts', count: counts.draft },
          { value: 'retired', label: 'Retired', count: counts.retired },
          { value: 'all', label: 'All', count: db.templates.length }
        ], state.show) : ''}
        <div class="toolbar">
          ${C.search(state.q, 'Search templates')}
          ${C.select('category', 'Category', C.options('templateCategory'), state.category)}
          ${C.select('funding', 'For', C.options('templateFunding').filter((o) => o.value !== 'any'), state.funding, 'Any client')}
        </div>
        ${groups.length
          ? html`<div class="stack-panels">${groups.map((g) => html`<section class="panel" aria-labelledby="tg_${g.key}">
              <div class="panel-head"><h2 id="tg_${g.key}">${g.label} <span class="muted" style="font-weight:500">${g.items.length}</span></h2></div>
              <ul class="rows">${g.items.map((t) => row(db, t, manage))}</ul>
            </section>`)}</div>`
          : html`<section class="panel"><div class="panel-body">${C.empty({
              icon: 'clipboard',
              title: db.templates.length ? 'No templates match' : 'No templates yet',
              text: db.templates.length ? 'Try changing the filters.' : manage ? 'Add the practice\'s first template.' : 'Approved templates will appear here.',
              action: !db.templates.length && manage ? html`<button type="button" class="btn btn-secondary btn-sm" data-new-template>${icon('plus')}New template</button>` : ''
            })}</div></section>`}
      `);

      C.bindFilters(ctx);
      AWY.on(ctx.el, 'click', '[data-new-template]', () => newTemplate());
      AWY.on(ctx.el, 'click', '[data-open-template]', (event, btn) => openTemplate(btn.dataset.openTemplate));
      AWY.on(ctx.el, 'click', '[data-download]', (event, btn) => {
        const t = db.templates.find((x) => x.id === btn.dataset.download);
        download(t, current(db, t), btn);
      });

      /* Opened from search or another screen */
      if (query.open && state.openedFor !== query.open) {
        state.openedFor = query.open;
        AWY.router.replace(['templates']);
        if (db.templates.some((t) => t.id === query.open)) openTemplate(query.open);
      }
    }
  };
})();
