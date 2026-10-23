/*
  The website search index, js/site/searchindex.json. Search reads it to find any section
  or question on any public page. Built from the pages themselves, so nobody keeps it by hand:
    npm run search       rebuilds it after changing a page
    npm test -- search   fails if the pages and the index no longer match
  Every h2, h3 and question in <main> needs an id, so each result can open at the right place.
*/
const fs = require('fs');
const path = require('path');

const PAGES = [
  'index.html', 'about.html', 'services.html', 'services/assessments.html', 'services/independence.html', 'services/home.html',
  'services/technology.html', 'services/therapy.html', 'services/reports.html', 'ndis.html', 'myagedcare.html', 'process.html',
  'northernrivers.html', 'goldcoast.html', 'fees.html', 'faq.html', 'referrals.html', 'contact.html', 'privacy.html', 'complaints.html', 'accessibility.html'
];
const OUT = 'js/site/searchindex.json';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…' };
const decode = (s) => s.replace(/&(#\d+|[a-z]+);/g, (m, e) => (e[0] === '#' ? String.fromCharCode(+e.slice(1)) : ENTITIES[e] || m));
const tidy = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function pageEntry(root, rel, failures) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const title = tidy((src.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
  const main = (src.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] || '';
  /* Cards that link to another page are left out: that page is in the index itself */
  const body = main.replace(/<(script|style|svg|form|nav)[\s\S]*?<\/\1>/g, ' ').replace(/<a\s[^>]*>(?:(?!<\/a>)[\s\S])*?<h[1-3][\s\S]*?<\/a>/g, ' ');
  const h1 = tidy((body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const page = { url: rel, title: rel === 'index.html' ? 'Home' : title.split(' | ')[0], heading: h1, sections: [] };

  /* Walk the page in order: each heading or question starts a section, text runs into the current one */
  const TOKEN = /<(h[1-3])([^>]*)>([\s\S]*?)<\/\1>|<details([^>]*)>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>|<(p|li|dd|dt|td|th|figcaption|blockquote)[^>]*>((?:(?!<h[1-3]|<details|<li\b|<p\b)[\s\S])*?)<\/\7>/g;
  const top = { id: '', title: h1, kind: 'page', text: '' };
  page.sections.push(top);
  let current = top;
  let heading = top;
  for (const m of body.matchAll(TOKEN)) {
    if (m[1]) {
      if (m[1] === 'h1') continue;
      const id = (m[2].match(/\sid="([^"]+)"/) || [])[1];
      if (!id) failures.push(rel + ': heading "' + tidy(m[3]) + '" has no id, so search cannot link to it');
      heading = current = { id: id || '', title: tidy(m[3]), kind: 'section', text: '' };
      page.sections.push(current);
    } else if (m[5] !== undefined) {
      const id = (m[4].match(/\sid="([^"]+)"/) || [])[1];
      if (!id) failures.push(rel + ': question "' + tidy(m[5]) + '" has no id, so search cannot link to it');
      page.sections.push({ id: id || '', title: tidy(m[5]), kind: 'question', text: tidy(m[6]), under: heading.title });
      current = heading;
    } else {
      const t = tidy(m[8]);
      if (t) current.text += (current.text ? ' ' : '') + t;
    }
  }
  /* The page's own description helps the page itself be found */
  const desc = tidy((src.match(/name="description" content="([^"]*)"/) || [])[1] || '');
  top.text = (top.text + ' ' + desc).trim();
  page.sections = page.sections.filter((s) => s.kind === 'page' || s.text || s.kind === 'question');
  return page;
}

function build(root) {
  const failures = [];
  const pages = PAGES.map((rel) => pageEntry(root, rel, failures));
  return { json: JSON.stringify({ pages: pages }, null, 1) + '\n', failures };
}

/* The check */
module.exports = async function search(ctx) {
  const { json, failures } = build(ctx.root);
  const file = path.join(ctx.root, OUT);
  if (!fs.existsSync(file)) failures.push(OUT + ' is missing. Run npm run search in tests/');
  else if (fs.readFileSync(file, 'utf8') !== json) failures.push(OUT + ' is out of date with the pages. Run npm run search in tests/');
  const missing = fs.readdirSync(path.join(ctx.root, 'services')).map((f) => 'services/' + f).filter((f) => !PAGES.includes(f));
  missing.forEach((f) => failures.push(f + ' is not in the search index. Add it to PAGES in tests/search.js'));

  /* Searching in a browser finds a question, opens it on its own page, and keyboard and screen reader use works */
  if (ctx.browser) {
    const { open } = require('./page');
    const p = await open(ctx, 1280);
    await p.goto(ctx.base + 'about.html', { waitUntil: 'networkidle' });
    await p.keyboard.press('Control+k');
    if (!(await p.evaluate(() => document.querySelector('#siteSearch[open]') && document.activeElement.id === 'siteSearchInput'))) failures.push('Control K does not open search with the box focused');
    await p.keyboard.type('cancel');
    await p.waitForSelector('#siteSearchResults a', { timeout: 4000 }).catch(() => failures.push('Typing "cancel" shows no results'));
    const first = await p.evaluate(() => (document.querySelector('#siteSearchResults a') || {}).getAttribute && document.querySelector('#siteSearchResults a').getAttribute('href'));
    if (!first || !/fees\.html|faq\.html/.test(first)) failures.push('The first result for "cancel" is ' + first + ', not the fees or questions page');
    await p.keyboard.press('ArrowDown');
    if (!(await p.evaluate(() => /^siteResult/.test(document.querySelector('#siteSearchInput').getAttribute('aria-activedescendant') || '')))) failures.push('Arrow down does not move through the results');
    /* The preview follows the result picked out, with a way to open it and the rest of its page */
    await p.keyboard.press('ArrowDown');
    const shown = await p.evaluate(() => {
      const picked = document.getElementById(document.querySelector('#siteSearchInput').getAttribute('aria-activedescendant'));
      const preview = document.querySelector('#siteSearchPreview');
      const open = preview.querySelector('.preview-open');
      return {
        visible: preview.offsetWidth > 0,
        title: (preview.querySelector('h2') || {}).textContent || '',
        picked: picked ? picked.querySelector('.hit-title').textContent : '',
        same: open && picked && open.getAttribute('href') === picked.getAttribute('href'),
        more: preview.querySelectorAll('.preview-more a').length
      };
    });
    if (!shown.visible) failures.push('The search preview does not show on a computer');
    else if (shown.title !== shown.picked && !shown.title.includes(shown.picked)) failures.push('The preview shows "' + shown.title + '" while "' + shown.picked + '" is picked out');
    if (shown.visible && !shown.same) failures.push('The preview\'s open button does not go where the picked result goes');
    if (shown.visible && !shown.more) failures.push('The preview does not list the rest of the page');
    /* One press of Escape closes search, even with something typed */
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    if (await p.evaluate(() => !!document.querySelector('#siteSearch[open]'))) failures.push('One press of Escape does not close search when something is typed');
    if (await p.evaluate(() => document.activeElement.id !== 'siteSearchButton')) failures.push('Closing search does not return focus to the search button');

    await p.goto(ctx.base + 'index.html', { waitUntil: 'networkidle' });
    await p.click('#siteSearchButton');
    await p.fill('#siteSearchInput', 'how long is an appointment');
    await p.waitForSelector('#siteSearchResults a');
    await p.keyboard.press('Enter');
    await p.waitForURL(/faq\.html#faq/, { timeout: 4000 }).catch(() => failures.push('Choosing a question does not open the questions page at that question'));
    await p.waitForTimeout(300);
    if (!(await p.evaluate(() => { const d = document.querySelector(location.hash); return d && d.open; }))) failures.push('The question search found is not opened on arrival');

    /* Typos are put right, and everyday words find the website's own */
    for (const [typed, want] of [['cancelation', /fees\.html/], ['wheelchiar', /technology|myagedcare/], ['zoom', /process|index|faq/], ['how much does it cost', /fees|faq/]]) {
      await p.evaluate(() => { if (!document.querySelector('#siteSearch').open) AWY.siteSearch.open(); });
      await p.fill('#siteSearchInput', typed);
      await p.waitForTimeout(250);
      const first = await p.evaluate(() => { const a = document.querySelector('#siteSearchResults a[role="option"]'); return a ? a.getAttribute('href') : ''; });
      if (!want.test(first)) failures.push('Searching "' + typed + '" first finds ' + (first || 'nothing'));
    }
    await p.keyboard.press('Escape');

    await p.goto(ctx.base + 'contact.html', { waitUntil: 'networkidle' });
    await p.click('#siteSearchButton');
    await p.fill('#siteSearchInput', 'zzqx');
    await p.waitForSelector('.site-search .search-empty', { timeout: 4000 }).catch(() => failures.push('A search with no matches does not say so'));
    failures.push(...p.problems);
    await p.close();
  }
  return failures;
};

/* npm run search */
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const { json, failures } = build(root);
  failures.forEach((f) => console.log('Problem: ' + f));
  fs.writeFileSync(path.join(root, OUT), json);
  const data = JSON.parse(json);
  console.log('Wrote ' + OUT + ': ' + data.pages.length + ' pages, ' + data.pages.reduce((n, p) => n + p.sections.length, 0) + ' sections, ' + Math.round(json.length / 1024) + ' KB');
  process.exit(failures.length ? 1 : 0);
}
