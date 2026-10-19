/*
  The enquiry Edge Function on the test project: refuses other websites, rejects
  incomplete enquiries and quietly drops spam. These paths never send an email and
  don't count towards the hourly limit, so they're safe to run every time.
*/
const { readEnv } = require('./env');

module.exports = async function enquiry(ctx) {
  const env = readEnv(ctx.root);
  if (!env.STAGING_URL) return ['The .env file has no staging project address, so the enquiry function could not be tested'];
  const url = env.STAGING_URL + '/functions/v1/enquiry';
  const failures = [];
  const post = (body, origin) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin || 'http://localhost:8765' }, body: JSON.stringify(body) });

  const pre = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://alliedwithyou.com.au', 'Access-Control-Request-Method': 'POST' } });
  if (pre.status !== 204 || pre.headers.get('access-control-allow-origin') !== 'https://alliedwithyou.com.au') failures.push('The live website is not allowed to send enquiries');
  const foreign = await post({ kind: 'contact' }, 'https://another.example');
  if (foreign.status !== 403) failures.push('Another website could send enquiries (status ' + foreign.status + ')');
  const missing = await post({ kind: 'contact', firstName: 'Only' });
  if (missing.status !== 400) failures.push('An incomplete enquiry was not rejected (status ' + missing.status + ')');
  const spam = await post({ kind: 'contact', website: 'http://spam.example', firstName: 'Spam' });
  const spamBody = await spam.json().catch(() => ({}));
  if (spam.status !== 200 || !spamBody.ok) failures.push('A spam submission was not quietly accepted and dropped');
  const badEmail = await post({ kind: 'contact', firstName: 'A', lastName: 'B', email: 'not an email', about: 'myself', suburb: 'Lismore', message: 'Hi' });
  if (badEmail.status !== 400) failures.push('An enquiry with an invalid email address was not rejected');
  return failures;
};
