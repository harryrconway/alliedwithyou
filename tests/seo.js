/*
  What search engines and link previews read. Every public page needs a canonical address,
  a unique title and description of a sensible length, and share details, and the sitemap
  and the questions page's structured data must match the pages.
    npm run seo       rebuilds sitemap.xml and the questions page's structured data
    npm test -- seo   fails if anything is missing or out of date
*/
const fs = require('fs');
const path = require('path');

const SITE = 'https://alliedwithyou.com.au/';
const PAGES = [
  'index.html', 'about.html', 'team.html', 'services.html', 'services/assessments.html', 'services/independence.html', 'services/home.html',
  'services/technology.html', 'services/therapy.html', 'services/reports.html', 'ndis.html', 'myagedcare.html', 'process.html',
  'northernrivers.html', 'goldcoast.html', 'fees.html', 'faq.html', 'referrals.html', 'contact.html', 'privacy.html', 'complaints.html', 'accessibility.html'
];
const address = (rel) => SITE + (rel === 'index.html' ? '' : rel);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', rsquo: '’' };
const tidy = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&(#\d+|[a-z]+);/g, (m, e) => (e[0] === '#' ? String.fromCharCode(+e.slice(1)) : ENTITIES[e] || m)).replace(/\s+/g, ' ').trim();
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function sitemap() {
  const urls = PAGES.map((rel) => '  <url><loc>' + address(rel) + '</loc></url>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n';
}

/* The questions page's answers, as structured data built from the questions themselves */
const FAQ_START = '<script type="application/ld+json" data-faq>';
function faqData(src) {
  const items = Array.from(src.matchAll(/<details class="disclosure"[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)).map((m) => ({
    '@type': 'Question',
    name: tidy(m[1]),
    acceptedAnswer: { '@type': 'Answer', text: tidy(m[2]) }
  }));
  return FAQ_START + JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items }) + '</script>';
}

function withFaq(src) {
  const block = faqData(src);
  const at = src.indexOf(FAQ_START);
  if (at >= 0) return src.slice(0, at) + block + src.slice(src.indexOf('</script>', at) + 9);
  return src.replace('</head>', '  ' + block + '\n</head>');
}

/* The check */
module.exports = async function seo(ctx) {
  const failures = [];
  const titles = new Map();
  const descriptions = new Map();
  for (const rel of PAGES) {
    const src = read(ctx.root, rel);
    const title = tidy((src.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const desc = (src.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const canonical = (src.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    const og = (name) => (src.match(new RegExp('<meta property="og:' + name + '" content="([^"]*)"')) || [])[1];
    if (title.length < 20 || title.length > 75) failures.push(rel + ': the title is ' + title.length + ' characters, aim for 20 to 75');
    if (desc.length < 70 || desc.length > 165) failures.push(rel + ': the description is ' + desc.length + ' characters, aim for 70 to 165');
    if (titles.has(title)) failures.push(rel + ' has the same title as ' + titles.get(title));
    if (descriptions.has(desc)) failures.push(rel + ' has the same description as ' + descriptions.get(desc));
    titles.set(title, rel);
    descriptions.set(desc, rel);
    if (canonical !== address(rel)) failures.push(rel + ': the canonical address should be ' + address(rel));
    if (og('url') !== address(rel)) failures.push(rel + ': og:url should be ' + address(rel));
    if (og('title') !== title) failures.push(rel + ': og:title should match the title');
    if (og('description') !== desc) failures.push(rel + ': og:description should match the description');
    if (!og('image') || !fs.existsSync(path.join(ctx.root, og('image').replace(SITE, '')))) failures.push(rel + ': the share image is missing');
    if (/name="robots" content="[^"]*noindex/.test(src)) failures.push(rel + ' asks search engines not to list it');
    for (const m of src.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(m[1]);
      } catch (error) {
        failures.push(rel + ': structured data is not valid JSON');
      }
    }
  }
  const faq = read(ctx.root, 'faq.html');
  if (faq !== withFaq(faq)) failures.push('faq.html: the questions structured data is out of date. Run npm run seo in tests/');
  if (!fs.existsSync(path.join(ctx.root, 'sitemap.xml')) || read(ctx.root, 'sitemap.xml') !== sitemap()) failures.push('sitemap.xml is missing or out of date. Run npm run seo in tests/');
  const robots = fs.existsSync(path.join(ctx.root, 'robots.txt')) ? read(ctx.root, 'robots.txt') : '';
  if (!robots.includes('Sitemap: ' + SITE + 'sitemap.xml')) failures.push('robots.txt does not point to the sitemap');
  return failures;
};

/* npm run seo */
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap());
  fs.writeFileSync(path.join(root, 'faq.html'), withFaq(read(root, 'faq.html')));
  console.log('Wrote sitemap.xml with ' + PAGES.length + ' pages, and the questions structured data in faq.html');
}

module.exports.PAGES = PAGES;
module.exports.address = address;
