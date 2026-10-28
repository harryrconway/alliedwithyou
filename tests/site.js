/*
  The website's contact form, with the enquiry function stood in for, so no email is ever
  sent. Checks what's sent, and what visitors see when it works, when they've sent too many,
  and when the connection drops. Referrals go through the practice's Splose form, which the
  referral page shows in a frame.
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

  /* When sending fails, visitors keep what they typed and are told why */
  await p.goto(ctx.base + 'contact.html', { waitUntil: 'networkidle' });
  await p.fill('#cFirst', 'Alex');
  await p.fill('#cLast', 'Tester');
  await p.fill('#cEmail', 'alex@example.com');
  await p.selectOption('#cAbout', 'myself');
  await p.fill('#cSuburb', 'Fremantle');
  await p.selectOption('#cState', 'WA');
  await p.fill('#cMessage', 'Checking a failed send.');
  sent = null;
  answer = { status: 429, body: { ok: false, error: 'limit' } };
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('.form-summary >> text=paused', { timeout: 5000 }).then(() => true, () => false), 'Too many messages did not explain the pause');
  ok(sent && sent.kind === 'contact', 'The contact form was not sent when it should have been');

  answer = 'drop';
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('.form-summary >> text=connection dropped', { timeout: 5000 }).then(() => true, () => false), 'A dropped connection on the contact form was not explained');
  ok((await p.inputValue('#cMessage')) === 'Checking a failed send.', 'A failed send lost what was typed');

  answer = { status: 502, body: { ok: false, error: 'send' } };
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('.form-summary >> text=hello@alliedwithyou.com.au', { timeout: 5000 }).then(() => true, () => false), 'A failed send did not offer the practice email address');

  answer = { status: 200, body: { ok: true } };
  await p.click('form[data-enquiry] [type="submit"]');
  ok(await p.waitForSelector('text=has been sent', { timeout: 5000 }).then(() => true, () => false), 'Sending again after a failure did not work');

  /* Referrals go through the practice's Splose form, stood in for here, in a frame the page's security rules allow */
  await p.route('https://alliedwithyou.splose.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Referral form</title><p>Splose referral form</p>' }));
  await p.goto(ctx.base + 'referrals.html', { waitUntil: 'networkidle' });
  ok(!(await p.$('form[data-enquiry]')), 'The old referral form is still on the referral page');
  const embed = await p.$('.embed-form iframe[src="https://alliedwithyou.splose.com/public-form/befe841e-6a11-48b4-8288-2177e6c4a4f1"]');
  ok(embed && (await embed.getAttribute('title')) === 'Referral form', 'The referral page did not show the Splose referral form');
  if (embed) {
    await embed.scrollIntoViewIfNeeded();
    const inside = await embed.contentFrame();
    ok(inside && await inside.waitForSelector('text=Splose referral form', { timeout: 5000 }).then(() => true, () => false), 'The Splose referral form did not load in its frame');
  }

  p.problems.filter((x) => !/ERR_FAILED|Failed to load resource|429 for|502 for/.test(x)).forEach((x) => failures.push(x));
  await p.close();
  return failures;
};
