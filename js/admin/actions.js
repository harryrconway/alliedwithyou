/*
  Record actions shared by several screens: tasks, calendar entries, reporting an
  issue and your own account.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const rules = AWY.rules;
  const store = AWY.store;
  const access = AWY.access;
  const schema = AWY.schema;
  const icon = (n) => raw(AWY.icon(n));

  const A = (AWY.actions = AWY.actions || {});
  const db = () => AWY.app.db;
  const me = () => access.user();

  /* Tasks */

  A.canEditTask = function (t) {
    return access.can('deleteAnyTask') || t.assignedTo === me().id || t.createdBy === me().id;
  };

  A.taskRow = function (data, t, today) {
    const status = rules.taskStatus(t, today);
    const id = 'task_' + t.id;
    const editable = A.canEditTask(t);
    return html`<li>
      <input type="checkbox" id="${id}" data-task-toggle="${t.id}" ${raw(t.status === 'done' ? 'checked' : '')} ${raw(editable ? '' : 'disabled')} style="width:1.15rem;height:1.15rem;margin-top:0.2rem;accent-color:var(--color-deep);flex:none">
      <div class="what">
        <label for="${id}" style="font-weight:620;cursor:pointer;${t.status === 'done' ? 'text-decoration:line-through;color:var(--color-grey)' : ''}">${t.title}</label>
        <div class="meta">
          <span style="${status === 'overdue' ? 'color:var(--color-danger);font-weight:680' : ''}">${icon('clock')}${status === 'overdue' ? 'Overdue, was due ' : 'Due '}${t.dueDate === today ? 'today' : fmt.date(t.dueDate)}</span>
          <span>${icon('user')}${rules.staffName(data, t.assignedTo)}</span>
          ${t.priority === 'high' ? html`<span>${C.badge('priority', 'high', 'High priority')}</span>` : ''}
        </div>
      </div>
      ${editable ? html`<div class="end"><button type="button" class="btn btn-quiet btn-sm" data-task-edit="${t.id}" aria-label="Edit task: ${t.title}">Edit</button></div>` : ''}
    </li>`;
  };

  A.taskForm = function (existing) {
    const data = db();
    const isNew = !existing;
    C.openForm({
      title: isNew ? 'New task' : 'Edit task',
      area: 'tasks',
      fields: schema.tables.tasks.fields,
      values: Object.assign({ priority: 'normal', dueDate: D.addBusinessDays(D.today(), 1), assignedTo: me().id }, existing || {}),
      db: data,
      submitLabel: isNew ? 'Add task' : 'Save task',
      footerStart: existing && (existing.createdBy === me().id || access.can('deleteAnyTask')) ? html`<button type="button" class="btn btn-danger" data-delete-task>${icon('trash')}Delete</button>` : '',
      onOpen(modal) {
        const del = modal.el.querySelector('[data-delete-task]');
        if (del) {
          del.addEventListener('click', () => {
            modal.close();
            C.confirmDelete({ table: 'tasks', id: existing.id, label: 'this task' });
          });
        }
      },
      async onSubmit(values, modal) {
        if (isNew) {
          await store.create('tasks', Object.assign(values, { status: 'open' }), { requestId: modal.requestId });
          AWY.ui.toast('Task added.');
        } else {
          const changes = [];
          if (values.assignedTo !== existing.assignedTo) changes.push('reassigned to ' + rules.staffName(data, values.assignedTo));
          if (values.dueDate !== existing.dueDate) changes.push('moved to ' + fmt.date(values.dueDate));
          await store.update('tasks', existing.id, values);
          AWY.ui.toast(changes.length ? 'Task ' + changes.join(' and ') + '.' : 'Task updated.');
        }
      }
    });
  };

  A.toggleTask = async function (id, done) {
    const saved = await C.save(
      store.update('tasks', id, done ? { status: 'done', completedAt: D.now(), completedBy: me().id } : { status: 'open', completedAt: '', completedBy: '' }),
      done ? 'Task completed.' : 'Task reopened.',
      { area: 'tasks', operation: done ? 'complete task' : 'reopen task' }
    );
    if (!saved && AWY.app.reload) AWY.app.reload();
  };

  /* Someone else's task, opened from search to read */
  A.taskView = function (t) {
    const data = db();
    AWY.ui.modal({
      title: t.title,
      subtitle: 'Only ' + rules.staffName(data, t.assignedTo) + ', whoever added it or an administrator can change this task.',
      body: html`${C.kv([
        ['Assigned to', rules.staffName(data, t.assignedTo)],
        ['Due', fmt.date(t.dueDate)],
        ['Priority', C.label('priority', t.priority)],
        ['Status', C.badge('task', rules.taskStatus(t, D.today()))],
        ['Completed', t.completedAt ? fmt.stamp(t.completedAt) + (t.completedBy ? ' by ' + rules.staffName(data, t.completedBy) : '') : ''],
        ['Details', t.description]
      ])}`,
      footer: html`<button type="button" class="btn btn-secondary" data-close>Close</button>`
    });
  };

  /* Calendar entries */

  A.canEditBlock = function (b) {
    return access.can('everyCalendar') || b.staffId === me().id;
  };

  /* The zone a new entry starts in: the one the calendar is shown in */
  A.defaultZone = function () {
    return D.viewZone((db().settings[0] || {}).defaultTimeZone);
  };

  /* Where an entry was booked, and its clock time there when that differs from the calendar's */
  A.zoneTag = function (b) {
    const differs = b.viewStart && (b.viewStart !== b.start || b.viewDate !== b.date);
    const there = differs ? fmt.time(b.start) + (b.viewDate !== b.date ? ' ' + fmt.dateDay(b.date) : '') : '';
    return html`<span class="zone-tag" title="${D.zoneLabel(b.timeZone)}${there ? ', ' + there + ' there' : ''}">${D.zoneShort(b.timeZone)}${there ? ' ' + there : ''}</span>`;
  };

  A.blockWhen = function (b) {
    return fmt.dateDay(b.date) + ', ' + fmt.timeRange(b.start, b.duration) + ' ' + D.zoneLabel(b.timeZone);
  };

  A.blockForm = function (existing, prefill) {
    const data = db();
    const isNew = !existing;
    const everyone = access.can('everyCalendar');
    const fields = [
      everyone ? { name: 'staffId', label: 'Staff member', type: 'staff', required: true } : null,
      { name: 'kind', label: 'Type', type: 'select', options: schema.options.blockKind, required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'start', label: 'Start time', type: 'time', required: true },
      { name: 'duration', label: 'Length', type: 'select', options: schema.options.blockLength, required: true },
      { name: 'timeZone', label: 'State or territory', type: 'select', options: schema.options.timeZone, required: true, hint: 'Where the person is, so the time is right for them. Broken Hill uses South Australian time.' },
      { name: 'note', label: 'Short note', type: 'text', span: 'all', maxlength: 140, hint: schema.NO_CLIENT_DETAILS }
    ].filter(Boolean);
    const start = Object.assign({ staffId: me().id, kind: 'booked', date: D.today(), start: '09:00', duration: '60', timeZone: A.defaultZone() }, prefill || {}, existing || {});
    start.duration = String(start.duration);
    if (!schema.options.blockLength.some((o) => o.value === start.duration)) start.duration = '60';

    const entry = (v) => ({
      staffId: everyone ? v.staffId : (existing ? existing.staffId : me().id),
      kind: v.kind, date: v.date, start: v.start, duration: Number(v.duration), timeZone: v.timeZone, note: v.note
    });

    C.openForm({
      title: isNew ? 'New calendar entry' : 'Edit calendar entry',
      subtitle: everyone ? '' : 'For your own calendar.',
      area: 'calendar',
      fields: fields,
      values: start,
      db: data,
      submitLabel: isNew ? 'Add to calendar' : 'Save changes',
      footerStart: existing ? html`<button type="button" class="btn btn-danger" data-delete-block>${icon('trash')}Delete</button>` : '',
      validate(values) {
        const e = entry(values);
        if ((values.note || '').length > 140) return { note: 'Please keep the note to 140 characters or fewer' };
        const clash = rules.blockClash(data, Object.assign({ startsAt: D.fromZone(e.date, e.start, e.timeZone) }, e), existing && existing.id);
        if (clash) return { start: 'Overlaps ' + C.label('blockKind', clash.kind).toLowerCase() + ' for ' + rules.staffName(data, clash.staffId) + ', ' + fmt.time(clash.start) + ' ' + D.zoneLabel(clash.timeZone) };
        return {};
      },
      onOpen(modal) {
        const del = modal.el.querySelector('[data-delete-block]');
        if (del) {
          del.addEventListener('click', () => {
            modal.close();
            C.confirmDelete({ table: 'calendar', id: existing.id, label: 'this calendar entry' });
          });
        }
      },
      async onSubmit(values, modal) {
        const e = entry(values);
        if (isNew) {
          await store.create('calendar', e, { requestId: modal.requestId });
          AWY.ui.toast('Added to the calendar for ' + fmt.dateDay(e.date) + ' at ' + fmt.time(e.start) + ' ' + D.zoneLabel(e.timeZone) + '.');
        } else {
          await store.update('calendar', existing.id, e);
          AWY.ui.toast('Calendar entry updated.');
        }
      }
    });
  };

  A.openBlock = function (id) {
    const data = db();
    const b = data.calendar.find((x) => x.id === id);
    if (!b) return AWY.ui.toast('That calendar entry no longer exists.', { tone: 'error' });
    const local = D.zoneParts(b.startsAt, D.localZone());
    const differs = D.zoneDiffers(b.startsAt, b.timeZone);
    const editable = A.canEditBlock(b);
    const modal = AWY.ui.modal({
      title: C.label('blockKind', b.kind),
      subtitle: A.blockWhen(b),
      body: html`${C.kv([
        ['Staff member', rules.staffName(data, b.staffId)],
        ['When', fmt.dateLong(b.date) + ', ' + fmt.timeRange(b.start, b.duration)],
        ['Time zone', D.zoneLabel(b.timeZone)],
        ['On this device', differs ? fmt.time(local.time) + (local.date !== b.date ? ' on ' + fmt.dateDay(local.date) : '') : ''],
        ['Note', b.note],
        ['Added by', b.createdBy ? rules.staffName(data, b.createdBy) : '']
      ])}`,
      footer: editable
        ? html`<button type="button" class="btn btn-danger spacer" data-act="delete">${icon('trash')}Delete</button>
          <button type="button" class="btn" data-act="edit">${icon('edit')}Edit</button>`
        : html`<button type="button" class="btn btn-secondary" data-close>Close</button>`
    });
    AWY.on(modal.el, 'click', '[data-act]', (event, btn) => {
      modal.close();
      if (btn.dataset.act === 'edit') A.blockForm(b);
      if (btn.dataset.act === 'delete') C.confirmDelete({ table: 'calendar', id: b.id, label: 'this calendar entry' });
    });
  };

  /* Reporting an issue or sending feedback, from anywhere in the dashboard */

  A.reportIssue = function (opts) {
    const o = opts || {};
    const current = AWY.app.current ? access.section(AWY.app.current.section) : null;
    C.openForm({
      title: o.errorRef ? 'Report this issue' : 'Report an issue or send feedback',
      subtitle: o.errorRef ? 'Reference ' + o.errorRef + ' is included, so the problem can be traced.' : 'Tell us about a problem, or an idea that would make the dashboard better.',
      area: 'feedback',
      fields: schema.tables.feedback.fields,
      values: { kind: o.kind || (o.errorRef ? 'issue' : '') },
      db: AWY.app.db,
      submitLabel: 'Send',
      async onSubmit(values, modal) {
        const rec = await store.create('feedback', Object.assign(values, { errorRef: o.errorRef || '', area: current ? current.label : '' }), { requestId: modal.requestId });
        AWY.ui.toast('Thanks, your report has been sent. Its reference is ' + rec.ref + '.');
      }
    });
  };

  /* Your own account */

  A.accountForm = function () {
    const user = me();
    C.openForm({
      title: 'Your account',
      subtitle: user.email + ', ' + access.roleLabel(user.role).toLowerCase(),
      area: 'account',
      fields: schema.tables.staff.fields,
      values: user,
      db: AWY.app.db,
      submitLabel: 'Save details',
      footerStart: html`<button type="button" class="btn btn-secondary" data-change-password>${icon('lock')}Change password</button>
        <button type="button" class="btn btn-secondary" data-two-step>${icon('shield')}Two step sign in</button>`,
      onOpen(modal) {
        modal.el.querySelector('[data-change-password]').addEventListener('click', () => {
          modal.close();
          A.passwordForm();
        });
        modal.el.querySelector('[data-two-step]').addEventListener('click', () => {
          modal.close();
          A.twoStepForm();
        });
      },
      async onSubmit(values) {
        const saved = await store.update('staff', user.id, values);
        AWY.app.updateUser(saved);
        AWY.ui.toast('Your details have been saved.');
      }
    });
  };

  /* Two step sign in for your own account */
  A.twoStepForm = async function () {
    let step;
    try {
      step = await AWY.auth.twoStep();
    } catch (error) {
      return C.save(Promise.reject(error), '', { area: 'account', operation: 'two step status' });
    }
    const on = !!step.factor;
    const modal = AWY.ui.modal({
      title: 'Two step sign in',
      size: 'narrow',
      body: on
        ? html`<p>Two step sign in is <strong>on</strong>. Each time you sign in, you enter a code from your authenticator app as well as your password.</p>
          ${step.required ? html`<p class="small muted" style="margin-top:0.75rem">It's required for your account, so it can't be turned off.</p>` : ''}`
        : html`<p>Two step sign in is <strong>off</strong>. Turning it on means signing in needs a code from your phone as well as your password, so a guessed password isn't enough on its own.</p>`,
      footer: html`<button type="button" class="btn btn-secondary" data-close>Close</button>
        ${on && !step.required ? html`<button type="button" class="btn btn-danger-solid" data-two-step-off>Turn off</button>` : ''}
        ${on ? '' : html`<button type="button" class="btn" data-two-step-on>${icon('shield')}Set up</button>`}`
    });
    const start = modal.el.querySelector('[data-two-step-on]');
    if (start) start.addEventListener('click', () => {
      modal.close();
      AWY.app.setUpTwoStep();
    });
    const stop = modal.el.querySelector('[data-two-step-off]');
    if (stop) stop.addEventListener('click', async () => {
      modal.close();
      const ok = await AWY.ui.confirm({ title: 'Turn off two step sign in?', message: 'Signing in will only need your password. You can turn it back on at any time.', confirmLabel: 'Turn off', danger: true });
      if (ok) await C.save(AWY.auth.stopTwoStep(step.factor.id), 'Two step sign in is off.', { area: 'account', operation: 'turn off two step' });
    });
  };

  A.passwordForm = function () {
    C.openForm({
      title: 'Change password',
      subtitle: 'Use at least 12 characters, and a password you don\'t use anywhere else.',
      area: 'account',
      fields: [
        { name: 'password', label: 'New password', type: 'password', required: true, minlength: 12, autocomplete: 'new-password', span: 'all' },
        { name: 'confirm', label: 'New password again', type: 'password', required: true, autocomplete: 'new-password', span: 'all' }
      ],
      values: {},
      db: AWY.app.db,
      submitLabel: 'Change password',
      validate(v) {
        return v.password !== v.confirm ? { confirm: "The two passwords don't match" } : {};
      },
      async onSubmit(v) {
        await AWY.auth.setPassword(v.password);
        AWY.ui.toast('Your password has been changed.');
      }
    });
  };

  /* Click handling shared by several screens */
  A.bindCommon = function (ctx) {
    const el = ctx.el;
    AWY.on(el, 'click', '[data-new-task]', () => A.taskForm(null));
    AWY.on(el, 'click', '[data-task-edit]', (event, btn) => A.taskForm(db().tasks.find((t) => t.id === btn.dataset.taskEdit)));
    AWY.on(el, 'click', '[data-block]', (event, btn) => {
      event.preventDefault();
      A.openBlock(btn.dataset.block);
    });
    AWY.on(el, 'click', '[data-new-block]', (event, btn) => A.blockForm(null, btn.dataset.date ? { date: btn.dataset.date } : {}));
    el.addEventListener('change', (event) => {
      const t = event.target;
      if (t.dataset && t.dataset.taskToggle) A.toggleTask(t.dataset.taskToggle, t.checked);
    });
    C.bindRows(el);
  };
})();
