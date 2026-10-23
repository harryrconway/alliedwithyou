/*
  Words explained where they appear. The first time a word from the glossary page (Words we
  use) comes up in a page's text, it gets a dotted underline; choosing it opens a short
  explanation, and Escape or a click elsewhere closes it. The words and explanations come
  from js/site/glossary.json, which `npm run build` makes from glossary.html.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const root = document.body.dataset.root || '';
  const main = document.querySelector('main');
  if (!main || document.body.dataset.page === 'glossary' || document.body.dataset.page === 'easyread') return;

  const SKIP = 'a, button, h1, h2, h3, h4, h5, h6, summary, label, legend, select, option, textarea, input, nav, form, .term-wrap, .crumbs, .btn, script, style, [data-no-terms]';
  let open = null;
  let count = 0;

  function close(focusBack) {
    if (!open) return;
    open.btn.setAttribute('aria-expanded', 'false');
    open.tip.hidden = true;
    if (focusBack) open.btn.focus();
    open = null;
  }

  function place(btn, tip) {
    tip.style.left = '0px';
    const b = btn.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const room = document.documentElement.clientWidth - 12;
    let left = 0;
    if (t.right > room) left = room - t.right;
    if (t.left + left < 12) left = 12 - t.left;
    tip.style.left = left + 'px';
    void b;
  }

  function mark(textNode, start, length, term) {
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, start + length);
    const words = range.toString();
    const id = 'term' + (count += 1);
    const wrap = document.createElement('span');
    wrap.className = 'term-wrap';
    wrap.innerHTML = String(html`<button type="button" class="term" aria-expanded="false" aria-controls="${id}">${words}</button><span class="term-tip" id="${id}" role="note" hidden><strong>${term.term}</strong> ${term.def} <a href="${root}glossary.html#${term.id}">More words we use</a></span>`);
    range.deleteContents();
    range.insertNode(wrap);
    const btn = wrap.querySelector('button');
    const tip = wrap.querySelector('.term-tip');
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (open && open.btn === btn) return close(false);
      close(false);
      tip.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      open = { btn: btn, tip: tip };
      place(btn, tip);
    });
  }

  function run(terms) {
    const used = new Set();
    const patterns = terms.map((t) => ({ term: t, re: new RegExp('\\b(' + t.match.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i') }));
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let current = node;
      patterns.forEach((p) => {
        if (used.has(p.term.id) || !current || !current.parentNode) return;
        const m = p.re.exec(current.nodeValue);
        if (!m) return;
        used.add(p.term.id);
        const after = current.splitText(m.index + m[0].length);
        mark(current, m.index, m[0].length, p.term);
        current = after;
      });
    });
  }

  document.addEventListener('click', (event) => {
    if (open && !event.target.closest('.term-wrap')) close(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) close(true);
  });
  window.addEventListener('resize', () => close(false));

  fetch(root + 'js/site/glossary.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((terms) => run(terms.filter((t) => t.match && t.match.length)))
    .catch(() => {
      /* without the list, the page simply has no explanations */
    });
})();
