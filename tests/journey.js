/*
  The full user journey: a website referral becomes a client, gets consent, an agreement,
  a funding plan, an assessment and an appointment, which is completed with a finalised
  note and a correction, then invoiced and paid. Dashboard figures must follow along.
*/
const { open } = require('./page');

module.exports = async function journey(ctx) {
  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };
  const p = await open(ctx);
  const dlg = (sel) => 'dialog[open] ' + sel;
  const tables = () => p.evaluate(() => JSON.parse(localStorage.getItem('awy.demo')).tables);
  const figures = () => p.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('.figure')).map((f) => [f.querySelector('.label').innerText, f.querySelector('.value').innerText])));
  const go = (hash) => p.evaluate((h) => { location.hash = h; }, hash);

  await p.goto(ctx.base + 'index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.goto(ctx.base + 'admin/index.html', { waitUntil: 'networkidle' });
  await p.click('text=Enter demo dashboard');
  await p.waitForSelector('.figures');
  await p.waitForTimeout(300);
  const before = await figures();

  /* Website referral with validation */
  await p.goto(ctx.base + 'referrals.html', { waitUntil: 'networkidle' });
  await p.click('button[type=submit]');
  ok((await p.$$('.field-error')).length >= 10, 'Empty referral form did not show field errors');
  await p.fill('#referrerName', 'Kim Lawson');
  await p.selectOption('#referrerRole', 'coordinator');
  await p.fill('#referrerOrg', 'Coastline Coordination (demo)');
  await p.fill('#referrerPhone', '07 5550 3344');
  await p.fill('#referrerEmail', 'kim.lawson@example.org');
  await p.fill('#firstName', 'Riley');
  await p.fill('#lastName', 'Morgan');
  await p.fill('#phone', '0491 570 110');
  await p.fill('#suburb', 'Ballina');
  await p.selectOption('#state', 'NSW');
  await p.selectOption('#fundingType', 'ndis_plan');
  await p.fill('#ndisNumber', '430000099');
  await p.selectOption('#service', 'independence');
  await p.fill('#reason', 'Wants to build confidence cooking and catching the bus.');
  await p.check('input[name=consent]');
  await p.click('button[type=submit]');
  await p.waitForSelector('.form-done');
  await p.click('text=See it in the demo dashboard');
  await p.waitForSelector('text=Accept and create client');

  /* Convert to a client */
  await p.click('text=Accept and create client');
  await p.waitForSelector(dlg('form'));
  const pre = await p.evaluate(() => { const f = document.querySelector('dialog[open] form'); return [f.elements.firstName.value, f.elements.suburb.value, f.elements.ndisNumber.value]; });
  ok(pre.join() === 'Riley,Ballina,430000099', 'Referral details did not carry across: ' + pre.join());
  await p.selectOption(dlg('[name=therapistId]'), 'st_hannah');
  await p.click(dlg('button[type=submit]'));
  await p.waitForSelector('.profile-head');
  await p.waitForTimeout(400);
  const clientId = (await p.evaluate(() => location.hash)).split('/')[2];
  let t = await tables();
  ok(t.referrals.find((r) => r.lastName === 'Morgan').status === 'accepted', 'Referral was not marked accepted');
  ok(t.tasks.some((x) => x.clientId === clientId && x.kind === 'setup'), 'No setup task for the new client');

  /* Consent and agreement */
  await go('#/clients/' + clientId + '/records');
  await p.waitForSelector('[data-new-consent]');
  await p.click('[data-new-consent]');
  await p.waitForSelector(dlg('form'));
  await p.selectOption(dlg('[name=type]'), 'treatment');
  await p.click(dlg('button[type=submit]'));
  await p.waitForTimeout(500);
  await p.click('[data-new-agreement]');
  await p.waitForSelector(dlg('form'));
  await p.check(dlg('input[name=services][value=independence]'));
  await p.selectOption(dlg('[name=status]'), 'awaiting');
  await p.click(dlg('button[type=submit]'));
  await p.waitForSelector('[data-sign]');
  await p.click('[data-sign]');
  await p.waitForSelector(dlg('form'));
  await p.click(dlg('button[type=submit]'));
  await p.waitForSelector('.toast:has-text("Signature recorded")');
  t = await tables();
  ok(t.agreements.some((a) => a.clientId === clientId && a.status === 'signed'), 'Agreement was not signed');
  ok(t.tasks.filter((x) => x.kind === 'agreement' && x.clientId === clientId).every((x) => x.status === 'done'), 'Agreement follow up task was not closed by the signature');

  /* Funding plan, assessment, appointment */
  await go('#/clients/' + clientId + '/funding');
  await p.waitForSelector('[data-new-plan]');
  await p.click('[data-new-plan]');
  await p.waitForSelector(dlg('form'));
  await p.fill(dlg('[name=name]'), 'NDIS plan');
  await p.selectOption(dlg('[name=fundingType]'), 'ndis_plan');
  await p.fill(dlg('[name=budget]'), '6000');
  await p.click(dlg('button[type=submit]'));
  await p.waitForTimeout(500);
  await go('#/clients/' + clientId + '/assessments');
  await p.waitForSelector('[data-new-assessment]');
  await p.click('[data-new-assessment]');
  await p.waitForSelector(dlg('form'));
  await p.selectOption(dlg('[name=type]'), 'initial');
  await p.click(dlg('button[type=submit]'));
  await p.waitForTimeout(500);
  await p.click('.profile-head [data-new-appt]');
  await p.waitForSelector(dlg('form'));
  await p.selectOption(dlg('[name=type]'), 'initial');
  await p.fill(dlg('[name=start]'), '07:00');
  await p.fill(dlg('[name=travelMins]'), '20');
  await p.click(dlg('button[type=submit]'));
  await p.waitForTimeout(500);
  t = await tables();
  const appt = t.appointments.find((a) => a.clientId === clientId);
  ok(!!appt, 'Appointment was not booked');

  /* Complete it and write the note */
  await go('#/clients/' + clientId);
  await p.waitForSelector('.facts-row [data-appt]');
  await p.click('.facts-row [data-appt]');
  await p.click(dlg('[data-act=complete]'));
  await p.click(dlg('[data-confirm]'));
  await p.waitForSelector('text=Write the session note now?');
  await p.click(dlg('[data-confirm]'));
  await p.waitForSelector('#noteForm');
  t = await tables();
  ok(t.supportLogs.some((l) => l.appointmentId === appt.id), 'Completing the appointment did not record services');
  ok(t.tasks.some((x) => x.relatedId === appt.id && x.kind === 'note'), 'No task to write the note');
  await p.fill('#n_reason', 'Initial assessment after support coordinator referral.');
  await p.fill('#n_interventions', 'Interview and COPM.');
  await p.fill('#n_observations', 'Followed a recipe with prompts.');
  await p.fill('#n_plan', 'Weekly therapy for eight weeks.');
  await p.click('button[value=final]');
  await p.click(dlg('[data-confirm]'));
  await p.waitForSelector('[data-amend]');
  t = await tables();
  const note = t.notes.find((n) => n.clientId === clientId);
  ok(note && note.status === 'final', 'Note was not finalised');
  ok(t.tasks.filter((x) => x.relatedId === appt.id && x.kind === 'note').every((x) => x.status === 'done'), 'Note task was not closed');
  const lockMsg = await p.evaluate(async (id) => { try { await AWY.store.update('notes', id, { observations: 'x' }); return 'not locked'; } catch (e) { return e.message; } }, note.id);
  ok(/finalised/.test(lockMsg), 'Finalised note could be changed');
  await p.click('[data-amend]');
  await p.fill(dlg('[name=reason]'), 'Left out travel goal');
  await p.fill(dlg('[name=text]'), 'Also discussed catching the bus.');
  await p.click(dlg('button[type=submit]'));
  await p.waitForSelector('.amendment');

  /* Verify, invoice, issue, pay */
  await go('#/clients/' + clientId + '/funding');
  await p.waitForSelector('[data-verify-log]');
  while (await p.$('[data-verify-log]')) {
    await p.click('[data-verify-log]');
    await p.waitForTimeout(600);
  }
  await p.click('[data-draft-invoice]');
  await p.waitForSelector('[data-issue]');
  const invId = (await p.evaluate(() => location.hash)).split('/')[2];
  t = await tables();
  const sum = t.invoiceLines.filter((l) => l.invoiceId === invId).reduce((s, l) => s + Math.round(l.quantity * l.rate * 100) / 100, 0);
  const shown = await p.evaluate(() => document.querySelector('.doc-table tfoot .total td.num').innerText);
  ok(shown === '$' + sum.toFixed(2), 'Invoice shows ' + shown + ' but its lines add to ' + sum.toFixed(2));
  await p.click('[data-issue]');
  await p.click(dlg('[data-confirm]'));
  await p.waitForSelector('[data-pay]');
  await p.click('[data-pay]');
  await p.click(dlg('button[type=submit]'));
  await p.waitForTimeout(700);
  t = await tables();
  ok(t.invoices.find((i) => i.id === invId).status === 'paid', 'Invoice was not marked paid');

  await go('#/');
  await p.waitForSelector('.figures');
  await p.waitForTimeout(300);
  const after = await figures();
  ok(Number(after['Active clients']) === Number(before['Active clients']) + 1, 'Active clients did not go up by one');

  failures.push(...p.problems);
  await p.close();
  return failures;
};
