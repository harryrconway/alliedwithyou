/*
  Pages fit phone, tablet and desktop widths without sideways scrolling,
  and keyboard users get a skip link, contained dialogs and announced errors.
*/
const { open, signIn, route, PUBLIC_PAGES, ADMIN_ROUTES } = require('./page');

module.exports = async function layout(ctx) {
  const failures = [];
  for (const width of [360, 768, 1366]) {
    const p = await open(ctx, width);
    for (const u of PUBLIC_PAGES) {
      await p.goto(ctx.base + u, { waitUntil: 'networkidle' });
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > width + 1) failures.push(u + ' is ' + sw + 'px wide at ' + width + 'px');
    }
    await signIn(p, ctx, 'st_hannah');
    for (const r of ADMIN_ROUTES) {
      await route(p, r);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > width + 1) failures.push('#/' + r + ' is ' + sw + 'px wide at ' + width + 'px');
    }
    await p.close();
  }

  const p = await open(ctx, 1280);
  await p.goto(ctx.base + 'index.html', { waitUntil: 'networkidle' });
  await p.keyboard.press('Tab');
  if ((await p.evaluate(() => document.activeElement.className)) !== 'skip') failures.push('The first tab stop is not the skip link');
  await signIn(p, ctx, 'st_hannah');
  await route(p, 'calendar?new=1');
  await p.waitForSelector('dialog[open]');
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press('Tab');
    const inside = await p.evaluate(() => !!document.activeElement.closest('dialog[open]') || document.activeElement === document.body);
    if (!inside) {
      failures.push('Keyboard focus escaped the dialog');
      break;
    }
  }
  await p.click('dialog[open] button[type=submit]');
  await p.waitForTimeout(200);
  const described = await p.evaluate(() => document.activeElement.getAttribute('aria-describedby') || '');
  if (!/Error/.test(described)) failures.push('The first invalid field is not linked to its error message');
  if (!(await p.$('dialog[open] .form-summary [role="alert"]'))) failures.push('Form errors are not announced');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  if (await p.$('dialog[open]')) failures.push('Escape did not close the dialog');
  await p.close();
  return failures;
};
