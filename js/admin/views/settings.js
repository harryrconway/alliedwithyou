/* Practice settings. Business details are placeholders until the business confirms them. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const store = AWY.store;
  const access = AWY.access;
  const icon = (n) => raw(AWY.icon(n));

  const BUSINESS_FIELDS = [
    { name: 'therapist', label: 'Lead therapist', type: 'text' },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'abn', label: 'ABN', type: 'text' },
    { name: 'hours', label: 'Opening hours', type: 'text', span: 'all' },
    { name: 'responseTime', label: 'Reply time promised to enquiries', type: 'text', span: 'all' },
    { name: 'postal', label: 'Postal address', type: 'text', span: 'all' },
    { name: 'areaDetail', label: 'Service area', type: 'textarea', span: 'all', rows: 2 }
  ];

  function section(id, title, intro, body, button) {
    return html`<section class="panel settings-section" aria-labelledby="${id}Title">
      <div class="panel-head"><div><h2 id="${id}Title">${title}</h2>${intro ? html`<p>${intro}</p>` : ''}</div></div>
      <form class="panel-body form" data-settings="${id}" novalidate>
        <div class="form-summary"></div>
        ${body}
        ${button !== false ? html`<div><button type="submit" class="btn btn-secondary">Save ${title.toLowerCase()}</button></div>` : ''}
      </form>
    </section>`;
  }

  AWY.views.settings = {
    title: 'Settings',
    render(ctx) {
      const { db } = ctx;
      const s = ctx.settings;
      const b = s.business || {};
      const editable = access.can('settings');
      const durations = s.durations || {};
      const templates = s.agreementTemplates || {};
      const automations = s.automations || {};

      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Settings', subtitle: 'Practice details and how the dashboard behaves. Anything marked to confirm is a placeholder.' })}
        ${!editable ? html`<div class="notice notice-warning" style="margin-bottom:1rem">${icon('lock')}<div>Only the owner and administrator can change settings.</div></div>` : ''}

        ${section('business', 'Business details', 'Shown on documents and invoices. All values are placeholders until the business confirms them.', html`
          <div class="notice notice-warning">${icon('alert')}<div>The public website currently reads its contact details from a separate placeholder file. When real details are confirmed, update both, or connect the website to these settings in the live system.</div></div>
          ${C.fields(BUSINESS_FIELDS, b, db, 'b_')}`)}

        ${section('funding', 'Funding accepted', 'Funding types that can be chosen for new clients.', html`
          <fieldset class="field"><legend>Accepted funding</legend><div class="choices">
            ${C.options('fundingType').map((o) => html`<label class="choice"><input type="checkbox" name="acceptedFunding" value="${o.value}" ${raw((s.acceptedFunding || []).includes(o.value) ? 'checked' : '')}> ${o.label}${o.value === 'ndis_agency' ? html` <span class="muted small">(needs registration as an NDIS provider)</span>` : ''}</label>`)}
          </div></fieldset>`)}

        ${section('services', 'Services offered', 'Only list services the therapist is qualified and ready to provide.', html`
          <fieldset class="field"><legend>Services</legend><div class="choices">
            ${C.options('service').filter((o) => o.value !== 'unsure').map((o) => html`<label class="choice"><input type="checkbox" name="services" value="${o.value}" ${raw((s.services || []).includes(o.value) ? 'checked' : '')}> ${o.label}</label>`)}
          </div></fieldset>`)}

        ${section('appointments', 'Appointment preferences', 'Default lengths fill in automatically when booking.', html`
          <div class="form-grid">
            ${C.options('appointmentType').map((o) => html`<div class="field"><label for="dur_${o.value}">${o.label}, minutes</label><input class="input" type="number" min="15" max="480" step="15" id="dur_${o.value}" name="dur_${o.value}" value="${durations[o.value] || 60}" required></div>`)}
            <div class="field"><label for="dayStart">Working day starts</label><input class="input" type="time" id="dayStart" name="dayStart" value="${s.dayStart || '08:00'}" required></div>
            <div class="field"><label for="dayEnd">Working day ends</label><input class="input" type="time" id="dayEnd" name="dayEnd" value="${s.dayEnd || '17:30'}" required></div>
            <div class="field"><label for="travelBuffer">Gap between visits, minutes</label><input class="input" type="number" min="0" max="120" id="travelBuffer" name="travelBuffer" value="${s.travelBuffer || 15}"></div>
            <div class="field"><label for="invoiceTerms">Invoice payment terms, days</label><input class="input" type="number" min="1" max="60" id="invoiceTerms" name="invoiceTerms" value="${s.invoiceTerms || 14}" required></div>
          </div>`)}

        ${section('automations', 'Automations', 'Each rule only creates tasks or records for a person to check. None of them finalise notes, confirm services, send anything or submit claims.', html`
          <div>${AWY.automations.definitions.map((d) => html`<label class="switch-row"><span>${d.label}</span><input type="checkbox" name="auto_${d.key}" ${raw(automations[d.key] !== false ? 'checked' : '')} style="width:1.2rem;height:1.2rem;accent-color:var(--color-deep);flex:none"></label>`)}</div>`)}

        ${section('templates', 'Agreement templates', 'Starting text for new service agreements. To be reviewed against the practice\'s real terms.', html`
          ${C.options('agreementTemplate').map((o) => html`<fieldset class="field"><legend>${o.label}</legend>
            <div class="form-grid">
              <div class="field span-all"><label for="tc_${o.value}">Conditions</label><textarea class="textarea" id="tc_${o.value}" name="tc_${o.value}" rows="3">${(templates[o.value] || {}).conditions || ''}</textarea></div>
              <div class="field span-all"><label for="tx_${o.value}">Cancellation terms</label><textarea class="textarea" id="tx_${o.value}" name="tx_${o.value}" rows="2">${(templates[o.value] || {}).cancellation || ''}</textarea></div>
            </div>
          </fieldset>`)}`)}

        <section class="panel settings-section">
          <div class="panel-head"><h2>Clinical templates</h2></div>
          <div class="panel-body">
            <p>Clinical note, assessment and report templates are drafts. They need to be reviewed and approved by the therapist before the live system is used with real clients.</p>
            <ul class="rows" style="margin-top:0.75rem;border:var(--border);border-radius:var(--radius-sm)">
              ${C.options('noteTemplate').concat(C.options('reportType')).map((o) => html`<li><div class="what">${o.label}</div><div class="end"><span class="badge tone-warning">${icon('edit')}Draft, to review</span></div></li>`)}
            </ul>
          </div>
        </section>

        <section class="panel settings-section">
          <div class="panel-head"><h2>Demo data</h2></div>
          <div class="panel-body stack">
            <p>Sample records were created on ${fmt.stamp(store.seededAt())}. Changes are saved in this browser only. Resetting restores the original sample records and clears anything entered while testing, including enquiries from the website.</p>
            <div class="btn-row">
              <button type="button" class="btn btn-secondary" data-action="reset">${icon('refresh')}Reset demo data</button>
              <button type="button" class="btn btn-quiet" data-export>${icon('download')}Download the demo data</button>
            </div>
          </div>
        </section>
      `);

      const el = ctx.el;
      if (!editable) AWY.$$('[data-settings] input, [data-settings] textarea, [data-settings] button', el).forEach((x) => (x.disabled = true));
      AWY.$$('[data-settings]', el).forEach((form) => AWY.validate.live(form));

      el.addEventListener('submit', async (event) => {
        const form = event.target.closest('[data-settings]');
        if (!form) return;
        event.preventDefault();
        const result = AWY.validate.form(form);
        if (!result.valid) return;
        const v = result.values;
        const kind = form.dataset.settings;
        let patch = {};
        if (kind === 'business') patch = { business: Object.assign({}, b, v) };
        if (kind === 'funding') patch = { acceptedFunding: AWY.$$('input[name="acceptedFunding"]:checked', form).map((i) => i.value) };
        if (kind === 'services') patch = { services: AWY.$$('input[name="services"]:checked', form).map((i) => i.value) };
        if (kind === 'appointments') {
          const d = {};
          C.options('appointmentType').forEach((o) => (d[o.value] = Number(v['dur_' + o.value])));
          patch = { durations: d, dayStart: v.dayStart, dayEnd: v.dayEnd, travelBuffer: Number(v.travelBuffer) || 0, invoiceTerms: Number(v.invoiceTerms) || 14 };
        }
        if (kind === 'automations') {
          const a = {};
          AWY.automations.definitions.forEach((d) => (a[d.key] = !!form.elements['auto_' + d.key].checked));
          patch = { automations: a };
        }
        if (kind === 'templates') {
          const t = {};
          C.options('agreementTemplate').forEach((o) => (t[o.value] = { conditions: v['tc_' + o.value], cancellation: v['tx_' + o.value] }));
          patch = { agreementTemplates: t };
        }
        await AWY.ui.busy(form.querySelector('[type="submit"]'), () => C.save(store.update('settings', s.id, patch, { summary: 'Updated practice settings: ' + kind }), 'Settings saved.'));
      });

      AWY.on(el, 'click', '[data-export]', async () => {
        const data = await store.snapshot();
        const blob = new Blob([JSON.stringify({ note: 'Fictional demo data from the Allied With You testing platform', exportedAt: AWY.date.now(), tables: data }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'alliedwithyoudemo.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        AWY.ui.toast('Demo data downloaded as a file.');
      });
    }
  };
})();
