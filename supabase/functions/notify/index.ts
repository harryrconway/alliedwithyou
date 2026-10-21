// Sends the dashboard's email alerts:
//   a new account waiting for approval, to every active administrator
//   staff checks coming up for renewal, to the person and, as one list, to administrators
//   privacy requests within 7 days of their 30 day deadline, or past it, to administrators
//   a weekly summary for administrators, on Monday mornings, naming how long it has been
//   since Download everything was last run, since that is the only backup on the free plan
//   service checks: the website, staff sign in and the enquiry form, with an email to
//   administrators and developers after two failures in a row, and when it's working again
// The database's scheduler calls this every 15 minutes with a shared secret. Each alert is
// recorded in the notifications table before it's sent, so nothing goes out twice, and a
// failed send is cleared so it's tried again next time. Check emails name the type of check
// and its date only, never reference numbers. Privacy request emails give the request's own
// reference and due date, never the person's name or what they asked.

import nodemailer from 'npm:nodemailer@9.1.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

// Compares the whole secret rather than stopping at the first different character, so how
// long the comparison takes can't be used to guess it one character at a time.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DASHBOARD = Deno.env.get('DASHBOARD_URL') ?? 'https://alliedwithyou.com.au/admin/';
// On the test project every email goes to this address instead, so nobody real is emailed
const REDIRECT = Deno.env.get('NOTIFY_REDIRECT') ?? '';
const ZONE = 'Australia/Brisbane';
// How long between copies of Download everything before the weekly summary says so
const BACKUP_DUE_DAYS = 14;

const CHECK_LABELS: Record<string, string> = {
  ndis_screening: 'NDIS Worker Screening Check',
  wwcc_nsw: 'Working with Children Check (NSW)',
  wwcc_vic: 'Working with Children Check (Victoria)',
  blue_card: 'Blue card (Queensland)',
  wwcc_sa: 'Working with Children Check (South Australia)',
  wwcc_wa: 'Working with Children Check (Western Australia)',
  rwvp_tas: 'Working with Vulnerable People registration (Tasmania)',
  ochre_card: 'Ochre Card (Northern Territory)',
  wwvp_act: 'Working with Vulnerable People registration (ACT)',
  police: 'National police check',
  ahpra: 'Ahpra registration',
  indemnity: 'Professional indemnity insurance',
  first_aid: 'First aid certificate',
  cpr: 'CPR certificate',
  ota: 'Occupational Therapy Australia membership',
  licence: "Driver's licence",
  car_insurance: 'Car insurance',
  vaccination: 'Vaccination record',
  training: 'Training',
  other: 'Other check',
};

type Person = { id: string; email: string; full_name: string; status: string; role: string };
// check and before: for a service check email, which check it's about and its alerted state before this run
type Mail = { keys: string[]; to: string[]; subject: string; text: string; check?: string; before?: boolean };

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

function daysUntil(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

function longDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

// Reminders go out 60, 30 and 7 days ahead, and once when the check has expired
function stage(days: number): string | null {
  if (days < 0) return 'expired';
  if (days <= 7) return '7';
  if (days <= 30) return '30';
  if (days <= 60) return '60';
  return null;
}

// A privacy request is due within 30 days of being received. A reminder goes out 7 days
// before that, and once when it's overdue, for as long as it stays open.
function privacyStage(daysLeft: number): string | null {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 7) return '7';
  return null;
}

function checkLine(c: { kind: string; details: string; expires_on: string }, now: string): string {
  const label = CHECK_LABELS[c.kind] ?? 'Check';
  const what = c.details ? label + ', ' + c.details : label;
  return what + ', ' + (c.expires_on < now ? 'expired ' : 'expires ') + longDate(c.expires_on);
}

/* The weekday and hour in Queensland, for the Monday morning summary */
function clock(): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: ZONE, weekday: 'long', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  return { weekday: parts.find((p) => p.type === 'weekday')!.value, hour: Number(parts.find((p) => p.type === 'hour')!.value) };
}

async function probe(url: string, init: RequestInit, expect: (r: Response, text: string) => boolean): Promise<string> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
    const text = init.method === 'OPTIONS' ? '' : await r.text();
    return expect(r, text) ? '' : 'Answered with status ' + r.status;
  } catch (error) {
    return (error as Error).name === 'TimeoutError' ? 'No answer within 10 seconds' : 'Could not connect';
  }
}

