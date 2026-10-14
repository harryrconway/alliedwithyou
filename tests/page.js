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

/* Starts the dashboard fresh, signed in as a demo person */
async function signIn(page, ctx, staffId) {
  await page.goto(ctx.base + 'admin/index.html', { waitUntil: 'networkidle' });
  await page.evaluate((s) => {
    localStorage.removeItem('awy.demo');
    localStorage.setItem('awy.session', JSON.stringify({ staffId: s }));
  }, staffId || 'st_hannah');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#main');
}

/* Moves to a dashboard route and waits for it to draw */
async function route(page, hash) {
  await page.evaluate((h) => {
    location.hash = h;
  }, '#/' + hash);
  await page.waitForTimeout(350);
}

const PUBLIC_PAGES = [
  'index.html', 'about.html', 'services.html', 'services/assessments.html', 'services/independence.html', 'services/home.html',
  'services/technology.html', 'services/therapy.html', 'services/reports.html', 'ndis.html', 'process.html', 'referrals.html',
  'contact.html', 'faq.html', 'fees.html', 'privacy.html', 'complaints.html', 'accessibility.html', '404.html'
];

const ADMIN_ROUTES = [
  '', 'clients', 'clients/cl_jack', 'clients/cl_jack/details', 'clients/cl_jack/appointments', 'clients/cl_jack/notes',
  'clients/cl_jack/assessments', 'clients/cl_jack/goals', 'clients/cl_jack/reports', 'clients/cl_jack/records',
  'clients/cl_jack/funding', 'clients/cl_jack/tasks', 'clients/cl_jack/history', 'clients/cl_peter', 'referrals',
  'referrals/rf_beverley', 'referrals/rf_desmond', 'calendar', 'notes', 'notes/cl_jack_ap0_nt', 'assessments', 'goals',
  'reports', 'reports/cl_jack_rp0', 'documents', 'agreements', 'agreements/cl_margaret_ag', 'funding/plans',
  'funding/services', 'funding/prices', 'invoices', 'invoices/in_1001', 'tasks', 'incidents', 'staff', 'statistics', 'settings'
];

module.exports = { open, signIn, route, PUBLIC_PAGES, ADMIN_ROUTES };
