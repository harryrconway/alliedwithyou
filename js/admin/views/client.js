/* Client profile: everything about one client, organised into tabs. */
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

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'details', label: 'Details and contacts' },
    { key: 'appointments', label: 'Appointments', section: 'calendar' },
    { key: 'notes', label: 'Clinical notes', section: 'notes' },
    { key: 'assessments', label: 'Assessments', section: 'assessments' },
    { key: 'goals', label: 'Goals', section: 'goals' },
    { key: 'reports', label: 'Reports', section: 'reports', clinical: true },
    { key: 'records', label: 'Consent and documents', section: 'documents' },
    { key: 'funding', label: 'Funding and billing', section: 'funding' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'history', label: 'History' }
  ];

  function panel(title, body, action) {
    return html`<section class="panel">
      <div class="panel-head"><h2>${title}</h2>${action || ''}</div>
      ${body}
    </section>`;
  }

  function goalBlock(db, g, withActions) {
    const latest = rules.goalLatest(db, g);
    const pct = latest !== '' && latest !== undefined ? latest : 0;
    return html`<li>
      <div class="what">
        <strong>${g.description}</strong>
        <div class="meta"><span>${C.label('goalArea', g.area)}</span><span>Review ${fmt.date(g.reviewDate)}</span>${C.badge('goal', g.status)}</div>
        <div style="margin-top:0.5rem;max-width:26rem">${C.meter({ value: pct, max: 10, target: g.target, left: 'Now ' + (latest === '' || latest === undefined ? 'not rated' : latest + ' of 10'), right: 'Target ' + (g.target === '' ? 'not set' : g.target), label: 'Rated ' + pct + ' out of 10, target ' + g.target })}</div>
      </div>
      ${withActions ? html`<div class="end"><button type="button" class="btn btn-quiet btn-sm" data-goal="${g.id}">Open</button></div>` : ''}
    </li>`;
  }

  function apptList(db, list, empty) {
    if (!list.length) return html`<div class="panel-body">${C.empty({ icon: 'calendar', title: empty })}</div>`;
    return html`<ul class="rows">${list.map((a) => {
      const note = rules.noteFor(db, a.id);
      return html`<li>
        <div class="when">${fmt.dateDay(a.date)}<small>${fmt.time(a.start)}</small></div>
        <div class="what">
          <button type="button" class="btn-quiet" style="all:unset;cursor:pointer;font-weight:680;color:var(--color-text)" data-appt="${a.id}">${C.label('appointmentType', a.type)}</button>
          <div class="meta"><span>${rules.staffName(db, a.staffId)}</span><span>${C.label('location', a.location)}</span>${a.status === 'completed' && access.can('clinical') ? html`<span>${note ? C.badge('note', note.status, note.status === 'final' ? 'Note finalised' : 'Note in draft') : html`<span style="color:var(--color-warning);font-weight:680">No note</span>`}</span>` : ''}</div>
        </div>
        <div class="end">${C.badge('appointment', a.status)}<button type="button" class="btn btn-quiet btn-sm" data-appt="${a.id}">Open</button></div>
      </li>`;
    })}</ul>`;
  }

  function overview(ctx, c) {
    const { db, today } = ctx;
    const goals = db.goals.filter((g) => g.clientId === c.id && (g.status === 'active' || g.status === 'planned'));
    const notes = db.notes.filter((n) => n.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const lastNote = notes[0];
    const appts = db.appointments.filter((a) => a.clientId === c.id);
    const upcoming = appts.filter((a) => rules.isLive(a) && a.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 3);
    const recent = appts.filter((a) => a.date < today || a.status === 'completed').sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)).slice(0, 3);
    const contacts = db.contacts.filter((x) => x.clientId === c.id);
    const tasks = db.tasks.filter((t) => t.clientId === c.id && t.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const plan = rules.activePlan(db, c.id, today);
    const usage = plan ? rules.planUsage(db, plan) : null;
    const clinical = access.can('clinical');

    const left = html`
      ${clinical ? panel('Current goals', goals.length ? html`<ul class="rows">${goals.map((g) => goalBlock(db, g, false))}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'target', title: 'No current goals' })}</div>`, html`<a class="btn btn-quiet btn-sm" href="#/clients/${c.id}/goals">All goals</a>`) : ''}
      ${clinical && lastNote ? panel('Latest clinical note', html`<div class="panel-body stack">
          <p class="muted small">${fmt.dateLong(lastNote.date)}, ${C.label('noteTemplate', lastNote.template).toLowerCase()} by ${rules.staffName(db, lastNote.authorId)} ${C.badge('note', lastNote.status)}</p>
          <p><strong>Progress:</strong> ${lastNote.progress}</p>
          <p><strong>Next steps:</strong> ${lastNote.plan}</p>
        </div>`, html`<a class="btn btn-quiet btn-sm" href="#/notes/${lastNote.id}">Open note</a>`) : ''}
      ${panel('Coming up', apptList(db, upcoming, 'Nothing booked'), html`<button type="button" class="btn btn-quiet btn-sm" data-new-appt data-client="${c.id}">${icon('plus')}Book</button>`)}
      ${panel('Recent appointments', apptList(db, recent, 'No appointments yet'), html`<a class="btn btn-quiet btn-sm" href="#/clients/${c.id}/appointments">All appointments</a>`)}`;

    const right = html`
      ${c.alerts ? html`<div class="notice notice-warning">${icon('alert')}<div><strong>Visit alerts</strong>${c.alerts}</div></div>` : ''}
      ${panel('Contacts', contacts.length ? html`<ul class="rows">${contacts.map((x) => html`<li><span class="avatar" aria-hidden="true">${fmt.initials(x.name)}</span><div class="what"><strong>${x.name}</strong><div class="meta"><span>${x.relationship}${x.organisation ? ', ' + x.organisation : ''}</span>${x.phone ? html`<span>${icon('phone')}${x.phone}</span>` : ''}${x.isPrimary ? html`<span class="tag">Main contact</span>` : ''}</div></div></li>`)}</ul>` : html`<div class="panel-body"><p class="muted">No contacts recorded.</p></div>`, html`<a class="btn btn-quiet btn-sm" href="#/clients/${c.id}/details">Manage</a>`)}
      ${panel('Open tasks', tasks.length ? html`<ul class="rows">${tasks.map((t) => A.taskRow(db, t, today))}</ul>` : html`<div class="panel-body"><p class="muted">No open tasks.</p></div>`, html`<button type="button" class="btn btn-quiet btn-sm" data-new-task data-client="${c.id}">${icon('plus')}Add</button>`)}
      ${access.canSee('funding') ? panel('Funding', plan ? html`<div class="panel-body stack">
          <p><strong>${plan.name}</strong><br><span class="muted small">${fmt.date(plan.startDate)} to ${fmt.date(plan.endDate)}${plan.managedBy ? ', ' + plan.managedBy : ''}</span></p>
          ${usage.budget ? C.meter({ value: usage.used, max: usage.budget, tone: usage.percent >= 85 ? 'warning' : '', left: fmt.money(usage.used) + ' used', right: fmt.money(usage.remaining) + ' left' }) : ''}
          ${usage.sessionsAllowed ? C.meter({ value: usage.sessions, max: usage.sessionsAllowed, tone: usage.sessions >= usage.sessionsAllowed ? 'warning' : '', left: usage.sessions + ' sessions used', right: 'of ' + usage.sessionsAllowed }) : ''}
        </div>` : html`<div class="panel-body"><p class="muted">${C.label('fundingType', c.fundingType)}. No funding plan needed.</p></div>`, html`<a class="btn btn-quiet btn-sm" href="#/clients/${c.id}/funding">Details</a>`) : ''}`;

    return html`<div class="columns"><div class="stack-panels">${left}</div><div class="stack-panels">${right}</div></div>`;
  }

  function details(ctx, c) {
    const { db } = ctx;
    const referral = db.referrals.find((r) => r.clientId === c.id);
    const contacts = db.contacts.filter((x) => x.clientId === c.id);
    const canEdit = access.can('editClients');
    return html`<div class="columns even">
      <div class="stack-panels">
        ${panel('Personal details', html`<div class="panel-body">${C.kv([
          ['Full name', c.firstName + ' ' + c.lastName],
          ['Preferred name', c.preferredName],
          ['Date of birth', c.dob ? fmt.dateFull(c.dob) + ' (' + fmt.age(c.dob) + ' years)' : ''],
          ['Phone', c.phone],
          ['Email', c.email],
          ['Address', [c.address, c.suburb + ' ' + c.state + ' ' + c.postcode].filter(Boolean).join(', ')],
          ['Communication', c.communication],
          ['NDIS number', c.ndisNumber]
        ])}</div>`, canEdit ? html`<button type="button" class="btn btn-quiet btn-sm" data-edit-client>${icon('edit')}Edit</button>` : '')}
        ${panel('Contacts and representatives', html`${contacts.length ? html`<ul class="rows">${contacts.map((x) => html`<li>
            <div class="what"><strong>${x.name}</strong>
              <div class="meta"><span>${C.label('contactKind', x.kind)}: ${x.relationship}</span>${x.organisation ? html`<span>${x.organisation}</span>` : ''}${x.phone ? html`<span>${icon('phone')}${x.phone}</span>` : ''}${x.email ? html`<span>${icon('mail')}${x.email}</span>` : ''}</div>
              <div class="meta" style="margin-top:0.25rem">${x.isPrimary ? html`<span class="tag">Main contact</span>` : ''}${x.canDiscuss ? html`<span class="tag" style="background:var(--color-success-bg);color:var(--color-success)">${icon('check')}Can discuss care</span>` : html`<span class="tag" style="background:var(--color-neutral-bg);color:var(--color-neutral)">${icon('lock')}No consent to discuss care</span>`}</div>
            </div>
            ${canEdit ? html`<div class="end"><button type="button" class="btn btn-quiet btn-sm" data-edit-contact="${x.id}">Edit</button></div>` : ''}
          </li>`)}</ul>` : html`<div class="panel-body"><p class="muted">No contacts recorded.</p></div>`}`, canEdit ? html`<button type="button" class="btn btn-quiet btn-sm" data-new-contact>${icon('plus')}Add contact</button>` : '')}
      </div>
      <div class="stack-panels">
        ${panel('Intake and background', html`<div class="panel-body">${C.kv([
          ['Client since', c.startDate ? fmt.dateFull(c.startDate) : ''],
          ['Referred by', c.referralSource],
          ['Referral record', referral && access.canSee('referrals') ? html`<a href="#/referrals/${referral.id}">Referral ${referral.ref}, received ${fmt.date(referral.receivedDate)}</a>` : ''],
          ['Background', c.background],
          ['Living situation', c.livingSituation],
          ['Relevant health information', access.can('clinical') || access.role() === 'admin' ? c.health : ''],
          ['Visit alerts', c.alerts]
        ])}</div>`)}
      </div>
    </div>`;
  }

  function appointmentsTab(ctx, c) {
    const { db } = ctx;
    const list = db.appointments.filter((a) => a.clientId === c.id).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
    return panel('All appointments', apptList(db, list, 'No appointments yet'), html`<button type="button" class="btn btn-sm" data-new-appt data-client="${c.id}">${icon('plus')}New appointment</button>`);
  }

  function notesTab(ctx, c) {
    const { db, today } = ctx;
    const notes = db.notes.filter((n) => n.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const missing = rules.notesOutstanding(db, today).filter((x) => x.appointment.clientId === c.id && !x.note);
    return html`
      ${missing.length ? html`<div class="notice notice-warning" style="margin-bottom:1rem">${icon('note')}<div><strong>${fmt.plural(missing.length, 'completed session')} without a note</strong>${missing.map((x) => html`<span style="display:block">${fmt.dateDay(x.appointment.date)}, ${C.label('appointmentType', x.appointment.type).toLowerCase()} <a href="#/notes/new?appointment=${x.appointment.id}">Write note</a></span>`)}</div></div>` : ''}
      ${panel('Clinical notes', notes.length ? html`<ul class="rows">${notes.map((n) => html`<li>
          <div class="when">${fmt.dateDay(n.date)}<small>${n.date.slice(0, 4)}</small></div>
          <div class="what"><a href="#/notes/${n.id}">${C.label('noteTemplate', n.template)}</a>
            <div class="meta"><span>${rules.staffName(db, n.authorId)}</span><span>${n.reason}</span>${(n.amendments || []).length ? html`<span class="tag">${fmt.plural(n.amendments.length, 'correction')}</span>` : ''}</div>
          </div>
          <div class="end">${C.badge('note', n.status)}</div>
        </li>`)}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'note', title: 'No notes yet' })}</div>`, html`<a class="btn btn-sm" href="#/notes/new?client=${c.id}">${icon('plus')}New note</a>`)}`;
  }

  function assessmentsTab(ctx, c) {
    const { db } = ctx;
    const list = db.assessments.filter((a) => a.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    return panel('Assessments', list.length ? html`<ul class="rows">${list.map((a) => html`<li>
        <div class="when">${fmt.dateDay(a.date)}<small>${a.date.slice(0, 4)}</small></div>
        <div class="what"><button type="button" style="all:unset;cursor:pointer;font-weight:680" data-assessment="${a.id}">${C.label('assessmentType', a.type)}</button>
          <div class="meta"><span>${rules.staffName(db, a.assessorId)}</span>${(a.methods || []).length ? html`<span>${a.methods.map((m) => C.label('assessmentMethod', m)).join(', ')}</span>` : ''}</div>
          ${a.findings ? html`<p class="small" style="margin-top:0.35rem">${a.findings}</p>` : ''}
        </div>
        <div class="end">${C.badge('assessment', a.status)}<button type="button" class="btn btn-quiet btn-sm" data-assessment="${a.id}">Open</button></div>
      </li>`)}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'clipboard', title: 'No assessments yet' })}</div>`,
      access.can('assess') ? html`<button type="button" class="btn btn-sm" data-new-assessment="${c.id}">${icon('plus')}New assessment</button>` : '');
  }

  function goalsTab(ctx, c) {
    const { db } = ctx;
    const goals = db.goals.filter((g) => g.clientId === c.id);
    const order = { active: 0, planned: 1, achieved: 2, discontinued: 3 };
    goals.sort((a, b) => order[a.status] - order[b.status]);
    return panel('Goals and progress', goals.length ? html`<ul class="rows">${goals.map((g) => goalBlock(db, g, true))}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'target', title: 'No goals yet' })}</div>`,
      html`<button type="button" class="btn btn-sm" data-new-goal="${c.id}">${icon('plus')}New goal</button>`);
  }

  function reportsTab(ctx, c) {
    const { db, today } = ctx;
    const list = db.reports.filter((r) => r.clientId === c.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    return panel('Reports', list.length ? html`<ul class="rows">${list.map((r) => html`<li>
        <div class="what"><a href="#/reports/${r.id}">${r.title}</a>
          <div class="meta"><span>${rules.staffName(db, r.authorId)}</span><span>Due ${C.due(r.dueDate, today, r.status === 'completed' || r.status === 'delivered')}</span>${r.recipient ? html`<span>For ${r.recipient}</span>` : ''}</div>
        </div>
        <div class="end">${C.badge('report', r.status)}</div>
      </li>`)}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'report', title: 'No reports yet' })}</div>`,
      access.can('assess') ? html`<button type="button" class="btn btn-sm" data-new-report="${c.id}">${icon('plus')}New report</button>` : '');
  }

  function recordsTab(ctx, c) {
    const { db, today } = ctx;
    const consents = db.consents.filter((x) => x.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const agreements = db.agreements.filter((x) => x.clientId === c.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const docs = db.documents.filter((x) => x.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    return html`<div class="stack-panels">
      ${panel('Consent records', consents.length ? html`<ul class="rows">${consents.map((x) => html`<li>
          <div class="what"><strong>${C.label('consentType', x.type)}</strong>
            <div class="meta"><span>Given by ${x.givenBy}</span><span>${C.label('consentMethod', x.method)}, ${fmt.date(x.date)}</span>${x.expiryDate ? html`<span>Review ${fmt.date(x.expiryDate)}</span>` : ''}</div>
            ${x.limitations ? html`<p class="small" style="margin-top:0.3rem"><strong>Limits:</strong> ${x.limitations}</p>` : ''}
            ${x.status === 'withdrawn' ? html`<p class="small" style="margin-top:0.3rem;color:var(--color-danger)"><strong>Withdrawn ${x.withdrawnDate ? fmt.date(x.withdrawnDate) : ''}:</strong> ${x.withdrawnNote}</p>` : ''}
          </div>
          <div class="end">${C.badge('consent', rules.consentStatus(x, today))}<button type="button" class="btn btn-quiet btn-sm" data-consent="${x.id}">Edit</button></div>
        </li>`)}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'shield', title: 'No consent recorded', text: 'Record consent before the first appointment.' })}</div>`,
        html`<button type="button" class="btn btn-sm" data-new-consent="${c.id}">${icon('plus')}Record consent</button>`)}
      ${access.canSee('agreements') ? panel('Service agreements', agreements.length ? html`<ul class="rows">${agreements.map((a) => html`<li>
          <div class="what"><a href="#/agreements/${a.id}">Agreement ${a.ref}, ${C.label('agreementTemplate', a.template).toLowerCase()}</a>
            <div class="meta"><span>${fmt.date(a.startDate)} to ${fmt.date(a.endDate)}</span>${a.signedDate ? html`<span>Signed ${fmt.date(a.signedDate)}</span>` : a.sentDate ? html`<span>Waiting since ${fmt.date(a.sentDate)}</span>` : ''}</div>
          </div>
          <div class="end">${C.badge('agreement', rules.agreementStatus(a, today))}</div>
        </li>`)}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'signature', title: 'No service agreement yet' })}</div>`,
        access.can('agreements') ? html`<button type="button" class="btn btn-sm" data-new-agreement="${c.id}">${icon('plus')}New agreement</button>` : '') : ''}
      ${panel('Documents', AWY.views.documents.docRows(db, docs, false), html`<button type="button" class="btn btn-sm" data-new-document="${c.id}">${icon('upload')}Add document</button>`)}
    </div>`;
  }

  function fundingTab(ctx, c) {
    const { db, today } = ctx;
    const plans = db.fundingPlans.filter((p) => p.clientId === c.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const logs = db.supportLogs.filter((l) => l.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const invoices = db.invoices.filter((i) => i.clientId === c.id).sort((a, b) => b.number - a.number);
    const ready = logs.filter((l) => l.status === 'verified' && !l.invoiceId);
    const billing = access.can('billing');
    return html`<div class="stack-panels">
      ${panel('Funding plans', plans.length ? html`<ul class="rows">${plans.map((p) => {
          const u = rules.planUsage(db, p);
          return html`<li><div class="what"><strong>${p.name}</strong>
            <div class="meta"><span>${C.label('fundingType', p.fundingType)}</span><span>${fmt.date(p.startDate)} to ${fmt.date(p.endDate)}</span>${p.managedBy ? html`<span>${p.managedBy}</span>` : ''}</div>
            <div style="margin-top:0.5rem;max-width:28rem">
              ${u.budget ? C.meter({ value: u.used, max: u.budget, tone: u.percent >= 85 ? 'warning' : '', left: fmt.money(u.used) + ' used of ' + fmt.money(u.budget), right: fmt.money(u.remaining) + ' left' }) : ''}
              ${u.sessionsAllowed ? C.meter({ value: u.sessions, max: u.sessionsAllowed, left: u.sessions + ' of ' + u.sessionsAllowed + ' Medicare sessions used', right: '' }) : ''}
            </div></div>
            <div class="end">${C.badge('plan', rules.planStatus(p, today))}<button type="button" class="btn btn-quiet btn-sm" data-plan="${p.id}">Edit</button></div></li>`;
        })}</ul>` : html`<div class="panel-body"><p class="muted">${C.label('fundingType', c.fundingType)}. No funding plan recorded.</p></div>`,
        html`<button type="button" class="btn btn-sm" data-new-plan="${c.id}">${icon('plus')}Add plan</button>`)}
      ${panel('Delivered services', AWY.views.funding.logTable(db, logs, false), billing && ready.length ? html`<button type="button" class="btn btn-sm" data-draft-invoice="${c.id}">${icon('receipt')}Create draft invoice from ${fmt.plural(ready.length, 'verified service')}</button>` : html`<a class="btn btn-quiet btn-sm" href="#/funding/services">All services</a>`)}
      ${billing ? panel('Invoices', invoices.length ? html`<ul class="rows">${invoices.map((i) => html`<li>
          <div class="what"><a href="#/invoices/${i.id}">Invoice ${i.number}</a><div class="meta"><span>Issued ${fmt.date(i.issueDate)}</span><span>Due ${fmt.date(i.dueDate)}</span><span>To ${i.billToName}</span></div></div>
          <div class="end"><strong>${fmt.money(rules.invoiceTotal(db, i))}</strong>${C.badge('invoice', rules.invoiceStatus(i, today))}</div>
        </li>`)}</ul>` : html`<div class="panel-body"><p class="muted">No invoices yet.</p></div>`) : ''}
    </div>`;
  }

  function tasksTab(ctx, c) {
    const { db, today } = ctx;
    const tasks = db.tasks.filter((t) => t.clientId === c.id).sort((a, b) => (a.status === b.status ? a.dueDate.localeCompare(b.dueDate) : a.status === 'open' ? -1 : 1));
    return panel('Tasks', tasks.length ? html`<ul class="rows">${tasks.map((t) => A.taskRow(db, t, today))}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'tasks', title: 'No tasks for this client' })}</div>`,
      html`<button type="button" class="btn btn-sm" data-new-task data-client="${c.id}">${icon('plus')}New task</button>`);
  }

  function historyTab(ctx, c) {
    const { db } = ctx;
    const events = db.auditEvents.filter((e) => e.clientId === c.id).sort((a, b) => b.at.localeCompare(a.at));
    return panel('History of changes', html`<div class="panel-body">
      <p class="small muted" style="margin-bottom:1rem">Every change to this client's records is logged with who made it and when. In the live system this history will be stored securely and can't be edited.</p>
      ${events.length ? html`<ol class="timeline">${events.map((e) => html`<li><div>${e.summary}</div><div class="meta">${fmt.stamp(e.at)} by ${rules.staffName(db, e.actorId)}${e.fields && e.fields.length ? ', changed ' + e.fields.join(', ').toLowerCase() : ''}</div></li>`)}</ol>` : C.empty({ icon: 'history', title: 'No changes recorded yet' })}
    </div>`);
  }

  AWY.views.client = {
    title: (ctx) => {
      const c = rules.client(ctx.db, ctx.params.id);
      return c ? rules.clientName(c) : 'Client';
    },
    render(ctx) {
      const { db, today, params } = ctx;
      const c = rules.client(db, params.id);
      if (!c) {
        ctx.el.innerHTML = String(html`${C.pageHead({ title: 'Client not found', back: { href: '#/clients', label: 'Client records' } })}<p>This client record may have been deleted. <a href="#/clients">Back to client records</a>.</p>`);
        return;
      }
      const tabs = TABS.filter((t) => (!t.section || access.canSee(t.section)) && (!t.clinical || access.can('clinical')));
      const tab = tabs.some((t) => t.key === params.tab) ? params.tab : 'overview';
      const counts = {
        appointments: db.appointments.filter((a) => a.clientId === c.id).length,
        notes: db.notes.filter((n) => n.clientId === c.id).length,
        goals: db.goals.filter((g) => g.clientId === c.id && g.status === 'active').length,
        tasks: db.tasks.filter((t) => t.clientId === c.id && t.status === 'open').length
      };
      const flags = rules.clientFlags(db, c, today);
      const next = rules.nextAppointment(db, c.id, today);
      const agreement = rules.currentAgreement(db, c.id, today);
      const consent = rules.hasTreatmentConsent(db, c.id, today);
      const primary = db.contacts.find((x) => x.clientId === c.id && x.isPrimary);
      const canEdit = access.can('editClients');

      const body = {
        overview, details, appointments: appointmentsTab, notes: notesTab, assessments: assessmentsTab, goals: goalsTab,
        reports: reportsTab, records: recordsTab, funding: fundingTab, tasks: tasksTab, history: historyTab
      }[tab](ctx, c);

      ctx.el.innerHTML = String(html`
        <a class="back-link" href="#/clients">${icon('arrowLeft')}Client records</a>
        <div class="profile-head">
          <span class="avatar lg" aria-hidden="true">${fmt.initials(c.firstName + ' ' + c.lastName)}</span>
          <div class="who">
            <h1>${rules.clientName(c)}${c.preferredName ? html` <span class="muted" style="font-size:var(--text-base);font-weight:500">(${c.firstName} ${c.lastName})</span>` : ''}</h1>
            <p>Client ${c.ref}${c.dob ? ', ' + fmt.age(c.dob) + ' years' : ''}, ${c.suburb} ${c.state}</p>
            <div class="badges">${C.badge('client', c.status)}<span class="badge tone-info">${icon('wallet')}${C.label('fundingType', c.fundingType)}</span></div>
          </div>
          <div class="btn-row">
            ${canEdit ? html`<button type="button" class="btn btn-secondary" data-edit-client>${icon('edit')}Edit details</button>` : ''}
            ${access.canSee('calendar') ? html`<button type="button" class="btn" data-new-appt data-client="${c.id}">${icon('plus')}Book appointment</button>` : ''}
            ${canEdit ? html`<button type="button" class="btn btn-quiet" data-archive>${icon('archive')}${c.status === 'archived' ? 'Restore' : 'Archive'}</button>` : ''}
            ${access.can('deleteClients') ? html`<button type="button" class="btn btn-danger" data-delete-client>${icon('trash')}Delete</button>` : ''}
          </div>
        </div>
        <dl class="facts-row">
          <div><dt>Therapist</dt><dd>${rules.staffName(db, c.therapistId)}</dd></div>
          <div><dt>Next appointment</dt><dd>${next ? html`<button type="button" style="all:unset;cursor:pointer;color:var(--color-blue);text-decoration:underline" data-appt="${next.id}">${fmt.dateDay(next.date)}, ${fmt.time(next.start)}</button>` : 'None booked'}</dd></div>
          <div><dt>Consent</dt><dd>${consent ? html`<span class="yes">${icon('check')}Current</span>` : html`<span style="color:var(--color-danger)">${icon('alertCircle')} Not recorded</span>`}</dd></div>
          <div><dt>Service agreement</dt><dd>${agreement ? html`<span class="yes">${icon('check')}Signed until ${fmt.date(agreement.endDate)}</span>` : html`<span style="color:var(--color-warning)">Not signed</span>`}</dd></div>
          <div><dt>Main contact</dt><dd>${primary ? primary.name + ', ' + primary.relationship.toLowerCase() : c.phone}</dd></div>
        </dl>
        ${flags.length ? html`<div class="flags" aria-label="Things to check">${flags.map((f) => html`<div class="notice notice-${f.tone === 'danger' ? 'danger' : 'warning'}">${icon(f.icon)}<div>${f.text}</div></div>`)}</div>` : ''}
        <div class="tabs-wrap">${C.tabs(tabs.map((t) => ({ key: t.key, label: t.label, href: '#/clients/' + c.id + '/' + t.key, count: counts[t.key] })), tab, 'Client record sections')}</div>
        ${body}
      `);

      const el = ctx.el;
      A.bindCommon(ctx);
      AWY.on(el, 'click', '[data-edit-client]', () => A.clientForm(c));
      AWY.on(el, 'click', '[data-archive]', async () => {
        const restoring = c.status === 'archived';
        const ok = await AWY.ui.confirm({
          title: restoring ? 'Restore this client?' : 'Archive this client?',
          message: restoring ? 'The client will be marked active again.' : 'Archived clients are kept with all their records but hidden from everyday lists. This is the usual way to close a file, because health records need to be kept.',
          confirmLabel: restoring ? 'Restore' : 'Archive'
        });
        if (ok) C.save(store.update('clients', c.id, { status: restoring ? 'active' : 'archived' }), restoring ? 'Client restored.' : 'Client archived.');
      });
      AWY.on(el, 'click', '[data-delete-client]', () => C.confirmDelete({ table: 'clients', id: c.id, label: 'the record for ' + rules.clientName(c), after: () => AWY.router.go(['clients']) }));
      AWY.on(el, 'click', '[data-new-contact]', () => contactForm(db, c, null));
      AWY.on(el, 'click', '[data-edit-contact]', (event, btn) => contactForm(db, c, db.contacts.find((x) => x.id === btn.dataset.editContact)));
      AWY.on(el, 'click', '[data-goal]', (event, btn) => A.openGoal(btn.dataset.goal));
      AWY.on(el, 'click', '[data-new-goal]', (event, btn) => A.goalForm(null, { clientId: btn.dataset.newGoal }));
      AWY.on(el, 'click', '[data-assessment]', (event, btn) => A.assessmentForm(db.assessments.find((x) => x.id === btn.dataset.assessment)));
      AWY.on(el, 'click', '[data-new-assessment]', (event, btn) => A.assessmentForm(null, { clientId: btn.dataset.newAssessment }));
      AWY.on(el, 'click', '[data-new-report]', (event, btn) => A.reportForm(null, { clientId: btn.dataset.newReport }));
      AWY.on(el, 'click', '[data-consent]', (event, btn) => A.consentForm(db.consents.find((x) => x.id === btn.dataset.consent)));
      AWY.on(el, 'click', '[data-new-consent]', (event, btn) => A.consentForm(null, { clientId: btn.dataset.newConsent }));
      AWY.on(el, 'click', '[data-new-agreement]', (event, btn) => A.agreementForm({ clientId: btn.dataset.newAgreement }));
      AWY.on(el, 'click', '[data-new-document]', (event, btn) => A.documentForm(null, { clientId: btn.dataset.newDocument }));
      AWY.on(el, 'click', '[data-plan]', (event, btn) => A.planForm(db.fundingPlans.find((x) => x.id === btn.dataset.plan)));
      AWY.on(el, 'click', '[data-new-plan]', (event, btn) => A.planForm(null, { clientId: btn.dataset.newPlan }));
      AWY.on(el, 'click', '[data-draft-invoice]', (event, btn) => A.draftInvoice(btn.dataset.draftInvoice, btn));
      AWY.views.documents.bindDocs(el);
      AWY.views.funding.bindLogs(el);
    }
  };

  function contactForm(db, c, existing) {
    C.openForm({
      title: existing ? 'Edit contact' : 'Add contact',
      subtitle: 'For ' + rules.clientName(c),
      fields: schema.tables.contacts.fields,
      values: existing || { kind: 'family' },
      db: db,
      footerStart: existing ? html`<button type="button" class="btn btn-danger" data-remove-contact>${icon('trash')}Remove</button>` : '',
      onOpen(modal) {
        const btn = modal.el.querySelector('[data-remove-contact]');
        if (btn) btn.addEventListener('click', () => {
          modal.close();
          C.confirmDelete({ table: 'contacts', id: existing.id, label: 'this contact' });
        });
      },
      async onSubmit(values) {
        if (values.isPrimary) {
          for (const x of db.contacts.filter((k) => k.clientId === c.id && k.isPrimary && (!existing || k.id !== existing.id))) {
            await store.update('contacts', x.id, { isPrimary: false }, { audit: false });
          }
        }
        if (existing) await store.update('contacts', existing.id, values);
        else await store.create('contacts', Object.assign(values, { clientId: c.id }));
        AWY.ui.toast(existing ? 'Contact updated.' : 'Contact added.');
      }
    });
  }
})();
