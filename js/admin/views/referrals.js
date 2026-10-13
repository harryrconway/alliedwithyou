/* Referrals and intake: track each referral from first contact to a decision. */
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

  A.referralForm = function (existing) {
    const db = AWY.app.db;
    C.openForm({
      title: existing ? 'Edit referral' : 'New referral',
      subtitle: existing ? 'Referral ' + existing.ref : 'For referrals taken by phone or email. Use made up details only.',
      fields: schema.tables.referrals.fields,
      values: existing || { receivedDate: D.today(), status: 'new', state: 'NSW', assignedTo: access.user().id },
      db: db,
      size: 'wide',
      async onSubmit(values) {
        if (existing) {
          await store.update('referrals', existing.id, values);
          AWY.ui.toast('Referral updated.');
        } else {
          const rec = await store.create('referrals', Object.assign(values, { kind: 'referral', createdVia: 'dashboard', clientId: null }));
          AWY.ui.toast('Referral added. A follow up task was created.');
          AWY.router.go(['referrals', rec.id]);
        }
      }
    });
  };

  /* Turns a referral into a client record, carrying the details across */
  A.convertReferral = function (r) {
    const db = AWY.app.db;
    const sourceLabel = C.label('referralSource', r.source);
    const prefill = {
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      email: r.email,
      suburb: r.suburb,
      state: r.state || 'NSW',
      fundingType: r.fundingType,
      ndisNumber: r.ndisNumber,
      status: 'active',
      startDate: D.today(),
      therapistId: r.assignedTo && db.staff.find((s) => s.id === r.assignedTo && (s.role === 'owner' || s.role === 'therapist')) ? r.assignedTo : '',
      referralSource: r.referrerName ? r.referrerName + (r.referrerOrg ? ', ' + r.referrerOrg : '') : sourceLabel,
      background: r.reason
    };
    A.clientForm(null, prefill, async (client) => {
      await store.update('referrals', r.id, { status: 'accepted', clientId: client.id, nextAction: '', nextActionDate: '' }, { summary: 'Accepted referral and created client record for ' + rules.clientName(client) });
      const kind = r.source === 'coordinator' ? 'coordinator' : r.source === 'planmanager' ? 'planmanager' : r.source === 'gp' ? 'gp' : r.source === 'family' ? 'family' : '';
      if (kind && r.referrerName) {
        await store.create('contacts', {
          clientId: client.id, name: r.referrerName, kind: kind, relationship: r.referrerOrg && kind === 'family' ? r.referrerOrg : sourceLabel,
          organisation: kind === 'family' ? '' : r.referrerOrg, phone: r.referrerPhone, email: r.referrerEmail, isPrimary: kind === 'family', canDiscuss: false
        });
      }
      AWY.ui.toast('Referral accepted. Record consent before discussing care with the referrer.');
      AWY.router.go(['clients', client.id]);
    });
  };

  const STAGES = Object.keys(schema.statuses.referral);

  AWY.views.referrals = {
    title: 'Referrals and intake',
    render(ctx) {
      const { db, state, today } = ctx;
      if (state.stage === undefined) state.stage = ctx.query.stage || 'open';
      if (state.sort === undefined) state.sort = '-received';
      const openStages = ['new', 'awaiting', 'review', 'waitlisted'];
      const counts = {};
      db.referrals.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
      const seg = [{ value: 'open', label: 'Open', count: db.referrals.filter((r) => openStages.includes(r.status)).length }]
        .concat(STAGES.map((s) => ({ value: s, label: schema.status('referral', s).label, count: counts[s] || 0 })))
        .concat([{ value: 'all', label: 'All', count: db.referrals.length }]);

      const rows = db.referrals.filter((r) =>
        (state.stage === 'all' || (state.stage === 'open' ? openStages.includes(r.status) : r.status === state.stage)) &&
        (!state.source || r.source === state.source) &&
        C.matches(r, state.q, [(x) => x.firstName + ' ' + x.lastName, 'referrerName', 'referrerOrg', 'suburb', 'ref'])
      );

      const columns = [
        { key: 'name', label: 'Person referred', sortValue: (r) => r.lastName, render: (r) => html`${r.firstName} ${r.lastName}<span class="sub">${r.suburb}${r.state ? ' ' + r.state : ''}${r.createdVia === 'website' ? ', from the website' : ''}</span>` },
        { key: 'source', label: 'Referred by', sortValue: (r) => C.label('referralSource', r.source), render: (r) => html`${C.label('referralSource', r.source)}${r.referrerName ? html`<span class="sub">${r.referrerName}</span>` : ''}` },
        { key: 'service', label: 'Service', sortValue: (r) => C.label('service', r.service), render: (r) => C.label('service', r.service) },
        { key: 'funding', label: 'Funding', render: (r) => (r.fundingType ? C.label('fundingType', r.fundingType) : html`<span class="muted">Not given</span>`) },
        { key: 'received', label: 'Received', sortValue: (r) => r.receivedDate, render: (r) => html`${fmt.date(r.receivedDate)}<span class="sub">${fmt.relative(r.receivedDate)}</span>` },
        { key: 'next', label: 'Next action', sortValue: (r) => r.nextActionDate || '9999', render: (r) => (r.nextAction ? html`${r.nextAction}<span class="sub">${r.nextActionDate ? html`Due ${C.due(r.nextActionDate, today)}` : ''}</span>` : html`<span class="muted">None</span>`) },
        { key: 'stage', label: 'Stage', sortValue: (r) => STAGES.indexOf(r.status), render: (r) => C.badge('referral', r.status) }
      ];

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Referrals and intake',
          subtitle: 'Website enquiries and referrals from GPs, coordinators and families land here.',
          actions: access.can('manageReferrals') ? html`<button type="button" class="btn" data-new-referral>${icon('plus')}New referral</button>` : ''
        })}
        ${C.seg('stage', seg, state.stage)}
        <div class="toolbar">
          ${C.search(state.q, 'Search by name, referrer or suburb')}
          ${C.select('source', 'Source', C.options('referralSource'), state.source)}
        </div>
        <p class="result-count" aria-live="polite">${fmt.plural(rows.length, 'referral')}</p>
        ${C.table({ columns, rows, sort: state.sort, caption: 'Referrals', rowHref: (r) => '#/referrals/' + r.id, empty: C.empty({ icon: 'inbox', title: 'No referrals here', text: 'Try another stage or search.' }) })}
      `);
      C.bindFilters(ctx);
      C.bindRows(ctx.el);
      AWY.on(ctx.el, 'click', '[data-new-referral]', () => A.referralForm(null));
    }
  };

  AWY.views.referral = {
    title: (ctx) => {
      const r = ctx.db.referrals.find((x) => x.id === ctx.params.id);
      return r ? 'Referral for ' + r.firstName + ' ' + r.lastName : 'Referral';
    },
    render(ctx) {
      const { db, today } = ctx;
      const r = db.referrals.find((x) => x.id === ctx.params.id);
      if (!r) {
        ctx.el.innerHTML = String(html`${C.pageHead({ title: 'Referral not found', back: { href: '#/referrals', label: 'Referrals' } })}<p>It may have been deleted, or the demo data was reset.</p>`);
        return;
      }
      const manage = access.can('manageReferrals');
      const tasks = db.tasks.filter((t) => t.relatedId === r.id);
      const events = db.auditEvents.filter((e) => e.recordId === r.id).sort((a, b) => b.at.localeCompare(a.at));
      const agencyManaged = r.fundingType === 'ndis_agency';
      const converted = !!r.clientId;

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          back: { href: '#/referrals', label: 'Referrals' },
          title: r.firstName + ' ' + r.lastName,
          subtitle: 'Referral ' + r.ref + ', received ' + fmt.dateFull(r.receivedDate) + (r.createdVia === 'website' ? ' through the website' : ''),
          actions: manage ? html`
            <button type="button" class="btn btn-secondary" data-edit-referral>${icon('edit')}Edit</button>
            ${!converted && r.status !== 'closed' ? html`<button type="button" class="btn" data-convert>${icon('userPlus')}Accept and create client</button>` : ''}
            ${converted ? html`<a class="btn" href="#/clients/${r.clientId}">${icon('user')}Open client record</a>` : ''}` : ''
        })}
        ${agencyManaged ? html`<div class="notice notice-warning" style="margin-bottom:1.25rem">${icon('alert')}<div><strong>NDIA managed plan</strong>The practice isn't set up to see NDIA managed participants. Consider closing this referral and suggesting a registered provider.</div></div>` : ''}
        ${r.kind === 'enquiry' ? html`<div class="notice" style="margin-bottom:1.25rem">${icon('message')}<div><strong>General enquiry from the website</strong>${r.preferredContact ? 'Prefers to be contacted by ' + r.preferredContact + '. ' : ''}Nothing was emailed to the practice. It only exists in the demo data.</div></div>` : ''}
        <div class="columns side">
          <div class="stack-panels">
            <section class="panel"><div class="panel-head"><h2>Referral details</h2>${C.badge('referral', r.status)}</div>
              <div class="panel-body">${C.kv([
                ['Reason', r.reason],
                ['Service requested', C.label('service', r.service)],
                ['Funding', r.fundingType ? C.label('fundingType', r.fundingType) : 'Not given'],
                ['NDIS number', r.ndisNumber],
                ['Person\'s phone', r.phone],
                ['Person\'s email', r.email],
                ['Suburb', r.suburb + (r.state ? ' ' + r.state : '')],
                ['Agreed to be contacted', r.consentToContact ? 'Yes, confirmed by the referrer' : 'Not confirmed'],
                ['Intake notes', r.notes]
              ])}</div>
            </section>
            <section class="panel"><div class="panel-head"><h2>Referrer</h2></div>
              <div class="panel-body">${C.kv([
                ['Source', C.label('referralSource', r.source)],
                ['Name', r.referrerName],
                ['Organisation', r.referrerOrg],
                ['Phone', r.referrerPhone],
                ['Email', r.referrerEmail]
              ])}</div>
            </section>
            <section class="panel"><div class="panel-head"><h2>History</h2></div>
              <div class="panel-body">${events.length ? html`<ol class="timeline">${events.map((e) => html`<li><div>${e.summary}</div><div class="meta">${fmt.stamp(e.at)} by ${rules.staffName(db, e.actorId)}</div></li>`)}</ol>` : html`<p class="muted">No changes yet.</p>`}</div>
            </section>
          </div>
          <div class="stack-panels">
            ${manage ? html`<section class="panel"><div class="panel-head"><h2>Move to another stage</h2></div>
              <div class="panel-body">
                <form class="form" id="stageForm" novalidate>
                  <div class="field"><label for="stageSelect">Stage</label>
                    <select class="select" id="stageSelect" name="status">${STAGES.map((s) => html`<option value="${s}" ${raw(s === r.status ? 'selected' : '')}>${schema.status('referral', s).label}</option>`)}</select>
                  </div>
                  <div class="field"><label for="nextAction">Next action <span class="optional">(optional)</span></label><input class="input" id="nextAction" name="nextAction" value="${r.nextAction || ''}"></div>
                  <div class="field"><label for="nextActionDate">Due <span class="optional">(optional)</span></label><input class="input" type="date" id="nextActionDate" name="nextActionDate" value="${r.nextActionDate || ''}"></div>
                  <div class="field"><label for="assignedTo">Assigned to</label>
                    <select class="select" id="assignedTo" name="assignedTo"><option value="">Nobody yet</option>${C.staffOptions(db).map((o) => html`<option value="${o.value}" ${raw(o.value === r.assignedTo ? 'selected' : '')}>${o.label}</option>`)}</select>
                  </div>
                  <button type="submit" class="btn btn-secondary">Save stage</button>
                </form>
              </div>
            </section>` : ''}
            <section class="panel"><div class="panel-head"><h2>Related tasks</h2></div>
              ${tasks.length ? html`<ul class="rows">${tasks.map((t) => A.taskRow(db, t, today))}</ul>` : html`<div class="panel-body"><p class="muted">No tasks linked to this referral.</p></div>`}
            </section>
            ${access.can('deleteRecords') ? html`<button type="button" class="btn btn-danger" data-delete-referral>${icon('trash')}Delete referral</button>` : ''}
          </div>
        </div>
      `);

      const el = ctx.el;
      A.bindCommon(ctx);
      AWY.on(el, 'click', '[data-edit-referral]', () => A.referralForm(r));
      AWY.on(el, 'click', '[data-convert]', () => A.convertReferral(r));
      AWY.on(el, 'click', '[data-delete-referral]', () => C.confirmDelete({ table: 'referrals', id: r.id, label: 'this referral', after: () => AWY.router.go(['referrals']) }));
      const form = el.querySelector('#stageForm');
      if (form) {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const v = AWY.formValues(form);
          if (v.status === 'accepted' && !converted) {
            AWY.ui.toast('Use Accept and create client so the details carry across.', { tone: 'error' });
            return;
          }
          await AWY.ui.busy(form.querySelector('button'), () => C.save(store.update('referrals', r.id, v), 'Referral stage saved.'));
        });
      }
    }
  };
})();
