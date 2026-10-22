/* Every relative link and file reference in the pages must point at a real file. */
const fs = require('fs');
const path = require('path');
const files = require('./files');

module.exports = async function links(ctx) {
  const failures = [];
  const check = (from, url) => {
    if (!url || /^(https?:|mailto:|tel:|#|data:|\$\{|\{\{)/.test(url)) return;
    const target = url.split('#')[0].split('?')[0];
    if (!target) return;
    const full = target.startsWith('/alliedwithyou/')
      ? path.join(ctx.root, target.replace('/alliedwithyou/', ''))
      : target.startsWith('/') ? path.join(ctx.root, target) : path.join(path.dirname(from), target);
    if (!fs.existsSync(full)) failures.push(path.relative(ctx.root, from) + ' links to missing ' + url);
  };
  for (const file of files(ctx.root, '.html')) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:href|src)="([^"]+)"/g)) check(file, m[1]);
    for (const m of src.matchAll(/srcset="([^"]+)"/g)) m[1].split(',').forEach((part) => check(file, part.trim().split(' ')[0]));
  }
  /* Everything _config.yml leaves out of the published site must exist, so a misspelt name can't leave a page published */
  const config = path.join(ctx.root, '_config.yml');
  if (fs.existsSync(config)) {
    for (const m of fs.readFileSync(config, 'utf8').matchAll(/^\s*-\s+(\S+)\s*$/gm)) {
      if (!fs.existsSync(path.join(ctx.root, m[1]))) failures.push('_config.yml leaves out ' + m[1] + ', which does not exist');
    }
  }

  /* Links the shared website header and footer generate */
  const layout = fs.readFileSync(path.join(ctx.root, 'js/site/layout.js'), 'utf8');
  for (const m of layout.matchAll(/href: '([^']+)'|\$\{root\}([a-z/]+\.(?:html|svg))/g)) {
    const u = m[1] || m[2];
    if (!fs.existsSync(path.join(ctx.root, u))) failures.push('js/site/layout.js links to missing ' + u);
  }
  return failures;
};
