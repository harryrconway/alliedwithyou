/*
  Checks the browser demo data layer: every link between records resolves,
  totals add up, finalised notes stay locked, automations run, deleting a client
  leaves nothing behind, and a reset restores the sample data.
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(root) {
  const mem = {};
  const window = {
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] },
    addEventListener() {}
  };
  const ctx = vm.createContext({ window, console, setTimeout, clearTimeout, Intl, Date, Math, JSON, Promise });
  window.AWY = {};
  ctx.AWY = window.AWY;
  for (const f of ['core/format.js', 'core/dom.js', 'data/business.js', 'data/schema.js', 'data/seed.js', 'data/store.js', 'data/rules.js', 'data/automations.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
  }
  window.AWY.store.latency = { read: 0, write: 0 };
  return window.AWY;
}

const settle = () => new Promise((r) => setTimeout(r, 30));

module.exports = async function data(ctx) {
  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };
  const AWY = load(ctx.root);
  const R = AWY.rules;
  const today = AWY.date.today();
  let db = await AWY.store.snapshot();
  const seededReferrals = db.referrals.length;

  const ids = (t) => new Set(db[t].map((r) => r.id));
  const fk = (table, field, target, nullable) => {
    const set = ids(target);
    db[table].forEach((r) => {
      const v = r[field];
      if (v === null || v === undefined || v === '') return ok(nullable, table + ' ' + r.id + ' has no ' + field);
      (Array.isArray(v) ? v : [v]).forEach((x) => {
        if (!['system', 'website'].includes(x)) ok(set.has(x), table + ' ' + r.id + ' ' + field + ' points at missing ' + x);
      });
    });
  };
  ['contacts', 'consents', 'agreements', 'appointments', 'notes', 'assessments', 'goals', 'progress', 'reports', 'documents', 'fundingPlans', 'supportLogs', 'invoices'].forEach((t) => fk(t, 'clientId', 'clients', false));
  fk('tasks', 'clientId', 'clients', true);
  fk('incidents', 'clientId', 'clients', true);
  fk('referrals', 'clientId', 'clients', true);
  fk('appointments', 'staffId', 'staff', false);
  fk('notes', 'appointmentId', 'appointments', true);
  fk('notes', 'goalIds', 'goals', true);
  fk('progress', 'goalId', 'goals', false);
  fk('supportLogs', 'itemId', 'supportItems', false);
  fk('supportLogs', 'invoiceId', 'invoices', true);
  fk('invoiceLines', 'invoiceId', 'invoices', false);
  fk('invoiceLines', 'supportLogId', 'supportLogs', true);
  fk('tasks', 'assignedTo', 'staff', false);
  fk('clients', 'therapistId', 'staff', false);
  Object.entries(db).forEach(([t, list]) => ok(new Set(list.map((r) => r.id)).size === list.length, 'Duplicate ids in ' + t));

  /* No staff member is double booked, and nothing falls on a weekend */
  const slots = {};
  db.appointments.filter((a) => a.status !== 'cancelled').forEach((a) => {
    const key = a.staffId + a.date;
    const s = AWY.date.minutes(a.start);
    const e = s + Number(a.duration);
    (slots[key] = slots[key] || []).forEach(([x, y, id]) => ok(e <= x || s >= y, 'Appointment ' + a.id + ' overlaps ' + id));
    slots[key].push([s, e, a.id]);
    const w = AWY.date.weekday(a.date);
    ok(w !== 0 && w !== 6, 'Appointment ' + a.id + ' is on a weekend');
  });

  db.invoices.forEach((i) => ok(db.invoiceLines.some((l) => l.invoiceId === i.id), 'Invoice ' + i.number + ' has no lines'));
  const dash = R.dashboard(db, today);
  ok(dash.activeClients.length === db.clients.filter((c) => c.status === 'active').length, 'Active client count is wrong');
  ok(dash.overdueTasks.length === db.tasks.filter((t) => t.status === 'open' && t.dueDate < today).length, 'Overdue task count is wrong');
  ok(db.supportLogs.some((l) => l.itemId.endsWith('_prev')), 'No delivered service uses last financial year\'s rate');

  /* Finalised notes are locked, corrections keep the original */
  AWY.store.setActor('st_hannah');
  const final = db.notes.find((n) => n.status === 'final');
  let locked = false;
  try {
    await AWY.store.update('notes', final.id, { observations: 'changed' });
  } catch (error) {
    locked = /finalised/.test(error.message);
  }
  ok(locked, 'A finalised note could be overwritten');
  await AWY.store.amendNote(final.id, 'Test reason', 'Test correction');
  db = await AWY.store.snapshot();
  const amended = db.notes.find((n) => n.id === final.id);
  ok(amended.amendments.length === 1 && amended.observations === final.observations, 'Correction was not stored beside the original');

  /* A referral creates a follow up task */
  const tasksBefore = db.tasks.length;
  await AWY.store.create('referrals', { receivedDate: today, source: 'website', firstName: 'Test', lastName: 'Person', suburb: 'Lismore', service: 'home', status: 'new', reason: 'Testing' }, { actor: 'website' });
  await settle();
  db = await AWY.store.snapshot();
  ok(db.tasks.length === tasksBefore + 1, 'A new referral did not create a follow up task');

  /* Completing an appointment records services, which can then be invoiced */
  const appt = db.appointments.find((a) => a.status === 'scheduled' && a.date >= today && db.clients.find((c) => c.id === a.clientId).fundingType.startsWith('ndis'));
  const logsBefore = db.supportLogs.length;
  await AWY.store.update('appointments', appt.id, { status: 'completed' });
  await settle();
  db = await AWY.store.snapshot();
  ok(db.supportLogs.length > logsBefore, 'Completing an appointment did not record delivered services');
  for (const l of db.supportLogs.filter((x) => x.appointmentId === appt.id)) await AWY.store.update('supportLogs', l.id, { status: 'verified' });
  const inv = await AWY.automations.draftInvoice(appt.clientId);
  db = await AWY.store.snapshot();
  const total = R.invoiceTotal(db, db.invoices.find((i) => i.id === inv.id));
  const expected = R.sum(db.supportLogs.filter((l) => l.invoiceId === inv.id), R.logAmount);
  ok(total > 0 && Math.abs(total - expected) < 0.001, 'Draft invoice total ' + total + ' does not match its services ' + expected);

  /* Deleting a client leaves no orphaned records */
  await AWY.store.remove('clients', 'cl_wayne');
  db = await AWY.store.snapshot();
  Object.entries(db).forEach(([t, list]) => list.forEach((r) => { if (r.clientId === 'cl_wayne') failures.push('Record left behind after delete: ' + t + ' ' + r.id); }));
  const invIds = new Set(db.invoices.map((i) => i.id));
  db.invoiceLines.forEach((l) => ok(invIds.has(l.invoiceId), 'Invoice line left behind: ' + l.id));

  /* Reset brings everything back */
  await AWY.store.reset();
  db = await AWY.store.snapshot();
  ok(db.clients.some((c) => c.id === 'cl_wayne'), 'Reset did not restore the deleted client');
  ok(db.referrals.length === seededReferrals, 'Reset did not restore the referrals');
  return failures;
};
