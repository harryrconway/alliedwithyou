/*
  Writing rules: no hyphens, en dashes or em dashes in anything people read,
  and no numbered labels. Checks the source statically, then the rendered pages.
*/
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const files = require('./files');
const { open, PUBLIC_PAGES } = require('./page');

const DASH = /[‐-―−]/;
const WORD_HYPHEN = /[A-Za-z]-[A-Za-z]/;
const SPACED = /\s-\s(?!\d+px)/;
const RANGE = /\b\d+\s?-\s?\d+\b/;

/* Removes things that legitimately contain hyphens: SVG paths, phone numbers, class names, CSS maths */
function clean(text) {
  return text
    .replace(/<path[^>]*>|<circle[^>]*>|<rect[^>]*>/g, ' ')
    .replace(/\b0[2378] \d{4} \d{4}\b|\b0491 5\d\d \d{3}\b/g, ' ')
    .replace(/\S+@\S+\.(example|org|com)\b/g, ' ')
    .replace(/\d{2}_\d{3}_\d{4}_\d_\d/g, ' ')
    .replace(/\b(is|tone|toast|span|btn|cal|doc|notice)-[a-z]+\b/g, ' ')
    .replace(/calc\([^)]*\)|step="[^"]*"/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function problems(text) {
  const t = clean(text);
  if (!t) return null;
  if (DASH.test(t) || WORD_HYPHEN.test(t) || SPACED.test(t) || (RANGE.test(t) && !/\d{4}-\d{2}-\d{2}/.test(t))) return t.slice(0, 120);
  return null;
}

const CODEISH = /(^:scope|class=|style=|href=|data-[a-z]|aria-[a-z]|var\(--|^[.#\[]|^[a-z]+(-[a-z]+)+$|^[a-z]+:\/\/|\.html|\.svg|\.js|\.css|^--|=>|\bsr-only|^[A-Za-z]+-[a-z]+$|tabular-nums|text-anchor|stroke-|font-)/;

module.exports = async function text(ctx) {
  const failures = [];
  const flag = (where, t) => {
    const p = problems(t);
    if (p) failures.push(where + ': ' + p);
  };

  for (const file of files(ctx.root, '.js').filter((f) => !f.endsWith('icons.js') && !f.includes('/vendor/'))) {
    const rel = path.relative(ctx.root, file);
    const ast = acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 2022, locations: true });
    walk.full(ast, (node) => {
      if (node.type === 'Literal' && typeof node.value === 'string' && /\s/.test(node.value) && !CODEISH.test(node.value)) flag(rel + ':' + node.loc.start.line, node.value);
      if (node.type === 'TemplateLiteral') flag(rel + ':' + node.loc.start.line, node.quasis.map((q) => q.value.cooked).join(' ').replace(/<[^>]*>/g, ' '));
    });
  }

  for (const file of files(ctx.root, '.html')) {
    const rel = path.relative(ctx.root, file);
    let src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\s(?:alt|title|placeholder|aria-label|content)="([^"]*)"/g)) {
      if (!/^width=|^#|^noindex|^default-src|^no-referrer/.test(m[1])) flag(rel, m[1]);
    }
    src = src.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, '\n');
    src.split('\n').forEach((line) => flag(rel, line.replace(/&[a-z]+;/g, ' ')));
  }

  for (const file of files(ctx.root, '.md')) {
    const rel = path.relative(ctx.root, file);
    let inCode = false;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.startsWith('```')) inCode = !inCode;
      if (inCode || /^\|?[\s|:-]+\|?$/.test(line)) return;
      flag(rel + ':' + (i + 1), line.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' '));
    });
  }

  /* What actually appears on screen, including labels read by screen readers */
  const page = await open(ctx);
  const visible = () => page.evaluate(() => document.body.innerText + '\n' + document.title + '\n' +
    Array.from(document.querySelectorAll('[aria-label],[title],[placeholder],img[alt]')).map((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('placeholder'), e.getAttribute('alt')].filter(Boolean).join('\n')).join('\n'));
  /* The live website must not show placeholder, testing or demo wording */
  const LEFTOVERS = /to confirm|testing version|placeholder|demo|sample|made up|\.example\b|0491 57|5550 /i;
  for (const u of PUBLIC_PAGES) {
    await page.goto(ctx.base + u, { waitUntil: 'networkidle' });
    const shown = await visible();
    shown.split('\n').forEach((l) => flag('rendered ' + u, l));
    shown.split('\n').filter((l) => LEFTOVERS.test(l)).forEach((l) => failures.push('Leftover wording on ' + u + ': ' + l.trim().slice(0, 100)));
  }
  await page.close();
  return failures;
};
