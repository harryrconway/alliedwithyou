/*
  Funding plans, delivered services and price items.
  Delivered services are checked against the client's plan and verified by a person
  before they can be invoiced. Nothing is claimed from the NDIS or any other funder.
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

  /* How a delivered service sits against the client's funding */
  function planCheck(db, log) {
    const client = rules.client(db, log.clientId);
    if (!client) return { tone: 'neutral', text: 'No client' };
    if (client.fundingType === 'private' || client.fundingType === 'healthfund') return { tone: 'neutral', text: 'Paid privately' };
    const plan = rules.activePlan(db, log.clientId, log.date);
    if (!plan) return { tone: 'danger', text: 'No plan covers this date' };
    const usage = rules.planUsage(db, plan);
    if (usage.budget && usage.used > usage.budget) return { tone: 'danger', text: 'Plan budget exceeded' };
    if (usage.sessionsAllowed && usage.sessions > usage.sessionsAllowed) return { tone: 'warning', text: 'Over the Medicare session limit' };
    if (usage.percent !== null && usage.percent >= 85) return { tone: 'warning', text: usage.percent + '% of plan used' };
    return { tone: 'success', text: 'Within ' + plan.name };
  }

  function logTable(db, logs, showClient) {
    if (!logs.length) return html`<div class="panel-body">${C.empty({ icon: 'wallet', title: 'No delivered services recorded' })}</div>`;
    const canVerify = access.can('billing') || access.role() === 'owner' || access.role() === 'therapist';
    return html`<div class="table-wrap"><table class="table table-stack">
      <caption class="sr-only">Delivered services</caption>
      <thead><tr>
        <th scope="col">Date</th>${showClient ? html`<th scope="col">Client</th>` : ''}<th scope="col">Service</th><th scope="col" class="num">Quantity</th><th scope="col" class="num">Rate</th><th scope="col" class="num">Amount</th><th scope="col">Funding check</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th>
      </tr></thead>
      <tbody>${logs.map((l) => {
        const check = planCheck(db, l);
        return html`<tr>
          <td class="cell-main" data-label="">${fmt.date(l.date)}<span class="sub">${rules.staffName(db, l.staffId)}</span></td>
          ${showClient ? html`<td data-label="Client">${C.clientLink(db, l.clientId, 'funding')}</td>` : ''}
          <td data-label="Service">${l.description}${l.code ? html`<span class="sub">${l.code}</span>` : ''}${l.automated ? html` ${C.autoTag('Recorded from a completed appointment')}` : ''}</td>
          <td class="num" data-label="Quantity">${l.unit === 'hour' ? fmt.hours(l.minutes) : '1 ' + C.label('unit', l.unit).replace('Per ', '').toLowerCase()}</td>
          <td class="num" data-label="Rate">${fmt.money(l.rate)}</td>
          <td class="num" data-label="Amount"><strong>${fmt.money(rules.logAmount(l))}</strong></td>
          <td data-label="Funding check"><span class="badge tone-${check.tone}">${icon(check.tone === 'success' ? 'check' : check.tone === 'neutral' ? 'dot' : 'alert')}${check.text}</span></td>
          <td data-label="Status">${C.badge('supportLog', l.status)}</td>
          <td data-label="">
            <div class="btn-row" style="gap:0.25rem;justify-content:flex-end">
              ${l.status === 'recorded' && canVerify ? html`<button type="button" class="btn btn-secondary btn-sm" data-verify-log="${l.id}">Verify</button>` : ''}
              ${l.status === 'recorded' ? html`<button type="button" class="btn btn-quiet btn-sm" data-edit-log="${l.id}">Edit</button>` : ''}
              ${l.status === 'verified' && canVerify ? html`<button type="button" class="btn btn-quiet btn-sm" data-unverify-log="${l.id}">Undo</button>` : ''}
              ${l.status === 'invoiced' && l.invoiceId && access.can('billing') ? html`<a class="btn btn-quiet btn-sm" href="#/invoices/${l.invoiceId}">Invoice</a>` : ''}
            </div>
          </td>
        </tr>`;
      })}</tbody>
    </table></div>`;
  }

  function bindLogs(el) {
    AWY.on(el, 'click', '[data-verify-log]', (event, btn) => C.save(store.update('supportLogs', btn.dataset.verifyLog, { status: 'verified', verifiedBy: access.user().id, verifiedAt: D.now() }), 'Service verified. It can now be included in an invoice.'));
    AWY.on(el, 'click', '[data-unverify-log]', (event, btn) => C.save(store.update('supportLogs', btn.dataset.unverifyLog, { status: 'recorded', verifiedBy: '', verifiedAt: '' }), 'Verification removed.'));
    AWY.on(el, 'click', '[data-edit-log]', (event, btn) => {
      const db = AWY.app.db;
      const l = db.supportLogs.find((x) => x.id === btn.dataset.editLog);
      C.openForm({
        title: 'Check delivered service',
        subtitle: rules.clientNameById(db, l.clientId) + ', ' + fmt.dateDay(l.date) + '. Rate ' + fmt.money(l.rate) + ' ' + C.label('unit', l.unit).toLowerCase() + ', from the price in effect on that date.',
        fields: [
          { name: 'description', label: 'Description', type: 'text', required: true, span: 'all' },
          { name: 'minutes', label: 'Minutes', type: 'number', min: 1, max: 600, required: true }
        ],
        values: l,
        db: db,
        footerStart: access.can('deleteRecords') ? html`<button type="button" class="btn btn-danger" data-remove-log>${icon('trash')}Remove</button>` : '',
        onOpen(modal) {
          const r = modal.el.querySelector('[data-remove-log]');
          if (r) r.addEventListener('click', () => {
            modal.close();
            C.confirmDelete({ table: 'supportLogs', id: l.id, label: 'this delivered service' });
          });
        },
        async onSubmit(v) {
          await store.update('supportLogs', l.id, { description: v.description, minutes: v.minutes, quantity: l.unit === 'hour' ? rules.round2(v.minutes / 60) : 1 });
          AWY.ui.toast('Delivered service updated.');
        }
      });
    });
  }

  A.planForm = function (existing, prefill) {
    const db = AWY.app.db;
    const isNew = !existing;
    const fields = schema.tables.fundingPlans.fields.filter((f) => !(f.name === 'clientId' && ((prefill && prefill.clientId) || existing)));
    C.openForm({
      title: isNew ? 'Add funding plan' : 'Edit funding plan',
      subtitle: (existing || prefill || {}).clientId ? rules.clientNameById(db, (existing || prefill).clientId) : '',
      fields: fields,
      values: Object.assign({ startDate: D.today(), endDate: D.addDays(D.addMonths(D.today(), 12), -1) }, prefill || {}, existing || {}),
      db: db,
      size: 'wide',
      footerStart: existing && access.can('deleteRecords') ? html`<button type="button" class="btn btn-danger" data-remove-plan>${icon('trash')}Delete</button>` : '',
      onOpen(modal) {
        const r = modal.el.querySelector('[data-remove-plan]');
        if (r) r.addEventListener('click', () => {
          modal.close();
          C.confirmDelete({ table: 'fundingPlans', id: existing.id, label: 'this funding plan' });
        });
      },
      validate(v) {
        return v.endDate <= v.startDate ? { endDate: 'The end date should be after the start date' } : {};
      },
      async onSubmit(values) {
        if (isNew) await store.create('fundingPlans', Object.assign({ clientId: prefill && prefill.clientId }, values));
        else await store.update('fundingPlans', existing.id, values);
        AWY.ui.toast(isNew ? 'Funding plan added.' : 'Funding plan saved.');
      }
    });
  };

  function newRate(key) {
    const db = AWY.app.db;
    const versions = rules.itemVersions(db, key);
    const latest = versions[0];
    C.openForm({
      title: 'Add a new rate',
      subtitle: latest.name + '. The current rate stays on older records, and the new one applies from its start date.',
      fields: [
        { name: 'rate', label: 'New rate', type: 'money', required: true },
        { name: 'effectiveFrom', label: 'Applies from', type: 'date', required: true },
        { name: 'notes', label: 'Notes', type: 'text', span: 'all' }
      ],
      values: { rate: latest.rate, effectiveFrom: D.addDays(D.today(), 1), notes: latest.notes },
      db: db,
      submitLabel: 'Add rate',
      validate(v) {
        return v.effectiveFrom <= latest.effectiveFrom ? { effectiveFrom: 'Must be after ' + fmt.date(latest.effectiveFrom) + ', when the latest rate started' } : {};
      },
      async onSubmit(v) {
        await store.update('supportItems', latest.id, { effectiveTo: D.addDays(v.effectiveFrom, -1) });
        const copy = Object.assign({}, latest, { rate: v.rate, effectiveFrom: v.effectiveFrom, effectiveTo: '', notes: v.notes });
        delete copy.id;
        delete copy.createdAt;
        delete copy.updatedAt;
        await store.create('supportItems', copy);
        AWY.ui.toast('New rate added from ' + fmt.date(v.effectiveFrom) + '. Existing records keep the rate that applied at the time.');
      }
    });
  }

  AWY.views.funding = {
    title: 'Funding and services',
    logTable: logTable,
    bindLogs: bindLogs,
    planCheck: planCheck,
    render(ctx) {
      const { db, state, today } = ctx;
      const tab = ['plans', 'services', 'prices'].includes(ctx.params.id) ? ctx.params.id : 'plans';
      let body;

      if (tab === 'plans') {
        if (state.planStatus === undefined) state.planStatus = 'current';
        const plans = db.fundingPlans.map((p) => Object.assign({}, p, { _status: rules.planStatus(p, today), _usage: rules.planUsage(db, p) })).filter((p) =>
          (state.planStatus === 'all' || (state.planStatus === 'current' ? p._status !== 'ended' : p._status === state.planStatus)) &&
          (!state.funding || p.fundingType === state.funding) &&
          C.matches(p, state.q, [(x) => rules.clientNameById(db, x.clientId), 'name', 'managedBy'])
        );
        const columns = [
          { key: 'client', label: 'Client', sortValue: (p) => rules.clientNameById(db, p.clientId), render: (p) => html`${C.clientLink(db, p.clientId, 'funding')}<span class="sub">${p.name}</span>` },
          { key: 'type', label: 'Funding', sortValue: (p) => p.fundingType, render: (p) => html`${C.label('fundingType', p.fundingType)}${p.managedBy ? html`<span class="sub">${p.managedBy}</span>` : ''}` },
          { key: 'period', label: 'Period', sortValue: (p) => p.endDate, render: (p) => html`${fmt.date(p.startDate)}<span class="sub">to ${fmt.date(p.endDate)}</span>` },
          { key: 'usage', label: 'Used', sortValue: (p) => p._usage.percent || 0, render: (p) => html`<div style="min-width:11rem">${p._usage.budget ? C.meter({ value: p._usage.used, max: p._usage.budget, tone: p._usage.percent >= 85 ? 'warning' : '', left: fmt.money(p._usage.used), right: 'of ' + fmt.money(p._usage.budget) }) : p._usage.sessionsAllowed ? C.meter({ value: p._usage.sessions, max: p._usage.sessionsAllowed, left: p._usage.sessions + ' sessions', right: 'of ' + p._usage.sessionsAllowed }) : html`<span class="muted">${fmt.money(p._usage.used)} delivered</span>`}</div>` },
          { key: 'status', label: 'Status', sortValue: (p) => p._status, render: (p) => C.badge('plan', p._status) },
          { key: 'edit', label: '', render: (p) => html`<button type="button" class="btn btn-quiet btn-sm" data-plan="${p.id}">Edit</button>` }
        ];
        body = html`
          ${C.seg('planStatus', [{ value: 'current', label: 'Current' }, { value: 'ending', label: 'Ending soon' }, { value: 'ended', label: 'Ended' }, { value: 'all', label: 'All' }], state.planStatus)}
          <div class="toolbar">${C.search(state.q, 'Search by client or plan manager')}${C.select('funding', 'Funding', C.options('fundingType'), state.funding)}</div>
          ${C.table({ columns, rows: plans, sort: state.sort || 'period', caption: 'Funding plans', empty: C.empty({ icon: 'wallet', title: 'No plans match' }) })}`;
      }

      if (tab === 'services') {
        if (state.logStatus === undefined) state.logStatus = ctx.query.status || 'recorded';
        const counts = {};
        db.supportLogs.forEach((l) => (counts[l.status] = (counts[l.status] || 0) + 1));
        const logs = db.supportLogs.filter((l) =>
          (state.logStatus === 'all' || l.status === state.logStatus) &&
          (!state.client || l.clientId === state.client) &&
          C.matches(l, state.q, ['description', (x) => rules.clientNameById(db, x.clientId), 'code'])
        ).sort((a, b) => b.date.localeCompare(a.date));
        const recorded = logs.filter((l) => l.status === 'recorded');
        body = html`
          <div class="notice" style="margin-bottom:1rem">${icon('info')}<div>Services are recorded automatically when an appointment is marked completed. Check the time and rate, then verify them. Only verified services can be put on an invoice. Nothing is claimed from the NDIS or any other funder in the demo.</div></div>
          ${C.seg('logStatus', [{ value: 'recorded', label: 'Needs checking', count: counts.recorded || 0 }, { value: 'verified', label: 'Verified', count: counts.verified || 0 }, { value: 'invoiced', label: 'Invoiced', count: counts.invoiced || 0 }, { value: 'all', label: 'All', count: db.supportLogs.length }], state.logStatus)}
          <div class="toolbar">
            ${C.search(state.q, 'Search services or clients')}
            ${C.select('client', 'Client', C.clientOptions(db), state.client)}
            <span class="spacer"></span>
            ${recorded.length && (access.can('billing') || access.role() === 'therapist') ? html`<button type="button" class="btn btn-secondary" data-verify-all>${icon('check')}Verify all ${recorded.length} shown</button>` : ''}
          </div>
          <section class="panel">${logTable(db, logs, true)}</section>
          <p class="small muted" style="margin-top:0.75rem">Total shown ${fmt.money(rules.sum(logs, rules.logAmount))}.</p>`;
      }

      if (tab === 'prices') {
        const keys = [];
        db.supportItems.forEach((i) => {
          if (!keys.includes(i.key)) keys.push(i.key);
        });
        body = html`
          <div class="notice notice-warning" style="margin-bottom:1rem">${icon('alert')}<div><strong>Sample prices</strong>These are placeholders for testing, not approved fees. NDIS items must be checked against the current NDIS Pricing Arrangements and Price Limits. Each rate has dates, so older records keep the price that applied at the time.</div></div>
          <div class="stack-panels">${keys.map((key) => {
            const versions = rules.itemVersions(db, key);
            const top = versions[0];
            return html`<section class="panel">
              <div class="panel-head">
                <div><h2>${top.name}</h2><p>${C.label('itemFunding', top.funding)}${top.code ? ', ' + top.code : ''}, ${C.label('unit', top.unit).toLowerCase()}</p></div>
                ${access.can('settings') ? html`<button type="button" class="btn btn-secondary btn-sm" data-new-rate="${key}">${icon('plus')}New rate</button>` : ''}
              </div>
              <ul class="rows">${versions.map((v) => html`<li>
                <div class="what"><strong>${fmt.money(v.rate)}</strong><div class="meta"><span>From ${fmt.date(v.effectiveFrom)}${v.effectiveTo ? ' to ' + fmt.date(v.effectiveTo) : ''}</span>${v.notes ? html`<span>${v.notes}</span>` : ''}</div></div>
                <div class="end">${rules.itemIsCurrent(v, today) ? html`<span class="badge tone-success">${icon('check')}Current</span>` : v.effectiveFrom > today ? html`<span class="badge tone-info">${icon('clock')}Upcoming</span>` : html`<span class="badge">${icon('archive')}Previous</span>`}</div>
              </li>`)}</ul>
            </section>`;
          })}</div>`;
      }

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Funding and services',
          subtitle: 'Funding plans, the services delivered against them, and the prices used.',
          actions: tab === 'plans' ? html`<button type="button" class="btn" data-new-plan>${icon('plus')}Add funding plan</button>` : ''
        })}
        <div class="tabs-wrap">${C.tabs([
          { key: 'plans', label: 'Funding plans', href: '#/funding/plans' },
          { key: 'services', label: 'Delivered services', href: '#/funding/services', count: db.supportLogs.filter((l) => l.status === 'recorded').length },
          { key: 'prices', label: 'Price items', href: '#/funding/prices' }
        ], tab)}</div>
        ${body}
      `);
      C.bindFilters(ctx);
      bindLogs(ctx.el);
      AWY.on(ctx.el, 'click', '[data-plan]', (event, btn) => A.planForm(db.fundingPlans.find((p) => p.id === btn.dataset.plan)));
      AWY.on(ctx.el, 'click', '[data-new-plan]', () => A.planForm(null, {}));
      AWY.on(ctx.el, 'click', '[data-new-rate]', (event, btn) => newRate(btn.dataset.newRate));
      AWY.on(ctx.el, 'click', '[data-verify-all]', async (event, btn) => {
        const ids = db.supportLogs.filter((l) => l.status === 'recorded' && (!state.client || l.clientId === state.client) && C.matches(l, state.q, ['description', (x) => rules.clientNameById(db, x.clientId), 'code'])).map((l) => l.id);
        const ok = await AWY.ui.confirm({ title: 'Verify ' + fmt.plural(ids.length, 'service') + '?', message: 'Confirm you have checked the dates, times and rates. Verified services can then be added to invoices.', confirmLabel: 'Verify all' });
        if (!ok) return;
        await AWY.ui.busy(btn, async () => {
          for (const id of ids) await store.update('supportLogs', id, { status: 'verified', verifiedBy: access.user().id, verifiedAt: D.now() }, { instant: true });
        });
        AWY.ui.toast(fmt.plural(ids.length, 'service') + ' verified.');
      });
    }
  };
})();
