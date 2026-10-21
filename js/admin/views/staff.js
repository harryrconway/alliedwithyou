/*
  Team and access: who has an account, new accounts waiting for approval, and what each
  role can do. The database applies the same rules, so this screen can't grant more
  than an administrator is allowed to.
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

  const roleField = { name: 'role', label: 'Role', type: 'select', options: schema.options.role, required: true, hint: 'Choose the lowest role that covers what they need. It can be changed later.' };

  function approveForm(person) {
    C.openForm({
      title: 'Approve ' + (person.name || person.email),
      subtitle: person.email + '. Email confirmed ' + fmt.stamp(person.emailConfirmedAt) + '.',
      area: 'staff',
      fields: [roleField, { name: 'title', label: 'Position title', type: 'text' }],
      values: { role: 'support', title: person.title },
      db: AWY.app.db,
      submitLabel: 'Approve account',
      async onSubmit(values) {
        await store.update('staff', person.id, { role: values.role, title: values.title, status: 'active' });
        AWY.ui.toast((person.name || person.email) + ' can now sign in as ' + access.roleLabel(values.role).toLowerCase() + '.');
      }
    });
  }

  async function setStatus(person, status) {
    const name = person.name || person.email;
    const copy = {
      declined: { title: 'Decline ' + name + '?', message: "They won't be able to use the dashboard. You can approve them later if this was a mistake.", label: 'Decline', done: name + "'s account was declined." },
      disabled: { title: 'Switch off ' + name + "'s account?", message: "They'll be signed out and won't be able to sign in. Their tasks and calendar entries stay, so the history is kept. You can switch it back on at any time.", label: 'Switch off', done: name + "'s account is switched off." },
      active: { title: 'Switch ' + name + "'s account back on?", message: 'They will be able to sign in again with their existing role, ' + access.roleLabel(person.role).toLowerCase() + '.', label: 'Switch on', done: name + ' can sign in again.' }
    }[status];
    const ok = await AWY.ui.confirm({ title: copy.title, message: copy.message, confirmLabel: copy.label, danger: status !== 'active' });
    if (ok) await C.save(store.update('staff', person.id, { status: status }), copy.done, { area: 'staff', operation: 'set status ' + status });
  }

  function editForm(person) {
    const self = person.id === access.user().id;
    C.openForm({
      title: 'Edit ' + (person.name || person.email),
      subtitle: person.email,
      area: 'staff',
      fields: [schema.tables.staff.fields[0], self ? null : roleField].concat(schema.tables.staff.fields.slice(1)).filter(Boolean),
      values: person,
      db: AWY.app.db,
      footerStart: self ? '' : html`<button type="button" class="btn btn-danger" data-switch-off>${icon('lock')}Switch off account</button>`,
      onOpen(modal) {
        const off = modal.el.querySelector('[data-switch-off]');
        if (off) off.addEventListener('click', () => {
          modal.close();
          setStatus(person, 'disabled');
        });
      },
      async onSubmit(values) {
        const saved = await store.update('staff', person.id, values);
        if (self) AWY.app.updateUser(saved);
        AWY.ui.toast('Details saved for ' + (saved.name || saved.email) + '.');
      }
    });
  }

  /* Checks and registrations */

  function checkForm(person, existing) {
    C.openForm({
      title: existing ? 'Edit check' : 'Add a check for ' + (person.name || person.email),
      subtitle: 'Record the details after sighting the original. Please don\'t keep copies of certificates or police checks here.',
      area: 'staff checks',
      fields: schema.tables.staffChecks.fields,
      values: existing || {},
      db: AWY.app.db,
      size: 'wide',
      submitLabel: existing ? 'Save check' : 'Add check',
      footerStart: existing ? html`<button type="button" class="btn btn-danger" data-delete-check>${icon('trash')}Delete</button>` : '',
      validate(v) {
        if (v.issuedOn && v.expiresOn && v.expiresOn < v.issuedOn) return { expiresOn: 'The expiry date should be after the issue date' };
        if ((v.kind === 'other' || v.kind === 'training') && !v.details) return { details: 'Please say what it is' };
        return {};
      },
      onOpen(modal) {
        const del = modal.el.querySelector('[data-delete-check]');
        if (del) del.addEventListener('click', () => {
          modal.close();
          C.confirmDelete({ table: 'staffChecks', id: existing.id, label: 'this check' });
        });
      },
      async onSubmit(values, modal) {
        if (existing) {
          await store.update('staffChecks', existing.id, values);
          AWY.ui.toast('Check saved.');
        } else {
          await store.create('staffChecks', Object.assign({ staffId: person.id }, values), { requestId: modal.requestId });
          AWY.ui.toast(C.label('checkKind', values.kind) + ' added for ' + (person.name || person.email) + '.');
        }
      }
    });
  }

  function checkRow(c, today, manage) {
    const status = rules.checkStatus(c, today);
    return html`<li>
      <div class="what"><strong>${C.label('checkKind', c.kind)}</strong>${c.details ? html`<span class="muted">, ${c.details}</span>` : ''}
        <div class="meta">
          ${c.reference ? html`<span>${c.reference}</span>` : ''}
          ${c.expiresOn ? html`<span>${icon('clock')}${status === 'expired' ? 'Expired ' : 'Expires '}${fmt.date(c.expiresOn)}</span>` : ''}
          ${c.issuedOn ? html`<span>Issued ${fmt.date(c.issuedOn)}</span>` : ''}
          ${c.sightedOn ? html`<span>${icon('check')}Original sighted ${fmt.date(c.sightedOn)}</span>` : ''}
        </div>
        ${c.notes ? html`<div class="meta" style="margin-top:0.2rem"><span>${c.notes}</span></div>` : ''}
      </div>
      <div class="end">${C.badge('check', status)}${manage ? html`<button type="button" class="btn btn-quiet btn-sm" data-edit-check="${c.id}">Edit</button>` : ''}</div>
    </li>`;
  }

  function checksTab(ctx) {
    const { db, state, today, user } = ctx;
    const manage = access.can('manageChecks');
    if (state.checks === undefined) state.checks = 'all';
    const people = manage ? rules.activeStaff(db) : db.staff.filter((s) => s.id === user.id);
    const due = rules.checksDue(db, today);
    return html`
      ${manage
        ? html`<div class="notice" style="margin-bottom:1rem">${icon('shield')}<div>Each person can see their own checks, and only administrators can see everyone's. Record the details after sighting the original. Please don't keep copies of certificates or police checks here.</div></div>
          ${C.seg('checks', [{ value: 'all', label: 'Everyone' }, { value: 'due', label: 'Needs renewing', count: due.length }], state.checks)}`
        : html`<p class="muted" style="margin-bottom:1rem">The practice keeps these details for you. If something has changed, let an administrator know.</p>`}
      <div class="stack-panels">${people.map((p) => {
        const mine = db.staffChecks.filter((c) => c.staffId === p.id && (state.checks !== 'due' || ['expired', 'expiring'].includes(rules.checkStatus(c, today))));
        if (state.checks === 'due' && !mine.length) return '';
        const order = { expired: 0, expiring: 1, current: 2, noexpiry: 3 };
        mine.sort((a, b) => order[rules.checkStatus(a, today)] - order[rules.checkStatus(b, today)] || String(a.expiresOn).localeCompare(String(b.expiresOn)));
        return html`<section class="panel" aria-labelledby="ck_${p.id}">
          <div class="panel-head">
            <div><h2 id="ck_${p.id}">${p.id === user.id && !manage ? 'Your checks and registrations' : p.name || p.email}</h2><p>${access.roleLabel(p.role)}${p.title && p.title.toLowerCase() !== access.roleLabel(p.role).toLowerCase() ? ', ' + p.title : ''}</p></div>
            ${manage ? html`<button type="button" class="btn btn-secondary btn-sm" data-add-check="${p.id}">${icon('plus')}Add check</button>` : ''}
          </div>
          ${mine.length ? html`<ul class="rows">${mine.map((c) => checkRow(c, today, manage))}</ul>` : html`<div class="panel-body"><p class="muted small">Nothing recorded yet.</p></div>`}
        </section>`;
      })}</div>`;
  }

  function personMeta(s) {
    return html`<div class="meta">${s.title ? html`<span>${s.title}</span>` : ''}<span>${icon('mail')}${s.email}</span>${s.phone ? html`<span>${icon('phone')}${s.phone}</span>` : ''}${s.registration ? html`<span>AHPRA ${s.registration}</span>` : ''}</div>`;
  }

  function pendingRow(s) {
    const reserved = AWY.auth.isReserved(s.email);
    const confirmed = !!s.emailConfirmedAt;
    let note;
    if (reserved) note = html`<span class="muted">Reserved practice address. It can only be set up from its invitation email.</span>`;
    else if (!confirmed) note = html`<span class="muted">Hasn't confirmed their email yet, so they can't be approved.</span>`;
    return html`<li>
      <span class="avatar" aria-hidden="true">${fmt.initials(s.name || s.email)}</span>
      <div class="what"><strong>${s.name || 'No name given'}</strong>
        <div class="meta"><span>${icon('mail')}${s.email}</span><span>${icon('clock')}Signed up ${fmt.relative(s.createdAt.slice(0, 10)).toLowerCase()}</span></div>
        ${note ? html`<div class="meta" style="margin-top:0.25rem">${note}</div>` : ''}
      </div>
      <div class="end">
        ${!reserved && confirmed ? html`<button type="button" class="btn btn-sm" data-approve="${s.id}">${icon('check')}Approve</button>` : ''}
        <button type="button" class="btn btn-quiet btn-sm" data-decline="${s.id}">Decline</button>
      </div>
    </li>`;
  }

  AWY.views.staff = {
    title: 'Team and access',
    render(ctx) {
      const { db, user, today, query, state } = ctx;
      const manage = access.can('manageStaff');
      const tab = ctx.params.id === 'checks' ? 'checks' : 'team';
      const dueCount = rules.checksDue(db, today, access.can('manageChecks') ? '' : user.id).length;
      const tabs = html`<div class="tabs-wrap">${C.tabs([
        { key: 'team', label: 'Team', href: '#/staff' },
        { key: 'checks', label: 'Checks and registrations', href: '#/staff/checks', count: dueCount || undefined }
      ], tab)}</div>`;

      if (tab === 'checks') {
        const everyone = access.can('manageChecks');
        const download = everyone ? html`<button type="button" class="btn btn-secondary" data-download-checks ${raw(db.staffChecks.length ? '' : 'disabled')}>${icon('download')}Download</button>` : '';
        ctx.el.innerHTML = String(html`${C.pageHead({ title: 'Team and access', subtitle: 'Screening checks, registrations, insurance and certificates for each person.', actions: download })}${tabs}${checksTab(ctx)}`);
        C.bindFilters(ctx);
        AWY.on(ctx.el, 'click', '[data-download-checks]', () => {
          const shown = db.staffChecks.filter((c) => ctx.state.checks !== 'due' || ['expired', 'expiring'].includes(rules.checkStatus(c, today)));
          AWY.exports.sheet('Staff checks', AWY.exports.COLUMNS.staffChecks(db, today), shown.slice().sort((a, b) => rules.staffName(db, a.staffId).localeCompare(rules.staffName(db, b.staffId)) || String(a.expiresOn).localeCompare(String(b.expiresOn))));
        });
        AWY.on(ctx.el, 'click', '[data-add-check]', (event, btn) => checkForm(db.staff.find((s) => s.id === btn.dataset.addCheck), null));
        AWY.on(ctx.el, 'click', '[data-edit-check]', (event, btn) => {
          const c = db.staffChecks.find((x) => x.id === btn.dataset.editCheck);
          checkForm(db.staff.find((s) => s.id === c.staffId), c);
        });
        return;
      }
      const roles = Object.keys(access.ROLES);
      const yes = html`<span class="yes">${icon('check')}Yes</span>`;
      const no = html`<span class="no">${icon('minusCircle')}No</span>`;
      const pending = rules.pendingStaff(db);
      const team = rules.activeStaff(db);
      const inactive = db.staff.filter((s) => s.status === 'disabled' || s.status === 'declined');
      const openSections = access.SECTIONS.filter((s) => !access.isLocked(s.key));

      const approvals = manage ? html`<section class="panel" style="margin-bottom:1.5rem" aria-labelledby="pendingTitle">
        <div class="panel-head"><div><h2 id="pendingTitle">Waiting for approval <span class="muted" style="font-weight:500">${pending.length}</span></h2><p>People who created an account. Approve only people you know work with the practice.</p></div></div>
        ${pending.length ? html`<ul class="rows">${pending.map(pendingRow)}</ul>` : html`<div class="panel-body"><p class="muted small">Nobody is waiting.</p></div>`}
      </section>` : '';

      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Team and access', subtitle: 'Who has an account, and what each role can do.', actions: manage ? html`<button type="button" class="btn btn-secondary" data-download-team>${icon('download')}Download</button>` : '' })}
        ${tabs}
        ${approvals}
        <section class="panel" style="margin-bottom:1.5rem" aria-labelledby="teamTitle">
          <div class="panel-head"><h2 id="teamTitle">Team</h2></div>
          <ul class="rows">${team.map((s) => html`<li data-person="${s.id}">
            <span class="avatar" aria-hidden="true">${fmt.initials(s.name || s.email)}</span>
            <div class="what"><strong>${s.name || s.email}${s.id === user.id ? html` <span class="tag">You</span>` : ''}</strong>${personMeta(s)}</div>
            <div class="end">${manage ? (s.mfaEnabled ? html`<span class="tag" title="Two step sign in is on">${icon('lock')}Two step on</span>` : html`<span class="tag tag-warning" title="Two step sign in is off">Two step off</span>`) : ''}<span class="badge tone-sage">${icon('shield')}${access.roleLabel(s.role)}</span>
              ${manage ? html`<button type="button" class="btn btn-quiet btn-sm" data-edit-staff="${s.id}" aria-label="Edit ${s.name || s.email}">Edit</button>` : s.id === user.id ? html`<button type="button" class="btn btn-quiet btn-sm" data-action="account">Edit your details</button>` : ''}
            </div>
          </li>`)}</ul>
        </section>

        ${manage && inactive.length ? html`<details class="panel" style="margin-bottom:1.5rem">
          <summary class="panel-head" style="cursor:pointer;list-style:none"><h2>Switched off and declined <span class="muted" style="font-weight:500">${inactive.length}</span></h2>${icon('chevronDown')}</summary>
          <ul class="rows">${inactive.map((s) => html`<li>
            <span class="avatar" aria-hidden="true">${fmt.initials(s.name || s.email)}</span>
            <div class="what"><strong>${s.name || s.email}</strong>${personMeta(s)}</div>
            <div class="end">${C.badge('account', s.status)}
              ${s.status === 'disabled' ? html`<button type="button" class="btn btn-quiet btn-sm" data-switch-on="${s.id}">Switch on</button>` : s.emailConfirmedAt && !AWY.auth.isReserved(s.email) ? html`<button type="button" class="btn btn-quiet btn-sm" data-approve="${s.id}">Approve</button>` : ''}
            </div>
          </li>`)}</ul>
        </details>` : ''}

        <section class="panel">
          <div class="panel-head"><div><h2>What each role can do</h2><p>Only sections that are switched on are listed. The database enforces these rules, not just the screens.</p></div></div>
          <div class="table-wrap" style="border-radius:0 0 var(--radius) var(--radius);border:0;border-top:var(--border)">
            <table class="table matrix">
              <caption class="sr-only">Access by role</caption>
              <thead><tr><th scope="col">Section or action</th>${roles.map((r) => html`<th scope="col">${access.ROLES[r].label}</th>`)}</tr></thead>
              <tbody>
                ${openSections.map((s) => html`<tr><th scope="row" style="font-weight:600;color:var(--color-text)">${s.label}</th>${roles.map((r) => html`<td>${access.canSee(s.key, r) ? yes : no}</td>`)}</tr>`)}
                ${Object.keys(access.CAPABILITY_LABELS).map((k) => html`<tr><th scope="row" style="font-weight:600;color:var(--color-text)">${access.CAPABILITY_LABELS[k]}</th>${roles.map((r) => html`<td>${access.can(k, r) ? yes : no}</td>`)}</tr>`)}
              </tbody>
            </table>
          </div>
        </section>
      `);

      const find = (id) => db.staff.find((s) => s.id === id);
      AWY.on(ctx.el, 'click', '[data-approve]', (event, btn) => approveForm(find(btn.dataset.approve)));
      AWY.on(ctx.el, 'click', '[data-decline]', (event, btn) => setStatus(find(btn.dataset.decline), 'declined'));
      AWY.on(ctx.el, 'click', '[data-switch-on]', (event, btn) => setStatus(find(btn.dataset.switchOn), 'active'));
      AWY.on(ctx.el, 'click', '[data-edit-staff]', (event, btn) => editForm(find(btn.dataset.editStaff)));
      AWY.on(ctx.el, 'click', '[data-download-team]', () => AWY.exports.sheet('Team', AWY.exports.COLUMNS.staff(), team.concat(pending, inactive)));

      /* Opened from search or another screen. Administrators get the edit form, and everyone else sees the person picked out in the list. */
      C.openLinked(ctx, { path: ['staff'], list: db.staff, table: 'staff', open: (s) => {
        if (manage) return editForm(s);
        const row = ctx.el.querySelector('[data-person="' + s.id + '"]');
        if (!row) return;
        row.scrollIntoView({ block: 'center' });
        row.classList.add('is-found');
        setTimeout(() => row.classList.remove('is-found'), 2700);
      } });
    }
  };
})();
