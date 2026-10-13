/* Client records: search, filter and sort every client. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const rules = AWY.rules;
  const access = AWY.access;
  const icon = (n) => raw(AWY.icon(n));

  AWY.views.clients = {
    title: 'Client records',
    render(ctx) {
      const { db, today, state } = ctx;
      if (state.status === undefined) state.status = ctx.query.status || 'active';
      if (state.sort === undefined) state.sort = 'name';

      const enriched = db.clients.map((c) => {
        const next = rules.nextAppointment(db, c.id, today);
        return Object.assign({}, c, { _next: next, _flags: rules.clientFlags(db, c, today), _name: rules.clientName(c) });
      });

      const counts = {};
      enriched.forEach((c) => (counts[c.status] = (counts[c.status] || 0) + 1));
      const statusOptions = [{ value: 'all', label: 'All', count: enriched.length }].concat(
        Object.keys(AWY.schema.statuses.client).map((k) => ({ value: k, label: AWY.schema.statuses.client[k].label, count: counts[k] || 0 }))
      );

      const rows = enriched.filter((c) =>
        (state.status === 'all' || c.status === state.status) &&
        (!state.funding || c.fundingType === state.funding) &&
        (!state.therapist || c.therapistId === state.therapist) &&
        C.matches(c, state.q, [(r) => r.firstName + ' ' + r.lastName, 'preferredName', 'suburb', 'phone', 'email', 'ndisNumber', 'ref'])
      );

      const columns = [
        { key: 'name', label: 'Client', sortValue: (c) => c.lastName + ' ' + c.firstName, render: (c) => html`${c._name}<span class="sub">Client ${c.ref}, ${c.suburb} ${c.state}</span>` },
        { key: 'funding', label: 'Funding', sortValue: (c) => C.label('fundingType', c.fundingType), render: (c) => C.label('fundingType', c.fundingType) },
        { key: 'therapist', label: 'Therapist', sortValue: (c) => rules.staffName(db, c.therapistId), render: (c) => rules.staffName(db, c.therapistId) },
        { key: 'next', label: 'Next appointment', sortValue: (c) => (c._next ? c._next.date + c._next.start : '9999'), render: (c) => (c._next ? html`${fmt.dateDay(c._next.date)}<span class="sub">${fmt.time(c._next.start)}, ${C.label('appointmentType', c._next.type).toLowerCase()}</span>` : html`<span class="muted">None booked</span>`) },
        { key: 'flags', label: 'Needs attention', sortValue: (c) => -c._flags.length, render: (c) => (c._flags.length ? html`<span class="badge tone-${c._flags.some((f) => f.tone === 'danger') ? 'danger' : 'warning'}">${icon('alert')}${fmt.plural(c._flags.length, 'item')}</span>` : html`<span class="muted">Nothing</span>`) },
        { key: 'status', label: 'Status', sortValue: (c) => c.status, render: (c) => C.badge('client', c.status) }
      ];

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Client records',
          subtitle: 'Everyone the practice works with, past and present.',
          actions: access.can('editClients') ? html`<button type="button" class="btn" data-new-client>${icon('userPlus')}New client</button>` : ''
        })}
        ${C.seg('status', statusOptions, state.status)}
        <div class="toolbar">
          ${C.search(state.q, 'Search by name, suburb, phone or NDIS number')}
          ${C.select('funding', 'Funding', C.options('fundingType'), state.funding)}
          ${C.select('therapist', 'Therapist', C.staffOptions(db, true), state.therapist)}
        </div>
        <p class="result-count" aria-live="polite">${fmt.plural(rows.length, 'client')}</p>
        ${C.table({
          columns,
          rows,
          sort: state.sort,
          caption: 'Client records',
          rowHref: (c) => '#/clients/' + c.id,
          empty: C.empty({ icon: 'users', title: 'No clients match', text: 'Try a different search or status.' })
        })}
      `);
      C.bindFilters(ctx);
      AWY.actions.bindCommon(ctx);
    }
  };
})();
