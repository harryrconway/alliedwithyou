/* Practice settings and the fee schedule. Everyone can read them, and administrators can change them. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const store = AWY.store;
  const access = AWY.access;
  const rules = AWY.rules;
  const schema = AWY.schema;
  const icon = (n) => raw(AWY.icon(n));

  const BUSINESS_FIELDS = [
    { name: 'name', label: 'Practice name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'tel', rule: 'phone' },
    { name: 'abn', label: 'ABN', type: 'text' },
    { name: 'postal', label: 'Postal address', type: 'text', span: 'all' },
    { name: 'areaDetail', label: 'Service area', type: 'textarea', span: 'all', rows: 2 }
  ];

  function section(id, title, intro, body, editable) {
    return html`<section class="panel settings-section" aria-labelledby="${id}Title">
      <div class="panel-head"><div><h2 id="${id}Title">${title}</h2>${intro ? html`<p>${intro}</p>` : ''}</div></div>
      <form class="panel-body form" data-settings="${id}" novalidate>
        <div class="form-summary"></div>
        ${body}
        ${editable ? html`<div><button type="submit" class="btn btn-secondary">Save ${title.toLowerCase()}</button></div>` : ''}
      </form>
    </section>`;
  }

  /* A new rate starts on a chosen date. Older records keep the rate that applied at the time. */
  function newRate(key) {
    const db = AWY.app.db;
    const latest = rules.itemVersions(db, key)[0];
    C.openForm({
      title: 'Add a new rate',
      subtitle: latest.name + '. The current rate stays in place until the new one starts.',
      area: 'fees',
      fields: [
        { name: 'rate', label: 'New rate', type: 'money', required: true },
        { name: 'effectiveFrom', label: 'Applies from', type: 'date', required: true },
        { name: 'notes', label: 'Notes', type: 'text', span: 'all' }
      ],
      values: { rate: latest.rate, effectiveFrom: D.addDays(D.today(), 1), notes: latest.notes },
      db: db,
      submitLabel: 'Add rate',
      validate(v) {
        return v.effectiveFrom <= latest.effectiveFrom ? { effectiveFrom: 'Must be after ' + fmt.date(latest.effectiveFrom) + ', when the latest rate starts' } : {};
      },
      async onSubmit(v, modal) {
        const copy = { key: latest.key, name: latest.name, funding: latest.funding, code: latest.code, unit: latest.unit, rate: v.rate, effectiveFrom: v.effectiveFrom, effectiveTo: '', notes: v.notes };
        await store.create('supportItems', copy, { requestId: modal.requestId });
        await store.update('supportItems', latest.id, { effectiveTo: D.addDays(v.effectiveFrom, -1) });
        AWY.ui.toast('New rate of ' + fmt.money(v.rate) + ' added from ' + fmt.date(v.effectiveFrom) + '.');
      }
    });
  }

  function newFee() {
    const db = AWY.app.db;
    C.openForm({
      title: 'Add a fee',
      subtitle: 'For a service that isn\'t on the schedule yet. To change an existing price, use New rate instead.',
      area: 'fees',
      fields: schema.tables.supportItems.fields,
      values: { funding: 'private', unit: 'hour', effectiveFrom: D.today() },
      db: db,
      size: 'wide',
      submitLabel: 'Add fee',
      async onSubmit(v, modal) {
        const base = (v.funding + '_' + v.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')).slice(0, 50);
        let key = base;
        let n = 2;
        while (db.supportItems.some((i) => i.key === key)) key = base + '_' + n++;
        await store.create('supportItems', Object.assign({}, v, { key: key }), { requestId: modal.requestId });
        AWY.ui.toast(v.name + ' added to the fee schedule.');
      }
    });
  }

  /* Removes a rate that hasn't started yet, for example one added by mistake */
  async function removeUpcoming(item) {
    const db = AWY.app.db;
    const versions = rules.itemVersions(db, item.key);
    const previous = versions[versions.indexOf(item) + 1];
    const ok = await AWY.ui.confirm({
      title: 'Remove this upcoming rate?',
      message: 'The ' + fmt.money(item.rate) + ' rate from ' + fmt.date(item.effectiveFrom) + ' will be removed.' + (previous ? ' The ' + fmt.money(previous.rate) + ' rate carries on instead.' : ''),
      confirmLabel: 'Remove rate',
      danger: true
    });
    if (!ok) return;
    const removed = await C.save(store.remove('supportItems', item.id), 'Upcoming rate removed.', { area: 'fees', operation: 'remove rate' });
    if (removed && previous && previous.effectiveTo) await C.save(store.update('supportItems', previous.id, { effectiveTo: '' }), '', { area: 'fees', operation: 'reopen rate' });
  }

  function feeSchedule(db, today, editable) {
    /* Grouped by fee schedule, then alphabetical, so the order never shifts */
    const keys = [];
    db.supportItems.forEach((i) => {
      if (!keys.includes(i.key)) keys.push(i.key);
    });
    const latest = (key) => rules.itemVersions(db, key)[0];
    keys.sort((a, b) => latest(a).funding.localeCompare(latest(b).funding) || latest(a).name.localeCompare(latest(b).name));
    return html`<section class="panel settings-section" aria-labelledby="feesTitle">
      <div class="panel-head">
        <div><h2 id="feesTitle">Fees</h2><p>Each rate has a start date, so a price change never alters what was charged before. The website's fees page is updated separately.</p></div>
        ${editable ? html`<button type="button" class="btn btn-secondary btn-sm" data-new-fee>${icon('plus')}Add a fee</button>` : ''}
      </div>
      ${keys.length ? html`<ul class="rows">${keys.map((key) => {
        const versions = rules.itemVersions(db, key);
        const current = rules.rateFor(db, key, today);
        const top = versions[0];
        return html`<li class="fee-row">
          <div class="what"><strong>${top.name}</strong>
            <div class="meta"><span>${C.label('itemFunding', top.funding)}</span>${top.code ? html`<span>${top.code}</span>` : ''}<span>${C.label('unit', top.unit)}</span></div>
            <ul class="fee-versions">${versions.map((v) => html`<li>
              <strong>${fmt.money(v.rate)}</strong>
              <span>From ${fmt.date(v.effectiveFrom)}${v.effectiveTo ? ' to ' + fmt.date(v.effectiveTo) : ''}</span>
              ${current && current.id === v.id ? html`<span class="badge tone-success">${icon('check')}Current</span>` : v.effectiveFrom > today ? html`<span class="badge tone-info">${icon('clock')}Upcoming</span>` : html`<span class="badge">${icon('archive')}Previous</span>`}
              ${editable && v.effectiveFrom > today ? html`<button type="button" class="btn btn-quiet btn-sm" data-remove-rate="${v.id}" aria-label="Remove the upcoming ${fmt.money(v.rate)} rate">Remove</button>` : ''}
              ${v.notes ? html`<span class="muted">${v.notes}</span>` : ''}
            </li>`)}</ul>
          </div>
          ${editable ? html`<div class="end"><button type="button" class="btn btn-secondary btn-sm" data-new-rate="${key}" aria-label="New rate for ${top.name}">${icon('plus')}New rate</button></div>` : ''}
        </li>`;
      })}</ul>` : html`<div class="panel-body"><p class="muted small">No fees yet.</p></div>`}
    </section>`;
  }

  AWY.views.settings = {
    title: 'Settings',
    render(ctx) {
      const { db, today } = ctx;
      const s = ctx.settings;
      const b = s.business || {};
      const editable = access.can('settings');
      const fees = access.can('fees');
      const durations = s.durations || {};

      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Settings', subtitle: 'Practice details, preferences and fees.' })}
        ${!editable ? html`<div class="notice" style="margin-bottom:1rem">${icon('lock')}<div>Only administrators can change settings and fees.</div></div>` : ''}

        ${section('business', 'Business details', 'Used on documents once those are switched on. The website\'s contact details are updated separately.', C.fields(BUSINESS_FIELDS, b, db, 'b_'), editable)}

        ${feeSchedule(db, today, fees)}

        ${section('services', 'Services offered', 'Only list services the practice is qualified and ready to provide.', html`
          <fieldset class="field"><legend>Services</legend><div class="choices">
            ${C.options('service').map((o) => html`<label class="choice"><input type="checkbox" name="services" value="${o.value}" ${raw((s.services || []).includes(o.value) ? 'checked' : '')}> ${o.label}</label>`)}
          </div></fieldset>`, editable)}

        ${section('funding', 'Funding accepted', 'Ways clients can pay for services.', html`
          <fieldset class="field"><legend>Accepted funding</legend><div class="choices">
            ${C.options('fundingType').map((o) => html`<label class="choice"><input type="checkbox" name="acceptedFunding" value="${o.value}" ${raw((s.acceptedFunding || []).includes(o.value) ? 'checked' : '')}> ${o.label}</label>`)}
          </div></fieldset>`, editable)}

        ${section('appointments', 'Appointment preferences', 'Default lengths and working hours, used when bookings are switched on.', html`
          <div class="form-grid">
            ${C.options('appointmentType').map((o) => html`<div class="field"><label for="dur_${o.value}">${o.label}, minutes</label><input class="input" type="number" min="15" max="480" step="15" id="dur_${o.value}" name="dur_${o.value}" value="${durations[o.value] || 60}" required></div>`)}
            <div class="field"><label for="dayStart">Working day starts</label><input class="input" type="time" id="dayStart" name="dayStart" value="${s.dayStart || '08:00'}" required></div>
            <div class="field"><label for="dayEnd">Working day ends</label><input class="input" type="time" id="dayEnd" name="dayEnd" value="${s.dayEnd || '17:30'}" required></div>
            <div class="field"><label for="travelBuffer">Gap between visits, minutes</label><input class="input" type="number" min="0" max="120" id="travelBuffer" name="travelBuffer" value="${s.travelBuffer === undefined ? 15 : s.travelBuffer}"></div>
            <div class="field"><label for="invoiceTerms">Invoice payment terms, days</label><input class="input" type="number" min="1" max="60" id="invoiceTerms" name="invoiceTerms" value="${s.invoiceTerms || 14}" required></div>
            <div class="field"><label for="defaultTimeZone">Usual time zone</label>
              <select class="select" id="defaultTimeZone" name="defaultTimeZone" aria-describedby="defaultTimeZoneHint">
                ${C.options('timeZone').map((o) => html`<option value="${o.value}" ${raw(o.value === (s.defaultTimeZone || 'Australia/Brisbane') ? 'selected' : '')}>${o.label}</option>`)}
              </select>
              <p class="hint" id="defaultTimeZoneHint">Used for new calendar entries on devices outside NSW and Queensland.</p>
            </div>
          </div>`, editable)}

        ${s.updatedAt ? html`<p class="small muted">Settings last changed ${fmt.stamp(s.updatedAt)}${s.updatedBy ? ' by ' + rules.staffName(db, s.updatedBy) : ''}.</p>` : ''}
      `);

      const el = ctx.el;
      if (!editable) AWY.$$('[data-settings] input, [data-settings] textarea, [data-settings] select', el).forEach((x) => (x.disabled = true));
      AWY.$$('[data-settings]', el).forEach((form) => AWY.validate.live(form));

      el.addEventListener('submit', async (event) => {
        const form = event.target.closest('[data-settings]');
        if (!form) return;
        event.preventDefault();
        const kind = form.dataset.settings;
        const custom = () => (kind === 'appointments' && form.elements.dayEnd.value <= form.elements.dayStart.value ? { dayEnd: 'The day should end after it starts' } : {});
        const result = AWY.validate.form(form, custom);
        if (!result.valid) return;
        const v = result.values;
        let patch = {};
        if (kind === 'business') patch = { business: Object.assign({}, b, v) };
        if (kind === 'funding') patch = { acceptedFunding: AWY.$$('input[name="acceptedFunding"]:checked', form).map((i) => i.value) };
        if (kind === 'services') patch = { services: AWY.$$('input[name="services"]:checked', form).map((i) => i.value) };
        if (kind === 'appointments') {
          const d = {};
          C.options('appointmentType').forEach((o) => (d[o.value] = Number(v['dur_' + o.value])));
          patch = { durations: d, dayStart: v.dayStart, dayEnd: v.dayEnd, travelBuffer: Number(v.travelBuffer) || 0, invoiceTerms: Number(v.invoiceTerms) || 14, defaultTimeZone: v.defaultTimeZone };
        }
        const button = form.querySelector('[type="submit"]');
        await AWY.ui.busy(button, async () => {
          try {
            await store.update('settings', s.id, patch);
            AWY.ui.toast('Settings saved.');
          } catch (error) {
            C.showStoreError(form, error, '', { area: 'settings', operation: 'save ' + kind });
          }
        });
      });

      AWY.on(el, 'click', '[data-new-rate]', (event, btn) => newRate(btn.dataset.newRate));
      AWY.on(el, 'click', '[data-new-fee]', () => newFee());
      AWY.on(el, 'click', '[data-remove-rate]', (event, btn) => removeUpcoming(db.supportItems.find((i) => i.id === btn.dataset.removeRate)));
    }
  };
})();
