/* Goals and progress: client goals with review dates and progress over time. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const rules = AWY.rules;
  const store = AWY.store;
  const schema = AWY.schema;
  const A = AWY.actions;
  const icon = (n) => raw(AWY.icon(n));

  A.goalForm = function (existing, prefill) {
    const db = AWY.app.db;
    const isNew = !existing;
    const fields = (isNew && !(prefill && prefill.clientId) ? [{ name: 'clientId', label: 'Client', type: 'client', required: true }] : []).concat(schema.tables.goals.fields);
    C.openForm({
      title: isNew ? 'New goal' : 'Edit goal',
      subtitle: (existing || prefill || {}).clientId ? rules.clientNameById(db, (existing || prefill).clientId) : '',
      fields: fields,
      values: Object.assign({ status: 'active', createdDate: D.today(), reviewDate: D.addMonths(D.today(), 3), baseline: '', target: 8 }, prefill || {}, existing || {}),
      db: db,
      submitLabel: isNew ? 'Add goal' : 'Save goal',
      validate(v) {
        if (v.reviewDate < v.createdDate) return { reviewDate: 'The review date should be after the date the goal was set' };
        return {};
      },
      async onSubmit(values) {
        if (isNew) {
          await store.create('goals', Object.assign({ clientId: prefill && prefill.clientId }, values));
          AWY.ui.toast('Goal added.');
        } else {
          await store.update('goals', existing.id, values);
          AWY.ui.toast('Goal saved.');
        }
      }
    });
  };

  A.progressForm = function (goal) {
    const db = AWY.app.db;
    const notes = db.notes.filter((n) => n.clientId === goal.clientId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    C.openForm({
      title: 'Add a progress update',
      subtitle: goal.description,
      fields: schema.tables.progress.fields.concat([{ name: 'noteId', label: 'Related clinical note', type: 'select', options: notes.map((n) => ({ value: n.id, label: fmt.date(n.date) + ', ' + C.label('noteTemplate', n.template).toLowerCase() })) }]),
      values: { date: D.today(), rating: rules.goalLatest(db, goal) },
      db: db,
      submitLabel: 'Add update',
      async onSubmit(values) {
        await store.create('progress', Object.assign(values, { goalId: goal.id, clientId: goal.clientId, authorId: AWY.access.user().id }));
        AWY.ui.toast('Progress update added.');
      }
    });
  };

  /* A small line chart of ratings over time */
  function sparkline(points, target) {
    if (points.length < 2) return '';
    const w = 320;
    const h = 90;
    const pad = 14;
    const xs = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
    const ys = (v) => h - pad - (v / 10) * (h - pad * 2);
    const d = points.map((p, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(p.rating).toFixed(1)).join(' ');
    return html`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Ratings over time: ${points.map((p) => p.rating).join(', ')}">
      <line class="grid" x1="${pad}" x2="${w - pad}" y1="${ys(0)}" y2="${ys(0)}"></line>
      ${target !== '' && target !== undefined ? html`<line x1="${pad}" x2="${w - pad}" y1="${ys(target)}" y2="${ys(target)}" stroke="var(--color-deep)" stroke-dasharray="4 4"></line><text x="${w - pad}" y="${ys(target) - 4}" text-anchor="end">Target ${target}</text>` : ''}
      <path d="${d}" fill="none" stroke="var(--color-sage)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
      ${points.map((p, i) => html`<circle cx="${xs(i)}" cy="${ys(p.rating)}" r="3.5" fill="var(--color-deep)"></circle>`)}
    </svg>`;
  }

  A.openGoal = function (id) {
    const db = AWY.app.db;
    const g = db.goals.find((x) => x.id === id);
    if (!g) return;
    const list = rules.goalProgress(db, g.id);
    const points = (g.baseline !== '' && g.baseline !== undefined ? [{ rating: g.baseline, date: g.createdDate }] : []).concat(list);
    const notes = db.notes.filter((n) => (n.goalIds || []).includes(g.id)).sort((a, b) => b.date.localeCompare(a.date));
    const modal = AWY.ui.modal({
      title: g.description,
      subtitle: rules.clientNameById(db, g.clientId) + ', ' + C.label('goalArea', g.area).toLowerCase(),
      size: 'wide',
      body: html`
        <div class="btn-row" style="margin-bottom:1rem">${C.badge('goal', g.status)}<span class="muted small">Set ${fmt.date(g.createdDate)}. Review ${fmt.date(g.reviewDate)}${g.status === 'active' && g.reviewDate < D.today() ? ' (review date has passed)' : ''}.</span></div>
        ${sparkline(points, g.target)}
        <h3 class="section-title">Progress updates</h3>
        ${list.length ? html`<ol class="timeline">${list.slice().reverse().map((p) => html`<li><div><strong>${p.rating} of 10.</strong> ${p.comment}</div><div class="meta">${fmt.date(p.date)} by ${rules.staffName(db, p.authorId)}${p.noteId ? html`, <a href="#/notes/${p.noteId}" data-close>see note</a>` : ''}</div></li>`)}</ol>` : html`<p class="muted">No progress updates yet. Starting point ${g.baseline === '' ? 'not rated' : g.baseline + ' of 10'}.</p>`}
        ${notes.length ? html`<h3 class="section-title">Sessions that addressed this goal</h3><ul class="rows" style="border:var(--border);border-radius:var(--radius-sm)">${notes.map((n) => html`<li><div class="what"><a href="#/notes/${n.id}" data-close>${fmt.dateDay(n.date)}, ${C.label('noteTemplate', n.template).toLowerCase()}</a><div class="meta"><span>${n.progress}</span></div></div></li>`)}</ul>` : ''}`,
      footer: html`
        <button type="button" class="btn btn-secondary spacer" data-act="edit">${icon('edit')}Edit goal</button>
        ${g.status === 'active' ? html`<button type="button" class="btn btn-secondary" data-act="achieved">${icon('checkCircle')}Mark achieved</button>` : ''}
        ${g.status === 'planned' ? html`<button type="button" class="btn btn-secondary" data-act="activate">Start working on it</button>` : ''}
        <button type="button" class="btn" data-act="progress">${icon('plus')}Add progress update</button>`
    });
    AWY.on(modal.el, 'click', '[data-act]', async (event, btn) => {
      const act = btn.dataset.act;
      modal.close();
      if (act === 'edit') A.goalForm(g);
      if (act === 'progress') A.progressForm(g);
      if (act === 'achieved') C.save(store.update('goals', g.id, { status: 'achieved' }), 'Goal marked as achieved.');
      if (act === 'activate') C.save(store.update('goals', g.id, { status: 'active' }), 'Goal is now active.');
    });
  };

  AWY.views.goals = {
    title: 'Goals and progress',
    render(ctx) {
      const { db, state, today, user } = ctx;
      if (state.status === undefined) state.status = ctx.query.due ? 'due' : 'active';
      if (state.sort === undefined) state.sort = 'review';
      const dueIds = new Set(rules.goalsDueReview(db, today, 14).map((g) => g.id));
      const mineOnly = user.role === 'support';
      const visibleClients = mineOnly ? new Set(db.appointments.filter((a) => a.staffId === user.id).map((a) => a.clientId)) : null;
      const goals = db.goals.filter((g) => !visibleClients || visibleClients.has(g.clientId));
      const counts = {};
      goals.forEach((g) => (counts[g.status] = (counts[g.status] || 0) + 1));
      const seg = [{ value: 'due', label: 'Due for review', count: goals.filter((g) => dueIds.has(g.id)).length }]
        .concat(Object.keys(schema.statuses.goal).map((k) => ({ value: k, label: schema.status('goal', k).label, count: counts[k] || 0 })))
        .concat([{ value: 'all', label: 'All', count: goals.length }]);
      const rows = goals.filter((g) =>
        (state.status === 'all' || (state.status === 'due' ? dueIds.has(g.id) : g.status === state.status)) &&
        (!state.area || g.area === state.area) &&
        C.matches(g, state.q, ['description', (x) => rules.clientNameById(db, x.clientId)])
      );
      const columns = [
        { key: 'goal', label: 'Goal', sortValue: (g) => g.description, render: (g) => html`<button type="button" style="all:unset;cursor:pointer;font-weight:680;display:block;max-width:26rem" data-goal="${g.id}">${g.description}</button><span class="sub">${C.label('goalArea', g.area)}</span>` },
        { key: 'client', label: 'Client', sortValue: (g) => rules.clientNameById(db, g.clientId), render: (g) => C.clientLink(db, g.clientId, 'goals') },
        { key: 'progress', label: 'Progress', sortValue: (g) => Number(rules.goalLatest(db, g)) || 0, render: (g) => html`<div style="min-width:9rem">${C.meter({ value: Number(rules.goalLatest(db, g)) || 0, max: 10, target: g.target, left: (rules.goalLatest(db, g) === '' ? 'Not rated' : rules.goalLatest(db, g) + ' of 10'), right: 'Target ' + g.target })}</div>` },
        { key: 'review', label: 'Review', sortValue: (g) => g.reviewDate, render: (g) => C.due(g.reviewDate, today, g.status !== 'active') },
        { key: 'status', label: 'Status', sortValue: (g) => g.status, render: (g) => C.badge('goal', g.status) }
      ];
      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Goals and progress', subtitle: 'Goals set with clients, in their own words, and how they are tracking.', actions: html`<button type="button" class="btn" data-new-goal>${icon('plus')}New goal</button>` })}
        ${C.seg('status', seg, state.status)}
        <div class="toolbar">
          ${C.search(state.q, 'Search goals or clients')}
          ${C.select('area', 'Area', C.options('goalArea'), state.area)}
        </div>
        ${C.table({ columns, rows, sort: state.sort, caption: 'Goals', empty: C.empty({ icon: 'target', title: 'No goals match' }) })}
      `);
      C.bindFilters(ctx);
      AWY.on(ctx.el, 'click', '[data-goal]', (event, btn) => A.openGoal(btn.dataset.goal));
      AWY.on(ctx.el, 'click', '[data-new-goal]', () => A.goalForm(null, {}));
    }
  };
})();
