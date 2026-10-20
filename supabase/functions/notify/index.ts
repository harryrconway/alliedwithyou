// Sends the dashboard's email alerts:
//   a new account waiting for approval, to every active administrator
//   staff checks coming up for renewal, to the person and, as one list, to administrators
// The database's scheduler calls this every 15 minutes with a shared secret. Each alert is
// recorded in the notifications table before it's sent, so nothing goes out twice, and a
// failed send is cleared so it's tried again next time. Emails name the type of check and
// its date only, never reference numbers.

import nodemailer from 'npm:nodemailer@6.9.16';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const DASHBOARD = Deno.env.get('DASHBOARD_URL') ?? 'https://alliedwithyou.com.au/admin/';
// On the test project every email goes to this address instead, so nobody real is emailed
const REDIRECT = Deno.env.get('NOTIFY_REDIRECT') ?? '';
const ZONE = 'Australia/Brisbane';

const CHECK_LABELS: Record<string, string> = {
  ndis_screening: 'NDIS Worker Screening Check',
  wwcc_nsw: 'Working with Children Check (NSW)',
  blue_card: 'Blue card (Queensland)',
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
type Mail = { keys: string[]; to: string[]; subject: string; text: string };

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

function checkLine(c: { kind: string; details: string; expires_on: string }, now: string): string {
  const label = CHECK_LABELS[c.kind] ?? 'Check';
  const what = c.details ? label + ', ' + c.details : label;
  return what + ', ' + (c.expires_on < now ? 'expired ' : 'expires ') + longDate(c.expires_on);
}

function firstName(p: Person): string {
  return (p.full_name || '').trim().split(' ')[0] || 'there';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { ok: false });
  const secret = Deno.env.get('NOTIFY_SECRET');
  if (!secret || req.headers.get('x-notify-secret') !== secret) return reply(401, { ok: false });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const now = today();

  const { data: people, error: peopleError } = await db.from('profiles').select('id, email, full_name, status, role, created_at, email_confirmed_at');
  if (peopleError) return reply(500, { ok: false, error: 'read' });
  const admins = (people as Person[]).filter((p) => p.role === 'administrator' && p.status === 'active');
  const adminEmails = admins.map((a) => a.email);
  const byId = new Map((people as Person[]).map((p) => [p.id, p]));
  const mails: Mail[] = [];

  // New accounts that have confirmed their email and are waiting. Without an administrator
  // to tell, nothing is recorded, so the alert goes out once there is one.
  if (adminEmails.length) {
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
  const due = (checks ?? [])
    .map((c: { id: string; staff_id: string; kind: string; details: string; expires_on: string }) => ({ ...c, stage: stage(daysUntil(now, c.expires_on)) }))
    .filter((c) => c.stage && byId.get(c.staff_id)?.status === 'active');

  // Record every candidate before sending. Keys that already exist come back empty.
  const candidates = [
    ...mails.flatMap((m) => m.keys.map((key) => ({ key, kind: 'signup' }))),
    ...due.map((c) => ({ key: 'check:' + c.id + ':' + c.stage + ':' + c.expires_on, kind: 'check' })),
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

  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT') ?? 465),
    secure: true,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASSWORD') },
  });

  let sent = 0;
  const failed: string[] = [];
  for (const m of sending) {
    const to = REDIRECT ? [REDIRECT] : m.to;
    const text = REDIRECT ? '(Test project. This would have gone to ' + m.to.join(', ') + '.)\n\n' + m.text : m.text;
    try {
      await transport.sendMail({ from: { name: 'Allied With You dashboard', address: Deno.env.get('SMTP_USER')! }, to, subject: m.subject, text });
      sent += 1;
    } catch (error) {
      console.error('Alert email failed:', (error as Error).name);
      failed.push(...m.keys);
    }
  }
  // Anything that didn't send is cleared, so the next run tries again
  if (failed.length) await db.from('notifications').delete().in('key', failed);

  return reply(failed.length ? 502 : 200, {
    ok: !failed.length,
    signups: sending.filter((m) => m.subject.startsWith('A new account')).length,
    checks: newChecks.length,
    emails: sent,
  });
});
