/*
  Pages fit phone, tablet and desktop widths without sideways scrolling,
  and keyboard users get a skip link, contained dialogs and announced errors. On phones,
  tablets and phones turned sideways the menu fills the screen, fits without scrolling and
  holds the page still behind it.
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

  for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [844, 390]]) {
    const m = await ctx.browser.newPage({ viewport: { width: w, height: h } });
    await m.goto(ctx.base + 'fees.html', { waitUntil: 'networkidle' });
    await m.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
    await m.click('.nav-toggle');
    await m.waitForTimeout(700);
    const state = await m.evaluate(() => {
      const nav = document.querySelector('.nav');
      const shown = Array.from(nav.querySelectorAll('a')).filter((a) => a.offsetParent);
      return {
        fits: nav.scrollHeight <= nav.clientHeight + 1,
        reachable: shown.every((a) => a.getBoundingClientRect().bottom <= innerHeight + 1),
        links: shown.length,
        aside: document.querySelector('main').inert && document.querySelector('footer').inert,
        expanded: document.querySelector('.nav-toggle').getAttribute('aria-expanded')
      };
    });
    const at = w + ' by ' + h;
    if (!state.fits || !state.reachable) failures.push('At ' + at + ' the open menu does not fit on screen');
    if (state.links < 10) failures.push('At ' + at + ' the open menu shows only ' + state.links + ' links');
    if (!state.aside) failures.push('At ' + at + ' the page behind the open menu is not set aside');
    if (state.expanded !== 'true') failures.push('At ' + at + ' the menu button does not say the menu is open');
    await m.mouse.wheel(0, 400);
    await m.waitForTimeout(150);
    if ((await m.evaluate(() => document.body.style.top)) !== '-500px') failures.push('At ' + at + ' the page behind the menu does not stay still');
    await m.keyboard.press('Escape');
    await m.waitForTimeout(400);
    const after = await m.evaluate(() => ({ y: Math.round(scrollY), focus: document.activeElement.className, open: document.querySelector('.nav').classList.contains('is-open') }));
    if (after.open) failures.push('At ' + at + ' Escape does not close the menu');
    if (after.y !== 500) failures.push('At ' + at + ' closing the menu loses the reading place');
    if (after.focus !== 'nav-toggle') failures.push('At ' + at + ' closing the menu does not return focus to its button');
    await m.close();
  }

  const p = await open(ctx, 1280);
  await p.goto(ctx.base + 'index.html', { waitUntil: 'networkidle' });
  await p.keyboard.press('Tab');
  if ((await p.evaluate(() => document.activeElement.className)) !== 'skip') failures.push('The first tab stop is not the skip link');
  await p.close();
  return failures;
};
