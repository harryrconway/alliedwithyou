/*
  Security rules on the test (staging) Supabase project.
  Creates throwaway accounts, tries what each one should and shouldn't be able to do,
  then removes everything it made. Never runs against production.
*/
const { createClient } = require('@supabase/supabase-js');
const { readEnv } = require('./env');

module.exports = async function auth(ctx) {
  const env = readEnv(ctx.root);
  if (!env.STAGING_URL || !env.STAGING_SECRET_KEY || !env.STAGING_PUBLISHABLE_KEY) {
    return ['The .env file has no staging project keys, so the security rules could not be tested'];
  }
  if (env.STAGING_URL === env.PROD_URL) return ['Refusing to run: the staging address matches production'];

  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(env.STAGING_URL, env.STAGING_SECRET_KEY, opts);
  const anon = createClient(env.STAGING_URL, env.STAGING_PUBLISHABLE_KEY, opts);
  const stamp = Date.now().toString(36);
  const password = 'Test' + Math.random().toString(36).slice(2) + 'Aa9!';
  const made = { users: [], allow: [] };

  async function makeUser(label, profile) {
    const email = 'qa.' + label + '.' + stamp + '@example.com';
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'QA ' + label } });
    if (error) throw new Error('Could not create ' + label + ': ' + error.message);
    made.users.push(data.user.id);
    if (profile) {
      const { error: e2 } = await service.from('profiles').update(profile).eq('id', data.user.id);
      if (e2) throw new Error('Could not set up ' + label + ': ' + e2.message);
    }
    const client = createClient(env.STAGING_URL, env.STAGING_PUBLISHABLE_KEY, opts);
    const { error: e3 } = await client.auth.signInWithPassword({ email, password });
    if (e3) throw new Error('Could not sign in as ' + label + ': ' + e3.message);
    return { id: data.user.id, email, client };
  }

  try {
    const admin = await makeUser('admin', { role: 'administrator', status: 'active' });
    const therapist = await makeUser('therapist', { role: 'therapist', status: 'active' });
    const pending = await makeUser('pending', null);
    const other = await makeUser('other', { role: 'therapist', status: 'active' });

    /* New sign ups start pending with the lowest role */
    const { data: pendRow } = await service.from('profiles').select('status, role').eq('id', pending.id).single();
    ok(pendRow && pendRow.status === 'pending' && pendRow.role === 'support', 'A new sign up did not start as pending support');

    /* Reserved addresses activate only through an accepted invitation */
    const reservedEmail = 'qa.reserved.' + stamp + '@example.com';
    const sneakyEmail = 'qa.sneaky.' + stamp + '@example.com';
    await service.from('signup_allowlist').insert([{ email: reservedEmail, role: 'administrator' }, { email: sneakyEmail, role: 'administrator' }]);
    made.allow.push(reservedEmail, sneakyEmail);
    const invite = await service.auth.admin.generateLink({ type: 'invite', email: reservedEmail });
    ok(!invite.error, 'Invitation for a reserved address failed: ' + (invite.error && invite.error.message));
    if (invite.data && invite.data.user) {
      const invitedId = invite.data.user.id;
      made.users.push(invitedId);
      const before = (await service.from('profiles').select('status').eq('id', invitedId).single()).data;
      ok(before && before.status === 'pending', 'An invited address was active before the invitation was accepted');
      await service.auth.admin.updateUserById(invitedId, { email_confirm: true });
      const after = (await service.from('profiles').select('status, role').eq('id', invitedId).single()).data;
      ok(after && after.status === 'active' && after.role === 'administrator', 'An accepted invitation did not make the reserved address an active administrator');
    }
    const sneaky = await service.auth.admin.createUser({ email: sneakyEmail, password, email_confirm: true });
    if (sneaky.data && sneaky.data.user) {
      made.users.push(sneaky.data.user.id);
      const row = (await service.from('profiles').select('status').eq('id', sneaky.data.user.id).single()).data;
      ok(row && row.status === 'pending', 'A reserved address registered without an invitation became active');
      const sneakyApprove = await admin.client.from('profiles').update({ status: 'active' }).eq('id', sneaky.data.user.id).select('id');
      ok(!!sneakyApprove.error, 'An administrator could approve a reserved address that was never invited');
    }

    /* Approval needs proof the person owns the email address */
    const unconfirmed = await service.auth.admin.createUser({ email: 'qa.unconfirmed.' + stamp + '@example.com', password, email_confirm: false });
    if (unconfirmed.data && unconfirmed.data.user) {
      made.users.push(unconfirmed.data.user.id);
      const early = await admin.client.from('profiles').update({ status: 'active' }).eq('id', unconfirmed.data.user.id).select('id');
      ok(!!early.error, 'An administrator could approve an account before its email was confirmed');
    }
    const { data: pendConfirmed } = await service.from('profiles').select('email_confirmed_at').eq('id', pending.id).single();
    ok(pendConfirmed && pendConfirmed.email_confirmed_at, 'A confirmed sign up did not have its confirmation recorded on the profile');
    const fakeConfirm = await admin.client.from('profiles').update({ email_confirmed_at: new Date().toISOString() }).eq('id', admin.id);
    ok(!!fakeConfirm.error, 'An administrator could change an email confirmation time');

    /* Visitors who aren't signed in can't read anything */
    for (const t of ['profiles', 'settings', 'price_items', 'tasks', 'calendar_blocks', 'feedback', 'error_events', 'audit_events', 'signup_allowlist', 'form_limits']) {
      const { data, error } = await anon.from(t).select('*').limit(1);
      ok(error || (data && data.length === 0), 'A visitor could read ' + t);
    }

    /* Pending accounts see only themselves */
    const pendProfiles = await pending.client.from('profiles').select('id');
    ok(pendProfiles.data && pendProfiles.data.length === 1 && pendProfiles.data[0].id === pending.id, 'A pending account could see other staff');
    const pendSettings = await pending.client.from('settings').select('id');
    ok(pendSettings.data && pendSettings.data.length === 0, 'A pending account could read the practice settings');
    const pendTask = await pending.client.from('tasks').insert({ title: 'Should fail', due_date: '2030-01-01', assigned_to: pending.id, created_by: pending.id });
    ok(!!pendTask.error, 'A pending account could create a task');

    /* Nobody can promote themselves */
    const selfPromote = await therapist.client.from('profiles').update({ role: 'administrator' }).eq('id', therapist.id);
    ok(!!selfPromote.error, 'A therapist could make themselves an administrator');
    const pendActivate = await pending.client.from('profiles').update({ status: 'active' }).eq('id', pending.id);
    ok(!!pendActivate.error, 'A pending account could approve itself');
    const ownName = await therapist.client.from('profiles').update({ full_name: 'QA therapist renamed' }).eq('id', therapist.id).select('full_name');
    ok(!ownName.error && ownName.data && ownName.data.length === 1, 'A therapist could not update their own name');

    /* Settings and fees are read by staff but changed only by administrators */
    const thSettings = await therapist.client.from('settings').select('data').eq('id', 'practice');
    ok(thSettings.data && thSettings.data.length === 1, 'An active therapist could not read the settings');
    const thSettingsEdit = await therapist.client.from('settings').update({ data: {} }).eq('id', 'practice').select('id');
    ok(thSettingsEdit.error || (thSettingsEdit.data && thSettingsEdit.data.length === 0), 'A therapist could change the practice settings');
    const thFee = await therapist.client.from('price_items').insert({ key: 'qa_fee', name: 'QA fee', funding: 'private', unit: 'hour', rate: 1, effective_from: '2030-01-01' });
    ok(!!thFee.error, 'A therapist could add a fee');
    const adFee = await admin.client.from('price_items').insert({ key: 'qa_fee_' + stamp, name: 'QA fee', funding: 'private', unit: 'hour', rate: 1, effective_from: '2030-01-01' }).select('id');
    ok(!adFee.error, 'An administrator could not add a fee: ' + (adFee.error && adFee.error.message));
    if (adFee.data && adFee.data[0]) await service.from('price_items').delete().eq('id', adFee.data[0].id);

    /* Tasks: create your own, can't change someone else's, no client details yet */
    const myTask = await therapist.client.from('tasks').insert({ title: 'QA task', due_date: '2030-01-01', assigned_to: therapist.id, created_by: therapist.id }).select('id').single();
    ok(!myTask.error, 'A therapist could not create a task: ' + (myTask.error && myTask.error.message));
    const otherTask = await other.client.from('tasks').insert({ title: 'QA other task', due_date: '2030-01-01', assigned_to: other.id, created_by: other.id }).select('id').single();
    const editOther = await therapist.client.from('tasks').update({ title: 'Changed by someone else' }).eq('id', otherTask.data.id).select('id');
    ok(editOther.error || (editOther.data && editOther.data.length === 0), 'A therapist could edit a task that was not theirs by changing the id');
    const clientTask = await therapist.client.from('tasks').insert({ title: 'QA client task', due_date: '2030-01-01', assigned_to: therapist.id, created_by: therapist.id, client_id: therapist.id });
    ok(!!clientTask.error, 'A task could be linked to a client before client records are switched on');
    const requestId = '00000000-0000-4000-8000-' + stamp.padStart(12, '0').slice(-12);
    await therapist.client.from('tasks').insert({ title: 'QA retry', due_date: '2030-01-01', assigned_to: therapist.id, created_by: therapist.id, request_id: requestId });
    const retry = await therapist.client.from('tasks').insert({ title: 'QA retry', due_date: '2030-01-01', assigned_to: therapist.id, created_by: therapist.id, request_id: requestId });
    ok(!!retry.error, 'Retrying with the same request id created a duplicate task');

    /* Calendar: your own entries only, and no double booking */
    const start = new Date(Date.UTC(2030, 0, 7, 0, 0));
    const block = await therapist.client.from('calendar_blocks').insert({ staff_id: therapist.id, starts_at: start.toISOString(), duration_mins: 60, kind: 'booked' }).select('id, ends_at').single();
    ok(!block.error && new Date(block.data.ends_at).getTime() === start.getTime() + 3600000, 'Calendar entry was not saved with the right end time');
    const overlap = await therapist.client.from('calendar_blocks').insert({ staff_id: therapist.id, starts_at: new Date(start.getTime() + 1800000).toISOString(), duration_mins: 60, kind: 'booked' });
    ok(!!overlap.error, 'A staff member could be double booked');
    const forOther = await therapist.client.from('calendar_blocks').insert({ staff_id: other.id, starts_at: start.toISOString(), duration_mins: 30, kind: 'booked' });
    ok(!!forOther.error, 'A therapist could add calendar entries for someone else');

    /* Feedback: your own only, administrators and developers see all */
    const fb = await therapist.client.from('feedback').insert({ title: 'QA feedback', description: 'Test', created_by: therapist.id }).select('id, ref').single();
    ok(!fb.error && fb.data.ref && fb.data.ref.length === 6, 'Feedback could not be submitted with a reference');
    const otherSeesFb = await other.client.from('feedback').select('id').eq('id', fb.data.id);
    ok(otherSeesFb.data && otherSeesFb.data.length === 0, 'Staff could read someone else\'s feedback');
    const adminSeesFb = await admin.client.from('feedback').select('id').eq('id', fb.data.id);
    ok(adminSeesFb.data && adminSeesFb.data.length === 1, 'An administrator could not read feedback');

    /* Errors are logged through the safe function and read only by administrators and developers */
    await therapist.client.rpc('log_error', { p_ref: 'QA' + stamp.slice(-4).toUpperCase(), p_category: 'network', p_area: 'tests', p_operation: 'auth check', p_message: 'Test error', p_app_version: 'test', p_fingerprint: 'qa' + stamp });
    const thErrors = await therapist.client.from('error_events').select('id');
    ok(thErrors.data && thErrors.data.length === 0, 'A therapist could read error events');
    const adErrors = await admin.client.from('error_events').select('id').eq('fingerprint', 'qa' + stamp);
    ok(adErrors.data && adErrors.data.length === 1, 'An error logged by staff was not recorded for administrators');
    await anon.rpc('log_error', { p_ref: 'X', p_category: 'network', p_area: '', p_operation: '', p_message: 'anon', p_app_version: '', p_fingerprint: 'anon' + stamp });
    const { count: anonErr } = await service.from('error_events').select('id', { count: 'exact', head: true }).eq('fingerprint', 'anon' + stamp);
    ok(!anonErr, 'A visitor who is not signed in could write error events');

    /* Approvals: an administrator approves, and it's recorded in the audit trail */
    const approve = await admin.client.from('profiles').update({ status: 'active', role: 'therapist' }).eq('id', pending.id).select('status, approved_by');
    ok(!approve.error && approve.data[0].status === 'active' && approve.data[0].approved_by === admin.id, 'An administrator could not approve a sign up');
    const { data: auditRows } = await admin.client.from('audit_events').select('summary').eq('record_id', pending.id).eq('action', 'update');
    ok((auditRows || []).some((r) => /status pending to active/.test(r.summary)), 'The approval was not recorded in the audit trail');
    const thAudit = await therapist.client.from('audit_events').select('id').limit(1);
    ok(thAudit.data && thAudit.data.length === 0, 'A therapist could read the audit trail');

    /* The audit trail can't be changed, even with the secret key */
    const firstAudit = (await service.from('audit_events').select('id').limit(1)).data[0];
    const delAudit = await service.from('audit_events').delete().eq('id', firstAudit.id);
    ok(!!delAudit.error, 'An audit record could be deleted');

    /* There must always be an active administrator */
    const { data: admins } = await service.from('profiles').select('id').eq('role', 'administrator').eq('status', 'active');
    if (admins.length === 1) {
      const demote = await admin.client.from('profiles').update({ role: 'therapist' }).eq('id', admin.id);
      ok(!!demote.error, 'The only administrator could be demoted');
    }
  } catch (error) {
    failures.push('The check stopped: ' + error.message);
  } finally {
    /* Remove everything this run created. Audit records stay, by design. */
    for (const id of made.users) {
      await service.from('feedback').delete().eq('created_by', id);
      await service.from('tasks').delete().or('assigned_to.eq.' + id + ',created_by.eq.' + id);
      await service.from('calendar_blocks').delete().eq('staff_id', id);
    }
    for (const id of made.users.slice().reverse()) await service.auth.admin.deleteUser(id);
    for (const email of made.allow) await service.from('signup_allowlist').delete().eq('email', email);
  }
  return failures;
};
