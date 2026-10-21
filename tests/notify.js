/*
  Email alerts on the test (staging) project: a confirmed account waiting for approval, and
  staff checks due for renewal. Calls the notify function directly, checks each alert is
  recorded once and sent once, and that a wrong secret is refused. On the test project every
  email goes to noreply@, and this check deletes them afterwards. Never runs against production.
*/
const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { readEnv } = require('./env');

/* Counts, and optionally deletes, the alert emails in the noreply@ inbox that mention a marker */
const INBOX = `
import imaplib, sys
env = {}
for line in open(sys.argv[1]):
    if '=' in line and not line.startswith('#'):
        k, v = line.rstrip('\\n').split('=', 1); env[k] = v
m = imaplib.IMAP4_SSL(env['SMTP_HOST'], 993)
m.login(env['SMTP_USER'], env['SMTP_PASSWORD'])
m.select('INBOX')
typ, data = m.search(None, 'BODY', '"' + sys.argv[2] + '"')
ids = data[0].split()
if sys.argv[3] == 'delete':
    for i in ids: m.store(i, '+FLAGS', '\\\\Deleted')
    m.expunge()
print(len(ids))
m.logout()
`;

module.exports = async function notify(ctx) {
  const env = readEnv(ctx.root);
  if (!env.STAGING_URL || !env.STAGING_SECRET_KEY || !env.STAGING_NOTIFY_SECRET) return ['The .env file has no staging notify secret, so the alerts could not be tested'];
  if (env.STAGING_URL === env.PROD_URL) return ['Refusing to run: the staging address matches production'];

  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };
  const service = createClient(env.STAGING_URL, env.STAGING_SECRET_KEY, { auth: { persistSession: false } });
  const url = env.STAGING_URL + '/functions/v1/notify';
  const call = (secret, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret }, body: JSON.stringify(body || {}) });
  /* A run whose emails didn't all send releases them for the next run, so try again as the schedule would */
  let retried = 0;
  const run = async (body) => {
    for (let attempt = 0; ; attempt += 1) {
      const res = await call(env.STAGING_NOTIFY_SECRET, body);
      const json = await res.json().catch(() => ({}));
      if (res.status !== 502 || attempt === 3) return { status: res.status, body: json };
      retried += 1;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  };
  const inbox = (marker, action) => Number(execFileSync('python3', ['-c', INBOX, ctx.root + '/.env', marker, action]).toString().trim());
  const stamp = Date.now().toString(36);
  const marker = 'QA Alert ' + stamp;
  const password = 'Test' + Math.random().toString(36).slice(2) + 'Aa9!';
  const made = [];
  const keys = [];

  async function makeUser(label, profile) {
    const { data, error } = await service.auth.admin.createUser({ email: 'qa.alert' + label + '.' + stamp + '@example.com', password, email_confirm: true, user_metadata: { full_name: marker + ' ' + label } });
    if (error) throw new Error('Could not create ' + label + ': ' + error.message);
    made.push(data.user.id);
    if (profile) await service.from('profiles').update(profile).eq('id', data.user.id);
    return data.user;
  }

  /* Dates as the practice sees them, in Queensland */
  const day = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + n * 86400000));

  try {
    const refused = await call('not the secret');
    ok(refused.status === 401, 'The alerts function accepted a wrong secret (status ' + refused.status + ')');

    await makeUser('admin', { role: 'administrator', status: 'active' });
    const waiting = await makeUser('waiting', null);
    const staff = await makeUser('staff', { role: 'therapist', status: 'active' });
    const soon = day(20);
    const gone = day(-2);
    const { data: checks, error } = await service.from('staff_checks').insert([
      { staff_id: staff.id, kind: 'first_aid', expires_on: soon },
      { staff_id: staff.id, kind: 'car_insurance', expires_on: gone },
      { staff_id: staff.id, kind: 'cpr', expires_on: day(200) }
    ]).select('id, kind');
    if (error) throw new Error('Could not add checks: ' + error.message);
    const id = (kind) => checks.find((c) => c.kind === kind).id;
    keys.push('signup:' + waiting.id, 'check:' + id('first_aid') + ':30:' + soon, 'check:' + id('car_insurance') + ':expired:' + gone);

    /* A privacy request received 25 days ago, so due within the week */
    const { data: request, error: requestError } = await service.from('privacy_requests')
      .insert({ kind: 'access', requester_name: 'QA Alert requester', created_by: staff.id, created_at: new Date(Date.now() - 25 * 86400000).toISOString() })
      .select('id').single();
    if (requestError) throw new Error('Could not add a privacy request: ' + requestError.message);
    keys.push('privacy:' + request.id + ':7');

    const first = await run({});
    ok(first.status === 200 && first.body.ok, 'The alerts function failed: ' + first.status + ' ' + JSON.stringify(first.body));
    const { data: recorded } = await service.from('notifications').select('key').in('key', keys);
    ok(recorded && recorded.length === 4, 'Not every alert that was due was recorded: ' + (recorded || []).length + ' of 4');
    const { data: far } = await service.from('notifications').select('key').like('key', 'check:' + id('cpr') + ':%');
    ok(far && far.length === 0, 'A reminder was sent for a check that is not due yet');

    await run({});

    /* The weekly summary goes once a week. This week's record is cleared first, as the schedule may have sent it already. */
    const weekly = (await run({ only: ['weekly'] })).body;
    if (!weekly.weekly) {
      await service.from('notifications').delete().like('key', 'weekly:%');
    }
    const weeklyAgain = weekly.weekly ? (await run({ only: ['weekly'] })).body : (await run({ only: ['weekly'] })).body;
    const weeklyThird = (await run({ only: ['weekly'] })).body;
    ok((weekly.weekly || weeklyAgain.weekly) && !weeklyThird.weekly, 'The weekly summary was not sent exactly once');
    const { data: weekRows } = await service.from('notifications').select('key').like('key', 'weekly:%');
    keys.push(...(weekRows || []).map((r) => r.key));

    /* Service checks: the real ones pass, and a pretend failure alerts after the second failure, then recovers */
    const real = (await run({ only: ['monitor'] })).body;
    ok(real.monitor && real.monitor.website === '' && real.monitor.signin === '' && real.monitor.enquiry === '', 'A service check failed: ' + JSON.stringify(real.monitor));
    await service.from('monitor_checks').upsert({ name: 'website', ok: false, failures: 1, alerted: false });
    const down = (await run({ only: ['monitor'], fail: ['website'] })).body;
    const { data: downRow } = await service.from('monitor_checks').select('ok, alerted').eq('name', 'website').single();
    ok(down.monitor.website && downRow && !downRow.ok && downRow.alerted, 'A failing service was not marked and alerted after two failures');
    await run({ only: ['monitor'] });
    const { data: upRow } = await service.from('monitor_checks').select('ok, alerted').eq('name', 'website').single();
    ok(upRow && upRow.ok && !upRow.alerted, 'A service that recovered was not marked as working');

    /* Every alert mentions the run's code: the waiting person's details, the redirected address or the staff name */
    let emails = 0;
    for (let i = 0; i < 8 && emails < 7; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      emails = inbox(stamp, 'count');
    }
    /* Approval alert, the staff member's reminder, the administrators' list, the privacy request reminder, the weekly summary, not working, working again */
    ok(emails === 7, 'Expected 7 alert emails, found ' + emails);
  } catch (error) {
    failures.push('The check stopped: ' + error.message);
  } finally {
    for (const userId of made) await service.from('notifications').delete().like('key', '%' + userId + '%');
    for (const userId of made) await service.from('privacy_requests').delete().eq('created_by', userId);
    if (keys.length) await service.from('notifications').delete().in('key', keys);
    for (const userId of made.slice().reverse()) await service.auth.admin.deleteUser(userId);
    try {
      inbox(stamp, 'delete');
    } catch (error) {
      failures.push('Could not tidy the test emails from noreply@');
    }
  }
  return failures;
};
