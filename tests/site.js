/*
  The website's enquiry and referral forms, with the enquiry function stood in for,
  so no email is ever sent. Checks what's sent, and what visitors see when it works,
  when they've sent too many, and when the connection drops.
*/
const { open } = require('./page');

module.exports = async function site(ctx) {
  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };
  const p = await open(ctx, 1280);
  let sent = null;
  let answer = { status: 200, body: { ok: true } };
  await p.route('**/functions/v1/enquiry', async (route) => {
    if (answer === 'drop') return route.abort();
    sent = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body), headers: { 'Access-Control-Allow-Origin': '*' } });
  });

  /* Contact form */
  await p.goto(ctx.base + 'contact.html', { waitUntil: 'networkidle' });
  await p.click('form[data-enquiry] [type="submit"]');
  ok((await p.$$('.field-error')).length >= 5, 'An empty contact form did not show what needs filling in');
  ok(sent === null, 'An incomplete contact form was sent');

  await p.fill('#cFirst', 'Alex');
  await p.fill('#cLast', 'Tester');
  await p.fill('#cEmail', 'alex@example.com');
  await p.selectOption('#cAbout', 'myself');
  await p.fill('#cSuburb', 'Fremantle');
  const everyState = 'NSW,VIC,QLD,SA,WA,TAS,NT,ACT';
  ok((await p.$$eval('#cState option', (os) => os.map((o) => o.value).filter(Boolean).join(','))) === everyState, 'The contact form did not offer every state and territory');
  await p.selectOption('#cState', 'WA');
  await p.fill('#cMessage', 'Checking the contact form works.');
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('text=has been sent', { timeout: 5000 }).then(() => true, () => false), 'A completed contact form did not confirm it was sent');
  ok(sent && sent.kind === 'contact' && sent.about === 'For myself' && sent.state === 'Western Australia' && sent.preferredContact === 'Email' && sent.website === '', 'The contact form did not send readable details: ' + JSON.stringify(sent));
  /* Safety first: the danger line, what happens next and free support lines that can be tapped to call, kept on screen to read */
  ok(await p.isVisible('.done-alert >> text=call 000 now') && (await p.$$('.done-lines a[href^="tel:"]')).length === 6 && await p.isVisible('.done-steps >> text=reads your message'), 'A sent contact form did not show the safety information and next steps');
  await p.waitForTimeout(1500);
  ok(/contact\.html/.test(p.url()), 'A sent contact form left the page before it could be read');

  /* Referral form */
  const fillReferral = async () => {
    await p.goto(ctx.base + 'referrals.html', { waitUntil: 'networkidle' });
    await p.selectOption('#referralType', 'ndis');
    await p.fill('#referrerName', 'Jo Referrer');
    await p.selectOption('#referrerRole', 'gp');
    await p.fill('#referrerPhone', '0400 000 000');
    await p.fill('#referrerEmail', 'jo@example.com');
    await p.fill('#firstName', 'Sam');
    await p.fill('#lastName', 'Person');
    await p.fill('#phone', '0400 000 001');
    await p.fill('#suburb', 'Tweed Heads');
    await p.selectOption('#state', 'VIC');
    await p.selectOption('#fundingType', 'ndis_plan');
    await p.selectOption('#service', 'home');
    await p.fill('#reason', 'Checking the referral form works.');
    await p.check('input[name="consent"]');
  };

  await fillReferral();
  ok((await p.$$eval('#state option', (os) => os.map((o) => o.value).filter(Boolean).join(','))) === everyState, 'The referral form did not offer every state and territory');
  ok(await p.isVisible('#ndisNumber'), 'The NDIS number field did not appear for an NDIS referral');
  const fundingFor = (t) => p.selectOption('#referralType', t).then(() => p.$$eval('#fundingType option', (os) => os.map((o) => o.value).filter(Boolean).join(',')));
  ok((await fundingFor('myagedcare')) === 'sah,unsure', 'A My Aged Care referral offered funding options that do not fit');
  ok((await fundingFor('private')) === 'private,healthfund,medicare,unsure', 'A private referral offered funding options that do not fit');
  ok((await fundingFor('ndis')) === 'ndis_self,ndis_plan,unsure', 'An NDIS referral offered funding options that do not fit');
  ok((await p.inputValue('#fundingType')) === '', 'Changing the type of referral kept a funding choice that no longer fits');
  await p.selectOption('#fundingType', 'ndis_plan');
  sent = null;
  answer = { status: 429, body: { ok: false, error: 'limit' } };
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('.form-summary >> text=paused', { timeout: 5000 }).then(() => true, () => false), 'Too many referrals did not explain the pause');
  ok(sent && sent.kind === 'referral' && sent.referralType === 'NDIS' && sent.state === 'Victoria' && sent.consent === 'yes' && sent.fundingType === 'NDIS plan managed', 'The referral did not send readable details: ' + JSON.stringify(sent));

  answer = 'drop';
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('.form-summary >> text=connection dropped', { timeout: 5000 }).then(() => true, () => false), 'A dropped connection on the referral form was not explained');
  ok((await p.inputValue('#reason')) === 'Checking the referral form works.', 'A failed referral lost what was typed');

  answer = { status: 502, body: { ok: false, error: 'send' } };
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('.form-summary >> text=hello@alliedwithyou.com.au', { timeout: 5000 }).then(() => true, () => false), 'A failed send did not offer the practice email address');

  answer = { status: 200, body: { ok: true } };
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('text=has been sent', { timeout: 5000 }).then(() => true, () => false), 'A referral did not confirm it was sent');
  ok(await p.isVisible('.done-steps >> text=reviews the referral') && await p.isVisible('.form-done a[href$="referrers.html"]'), 'A sent referral did not show what happens next for referrers');

  p.problems.filter((x) => !/ERR_FAILED|Failed to load resource|429 for|502 for/.test(x)).forEach((x) => failures.push(x));
  await p.close();
  return failures;
};
