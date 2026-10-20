// Sends website enquiries and referrals to the practice by email.
// Nothing from the enquiry is stored. The only record kept is a scrambled form of the
// visitor's network address with a time, so each visitor is limited to five an hour.

import nodemailer from 'npm:nodemailer@6.9.16';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const ALLOWED_ORIGINS = [
  'https://alliedwithyou.com.au',
  'https://www.alliedwithyou.com.au',
];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PER_HOUR = 5;

const LABELS: Record<string, string> = {
  referralType: 'Type of referral',
  referrerName: 'Referrer name',
  referrerRole: 'Referrer is a',
  referrerOrg: 'Organisation',
  referrerPhone: 'Referrer phone',
  referrerEmail: 'Referrer email',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  about: 'Asking',
  suburb: 'Suburb or town',
  state: 'State or territory',
  fundingType: 'Funding',
  ndisNumber: 'NDIS number',
  service: 'Service needed',
  reason: 'Reason for referral',
  message: 'Message',
  preferredContact: 'Best way to reply',
  consent: 'Person knows about the referral',
};

const RULES: Record<string, { required: string[]; fields: string[] }> = {
  contact: {
    required: ['firstName', 'lastName', 'email', 'about', 'suburb', 'message'],
    fields: ['firstName', 'lastName', 'email', 'phone', 'about', 'suburb', 'state', 'message', 'preferredContact'],
  },
  referral: {
    required: ['referrerName', 'referrerRole', 'referrerPhone', 'referrerEmail', 'firstName', 'lastName', 'phone', 'suburb', 'state', 'fundingType', 'service', 'reason', 'consent'],
    fields: ['referralType', 'referrerName', 'referrerRole', 'referrerOrg', 'referrerPhone', 'referrerEmail', 'firstName', 'lastName', 'phone', 'suburb', 'state', 'fundingType', 'ndisNumber', 'service', 'reason', 'consent'],
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (Deno.env.get('ALLOW_LOCAL') === 'yes' && LOCAL_ORIGIN.test(origin)) return origin;
  return null;
}

function reply(status: number, body: Record<string, unknown>, origin: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    if (!origin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      },
    });
  }
  if (!origin) return reply(403, { ok: false, error: 'origin' }, null);
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method' }, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { ok: false, error: 'invalid' }, origin);
  }

  const kind = body.kind === 'referral' ? 'referral' : body.kind === 'contact' ? 'contact' : '';
  if (!kind) return reply(400, { ok: false, error: 'invalid' }, origin);

  // Spam trap: real people never fill in this hidden field, so pretend all is well
  if (clean(body.website, 200)) return reply(200, { ok: true }, origin);

  const rule = RULES[kind];
  const values: Record<string, string> = {};
  for (const field of rule.fields) {
    values[field] = field === 'consent' ? (body.consent === true || body.consent === 'yes' ? 'Yes' : '') : clean(body[field], field === 'reason' || field === 'message' ? 1500 : 160);
  }
  const missing = rule.required.filter((f) => !values[f]);
  const badEmail = ['email', 'referrerEmail'].some((f) => values[f] && !EMAIL.test(values[f]));
  if (missing.length || badEmail) return reply(400, { ok: false, error: 'invalid', fields: missing }, origin);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Rate limit by a scrambled form of the visitor's address
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256(ip + '|' + (Deno.env.get('FORM_SALT') ?? ''));
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countError } = await admin
    .from('form_limits')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if (countError) return reply(500, { ok: false, error: 'server' }, origin);
  if ((count ?? 0) >= PER_HOUR) return reply(429, { ok: false, error: 'limit' }, origin);
  await admin.from('form_limits').insert({ ip_hash: ipHash });
  await admin.from('form_limits').delete().lt('created_at', new Date(Date.now() - 86400_000).toISOString());

  const lines = rule.fields
    .filter((f) => values[f])
    .map((f) => (f === 'reason' || f === 'message' ? '\n' + LABELS[f] + ':\n' + values[f] : LABELS[f] + ': ' + values[f]));
  const text = [
    kind === 'referral' ? 'A new referral was sent through the website.' : 'A new enquiry was sent through the website.',
    '',
    ...lines,
    '',
    'Reply to this email to respond directly.',
  ].join('\n');

  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT') ?? 465),
    secure: true,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASSWORD') },
  });

  try {
    await transport.sendMail({
      from: { name: 'Allied With You website', address: Deno.env.get('SMTP_USER')! },
      to: Deno.env.get('ENQUIRY_TO'),
      replyTo: kind === 'referral' ? values.referrerEmail : values.email,
      subject: kind === 'referral' ? 'New website referral' : 'New website enquiry',
      text,
    });
  } catch (error) {
    console.error('Enquiry email failed:', (error as Error).name);
    return reply(502, { ok: false, error: 'send' }, origin);
  }

  return reply(200, { ok: true }, origin);
});
