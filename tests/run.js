/*
  Runs every check, or the ones named on the command line:
    npm test
    npm test -- crm site
  Browser checks use Chromium by default. Set BROWSER to run them under Firefox or WebKit instead:
    BROWSER=firefox npm test -- text site layout
  Exits with an error code if anything fails.
*/
const path = require('path');
const serve = require('./serve');

const ROOT = path.resolve(__dirname, '..');
const ALL = ['syntax', 'links', 'text', 'search', 'seo', 'auth', 'enquiry', 'notify', 'site', 'crm', 'layout'];
const BROWSER = ['text', 'search', 'site', 'crm', 'layout'];
const ENGINES = { chromium: 'chromium', firefox: 'firefox', webkit: 'webkit' };

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const server = await serve(ROOT);
  let browser = null;
  if (names.some((n) => BROWSER.includes(n))) {
    const engine = ENGINES[process.env.BROWSER] || 'chromium';
    browser = await require('playwright')[engine].launch();
  }
  const ctx = { root: ROOT, base: server.url, browser };
  let failed = 0;
  for (const name of names) {
    const started = Date.now();
    let failures;
    try {
      failures = await require('./' + name)(ctx);
    } catch (error) {
      failures = ['The check stopped: ' + (error.stack || error.message)];
    }
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (failures.length) {
      failed += 1;
      console.log('FAIL  ' + name + ' (' + secs + 's)');
      failures.slice(0, 40).forEach((f) => console.log('      ' + f));
      if (failures.length > 40) console.log('      and ' + (failures.length - 40) + ' more');
    } else {
      console.log('PASS  ' + name + ' (' + secs + 's)');
    }
  }
  if (browser) await browser.close();
  server.close();
  console.log(failed ? '\n' + failed + ' of ' + names.length + ' checks failed' : '\nAll ' + names.length + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
