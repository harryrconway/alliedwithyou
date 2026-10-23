/* Shared helpers for browser checks. */

/* Opens a page that records any script errors or failed requests */
async function open(ctx, width) {
  const page = await ctx.browser.newPage({ viewport: { width: width || 1366, height: 900 } });
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('Script error: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 404/.test(m.text())) page.problems.push('Console error: ' + m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !/doesnotexist/.test(r.url())) page.problems.push(r.status() + ' for ' + r.url());
  });
  return page;
}

const PUBLIC_PAGES = [
  'index.html', 'about.html', 'services.html', 'services/assessments.html', 'services/independence.html', 'services/home.html',
  'services/technology.html', 'services/therapy.html', 'services/reports.html', 'ndis.html', 'myagedcare.html', 'process.html', 'referrals.html',
  'contact.html', 'northernrivers.html', 'goldcoast.html', 'faq.html', 'fees.html', 'privacy.html', 'complaints.html', 'accessibility.html', '404.html',
  'construction.html', 'admin/index.html'
];

module.exports = { open, PUBLIC_PAGES };
