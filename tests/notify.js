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
  const call = (secret) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret }, body: '{}' });
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

    const first = await call(env.STAGING_NOTIFY_SECRET);
    const body = await first.json().catch(() => ({}));
    ok(first.status === 200 && body.ok, 'The alerts function failed: ' + first.status + ' ' + JSON.stringify(body));
    const { data: recorded } = await service.from('notifications').select('key').in('key', keys);
    ok(recorded && recorded.length === 3, 'Not every alert that was due was recorded: ' + (recorded || []).length + ' of 3');
    const { data: far } = await service.from('notifications').select('key').like('key', 'check:' + id('cpr') + ':%');
    ok(far && far.length === 0, 'A reminder was sent for a check that is not due yet');

    await call(env.STAGING_NOTIFY_SECRET);
    /* Every alert mentions the run's code: the waiting person's details, the redirected address or the staff name */
    let emails = 0;
    for (let i = 0; i < 6 && emails < 3; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      emails = inbox(stamp, 'count');
    }
    /* The approval alert, the reminder to the staff member and the list for administrators, once each */
    ok(emails === 3, 'Expected 3 alert emails after running twice, found ' + emails);
  } catch (error) {
    failures.push('The check stopped: ' + error.message);
  } finally {
    for (const userId of made) await service.from('notifications').delete().like('key', '%' + userId + '%');
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
