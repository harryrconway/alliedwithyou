/*
  Record actions shared by several screens: appointments, tasks and client records.
  Every message describes only what happened inside the demo.
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
  const db = () => AWY.app.db || store.peek();

  /* Appointments */

  function clashes(data, ignoreId) {
    const start = D.minutes(data.start);
    const end = start + Number(data.duration);
    return db().appointments.find((a) => a.id !== ignoreId && a.staffId === data.staffId && a.date === data.date && a.status !== 'cancelled' && start < D.minutes(a.start) + Number(a.duration) && end > D.minutes(a.start));
  }

  A.appointmentForm = function (existing, prefill) {
    const data = db();
    const settings = data.settings[0] || {};
    const user = access.user();
    const isNew = !existing;
    const start = Object.assign({
      staffId: user.role === 'admin' ? '' : user.id,
      type: 'therapy',
      date: D.today(),
      start: '09:00',
      duration: (settings.durations || {}).therapy || 60,
      location: 'home',
      travelMins: 0
    }, prefill || {}, existing || {});
    if (isNew && start.clientId && !(prefill && prefill.staffId)) {
      const c = rules.client(data, start.clientId);
      if (c && (user.role === 'admin' || user.role === 'owner')) start.staffId = c.therapistId;
      if (c && start.location === 'home' && !start.address) start.address = c.address + ', ' + c.suburb;
    }
    C.openForm({
      title: isNew ? 'New appointment' : 'Edit appointment',
      subtitle: isNew ? 'No reminder will be sent in the demo.' : '',
      fields: schema.tables.appointments.fields,
      values: start,
      db: data,
      submitLabel: isNew ? 'Book appointment' : 'Save changes',
      validate(values) {
        const clash = clashes(values, existing && existing.id);
        if (clash) return { start: 'Overlaps with ' + rules.clientNameById(data, clash.clientId) + ' at ' + fmt.time(clash.start) + ' for the same staff member' };
        return {};
      },
      onOpen(modal) {
        const f = modal.form;
        f.elements.type.addEventListener('change', () => {
          const d = (settings.durations || {})[f.elements.type.value];
          if (d) f.elements.duration.value = d;
        });
        const fillAddress = () => {
          const c = rules.client(data, f.elements.clientId.value);
          if (!c) return;
          if (f.elements.location.value === 'home') f.elements.address.value = c.address + ', ' + c.suburb;
          if (f.elements.location.value === 'telehealth') f.elements.address.value = 'Video call link sent by text';
          if (isNew && (user.role === 'admin' || user.role === 'owner')) f.elements.staffId.value = c.therapistId;
        };
        f.elements.clientId.addEventListener('change', fillAddress);
        f.elements.location.addEventListener('change', fillAddress);
      },
      async onSubmit(values) {
        if (isNew) {
          const rec = await store.create('appointments', Object.assign(values, { status: 'scheduled', goalIds: [] }));
          AWY.ui.toast('Appointment booked for ' + fmt.dateDay(rec.date) + ' at ' + fmt.time(rec.start) + '. No reminder was sent.');
        } else {
          await store.update('appointments', existing.id, values);
          AWY.ui.toast('Appointment updated.');
        }
      }
    });
  };

  A.openAppointment = function (id) {
    const data = db();
    const a = data.appointments.find((x) => x.id === id);
    if (!a) return AWY.ui.toast('That appointment no longer exists.', { tone: 'error' });
    const client = rules.client(data, a.clientId);
    const note = rules.noteFor(data, a.id);
    const live = rules.isLive(a);
    const clinical = access.can('clinical');
    const noteCell = note
      ? html`${C.badge('note', note.status)} ${clinical ? html`<a href="#/notes/${note.id}" data-close>Open note</a>` : ''}`
      : a.status === 'completed' ? html`<span style="color:var(--color-warning);font-weight:680">No note yet</span>` : '';

    const modal = AWY.ui.modal({
      title: C.label('appointmentType', a.type) + ' with ' + rules.clientName(client),
      subtitle: fmt.dateLong(a.date) + ', ' + fmt.timeRange(a.start, a.duration),
      size: 'wide',
      body: html`
        ${client && client.alerts ? html`<div class="notice notice-warning" style="margin-bottom:1rem">${icon('alert')}<div><strong>Visit alerts</strong>${client.alerts}</div></div>` : ''}
        ${C.kv([
          ['Status', C.badge('appointment', a.status)],
          ['Client', html`<a href="#/clients/${a.clientId}" data-close>${rules.clientName(client)}</a>`],
          ['Staff member', rules.staffName(data, a.staffId)],
          ['Location', C.label('location', a.location) + (a.address ? ', ' + a.address : '')],
          ['Travel', a.travelMins ? a.travelMins + ' minutes each way' : ''],
          ['Rescheduled from', a.rescheduledFrom ? fmt.dateDay(a.rescheduledFrom.date) + ' at ' + fmt.time(a.rescheduledFrom.start) + (a.rescheduleReason ? '. ' + a.rescheduleReason : '') : ''],
          ['Cancellation', a.status === 'cancelled' ? (a.cancelReason || 'No reason recorded') + (a.lateCancellation ? ' (short notice)' : '') : ''],
          ['Follow up', a.followUp ? a.followUpNote || 'Needed' : ''],
          ['Booking notes', a.notes],
          ['Clinical note', noteCell]
        ])}`,
      footer: html`
        ${access.can('deleteRecords') ? html`<button type="button" class="btn btn-danger spacer" data-act="delete">${icon('trash')}Delete</button>` : ''}
        ${a.status === 'completed' && clinical && (!note || note.status === 'draft') ? html`<a class="btn btn-secondary" href="${note ? '#/notes/' + note.id : '#/notes/new?appointment=' + a.id}" data-close>${icon('note')}${note ? 'Finish note' : 'Write note'}</a>` : ''}
        ${a.status !== 'cancelled' ? html`<button type="button" class="btn btn-secondary" data-act="edit">${icon('edit')}Edit</button>` : ''}
        ${live ? html`<button type="button" class="btn btn-secondary" data-act="reschedule">${icon('refresh')}Reschedule</button>` : ''}
        ${live ? html`<button type="button" class="btn btn-secondary" data-act="cancel">${icon('minusCircle')}Cancel</button>` : ''}
        ${live && clinical ? html`<button type="button" class="btn" data-act="complete">${icon('check')}Mark completed</button>` : ''}`
    });
    AWY.on(modal.el, 'click', '[data-act]', (event, btn) => {
      const act = btn.dataset.act;
      modal.close();
      if (act === 'edit') A.appointmentForm(a);
      if (act === 'reschedule') A.reschedule(a);
      if (act === 'cancel') A.cancelAppointment(a);
      if (act === 'complete') A.completeAppointment(a.id);
      if (act === 'delete') C.confirmDelete({ table: 'appointments', id: a.id, label: 'this appointment' });
    });
  };

  A.completeAppointment = async function (id) {
    const data = db();
    const a = data.appointments.find((x) => x.id === id);
    const name = rules.clientNameById(data, a.clientId);
    const auto = AWY.automations.enabled('supportLogs');
    const ok = await AWY.ui.confirm({
      title: 'Mark this appointment as completed?',
      message: 'This records the ' + C.label('appointmentType', a.type).toLowerCase() + ' with ' + name + ' on ' + fmt.dateDay(a.date) + ' as having happened.',
      detail: auto ? 'The delivered service will be recorded automatically so it can be checked before any invoice is made.' : '',
      confirmLabel: 'Mark completed'
    });
    if (!ok) return;
    await C.save(store.update('appointments', id, { status: 'completed' }), 'Appointment marked completed.');
    const note = rules.noteFor(store.peek(), id);
    if (access.can('clinical') && (!note || note.status !== 'final')) {
      const write = await AWY.ui.confirm({
        title: 'Write the session note now?',
        message: 'A task has been added so the note isn\'t forgotten. You can write it now or come back to it later.',
        confirmLabel: 'Write note now',
        cancelLabel: 'Later'
      });
      if (write) AWY.router.go(['notes', note ? note.id : 'new'], note ? {} : { appointment: id });
    }
  };

  A.reschedule = function (a) {
    C.openForm({
      title: 'Reschedule appointment',
      subtitle: 'Currently ' + fmt.dateDay(a.date) + ' at ' + fmt.time(a.start) + '. No reminder will be sent.',
      fields: [
        { name: 'date', label: 'New date', type: 'date', required: true },
        { name: 'start', label: 'New start time', type: 'time', required: true },
        { name: 'reason', label: 'Reason', type: 'text', span: 'all', hint: 'For example, requested by the client' }
      ],
      values: { date: a.date, start: a.start },
      db: db(),
      submitLabel: 'Reschedule',
      validate(values) {
        if (values.date === a.date && values.start === a.start) return { date: 'Choose a different date or time' };
        const clash = clashes(Object.assign({}, a, values), a.id);
        return clash ? { start: 'Overlaps with ' + rules.clientNameById(db(), clash.clientId) + ' at ' + fmt.time(clash.start) } : {};
      },
      async onSubmit(values) {
        await store.update('appointments', a.id, {
          date: values.date,
          start: values.start,
          status: 'rescheduled',
          rescheduledFrom: { date: a.date, start: a.start },
          rescheduleReason: values.reason
        });
        AWY.ui.toast('Moved to ' + fmt.dateDay(values.date) + ' at ' + fmt.time(values.start) + '. No reminder was sent.');
      }
    });
  };

  A.cancelAppointment = function (a) {
    const data = db();
    const client = rules.client(data, a.clientId);
    const ndis = client && rules.isNdis(client.fundingType);
    C.openForm({
      title: 'Cancel appointment',
      subtitle: fmt.dateDay(a.date) + ' at ' + fmt.time(a.start) + ' with ' + rules.clientName(client) + '. Nobody will be notified in the demo.',
      fields: [
        { name: 'reason', label: 'Reason for cancelling', type: 'textarea', span: 'all', required: true, rows: 3 },
        { name: 'late', label: 'Cancelled at short notice, as defined in the service agreement', type: 'checkbox', span: 'all' }
      ].concat(ndis ? [{ name: 'charge', label: 'Record a short notice cancellation charge so it can be checked before invoicing', type: 'checkbox', span: 'all' }] : []),
      values: {},
      db: data,
      submitLabel: 'Cancel appointment',
      validate(values) {
        return values.charge && !values.late ? { charge: 'Only short notice cancellations can be charged' } : {};
      },
      async onSubmit(values) {
        await store.update('appointments', a.id, { status: 'cancelled', cancelReason: values.reason, lateCancellation: values.late });
        if (values.charge) {
          const item = rules.rateFor(store.peek(), 'ndis_cancel', a.date);
          if (item) {
            await store.create('supportLogs', {
              clientId: a.clientId, appointmentId: a.id, staffId: a.staffId, date: a.date, itemId: item.id, key: item.key, code: item.code,
              description: 'Short notice cancellation', minutes: a.duration, quantity: rules.round2(a.duration / 60), unit: item.unit, rate: item.rate,
              travel: false, fundingPlanId: (rules.activePlan(store.peek(), a.clientId, a.date) || {}).id || null, status: 'recorded'
            });
          }
        }
        AWY.ui.toast('Appointment cancelled.' + (values.charge ? ' The cancellation charge is waiting to be checked.' : ''));
      }
    });
  };

  /* Tasks */

  A.taskRow = function (data, t, today) {
    const status = rules.taskStatus(t, today);
    const id = 'task_' + t.id;
    return html`<li>
      <input type="checkbox" id="${id}" data-task-toggle="${t.id}" ${raw(t.status === 'done' ? 'checked' : '')} style="width:1.15rem;height:1.15rem;margin-top:0.2rem;accent-color:var(--color-deep);flex:none">
      <div class="what">
        <label for="${id}" style="font-weight:620;cursor:pointer;${t.status === 'done' ? 'text-decoration:line-through;color:var(--color-grey)' : ''}">${t.title}</label>
        <div class="meta">
          ${t.clientId ? html`<span>${icon('user')}${C.clientLink(data, t.clientId)}</span>` : ''}
          <span style="${status === 'overdue' ? 'color:var(--color-danger);font-weight:680' : ''}">${icon('clock')}${status === 'overdue' ? 'Overdue, was due ' : 'Due '}${fmt.relative(t.dueDate).toLowerCase() === 'today' ? 'today' : fmt.date(t.dueDate)}</span>
          <span>${icon('user')}${rules.staffName(data, t.assignedTo)}</span>
          ${t.priority === 'high' ? html`<span>${C.badge('priority', 'high', 'High priority')}</span>` : ''}
          ${t.automated ? html`<span>${C.autoTag(t.reason)}</span>` : ''}
        </div>
      </div>
      <div class="end"><button type="button" class="btn btn-quiet btn-sm" data-task-edit="${t.id}" aria-label="Edit task: ${t.title}">Edit</button></div>
    </li>`;
  };

  A.taskForm = function (existing, prefill) {
    const data = db();
    const isNew = !existing;
    C.openForm({
      title: isNew ? 'New task' : 'Edit task',
      subtitle: existing && existing.automated ? 'Created automatically because: ' + (existing.reason || 'an automation rule') : '',
      fields: schema.tables.tasks.fields,
      values: Object.assign({ priority: 'normal', dueDate: D.addBusinessDays(D.today(), 1), assignedTo: access.user().id }, prefill || {}, existing || {}),
      db: data,
      submitLabel: isNew ? 'Add task' : 'Save task',
      footerStart: existing && access.can('deleteRecords') ? html`<button type="button" class="btn btn-danger" data-delete-task>${icon('trash')}Delete</button>` : '',
      onOpen(modal) {
        const del = modal.el.querySelector('[data-delete-task]');
        if (del) {
          del.addEventListener('click', () => {
            modal.close();
            C.confirmDelete({ table: 'tasks', id: existing.id, label: 'this task' });
          });
        }
      },
      async onSubmit(values) {
        if (isNew) {
          await store.create('tasks', Object.assign(values, { status: 'open', automated: false }));
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
    await C.save(
      store.update('tasks', id, done ? { status: 'done', completedAt: D.now(), completedBy: access.user().id } : { status: 'open', completedAt: '', completedBy: '' }),
      done ? 'Task completed.' : 'Task reopened.'
    );
  };

  /* Clients */

  function clientFields(data) {
    const accepted = ((data.settings[0] || {}).acceptedFunding) || [];
    return schema.tables.clients.fields.map((f) => {
      if (f.name !== 'fundingType') return f;
      return Object.assign({}, f, {
        options: f.options.map((o) => (accepted.includes(o.value) ? o : Object.assign({}, o, { label: o.label + ' (not accepted)', disabled: true })))
      });
    });
  }

  A.clientForm = function (existing, prefill, after) {
    const data = db();
    const isNew = !existing;
    C.openForm({
      title: isNew ? 'New client' : 'Edit client details',
      subtitle: 'Use made up details only. This is a testing environment.',
      fields: clientFields(data),
      values: Object.assign({ status: 'active', state: 'NSW', startDate: D.today(), therapistId: access.user().role === 'therapist' || access.user().role === 'owner' ? access.user().id : '' }, prefill || {}, existing || {}),
      db: data,
      size: 'wide',
      submitLabel: isNew ? 'Create client record' : 'Save changes',
      validate(values) {
        if (rules.isNdis(values.fundingType) && !values.ndisNumber) return { ndisNumber: 'Add the NDIS number for NDIS participants' };
        return {};
      },
      async onSubmit(values) {
        if (isNew) {
          const rec = await store.create('clients', values);
          AWY.ui.toast('Client record created for ' + rules.clientName(rec) + '.');
          if (after) await after(rec);
          else AWY.router.go(['clients', rec.id]);
        } else {
          await store.update('clients', existing.id, values);
          AWY.ui.toast('Client details saved.');
        }
      }
    });
  };

  /* Click handling shared by most screens */
  A.bindCommon = function (ctx) {
    const el = ctx.el;
    AWY.on(el, 'click', '[data-appt]', (event, btn) => {
      event.preventDefault();
      A.openAppointment(btn.dataset.appt);
    });
    AWY.on(el, 'click', '[data-complete]', (event, btn) => A.completeAppointment(btn.dataset.complete));
    AWY.on(el, 'click', '[data-new-client]', () => A.clientForm(null));
    AWY.on(el, 'click', '[data-new-task]', (event, btn) => A.taskForm(null, btn.dataset.client ? { clientId: btn.dataset.client } : {}));
    AWY.on(el, 'click', '[data-task-edit]', (event, btn) => A.taskForm(db().tasks.find((t) => t.id === btn.dataset.taskEdit)));
    AWY.on(el, 'click', '[data-new-appt]', (event, btn) => A.appointmentForm(null, { clientId: btn.dataset.client || '', date: btn.dataset.date || D.today(), start: btn.dataset.time || '09:00' }));
    el.addEventListener('change', (event) => {
      const t = event.target;
      if (t.dataset && t.dataset.taskToggle) A.toggleTask(t.dataset.taskToggle, t.checked);
    });
    C.bindRows(el);
  };
})();
