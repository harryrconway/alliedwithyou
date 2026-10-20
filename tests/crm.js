/*
  The staff dashboard in a real browser, against the test (staging) project.
  Signs in with throwaway accounts, uses each section that's switched on, checks that
  locked sections can't be opened and that failed saves explain themselves.
  Everything it creates is removed afterwards. Never runs against production.
*/
const { createClient } = require('@supabase/supabase-js');
const { open } = require('./page');
const { readEnv } = require('./env');

module.exports = async function crm(ctx) {
  const env = readEnv(ctx.root);
  if (!env.STAGING_URL || !env.STAGING_SECRET_KEY) return ['The .env file has no staging project keys, so the dashboard could not be tested'];
  if (env.STAGING_URL === env.PROD_URL) return ['Refusing to run: the staging address matches production'];

  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };
  const service = createClient(env.STAGING_URL, env.STAGING_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = Date.now().toString(36);
  const password = 'Test' + Math.random().toString(36).slice(2) + 'Aa9!';
  const made = [];
  const cleanup = { prices: [], reopen: [], allow: [], templates: [] };

  async function makeUser(label, profile) {
    const email = 'qa.ui' + label + '.' + stamp + '@example.com';
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'QA ' + label } });
    if (error) throw new Error('Could not create ' + label + ': ' + error.message);
    made.push(data.user.id);
    if (profile) {
      const { error: e2 } = await service.from('profiles').update(profile).eq('id', data.user.id);
      if (e2) throw new Error('Could not set up ' + label + ': ' + e2.message);
    }
    return { id: data.user.id, email };
  }

  async function signIn(p, email, pass) {
    if (!(await p.isVisible('#identifier'))) {
      await p.goto(ctx.base + 'admin/', { waitUntil: 'networkidle' });
      await p.waitForSelector('#identifier');
    }
    await p.fill('#identifier', email);
    await p.fill('#password', pass || password);
    await p.click('#signinForm [type="submit"]');
  }

  async function toast(p, pattern) {
    try {
      await p.waitForSelector('.toast >> text=' + pattern, { timeout: 8000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function signOut(p) {
    await p.click('[data-action="signout"]');
    await p.waitForSelector('#identifier');
  }

  /* Expected noise: dropped connections, a wrong password, and the database refusing the double booking
     when it gets there before the screen's own check does */
  const expected = /ERR_FAILED|Failed to load resource|Reference [A-Z0-9]{6}|status of 400|status of 401|status of 409|400 for .*token\?grant_type=password|(400|409) for .*calendar_blocks/;
  const pages = [];

  try {
    const admin = await makeUser('admin', { role: 'administrator', status: 'active' });
    const therapist = await makeUser('therapist', { role: 'therapist', status: 'active', title: 'Occupational therapist' });
    const pending = await makeUser('pending', null);

    const p = await open(ctx, 1366);
    pages.push(p);
    await p.goto(ctx.base + 'admin/', { waitUntil: 'networkidle' });
    ok(await p.isVisible('#identifier'), 'The sign in form did not show');

    /* Reserved addresses are sent to their invitation */
    await p.click('[data-tab="create"]');
    await p.fill('#fullName', 'QA person');
    await p.fill('#email', 'jake@alliedwithyou.com.au');
    await p.fill('#newPassword', password);
    await p.fill('#confirmPassword', password);
    await p.click('#createForm [type="submit"]');
    ok(await p.isVisible('text=has its own invitation'), 'A reserved address was not told to use its invitation');

    /* A wrong password gets a clear message */
    await p.click('[data-tab="signin"]');
    await signIn(p, therapist.email, 'not the right password');
    await p.waitForSelector('#signinForm .form-summary .notice', { timeout: 8000 }).catch(() => null);
    ok(/don't match/.test(await p.textContent('#signinForm .form-summary').catch(() => '')), 'A wrong password did not explain what went wrong');

    /* Accounts waiting for approval can't get in */
    await signIn(p, pending.email);
    ok(await p.waitForSelector('h1:has-text("Waiting for approval")', { timeout: 8000 }).then(() => true, () => false), 'A pending account was not shown the waiting screen');
    await p.click('[data-signout]');
    await p.waitForSelector('#identifier');

    /* A therapist signs in */
    await signIn(p, therapist.email);
    ok(await p.waitForSelector('h1:has-text("Good")', { timeout: 10000 }).then(() => true, () => false), 'An active therapist could not reach the dashboard');

    /* Locked sections are greyed and can't be opened */
    const locked = await p.$$eval('.side-link.is-locked', (els) => els.map((e) => ({ tag: e.tagName, disabled: e.getAttribute('aria-disabled') })));
    ok(locked.length >= 8, 'Expected the sensitive sections to be greyed out, found ' + locked.length);
    ok(locked.every((l) => l.tag !== 'A' && l.disabled === 'true'), 'A greyed out section could still be clicked');
    await p.goto(ctx.base + 'admin/#/clients');
    ok(await p.waitForSelector('text=Not switched on yet', { timeout: 5000 }).then(() => true, () => false), 'Opening a locked section directly did not show the locked notice');

    /* Settings are read only for a therapist */
    await p.goto(ctx.base + 'admin/#/settings');
    await p.waitForSelector('text=Only administrators can change settings');
    ok(await p.$eval('#b_email', (el) => el.disabled), 'A therapist could edit the practice settings');
    ok(!(await p.isVisible('[data-new-rate]')), 'A therapist was offered a new fee rate');

    /* Tasks */
    const taskTitle = 'QA browser task ' + stamp;
    await p.goto(ctx.base + 'admin/#/tasks');
    await p.click('.page-head [data-new-task]');
    await p.fill('dialog input[name="title"]', taskTitle);
    await p.click('dialog [type="submit"]');
    ok(await toast(p, 'Task added.'), 'A new task was not saved');
    await p.waitForSelector('label:has-text("' + taskTitle + '")');
    const taskId = await p.$eval('label:has-text("' + taskTitle + '")', (l) => l.htmlFor.replace('task_', ''));
    await p.check('#task_' + taskId);
    ok(await toast(p, 'Task completed.'), 'A task could not be completed');

    /* A dropped connection while saving is explained, with a reference */
    await p.route('**/rest/v1/tasks**', (route) => route.abort());
    await p.click('.page-head [data-new-task]');
    await p.fill('dialog input[name="title"]', 'QA dropped ' + stamp);
    await p.click('dialog [type="submit"]');
    await p.waitForSelector('dialog .form-summary .notice', { timeout: 8000 }).catch(() => null);
    const dropped = await p.textContent('dialog .form-summary').catch(() => '');
    ok(/connection dropped/.test(dropped) && /Reference [A-Z0-9]{6}/.test(dropped), 'A save that lost its connection did not explain what happened: ' + dropped.trim());
    ok(await p.inputValue('dialog input[name="title"]') === 'QA dropped ' + stamp, 'A failed save lost what was typed');
    await p.unroute('**/rest/v1/tasks**');
    await p.click('dialog [data-close]');

    /* Calendar: add an entry, and overlaps are refused */
    await p.goto(ctx.base + 'admin/#/calendar?date=2031-03-03');
    await p.waitForSelector('.cal-toolbar');
    const addEntry = async (start) => {
      await p.click('.page-head [data-new-block]');
      await p.selectOption('dialog select[name="kind"]', 'booked');
      await p.fill('dialog input[name="date"]', '2031-03-03');
      await p.fill('dialog input[name="start"]', start);
      await p.selectOption('dialog select[name="duration"]', '60');
      await p.selectOption('dialog select[name="timeZone"]', 'Australia/Sydney');
      await p.click('dialog [type="submit"]');
    };
    await addEntry('09:00');
    ok(await toast(p, 'Added to the calendar'), 'A calendar entry was not saved');
    await p.waitForSelector('.cal-event.is-booked');
    ok(/NSW/.test(await p.textContent('.cal-event.is-booked')), 'A calendar entry did not show its NSW marker');
    await addEntry('09:30');
    ok(await p.waitForSelector('dialog .field-error:has-text("Overlaps")', { timeout: 5000 }).then(() => true, () => false), 'An overlapping calendar entry was not refused');
    await p.click('dialog [data-close]');
    const { data: blocks } = await service.from('calendar_blocks').select('starts_at, time_zone').eq('staff_id', therapist.id);
    ok(blocks && blocks.length === 1 && blocks[0].starts_at.startsWith('2031-03-02T22:00'), 'A 9am NSW entry was not stored as the right moment');

    /* Reporting an issue */
    await p.click('[data-action="report"]');
    await p.selectOption('dialog select[name="kind"]', 'bug');
    await p.fill('dialog input[name="title"]', 'QA report ' + stamp);
    await p.fill('dialog textarea[name="description"]', 'Made by the browser check.');
    await p.click('dialog [type="submit"]');
    ok(await toast(p, 'Its reference is'), 'An issue report was not sent');

    await signOut(p);

    /* An administrator approves the waiting account and changes a fee */
    await signIn(p, admin.email);
    await p.waitForSelector('h1:has-text("Good")', { timeout: 10000 });
    await p.goto(ctx.base + 'admin/#/staff');
    await p.click('[data-approve="' + pending.id + '"]');
    await p.selectOption('dialog select[name="role"]', 'support');
    await p.click('dialog [type="submit"]');
    ok(await toast(p, 'can now sign in'), 'An administrator could not approve an account');
    const { data: approved } = await service.from('profiles').select('status, role, approved_by').eq('id', pending.id).single();
    ok(approved.status === 'active' && approved.role === 'support' && approved.approved_by === admin.id, 'The approval was not saved correctly');

    await p.goto(ctx.base + 'admin/#/settings');
    const { data: before } = await service.from('price_items').select('id, effective_to').eq('key', 'private_therapy').is('effective_to', null);
    cleanup.reopen = before.map((r) => r.id);
    await p.click('[data-new-rate="private_therapy"]');
    await p.fill('dialog input[name="rate"]', '201');
    await p.fill('dialog input[name="effectiveFrom"]', '2031-01-01');
    await p.click('dialog [type="submit"]');
    ok(await toast(p, 'New rate'), 'An administrator could not add a new fee rate');
    const { data: rates } = await service.from('price_items').select('id, rate, effective_from').eq('key', 'private_therapy').eq('effective_from', '2031-01-01');
    ok(rates && rates.length === 1 && Number(rates[0].rate) === 201, 'The new fee rate was not stored');
    cleanup.prices = (rates || []).map((r) => r.id);

    /* Feedback and the error report behind a reference */
    await p.goto(ctx.base + 'admin/#/feedback');
    await p.click('[data-open-report]:has-text("QA report ' + stamp + '")');
    await p.selectOption('dialog select[name="status"]', 'under_review');
    await p.fill('dialog textarea[name="response"]', 'Thanks, looking into it.');
    await p.click('dialog [type="submit"]');
    ok(await toast(p, 'updated'), 'An administrator could not update a report');
    await p.goto(ctx.base + 'admin/#/feedback/errors');
    ok(await p.waitForSelector('td:has-text("Save not confirmed")', { timeout: 5000 }).then(() => true, () => false), 'The dropped connection was not in the error reports');

    /* Templates: an administrator adds one as a draft, uploads a second version and approves it */
    const tplName = 'QA template ' + stamp;
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const fileOne = path.join(os.tmpdir(), 'qa' + stamp + 'one.txt');
    const fileTwo = path.join(os.tmpdir(), 'qa' + stamp + 'two.txt');
    fs.writeFileSync(fileOne, 'QA template, first version');
    fs.writeFileSync(fileTwo, 'QA template, second version');
    await p.goto(ctx.base + 'admin/#/templates');
    await p.click('.page-head [data-new-template]');
    await p.fill('dialog input[name="title"]', tplName);
    await p.selectOption('dialog select[name="category"]', 'form');
    await p.setInputFiles('dialog input[name="file"]', fileOne);
    await p.click('dialog [type="submit"]');
    ok(await toast(p, 'added as a draft'), 'An administrator could not add a template');
    const { data: tplRows } = await service.from('templates').select('id, status, current_version_id').eq('title', tplName);
    ok(tplRows && tplRows.length === 1 && tplRows[0].status === 'draft' && tplRows[0].current_version_id, 'The new template was not saved as a draft with its file');
    cleanup.templates = (tplRows || []).map((t) => t.id);
    await p.click('[data-open-template="' + tplRows[0].id + '"] >> nth=0');
    await p.click('dialog [data-act="version"]');
    await p.setInputFiles('dialog input[name="file"]', fileTwo);
    await p.fill('dialog input[name="note"]', 'Second version from the browser check');
    await p.click('dialog [type="submit"]');
    ok(await toast(p, 'Version 2'), 'A new template version was not uploaded');
    await p.click('[data-open-template="' + tplRows[0].id + '"] >> nth=0');
    await p.click('dialog [data-act="approved"]');
    await p.click('dialog [data-confirm]');
    ok(await toast(p, 'is approved'), 'An administrator could not approve a template');

    /* A check that's about to expire shows on the dashboard */
    await p.goto(ctx.base + 'admin/#/staff/checks');
    await p.click('[data-add-check="' + therapist.id + '"]');
    await p.selectOption('dialog select[name="kind"]', 'first_aid');
    const soon = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    await p.fill('dialog input[name="expiresOn"]', soon);
    await p.click('dialog [type="submit"]');
    ok(await toast(p, 'First aid certificate added'), 'An administrator could not record a staff check');
    await p.goto(ctx.base + 'admin/#/');
    ok(await p.waitForSelector('h2:has-text("Checks to renew")', { timeout: 8000 }).then(() => true, () => false), 'A check due to expire was not flagged on the dashboard');

    await signOut(p);

    /* The therapist downloads the approved template, and sees their own check */
    await signIn(p, therapist.email, password);
    await p.waitForSelector('h1:has-text("Good")', { timeout: 10000 });
    await p.goto(ctx.base + 'admin/#/templates');
    await p.waitForSelector('[data-download="' + tplRows[0].id + '"]', { timeout: 8000 });
    const [download] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('[data-download="' + tplRows[0].id + '"]')]);
    const got = fs.readFileSync(await download.path(), 'utf8');
    ok(got === 'QA template, second version' && /version 2/.test(download.suggestedFilename()), 'The therapist did not download the latest approved version');
    ok(!(await p.isVisible('[data-new-template]')), 'A therapist was offered a new template');
    await p.goto(ctx.base + 'admin/#/staff/checks');
    ok(await p.waitForSelector('text=First aid certificate', { timeout: 8000 }).then(() => true, () => false), 'A therapist could not see their own check');
    ok(!(await p.isVisible('[data-add-check]')), 'A therapist was offered to add checks');
    fs.unlinkSync(fileOne);
    fs.unlinkSync(fileTwo);
    await signOut(p);

    /* Accepting an invitation to a reserved address: choose a name and password, then straight in */
    const invitedEmail = 'qa.uiinvite.' + stamp + '@example.com';
    await service.from('signup_allowlist').insert({ email: invitedEmail, role: 'administrator' });
    cleanup.allow.push(invitedEmail);
    const invite = await service.auth.admin.generateLink({ type: 'invite', email: invitedEmail, options: { redirectTo: ctx.base + 'admin/' } });
    if (invite.error) throw new Error('Could not make an invitation: ' + invite.error.message);
    made.push(invite.data.user.id);
    await p.goto(invite.data.properties.action_link);
    await p.waitForSelector('#setPasswordForm', { timeout: 10000 });
    ok(!/access_token/.test(p.url()), 'The sign in token was left in the address bar');
    await p.fill('#setName', 'QA Invited');
    await p.fill('#setPassword', password);
    await p.fill('#setConfirm', password);
    await p.click('#setPasswordForm [type="submit"]');
    ok(await toast(p, 'Your password is saved'), 'Accepting an invitation did not save the password');
    ok(await p.isVisible('h1:has-text("Good")'), 'An accepted invitation did not lead into the dashboard');
    const { data: invited } = await service.from('profiles').select('status, role, full_name').eq('id', invite.data.user.id).single();
    ok(invited.status === 'active' && invited.role === 'administrator' && invited.full_name === 'QA Invited', 'An accepted invitation did not set up an active administrator with their name');
    await signOut(p);

    /* Resetting a forgotten password from the emailed link */
    const newPassword = password + 'New';
    const recovery = await service.auth.admin.generateLink({ type: 'recovery', email: therapist.email, options: { redirectTo: ctx.base + 'admin/' } });
    if (recovery.error) throw new Error('Could not make a reset link: ' + recovery.error.message);
    await p.goto(recovery.data.properties.action_link);
    await p.waitForSelector('#setPasswordForm', { timeout: 10000 });
    await p.fill('#setPassword', newPassword);
    await p.fill('#setConfirm', newPassword);
    await p.click('#setPasswordForm [type="submit"]');
    ok(await toast(p, 'Your new password is saved'), 'A password reset was not saved');
    await signOut(p);
    await signIn(p, therapist.email, newPassword);
    ok(await p.waitForSelector('h1:has-text("Good")', { timeout: 10000 }).then(() => true, () => false), 'The new password did not work after a reset');
    await signOut(p);

    /* An expired or used link explains itself */
    await p.goto(recovery.data.properties.action_link);
    ok(await p.waitForSelector('text=expired or has already been used', { timeout: 10000 }).then(() => true, () => false), 'A used reset link did not explain what happened');

    /* Small screens fit without sideways scrolling */
    const small = await open(ctx, 360);
    pages.push(small);
    await signIn(small, therapist.email, password + 'New');
    await small.waitForSelector('h1:has-text("Good")', { timeout: 10000 });
    for (const view of ['', 'tasks', 'calendar', 'staff', 'settings', 'feedback']) {
      await small.goto(ctx.base + 'admin/#/' + view);
      await small.waitForTimeout(600);
      const sw = await small.evaluate(() => document.documentElement.scrollWidth);
      ok(sw <= 361, 'The ' + (view || 'dashboard') + ' screen is ' + sw + 'px wide on a phone');
    }

    for (const pg of pages) pg.problems.filter((x) => !expected.test(x)).forEach((x) => failures.push(x));
  } catch (error) {
    failures.push('The check stopped: ' + error.message.split('\n')[0]);
  } finally {
    for (const pg of pages) await pg.close().catch(() => null);
    for (const id of cleanup.templates) {
      const { data: files } = await service.storage.from('templates').list(id);
      if (files && files.length) await service.storage.from('templates').remove(files.map((f) => id + '/' + f.name));
      await service.from('templates').delete().eq('id', id);
    }
    if (cleanup.prices.length) await service.from('price_items').delete().in('id', cleanup.prices);
    if (cleanup.reopen.length) await service.from('price_items').update({ effective_to: null }).in('id', cleanup.reopen);
    for (const id of made) {
      await service.from('feedback').delete().eq('created_by', id);
      await service.from('tasks').delete().or('assigned_to.eq.' + id + ',created_by.eq.' + id);
      await service.from('calendar_blocks').delete().eq('staff_id', id);
      await service.from('error_events').delete().eq('user_id', id);
    }
    for (const id of made.slice().reverse()) await service.auth.admin.deleteUser(id);
    for (const email of cleanup.allow) await service.from('signup_allowlist').delete().eq('email', email);
  }
  return failures;
};
