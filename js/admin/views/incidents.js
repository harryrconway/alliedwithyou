/*
  Incidents and complaints. A restricted area.
  The final workflow must match the practice's actual reporting obligations,
  and access must be enforced by the server in the live system.
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

  function form(existing) {
    const db = AWY.app.db;
    const isNew = !existing;
    C.openForm({
      title: isNew ? 'Record an incident or complaint' : (existing.kind === 'complaint' ? 'Complaint ' : 'Record ') + existing.ref,
      subtitle: 'Use fictional details only. Stick to facts: what happened, when, and what was done.',
      fields: schema.tables.incidents.fields,
      values: existing || { kind: 'incident', date: D.today(), status: 'open', reportable: 'tbc', assignedTo: access.user().id },
      db: db,
      size: 'wide',
      intro: existing ? html`<p class="small muted">Recorded by ${rules.staffName(db, existing.reportedBy)}${existing.createdAt ? ' on ' + fmt.stamp(existing.createdAt) : ''}.</p>` : '',
      footerStart: existing && access.can('deleteRecords') ? html`<button type="button" class="btn btn-danger" data-remove>${icon('trash')}Delete</button>` : '',
      onOpen(modal) {
        const r = modal.el.querySelector('[data-remove]');
        if (r) r.addEventListener('click', () => {
          modal.close();
          C.confirmDelete({ table: 'incidents', id: existing.id, label: 'this record' });
        });
      },
      validate(v) {
        if ((v.status === 'resolved' || v.status === 'closed') && !v.resolution) return { resolution: 'Record how it was resolved before closing' };
        return {};
      },
      async onSubmit(values) {
        if ((values.status === 'resolved' || values.status === 'closed') && (!existing || !existing.resolvedDate)) values.resolvedDate = D.today();
        if (isNew) await store.create('incidents', Object.assign(values, { reportedBy: access.user().id }));
        else await store.update('incidents', existing.id, values);
        AWY.ui.toast(isNew ? 'Record saved. Nothing has been reported to any external body.' : 'Record updated.');
      }
    });
  }

  AWY.views.incidents = {
    title: 'Incidents and complaints',
    render(ctx) {
      const { db, state } = ctx;
      if (state.status === undefined) state.status = 'open';
      if (state.sort === undefined) state.sort = '-date';
      const rows = db.incidents.filter((i) =>
        (state.status === 'all' || (state.status === 'open' ? i.status === 'open' || i.status === 'investigating' : i.status === state.status)) &&
        (!state.kind || i.kind === state.kind) &&
        C.matches(i, state.q, ['title', 'description', (x) => (x.clientId ? rules.clientNameById(db, x.clientId) : '')])
      );
      const columns = [
        { key: 'date', label: 'Date', sortValue: (i) => i.date, render: (i) => html`<button type="button" style="all:unset;cursor:pointer;font-weight:680" data-incident="${i.id}">${fmt.date(i.date)}</button><span class="sub">Ref ${i.ref}</span>` },
        { key: 'kind', label: 'Type', sortValue: (i) => i.kind, render: (i) => C.label('incidentKind', i.kind) },
        { key: 'title', label: 'Summary', render: (i) => html`<span style="display:block;max-width:26rem">${i.title}</span>${i.clientId ? html`<span class="sub">${rules.clientNameById(db, i.clientId)}</span>` : ''}` },
        { key: 'assigned', label: 'Assigned to', sortValue: (i) => rules.staffName(db, i.assignedTo), render: (i) => rules.staffName(db, i.assignedTo) },
        { key: 'reportable', label: 'External report', render: (i) => (i.reportable === 'tbc' ? html`<span class="badge tone-warning">${icon('clock')}To be confirmed</span>` : C.label('reportable', i.reportable)) },
        { key: 'status', label: 'Status', sortValue: (i) => i.status, render: (i) => C.badge('incident', i.status) }
      ];
      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Incidents and complaints', subtitle: 'Restricted to the practice owner and administrator.', actions: html`<button type="button" class="btn" data-new-incident>${icon('plus')}New record</button>` })}
        <div class="notice notice-warning" style="margin-bottom:1.25rem">${icon('lock')}<div><strong>Restricted records</strong>Only the owner and administrator can see this section in the demo. In the live system, access will be enforced by the server, and the workflow will be set up to match the practice's actual incident management and reporting obligations, including any NDIS Commission requirements. Nothing is reported externally from here.</div></div>
        ${C.seg('status', [{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }], state.status)}
        <div class="toolbar">${C.search(state.q, 'Search records')}${C.select('kind', 'Type', C.options('incidentKind'), state.kind)}</div>
        ${C.table({ columns, rows, sort: state.sort, caption: 'Incidents and complaints', empty: C.empty({ icon: 'shield', title: 'No records here' }) })}
      `);
      C.bindFilters(ctx);
      AWY.on(ctx.el, 'click', '[data-incident]', (event, btn) => form(db.incidents.find((i) => i.id === btn.dataset.incident)));
      AWY.on(ctx.el, 'click', '[data-new-incident]', () => form(null));
    }
  };
})();