const CHECK_NAMES: Record<string, string> = { website: 'The website', signin: 'Staff sign in', enquiry: 'The website enquiry and referral forms' };

function firstName(p: Person): string {
  return (p.full_name || '').trim().split(' ')[0] || 'there';
}

Deno.serve(async (req) => {
  const started = Date.now();
  if (req.method !== 'POST') return reply(405, { ok: false });
  const secret = Deno.env.get('NOTIFY_SECRET');
  const given = req.headers.get('x-notify-secret');
  if (!secret || !given || !timingSafeEqual(given, secret)) return reply(401, { ok: false });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const now = today();
  // The scheduler sends {}. A test can ask for one part, and on the test project can pretend a service is down.
  const body = await req.json().catch(() => ({}));
  const parts: string[] = Array.isArray(body.only) ? body.only : ['signups', 'checks', 'weekly', 'monitor', 'privacy'];
  const pretendDown: string[] = REDIRECT && Array.isArray(body.fail) ? body.fail : [];

  const { data: people, error: peopleError } = await db.from('profiles').select('id, email, full_name, status, role, created_at, email_confirmed_at');
  if (peopleError) return reply(500, { ok: false, error: 'read' });
  const admins = (people as Person[]).filter((p) => p.role === 'administrator' && p.status === 'active');
  const adminEmails = admins.map((a) => a.email);
  const byId = new Map((people as Person[]).map((p) => [p.id, p]));
  const mails: Mail[] = [];

  // New accounts that have confirmed their email and are waiting. Without an administrator
  // to tell, nothing is recorded, so the alert goes out once there is one.
  if (parts.includes('signups') && adminEmails.length) {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: reserved } = await db.from('signup_allowlist').select('email');
    const reservedEmails = new Set((reserved ?? []).map((r: { email: string }) => r.email));
    for (const p of people as (Person & { created_at: string; email_confirmed_at: string | null })[]) {
      if (p.status !== 'pending' || !p.email_confirmed_at || p.created_at < since) continue;
      const name = p.full_name || 'Someone';
      const warning = reservedEmails.has(p.email)
        ? ["This is one of the practice's reserved addresses, which should only be set up from its invitation. Please don't approve it. Decline it, and see the operations notes about removing the account.", '']
        : [];
      mails.push({
        keys: ['signup:' + p.id],
        to: adminEmails,
        subject: 'A new account is waiting for approval',
        text: [
          'Hello,',
          '',
          name + ' (' + p.email + ') created an account for the practice dashboard on ' + longDate(p.created_at.slice(0, 10)) + ', confirmed their email address, and is waiting for approval.',
          '',
          ...warning,
          'You can approve or decline it in Team and access:',
          DASHBOARD + '#/staff',
          '',
          'Only approve people you know work with the practice.',
          '',
          'Allied With You dashboard',
        ].join('\n'),
      });
    }
  }

  // Staff checks due for a reminder at their current stage
  const { data: checks, error: checksError } = await db
    .from('staff_checks')
    .select('id, staff_id, kind, details, expires_on')
    .not('expires_on', 'is', null)
    .lte('expires_on', addDays(now, 60));
  if (checksError) return reply(500, { ok: false, error: 'read' });
  const due = (parts.includes('checks') ? checks ?? [] : [])
    .map((c: { id: string; staff_id: string; kind: string; details: string; expires_on: string }) => ({ ...c, stage: stage(daysUntil(now, c.expires_on)) }))
    .filter((c) => c.stage && byId.get(c.staff_id)?.status === 'active');

  // Privacy requests still open, within 7 days of their 30 day deadline or past it
  const { data: privacyRows, error: privacyError } = await db
    .from('privacy_requests')
    .select('id, ref, status, created_at')
    .in('status', ['received', 'in_progress']);
  if (privacyError) return reply(500, { ok: false, error: 'read' });
  const duePrivacy = (parts.includes('privacy') ? privacyRows ?? [] : [])
    .map((p: { id: string; ref: string; status: string; created_at: string }) => ({ ...p, due: addDays(p.created_at.slice(0, 10), 30) }))
    .map((p) => ({ ...p, pstage: privacyStage(daysUntil(now, p.due)) }))
    .filter((p) => p.pstage);

  // Service checks. An alert goes out after two failures in a row, and once more when it's working again.
  const watchers = (people as Person[]).filter((p) => (p.role === 'administrator' || p.role === 'developer') && p.status === 'active').map((p) => p.email);
  const monitorMails: Mail[] = [];
  const results: Record<string, string> = {};
  if (parts.includes('monitor')) {
    results.website = await probe(Deno.env.get('MONITOR_SITE') ?? 'https://alliedwithyou.com.au/', { method: 'GET' }, (r, t) => r.ok && t.includes('Allied With You'));
    results.signin = await probe(SUPABASE_URL + '/auth/v1/health', { method: 'GET', headers: { apikey: SERVICE_KEY } }, (r) => r.ok);
    results.enquiry = await probe(SUPABASE_URL + '/functions/v1/enquiry', { method: 'OPTIONS', headers: { Origin: 'https://alliedwithyou.com.au', 'Access-Control-Request-Method': 'POST' } }, (r) => r.status === 204);
    for (const name of pretendDown) if (name in results) results[name] = 'Pretend failure for testing';
    const { data: before } = await db.from('monitor_checks').select('*');
    const previous = new Map((before ?? []).map((m: { name: string }) => [m.name, m]));
    for (const [name, problem] of Object.entries(results)) {
      const last = (previous.get(name) ?? { ok: true, failures: 0, alerted: false }) as { ok: boolean; failures: number; alerted: boolean };
      const failures = problem ? last.failures + 1 : 0;
      let alerted = last.alerted;
      if (problem && failures >= 2 && !alerted && watchers.length) {
        alerted = true;
        monitorMails.push({ keys: [], check: name, before: last.alerted, to: watchers, subject: CHECK_NAMES[name] + " isn't working", text: [
          'Hello,',
          '',
          CHECK_NAMES[name] + " hasn't been working for the last two checks, about 15 minutes apart. " + problem + '.',
          '',
          "You'll get another email when it's working again.",
          '',
          'Allied With You dashboard',
        ].join('\n') });
      }
      if (!problem && last.alerted) {
        alerted = false;
        monitorMails.push({ keys: [], check: name, before: last.alerted, to: watchers, subject: CHECK_NAMES[name] + ' is working again', text: [
          'Hello,',
          '',
          CHECK_NAMES[name] + ' is working again.',
          '',
          'Allied With You dashboard',
        ].join('\n') });
      }
      await db.from('monitor_checks').upsert({
        name, ok: !problem, failures, alerted, detail: problem.slice(0, 200),
        checked_at: new Date().toISOString(),
        ...(problem ? !last.ok : last.ok) ? {} : { changed_at: new Date().toISOString() },
      });
    }
  }

  // The weekly summary, on Monday mornings in Queensland, or whenever a test asks for it
  const time = clock();
  const weeklyDue = parts.includes('weekly') && adminEmails.length && (Array.isArray(body.only) || (time.weekday === 'Monday' && time.hour >= 8));
  const weekKey = 'weekly:' + addDays(now, -((['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(time.weekday) + 7) % 7));

  // Record every candidate before sending. Keys that already exist come back empty.
  const candidates = [
    ...(weeklyDue ? [{ key: weekKey, kind: 'weekly' }] : []),
    ...mails.flatMap((m) => m.keys.map((key) => ({ key, kind: 'signup' }))),
    ...due.map((c) => ({ key: 'check:' + c.id + ':' + c.stage + ':' + c.expires_on, kind: 'check' })),
    ...duePrivacy.map((p) => ({ key: 'privacy:' + p.id + ':' + p.pstage, kind: 'privacy' })),
  ];
  let claimed = new Set<string>();
  if (candidates.length) {
    const { data: inserted, error: claimError } = await db
      .from('notifications')
      .upsert(candidates, { onConflict: 'key', ignoreDuplicates: true })
      .select('key');
    if (claimError) return reply(500, { ok: false, error: 'record' });
    claimed = new Set((inserted ?? []).map((r: { key: string }) => r.key));
  }

  const sending = mails.filter((m) => m.keys.every((k) => claimed.has(k)));
  sending.push(...monitorMails);

  if (weeklyDue && claimed.has(weekKey)) {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [tasks, templates, tickets, errors, monitor, backup] = await Promise.all([
      db.from('tasks').select('due_date').eq('status', 'open'),
      db.from('templates').select('id').eq('status', 'draft'),
      db.from('feedback').select('status, priority, created_at').in('status', ['submitted', 'under_review', 'planned', 'in_progress']),
      db.from('error_events').select('fingerprint').gte('created_at', weekAgo),
      db.from('monitor_checks').select('name, ok'),
      db.from('audit_events').select('at').eq('action', 'download').ilike('summary', 'Downloaded a copy of everything%').order('at', { ascending: false }).limit(1),
    ]);
    const waiting = (people as (Person & { email_confirmed_at: string | null })[]).filter((p) => p.status === 'pending' && p.email_confirmed_at);
    const openTasks = tasks.data ?? [];
    const renew = (checks ?? []).filter((c: { staff_id: string; expires_on: string }) => byId.get(c.staff_id)?.status === 'active');
    const openTickets = tickets.data ?? [];
    const problems = new Set((errors.data ?? []).map((e: { fingerprint: string }) => e.fingerprint)).size;
    const down = (monitor.data ?? []).filter((m: { ok: boolean }) => !m.ok).map((m: { name: string }) => CHECK_NAMES[m.name]);
    const count = (n: number, one: string, many: string) => (n === 0 ? 'No ' + many : n + ' ' + (n === 1 ? one : many));
    const overdue = openTasks.filter((t: { due_date: string }) => t.due_date < now).length;
    const upcoming = openTasks.filter((t: { due_date: string }) => t.due_date >= now && t.due_date <= addDays(now, 6)).length;
    const urgent = openTickets.filter((t: { priority: string }) => t.priority === 'urgent' || t.priority === 'high').length;
    const fresh = openTickets.filter((t: { created_at: string }) => t.created_at >= weekAgo).length;
    const errorCount = (errors.data ?? []).length;
    const lastBackup = backup.data?.[0]?.at ?? null;
    const backupDays = lastBackup ? daysUntil(lastBackup.slice(0, 10), now) : null;
    const backupLine = backupDays === null
      ? 'Download everything has never been run. It is the only backup while the database plan has none.'
      : 'Download everything was last run ' + (backupDays <= 0 ? 'today' : backupDays === 1 ? '1 day ago' : backupDays + ' days ago')
        + (backupDays >= BACKUP_DUE_DAYS ? '. It is the only backup while the database plan has none, and is worth running again soon' : '');
    sending.push({
      keys: [weekKey],
      to: adminEmails,
      subject: 'Your weekly dashboard summary',
      text: [
        'Hello,',
        '',
        'Here is how the practice dashboard is looking this week.',
        '',
        '\u2022 ' + count(waiting.length, 'account is', 'accounts are') + ' waiting for approval' + (waiting.length ? ': ' + waiting.map((w) => w.full_name || w.email).join(', ') : ''),
        '\u2022 ' + count(overdue, 'task is', 'tasks are') + ' overdue, and ' + (upcoming === 0 ? 'none are' : upcoming + (upcoming === 1 ? ' is' : ' are')) + ' due in the next 7 days',
        '\u2022 ' + (renew.length === 0 ? 'No staff checks expire in the next 60 days' : renew.length === 1 ? '1 staff check expires in the next 60 days or has already expired' : renew.length + ' staff checks expire in the next 60 days or have already expired'),
        '\u2022 ' + count((templates.data ?? []).length, 'template is', 'templates are') + ' waiting for approval',
        '\u2022 ' + (openTickets.length === 0 ? 'No tickets are open' : count(openTickets.length, 'ticket is', 'tickets are') + ' open, ' + (urgent === 0 ? 'none' : urgent) + ' high priority or urgent, and ' + (fresh === 0 ? 'none' : fresh) + ' new this week'),
        '\u2022 ' + (errorCount === 0 ? 'No errors were recorded this week' : count(errorCount, 'error was', 'errors were') + ' recorded this week, across ' + (problems === 1 ? '1 problem' : problems + ' problems')),
        '\u2022 ' + (down.length ? 'Not working at the last check: ' + down.join(', ') : 'The website, sign in and enquiry forms were all working at the last check'),
        '\u2022 ' + backupLine,
        '',
        'Open the dashboard:',
        DASHBOARD,
        '',
        'Allied With You dashboard',
      ].join('\n'),
    });
  }
  const newChecks = due.filter((c) => claimed.has('check:' + c.id + ':' + c.stage + ':' + c.expires_on));
  const checkKey = (c: typeof newChecks[number]) => 'check:' + c.id + ':' + c.stage + ':' + c.expires_on;

  // One reminder for each person, listing their own checks
  const perPerson = new Map<string, typeof newChecks>();
  for (const c of newChecks) perPerson.set(c.staff_id, [...(perPerson.get(c.staff_id) ?? []), c]);
  for (const [staffId, list] of perPerson) {
    const person = byId.get(staffId)!;
    const several = list.length > 1;
    sending.push({
      keys: list.map(checkKey),
      to: [person.email],
      subject: several ? 'Some of your checks need renewing' : 'A check needs renewing',
      text: [
        'Hello ' + firstName(person) + ',',
        '',
        several ? 'This is a reminder about these checks and registrations:' : 'This is a reminder about this check:',
        '',
        ...list.map((c) => '• ' + checkLine(c, now)),
        '',
        'Once renewed, please give the new details to an administrator so the dashboard can be updated.',
        '',
        'You can see your checks in Team and access, under Checks and registrations:',
        DASHBOARD + '#/staff/checks',
        '',
        'Allied With You dashboard',
      ].join('\n'),
    });
  }

  // One list for administrators
  if (newChecks.length && adminEmails.length) {
    sending.push({
      keys: [],
      to: adminEmails,
      subject: 'Staff checks needing renewal',
      text: [
        'Hello,',
        '',
        'These staff checks and registrations need renewing:',
        '',
        ...newChecks.map((c) => '• ' + (byId.get(c.staff_id)?.full_name || byId.get(c.staff_id)?.email) + ': ' + checkLine(c, now)),
        '',
        'Record the new details in Team and access, under Checks and registrations:',
        DASHBOARD + '#/staff/checks',
        '',
        'Allied With You dashboard',
      ].join('\n'),
    });
  }

  // Privacy requests close to, or past, their 30 day deadline
  const newPrivacy = duePrivacy.filter((p) => claimed.has('privacy:' + p.id + ':' + p.pstage));
  if (newPrivacy.length && adminEmails.length) {
    sending.push({
      keys: newPrivacy.map((p) => 'privacy:' + p.id + ':' + p.pstage),
      to: adminEmails,
      subject: newPrivacy.some((p) => p.pstage === 'overdue') ? 'A privacy request is overdue' : 'A privacy request is due soon',
      text: [
        'Hello,',
        '',
        'These privacy requests are close to, or past, the 30 day deadline:',
        '',
        ...newPrivacy.map((p) => '• Reference ' + p.ref + ', ' + (p.pstage === 'overdue' ? 'was due ' : 'due ') + longDate(p.due)),
        '',
        'Work them in Privacy requests:',
        DASHBOARD + '#/privacy',
        '',
        'Allied With You dashboard',
      ].join('\n'),
    });
  }

  // One connection for every email in the run, with time limits, so a slow mail server makes a send
  // fail and be retried next run, rather than the platform stopping the function part way through
  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT') ?? 465),
    secure: true,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASSWORD') },
    pool: true,
    maxConnections: 1,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  let sent = 0;
  const failed: string[] = [];
  const unsent: Mail[] = [];
  const stopAt = started + 100000;
  for (const m of sending) {
    if (Date.now() > stopAt) {
      unsent.push(m);
      continue;
    }
    const to = REDIRECT ? [REDIRECT] : m.to;
    const text = REDIRECT ? '(Test project. This would have gone to ' + m.to.join(', ') + '.)\n\n' + m.text : m.text;
    const began = Date.now();
    try {
      await transport.sendMail({ from: { name: 'Allied With You dashboard', address: Deno.env.get('SMTP_USER')! }, to, subject: m.subject, text });
      sent += 1;
    } catch (error) {
      console.error('Alert email failed:', (error as Error).name, (error as { code?: string }).code ?? '');
      unsent.push(m);
    }
    console.log('Alert email took', Date.now() - began, 'ms');
  }
  transport.close();
  // Anything that didn't send is cleared, so the next run tries again. A service check email
  // puts the check back as it was, so the next run notices the change and sends it again.
  for (const m of unsent) {
    failed.push(...m.keys);
    if (m.check) await db.from('monitor_checks').update({ alerted: m.before }).eq('name', m.check);
  }
  if (failed.length) await db.from('notifications').delete().in('key', failed);

  return reply(unsent.length ? 502 : 200, {
    ok: !unsent.length,
    signups: sending.filter((m) => m.subject.startsWith('A new account')).length,
    checks: newChecks.length,
    weekly: sending.some((m) => m.keys.includes(weekKey)),
    monitor: results,
    emails: sent,
  });
});
