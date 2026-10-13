/* Staff profiles and the simulated access levels for each role. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const access = AWY.access;
  const store = AWY.store;
  const schema = AWY.schema;
  const icon = (n) => raw(AWY.icon(n));

  function staffForm(existing) {
    const db = AWY.app.db;
    C.openForm({
      title: existing ? 'Edit ' + existing.name : 'Add a staff member',
      subtitle: 'Fictional details only. In the live system, staff accounts will be created through the sign in service.',
      fields: schema.tables.staff.fields,
      values: existing || { role: 'therapist' },
      db: db,
      async onSubmit(values) {
        if (existing) await store.update('staff', existing.id, values);
        else await store.create('staff', Object.assign(values, { active: true }));
        AWY.ui.toast(existing ? 'Staff details saved.' : 'Staff member added.');
      }
    });
  }

  AWY.views.staff = {
    title: 'Staff and access',
    render(ctx) {
      const { db, today, user } = ctx;
      const manage = access.can('manageStaff');
      const roles = Object.keys(access.ROLES);
      const yes = html`<span class="yes">${icon('check')}Yes</span>`;
      const no = html`<span class="no">${icon('minusCircle')}No</span>`;

      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Staff and access', subtitle: 'Who works in the practice and what each role can see.', actions: manage ? html`<button type="button" class="btn" data-new-staff>${icon('userPlus')}Add staff member</button>` : '' })}
        <section class="panel" style="margin-bottom:1.5rem">
          <div class="panel-head"><h2>Team</h2></div>
          <ul class="rows">${db.staff.map((s) => {
            const caseload = db.clients.filter((c) => c.therapistId === s.id && c.status === 'active').length;
            const upcoming = db.appointments.filter((a) => a.staffId === s.id && AWY.rules.isLive(a) && a.date >= today).length;
            const tasks = db.tasks.filter((t) => t.assignedTo === s.id && t.status === 'open').length;
            return html`<li>
              <span class="avatar" aria-hidden="true">${fmt.initials(s.name)}</span>
              <div class="what"><strong>${s.name}${s.id === user.id ? html` <span class="tag">You</span>` : ''}</strong>
                <div class="meta"><span>${s.title}</span><span>${icon('mail')}${s.email}</span>${s.phone ? html`<span>${icon('phone')}${s.phone}</span>` : ''}${s.registration ? html`<span>AHPRA ${s.registration}</span>` : ''}</div>
                <div class="meta" style="margin-top:0.25rem"><span>${fmt.plural(caseload, 'active client')}</span><span>${fmt.plural(upcoming, 'upcoming appointment')}</span><span>${fmt.plural(tasks, 'open task')}</span></div>
              </div>
              <div class="end"><span class="badge tone-sage">${icon('shield')}${access.roleLabel(s.role)}</span>${manage ? html`<button type="button" class="btn btn-quiet btn-sm" data-edit-staff="${s.id}">Edit</button>` : ''}</div>
            </li>`;
          })}</ul>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>What each role can see</h2><p>Switch person in the top bar to try each one</p></div>
          <div class="panel-body"><div class="notice notice-warning">${icon('lock')}<div><strong>Simulated for the demo</strong>These restrictions only change what the interface shows. In the live system, access will be enforced by the sign in service, database row level security policies and server side checks, with multi factor authentication for staff.</div></div></div>
          <div class="table-wrap" style="border-radius:0 0 var(--radius) var(--radius);border:0;border-top:var(--border)">
            <table class="table matrix">
              <caption class="sr-only">Access by role</caption>
              <thead><tr><th scope="col">Section or action</th>${roles.map((r) => html`<th scope="col">${access.ROLES[r].label}</th>`)}</tr></thead>
              <tbody>
                ${access.SECTIONS.map((s) => html`<tr><th scope="row" style="font-weight:600;color:var(--color-text)">${s.label}</th>${roles.map((r) => html`<td>${access.canSee(s.key, r) ? yes : no}</td>`)}</tr>`)}
                ${Object.keys(access.CAPABILITY_LABELS).map((k) => html`<tr><th scope="row" style="font-weight:600;color:var(--color-text)">${access.CAPABILITY_LABELS[k]}</th>${roles.map((r) => html`<td>${access.can(k, r) ? yes : no}</td>`)}</tr>`)}
              </tbody>
            </table>
          </div>
        </section>
      `);
      AWY.on(ctx.el, 'click', '[data-new-staff]', () => staffForm(null));
      AWY.on(ctx.el, 'click', '[data-edit-staff]', (event, btn) => staffForm(db.staff.find((s) => s.id === btn.dataset.editStaff)));
    }
  };
})();
