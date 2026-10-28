/*
  The helpful extras: email suggestions, forms that keep what's typed, the preferred therapist
  and how someone heard about us reaching the practice, the funding helper, words explained
  where they appear, and the text size and contrast choices.
*/
const { open } = require('./page');

module.exports = async function helpers(ctx) {
  const failures = [];
  const fail = (ok, message) => { if (!ok) failures.push(message); };
  const p = await open(ctx, 390);
  let sent = null;
  await p.route('**/functions/v1/enquiry', async (route) => {
    sent = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}', headers: { 'Access-Control-Allow-Origin': '*' } });
  });

  /* Email suggestions */
  await p.goto(ctx.base + 'contact.html?with=jake', { waitUntil: 'networkidle' });
  fail((await p.inputValue('#cTherapist')) === 'jake', 'Arriving from Ask to see Jake does not choose Jake');
  await p.click('#cEmail');
  await p.keyboard.type('sam');
  let hints = await p.$$eval('#cEmailHints [role="option"]', (l) => l.map((x) => x.textContent));
  fail(hints[0] === 'sam@gmail.com' && hints.length === 6, 'Typing an email does not suggest providers: ' + hints.join(', '));
  await p.keyboard.type('@ic');
  hints = await p.$$eval('#cEmailHints [role="option"]', (l) => l.map((x) => x.textContent));
  fail(hints.join() === 'sam@icloud.com', 'Typing @ic does not narrow to iCloud: ' + hints.join(', '));
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  fail((await p.inputValue('#cEmail')) === 'sam@icloud.com', 'Choosing a suggestion with the keyboard does not fill the email');
  fail(!(await p.isVisible('#cEmailHints')), 'The suggestions stay open after choosing one');
  await p.fill('#cEmail', '');
  await p.keyboard.type('sam@gmial.com');
  hints = await p.$$eval('#cEmailHints [role="option"]', (l) => l.map((x) => x.textContent));
  fail(hints.join() === 'sam@gmail.com', 'A typo such as gmial.com is not offered a fix');
  await p.keyboard.press('Escape');
  fail(!(await p.isVisible('#cEmailHints')), 'Escape does not close the email suggestions');

  /* Keeps what's typed, then sends the extra answers inside the message */
  await p.fill('#cEmail', 'sam@gmail.com');
  await p.fill('#cFirst', 'Sam');
  await p.fill('#cLast', 'Lee');
  await p.selectOption('#cAbout', 'myself');
  await p.fill('#cSuburb', 'Lismore');
  await p.selectOption('#cState', { index: 1 });
  await p.fill('#cMessage', 'Hello');
  await p.selectOption('#cHeard', 'friend');
  await p.waitForTimeout(400);
  await p.goto(ctx.base + 'contact.html', { waitUntil: 'networkidle' });
  fail((await p.inputValue('#cMessage')) === 'Hello' && (await p.inputValue('#cTherapist')) === 'jake', 'What was typed is lost when the page reloads');
  await p.click('button[type="submit"]');
  await p.waitForTimeout(600);
  fail(sent && sent.message === 'Hello\n\nPreferred therapist: Jake\nHeard about us through: A friend or family member', 'The preferred therapist and how they heard do not reach the message: ' + JSON.stringify(sent && sent.message));
  fail(sent && !('therapist' in sent) && !('heardFrom' in sent), 'Extra fields are sent separately as well as in the message');
  fail((await p.evaluate(() => sessionStorage.getItem('awy.draft.contact'))) === null, 'What was typed is still kept after sending');

  /* Funding helper */
  await p.goto(ctx.base + 'funding.html', { waitUntil: 'networkidle' });
  await p.check('input[name="ndis"][value="plan"]');
  await p.check('input[name="fund"][value="yes"]');
  const cards = await p.$$eval('.helper-card h3', (l) => l.map((x) => x.textContent));
  fail(cards.join('|') === 'Your NDIS plan|Private health insurance|Paying privately', 'The funding helper shows ' + cards.join(', '));

  /* Words explained where they appear */
  await p.goto(ctx.base + 'ndis.html', { waitUntil: 'networkidle' });
  await p.waitForSelector('.term', { timeout: 4000 }).catch(() => failures.push('No words are explained on the NDIS page'));
  const term = await p.$('.term');
  if (term) {
    await term.click();
    fail(await p.isVisible('.term-tip:not([hidden])'), 'Choosing an underlined word does not open its explanation');
    await p.keyboard.press('Escape');
    fail(!(await p.isVisible('.term-tip:not([hidden])')), 'Escape does not close an explanation');
  }

  /* Text size and contrast, chosen on a computer and remembered */
  const d = await open(ctx, 1366);
  await d.goto(ctx.base + 'about.html', { waitUntil: 'networkidle' });
  await d.click('#displayButton');
  await d.check('#displayPanel input[value="large"]');
  await d.check('#displayPanel input[value="high"]');
  await d.goto(ctx.base + 'fees.html', { waitUntil: 'networkidle' });
  const cls = await d.evaluate(() => document.documentElement.className);
  fail(/text-large/.test(cls) && /contrast-high/.test(cls), 'Text size and contrast are not remembered between pages');
  fail((await d.evaluate(() => document.documentElement.scrollWidth)) <= 1367, 'Larger text makes the page scroll sideways');
  failures.push(...p.problems, ...d.problems);
  await p.close();
  await d.close();
  return failures;
};
