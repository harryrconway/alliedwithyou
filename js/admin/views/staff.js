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
      const { db, user } = ctx;
      const manage = access.can('manageStaff');
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
        ${C.pageHead({ title: 'Team and access', subtitle: 'Who has an account, and what each role can do.' })}
        ${approvals}
        <section class="panel" style="margin-bottom:1.5rem" aria-labelledby="teamTitle">
          <div class="panel-head"><h2 id="teamTitle">Team</h2></div>
          <ul class="rows">${team.map((s) => html`<li>
            <span class="avatar" aria-hidden="true">${fmt.initials(s.name || s.email)}</span>
            <div class="what"><strong>${s.name || s.email}${s.id === user.id ? html` <span class="tag">You</span>` : ''}</strong>${personMeta(s)}</div>
            <div class="end"><span class="badge tone-sage">${icon('shield')}${access.roleLabel(s.role)}</span>
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
    }
  };
})();
