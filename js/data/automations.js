/*
  Automations that save time on admin.

  They only ever create tasks or draft records that a person then checks.
  They never finalise clinical notes, confirm that a service was delivered,
  issue invoices or submit claims. Each one is labelled as automatic, recorded
  in the change history and can be switched off in Settings.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const store = AWY.store;
  const rules = AWY.rules;
  const D = AWY.date;

  const SYSTEM = { actor: 'system', instant: true };

  const DEFINITIONS = [
    { key: 'referralTask', label: 'Create a follow up task when a referral arrives' },
    { key: 'consentTask', label: 'Create a setup task for consent and an agreement when a new client is added' },
    { key: 'supportLogs', label: 'Record delivered services when an appointment is marked completed, ready to be checked' },
    { key: 'noteTask', label: 'Create a task to write the note when a session is completed without one' },
    { key: 'closeNoteTask', label: 'Close the note task once the note is finalised' },
    { key: 'agreementTask', label: 'Create a follow up task when an agreement is waiting for a signature' }
  ];

  function enabled(key) {
    const settings = store.settings();
    return !settings.automations || settings.automations[key] !== false;
  }

  function adminId(db) {
    const admin = db.staff.find((s) => s.role === 'admin' && s.active !== false);
    return admin ? admin.id : db.staff[0].id;
  }

  function task(data, reason) {
    return store.create('tasks', Object.assign({ status: 'open', priority: 'normal', automated: true, reason: reason }, data), Object.assign({ summary: 'Created automatically: ' + data.title }, SYSTEM));
  }

  /* Picks the right price item for an appointment, based on the client's funding */
  function itemsForAppointment(db, appt, client) {
    const kind = rules.fundingKind(client.fundingType);
    const out = [];
    let key;
    if (kind === 'ndis') key = 'ndis_ot';
    else if (kind === 'sah') key = 'sah_ot';
    else if (appt.type === 'initial') key = 'private_initial';
    else if (Number(appt.duration) <= 30) key = 'private_short';
    else key = 'private_therapy';
    out.push({ key: key, travel: false });
    const travel = Number(appt.travelMins) || 0;
    if (travel > 0 && kind === 'ndis') out.push({ key: 'ndis_travel', travel: true, minutes: Math.min(travel, 30) });
    if (travel > 20 && kind === 'private') out.push({ key: 'private_travel', travel: true, minutes: travel - 20 });
    return out;
  }

  async function recordSupportLogs(appt) {
    const db = store.peek();
    if (db.supportLogs.some((l) => l.appointmentId === appt.id)) return;
    const client = rules.client(db, appt.clientId);
    if (!client) return;
    const plan = rules.activePlan(db, client.id, appt.date);
    for (const entry of itemsForAppointment(db, appt, client)) {
      const item = rules.rateFor(db, entry.key, appt.date);
      if (!item) continue;
      const minutes = entry.travel ? entry.minutes : Number(appt.duration);
      const quantity = item.unit === 'hour' ? rules.round2(minutes / 60) : 1;
      await store.create('supportLogs', {
        clientId: client.id,
        appointmentId: appt.id,
        staffId: appt.staffId,
        date: appt.date,
        itemId: item.id,
        key: item.key,
        code: item.code || '',
        description: entry.travel ? 'Travel for ' + AWY.schema.labelOf('appointmentType', appt.type).toLowerCase() : AWY.schema.labelOf('appointmentType', appt.type),
        minutes: minutes,
        quantity: quantity,
        unit: item.unit,
        rate: item.rate,
        travel: entry.travel,
        fundingPlanId: plan ? plan.id : null,
        status: 'recorded',
        automated: true
      }, Object.assign({ summary: 'Recorded automatically from a completed appointment, needs checking: ' + (entry.travel ? 'travel' : 'session') + ' on ' + AWY.fmt.date(appt.date) }, SYSTEM));
    }
  }

  async function handle(event) {
    if (event.actor === 'system') return;
    const db = store.peek();
    const today = D.today();
    const r = event.record;

    if (event.type === 'create' && event.table === 'referrals' && enabled('referralTask')) {
      const who = r.referrerName ? r.referrerName + (r.referrerOrg ? ' at ' + r.referrerOrg : '') : r.firstName + ' ' + r.lastName;
      await task({
        title: 'Follow up new referral for ' + r.firstName + ' ' + r.lastName,
        description: 'Contact ' + who + ' to talk about the referral, funding and next steps.',
        dueDate: D.addBusinessDays(today, 2),
        priority: r.source === 'website' ? 'high' : 'normal',
        assignedTo: r.assignedTo || adminId(db),
        relatedType: 'referrals',
        relatedId: r.id,
        kind: 'referral'
      }, 'A new referral was received');
    }

    if (event.type === 'create' && event.table === 'clients' && enabled('consentTask')) {
      await task({
        title: 'Record consent and send a service agreement to ' + rules.clientName(r),
        description: 'Before the first appointment, record consent for assessment and therapy and prepare the service agreement.',
        clientId: r.id,
        dueDate: D.addBusinessDays(today, 3),
        priority: 'high',
        assignedTo: adminId(db),
        relatedType: 'clients',
        relatedId: r.id,
        kind: 'setup'
      }, 'A new client was added');
    }

    if (event.type === 'update' && event.table === 'appointments' && r.status === 'completed' && event.previous.status !== 'completed') {
      if (enabled('supportLogs')) await recordSupportLogs(r);
      const note = rules.noteFor(store.peek(), r.id);
      const hasTask = store.peek().tasks.some((t) => t.relatedId === r.id && t.kind === 'note' && t.status === 'open');
      if (enabled('noteTask') && (!note || note.status !== 'final') && !hasTask) {
        await task({
          title: 'Write session note for ' + rules.clientNameById(db, r.clientId) + ', ' + AWY.fmt.date(r.date),
          description: 'The appointment was marked completed without a finalised note.',
          clientId: r.clientId,
          dueDate: D.addBusinessDays(r.date > today ? r.date : today, 1),
          priority: 'normal',
          assignedTo: r.staffId,
          relatedType: 'appointments',
          relatedId: r.id,
          kind: 'note'
        }, 'A session was completed without a note');
      }
    }

    if (event.type === 'update' && event.table === 'notes' && r.status === 'final' && event.previous.status !== 'final' && enabled('closeNoteTask')) {
      const open = store.peek().tasks.filter((t) => t.kind === 'note' && t.status === 'open' && t.relatedId === r.appointmentId);
      for (const t of open) {
        await store.update('tasks', t.id, { status: 'done', completedAt: D.now(), completedBy: 'system' }, Object.assign({ summary: 'Closed automatically because the note was finalised: ' + t.title }, SYSTEM));
      }
    }

    const nowAwaiting = event.table === 'agreements' && r.status === 'awaiting' && (event.type === 'create' || (event.type === 'update' && event.previous.status !== 'awaiting'));
    if (nowAwaiting && enabled('agreementTask')) {
      await task({
        title: 'Follow up unsigned agreement for ' + rules.clientNameById(db, r.clientId),
        description: 'Agreement ' + r.ref + ' is waiting for a signature. Check in if it has not come back.',
        clientId: r.clientId,
        dueDate: D.addDays(today, 7),
        priority: 'normal',
        assignedTo: adminId(db),
        relatedType: 'agreements',
        relatedId: r.id,
        kind: 'agreement'
      }, 'An agreement was marked as waiting for a signature');
    }
  }

  store.on((event) => {
    handle(event).catch((error) => console.error('Automation failed', error));
  });

  /*
    Builds a draft invoice from a client's verified services.
    Only runs when someone asks for it, and the result stays a draft until issued.
  */
  async function draftInvoice(clientId) {
    const db = store.peek();
    const today = D.today();
    const client = rules.client(db, clientId);
    const logs = db.supportLogs.filter((l) => l.clientId === clientId && l.status === 'verified' && !l.invoiceId).sort((a, b) => a.date.localeCompare(b.date));
    if (!logs.length) throw new store.StoreError('There are no verified services ready to invoice for this client.');
    const settings = store.settings();
    const billing = rules.billTo(db, client, today);
    const invoice = await store.create('invoices', {
      clientId: clientId,
      status: 'draft',
      issueDate: today,
      dueDate: D.addDays(today, Number(settings.invoiceTerms) || 14),
      billTo: billing.billTo,
      billToName: billing.billToName,
      notes: 'Draft created from ' + AWY.fmt.plural(logs.length, 'verified service') + '.',
      fromServices: true
    }, { summary: 'Created a draft invoice from ' + AWY.fmt.plural(logs.length, 'verified service') + ' for ' + rules.clientName(client) });
    for (const l of logs) {
      await store.create('invoiceLines', {
        invoiceId: invoice.id,
        supportLogId: l.id,
        date: l.date,
        itemId: l.itemId,
        code: l.code,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        rate: l.rate
      }, { audit: false, instant: true });
      await store.update('supportLogs', l.id, { status: 'invoiced', invoiceId: invoice.id }, { audit: false, instant: true });
    }
    return invoice;
  }

  AWY.automations = { definitions: DEFINITIONS, enabled: enabled, draftInvoice: draftInvoice, recordSupportLogs: recordSupportLogs };
})();
