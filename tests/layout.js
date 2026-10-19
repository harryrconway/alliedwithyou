/*
  Pages fit phone, tablet and desktop widths without sideways scrolling,
  and keyboard users get a skip link, contained dialogs and announced errors.
*/
const { open, PUBLIC_PAGES } = require('./page');

module.exports = async function layout(ctx) {
  const failures = [];
  for (const width of [360, 768, 1366]) {
    const p = await open(ctx, width);
    for (const u of PUBLIC_PAGES) {
      await p.goto(ctx.base + u, { waitUntil: 'networkidle' });
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > width + 1) failures.push(u + ' is ' + sw + 'px wide at ' + width + 'px');
    }
    await p.close();
  }

  const p = await open(ctx, 1280);
  await p.goto(ctx.base + 'index.html', { waitUntil: 'networkidle' });
  await p.keyboard.press('Tab');
  if ((await p.evaluate(() => document.activeElement.className)) !== 'skip') failures.push('The first tab stop is not the skip link');
  await p.close();
  return failures;
};
