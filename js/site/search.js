/*
  Website search, built like the dashboard's: type anything and matching sections and
  questions from every page show straight away, grouped by page and best first. Choosing
  one opens that page at that exact spot, and a question there opens itself.

  The index is js/site/searchindex.json, built from the pages by `npm run search` in
  tests/, and only loaded the first time someone opens search.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const root = document.body.dataset.root || '';
  const icon = (name) => AWY.raw(AWY.icon(name));
  const lower = (text) => String(text || '').toLowerCase();

  /* Pages to offer straight away, and the everyday words people use for them */
  const PLACES = [
    { url: 'fees.html', label: 'Fees and cancellations', icon: 'wallet', words: 'fees cost costs price prices pricing charge charges rates pay paying payment invoice invoices medicare gp plan health fund insurance cancel cancellation cancellations' },
    { url: 'ndis.html', label: 'NDIS participants', icon: 'target', words: 'ndis plan participant participants support coordinator coordinators capacity building plan managed self managed' },
    { url: 'myagedcare.html', label: 'My Aged Care', icon: 'heart', words: 'my aged care support at home home care package older elderly seniors' },
    { url: 'referrals.html', label: 'Make a referral', icon: 'send', words: 'referral referrals refer referring referrer gp doctor coordinator professional' },
    { url: 'contact.html', label: 'Contact us', icon: 'mail', words: 'contact email enquiry enquire message get in touch talk' },
    { url: 'services.html', label: 'Services', icon: 'clipboard', words: 'services help what we do occupational therapy ot' },
    { url: 'process.html', label: 'How it works', icon: 'chart', words: 'how it works process steps what to expect first appointment waiting wait times' },
    { url: 'faq.html', label: 'Questions people ask', icon: 'message', words: 'faq faqs questions answers' },
    { url: 'about.html', label: 'About us', icon: 'users', words: 'about us team who we are practice' },
    { url: 'privacy.html', label: 'Privacy', icon: 'lock', words: 'privacy personal information data' },
    { url: 'complaints.html', label: 'Complaints and feedback', icon: 'alertCircle', words: 'complaint complaints feedback unhappy concern' },
    { url: 'accessibility.html', label: 'Accessibility', icon: 'eye', words: 'accessibility accessible interpreter interpreters auslan large print' },
    { url: 'index.html', label: 'Home', icon: 'home', words: 'home start' }
  ];
  const POPULAR = ['fees.html', 'ndis.html', 'myagedcare.html', 'referrals.html', 'contact.html'];
  const PAGE_ICON = {};
  PLACES.forEach((p) => { PAGE_ICON[p.url] = p.icon; });

  /* Little words that don't help find anything */
  const SKIP = new Set('a an and are as at be by can do does for from how i if in is it its me my of on or our so that the to we what when where which who why will with you your'.split(' '));

  /* Turns what was typed into the words to look for. "Cancellations" also finds "cancellation". */
  function terms(typed) {
    const words = lower(typed).replace(/[’']/g, '').match(/[a-z0-9]+/g) || [];
    const useful = words.filter((w) => !SKIP.has(w));
    return (useful.length ? useful : words).map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
  }

  let index = null;
  let loading = null;
  function load() {
    if (!loading) {
      loading = fetch(root + 'js/site/searchindex.json', { cache: 'no-cache' })
        .then((r) => {
          if (!r.ok) throw new Error('Search index returned ' + r.status);
          return r.json();
        })
        .then((data) => {
          index = [];
          data.pages.forEach((page) => page.sections.forEach((s) => {
            index.push({
              page: page,
              section: s,
              title: lower(s.title),
              head: lower(s.title + ' ' + (s.under || '') + ' ' + page.title),
              text: lower(s.text)
            });
          }));
          return index;
        })
        .catch((error) => {
          loading = null;
          throw error;
        });
    }
    return loading;
  }

  const startsWord = (hay, t) => hay.startsWith(t) || hay.includes(' ' + t);

  /* Best first: the whole phrase in a heading, then every word in a heading, then words in the text */
  function score(entry, ts, phrase) {
    let n = 0;
    let found = 0;
    ts.forEach((t) => {
      const inTitle = entry.title.includes(t);
      const inHead = entry.head.includes(t);
      const inText = entry.text.includes(t);
      if (inTitle || inHead || inText) found += 1;
      if (inTitle) n += startsWord(entry.title, t) ? 5 : 3;
      else if (inHead) n += 2;
      if (inText) n += startsWord(entry.text, t) ? 1.5 : 1;
    });
    if (!found) return { n: 0, found: 0 };
    if (phrase.length > 2 && entry.title.includes(phrase)) n += 10;
    else if (phrase.length > 2 && entry.text.includes(phrase)) n += 4;
    if (entry.section.kind === 'question') n += 1;
    if (entry.section.kind === 'page' && found === ts.length) n += 1;
    return { n: n, found: found };
  }

  function placeMatches(ts) {
    return PLACES.filter((p) => ts.every((t) => (' ' + lower(p.label) + ' ' + p.words).includes(' ' + t))).slice(0, 3);
  }

  /* Sections that have every word, or if none do, those that have most of them. Grouped by page. */
  function search(typed) {
    const ts = terms(typed);
    const phrase = lower(typed).trim();
    if (!ts.length) return { groups: [], total: 0 };
    let hits = index.map((e) => Object.assign({ e: e }, score(e, ts, phrase))).filter((h) => h.n > 0);
    const all = hits.filter((h) => h.found === ts.length);
    hits = all.length ? all : hits.filter((h) => h.found >= Math.ceil(ts.length / 2));
    hits.sort((a, b) => b.n - a.n);

    const byPage = new Map();
    hits.forEach((h) => {
      const key = h.e.page.url;
      if (!byPage.has(key)) byPage.set(key, { page: h.e.page, best: h.n, hits: [] });
      byPage.get(key).hits.push(h);
    });
    const groups = [];
    const places = placeMatches(ts);
    if (places.length) groups.push({ label: 'Go to', best: Infinity, total: places.length, items: places.map((p) => ({ href: root + p.url, title: p.label, sub: '', icon: p.icon })) });
    Array.from(byPage.values()).sort((a, b) => b.best - a.best).slice(0, 6).forEach((g) => {
      groups.push({
        label: g.page.title,
        best: g.best,
        total: g.hits.length,
        items: g.hits.slice(0, 4).map((h) => {
          const s = h.e.section;
          return {
            href: root + g.page.url + (s.id ? '#' + s.id : ''),
            title: s.kind === 'page' ? g.page.title : s.title,
            sub: snippet(s.text, ts),
            icon: s.kind === 'question' ? 'message' : s.kind === 'page' ? PAGE_ICON[g.page.url] || 'note' : 'arrowRight'
          };
        })
      });
    });
    return { groups: groups, total: hits.length, ts: ts };
  }

  /* A short piece of the text around the first word that matched */
  function snippet(text, ts) {
    const t = String(text || '');
    if (!t) return '';
    const low = lower(t);
    let at = -1;
    ts.some((w) => {
      at = low.indexOf(w);
      return at >= 0;
    });
    if (at < 0 || at < 60) return t.length > 130 ? t.slice(0, t.lastIndexOf(' ', 125)) + '…' : t;
    const start = t.indexOf(' ', at - 50) + 1;
    const end = t.length > start + 130 ? t.lastIndexOf(' ', start + 125) : t.length;
    return '…' + t.slice(start, end) + (end < t.length ? '…' : '');
  }

  /* Every matched word highlighted */
  function mark(text, ts) {
    const s = String(text || '');
    if (!ts || !ts.length) return s;
    const low = lower(s);
    const spans = [];
    ts.forEach((t) => {
      for (let i = low.indexOf(t); i >= 0; i = low.indexOf(t, i + t.length)) spans.push([i, i + t.length]);
    });
    if (!spans.length) return s;
    spans.sort((a, b) => a[0] - b[0]);
    const out = [];
    let pos = 0;
    spans.forEach(([a, b]) => {
      if (a < pos) return;
      out.push(s.slice(pos, a), html`<mark>${s.slice(a, b)}</mark>`);
      pos = b;
    });
    out.push(s.slice(pos));
    return out;
  }

  /* The search box itself */
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const dialog = document.createElement('dialog');
  dialog.className = 'site-search';
  dialog.id = 'siteSearch';
  dialog.setAttribute('aria-label', 'Search this website');
  dialog.innerHTML = String(html`<div class="search" role="search">
      ${icon('search')}
      <label class="sr-only" for="siteSearchInput">Search this website</label>
      <input class="input" id="siteSearchInput" type="search" placeholder="Search services, fees, NDIS and more" autocomplete="off" spellcheck="false" enterkeyhint="go" role="combobox" aria-expanded="false" aria-controls="siteSearchResults" aria-autocomplete="list">
      <button class="search-close" type="button" aria-label="Close search">${icon('close')}</button>
    </div>
    <div class="search-results" id="siteSearchResults" role="listbox" aria-label="Search results"></div>
    <p class="sr-only" role="status" id="siteSearchStatus"></p>`);
  document.body.appendChild(dialog);

  const input = dialog.querySelector('#siteSearchInput');
  const box = dialog.querySelector('#siteSearchResults');
  const status = dialog.querySelector('#siteSearchStatus');
  const button = document.getElementById('siteSearchButton');
  let active = -1;
  let opener = null;
  const links = () => Array.from(box.querySelectorAll('a'));

  const hint = button && button.querySelector('kbd');
  if (hint) hint.textContent = isMac ? '⌘K' : 'Ctrl K';

  function highlight() {
    links().forEach((a, i) => {
      a.classList.toggle('is-active', i === active);
      a.setAttribute('aria-selected', String(i === active));
    });
    const current = links()[active];
    if (current) {
      input.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function renderGroups(groups, ts) {
    let n = 0;
    return groups.map((g, gi) => html`<div role="group" aria-labelledby="siteGroup${gi}">
      <div class="group" id="siteGroup${gi}"><span>${g.label}</span>${g.total > g.items.length ? html`<span class="n">${g.items.length} of ${g.total}</span>` : ''}</div>
      ${g.items.map((it) => html`<a href="${it.href}" id="siteResult${n++}" role="option" aria-selected="false">${icon(it.icon)}<span class="hit"><span class="hit-title">${mark(it.title, ts)}</span>${it.sub ? html`<small>${mark(it.sub, ts)}</small>` : ''}</span></a>`)}
    </div>`);
  }

  const KEYS = html`<p class="search-keys" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></p>`;

  function showPopular() {
    const items = POPULAR.map((url) => PLACES.find((p) => p.url === url)).map((p) => ({ href: root + p.url, title: p.label, sub: '', icon: p.icon }));
    box.innerHTML = String(html`${renderGroups([{ label: 'Popular', total: items.length, items: items }], [])}${KEYS}`);
    status.textContent = '';
    input.setAttribute('aria-expanded', 'true');
    active = -1;
    highlight();
  }

  async function update() {
    const typed = input.value.trim();
    if (terms(typed).length === 0 || typed.length < 2) return showPopular();
    if (!index) {
      box.innerHTML = String(html`<p class="search-status">${icon('refresh')}<span>Getting search ready</span></p>`);
      try {
        await load();
      } catch (error) {
        box.innerHTML = String(html`<p class="search-status is-problem">${icon('alertCircle')}<span>Search couldn't load just now. Check your connection and try again, or use the menu to find your way.</span></p>`);
        status.textContent = 'Search could not load';
        return;
      }
      if (input.value.trim() !== typed) return;
    }
    const keep = active >= 0 && links()[active] ? links()[active].getAttribute('href') : '';
    const result = search(typed);
    const empty = !result.groups.length
      ? html`<p class="search-empty"><strong>No matches for “${typed}”</strong>Try another word, such as fees, NDIS or home visits, or <a class="text-link" href="${root}contact.html">ask us directly</a>.</p>`
      : '';
    box.innerHTML = String(html`${renderGroups(result.groups, result.ts)}${empty}${result.groups.length ? KEYS : ''}`);
    const count = links().length;
    status.textContent = count ? count + (count === 1 ? ' result' : ' results') + '. Use the arrow keys to move through them.' : 'No matches';
    input.setAttribute('aria-expanded', String(!!count));
    active = keep ? links().findIndex((a) => a.getAttribute('href') === keep) : -1;
    highlight();
  }

  function openSearch() {
    if (dialog.open) {
      input.focus();
      input.select();
      return;
    }
    if (AWY.closeMenu) AWY.closeMenu();
    opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : button;
    dialog.showModal();
    held = true;
    if (AWY.holdPage) AWY.holdPage(true);
    input.focus();
    input.select();
    update();
    load().catch(() => {});
    if (button) button.setAttribute('aria-expanded', 'true');
  }

  /* Lets the page go straight away, so a jump to a spot on this page isn't undone */
  let held = false;
  function release() {
    if (!held) return;
    held = false;
    if (AWY.holdPage) AWY.holdPage(false);
  }

  function closeSearch() {
    if (!dialog.open) return;
    dialog.close();
    release();
  }

  dialog.addEventListener('close', () => {
    release();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    if (button) button.setAttribute('aria-expanded', 'false');
    if (opener && document.contains(opener)) opener.focus();
  });

  /* Goes to a result. A link to this same page just scrolls there and opens it. */
  function go(a) {
    const url = new URL(a.href, location.href);
    try {
      sessionStorage.setItem('awy.searchJump', url.hash || 'top');
    } catch (error) {
      /* storage blocked: the page still opens at the right place, just without moving focus */
    }
    opener = null;
    closeSearch();
    if (url.pathname === location.pathname) {
      if (url.hash && url.hash !== location.hash) history.pushState(null, '', url.hash);
      reveal(true);
    } else {
      location.href = url.href;
    }
  }

  input.addEventListener('input', update);
  input.addEventListener('keydown', (event) => {
    const list = links();
    if (event.key === 'ArrowDown' && list.length) {
      event.preventDefault();
      active = (active + 1) % list.length;
      highlight();
    } else if (event.key === 'ArrowUp' && list.length) {
      event.preventDefault();
      active = (active - 1 + list.length) % list.length;
      highlight();
    } else if (event.key === 'Enter' && list[active >= 0 ? active : 0]) {
      event.preventDefault();
      go(list[active >= 0 ? active : 0]);
    } else if (event.key === 'Escape' && input.value) {
      /* Esc clears first, then a second Esc closes, the same as the dashboard */
      event.preventDefault();
      input.value = '';
      update();
    }
  });
  box.addEventListener('mousemove', (event) => {
    const a = event.target.closest('a[role="option"]');
    const i = a ? links().indexOf(a) : -1;
    if (i >= 0 && i !== active) {
      active = i;
      links().forEach((x, j) => x.classList.toggle('is-active', j === active));
    }
  });
  box.addEventListener('click', (event) => {
    const a = event.target.closest('a');
    if (!a || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    go(a);
  });
  dialog.querySelector('.search-close').addEventListener('click', closeSearch);
  /* A click on the dimmed page outside the box closes it */
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeSearch();
  });
  if (button) button.addEventListener('click', openSearch);

  /* Ctrl K, Command K or / opens search from anywhere, unless someone is typing elsewhere */
  document.addEventListener('keydown', (event) => {
    const typing = event.target.closest && event.target.closest('input, textarea, select, [contenteditable="true"]');
    const shortcut = (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);
    if (shortcut || (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey)) {
      if (document.querySelector('dialog[open]:not(#siteSearch)')) return;
      event.preventDefault();
      openSearch();
    }
  });

  /*
    Arriving at a section or question: a question opens, the spot is picked out briefly,
    and after a search, focus moves there so screen readers start reading at the right place.
  */
  function reveal(fromSearch) {
    const id = decodeURIComponent(location.hash.slice(1));
    let jumped = fromSearch;
    try {
      jumped = jumped || sessionStorage.getItem('awy.searchJump') === location.hash;
      sessionStorage.removeItem('awy.searchJump');
    } catch (error) {
      /* nothing to tidy up */
    }
    const target = id && document.getElementById(id);
    if (!target) {
      if (jumped) window.scrollTo(0, 0);
      return;
    }
    const details = target.closest('details');
    if (details) details.open = true;
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    target.scrollIntoView({ block: 'start', behavior: calm || !fromSearch ? 'auto' : 'smooth' });
    target.classList.remove('is-found');
    void target.offsetWidth;
    target.classList.add('is-found');
    setTimeout(() => target.classList.remove('is-found'), 2700);
    if (jumped) {
      const focusable = target.tagName === 'DETAILS' ? target.querySelector('summary') : target;
      if (focusable !== target.querySelector('summary') && !focusable.hasAttribute('tabindex')) focusable.setAttribute('tabindex', '-1');
      focusable.focus({ preventScroll: true });
    }
  }
  window.addEventListener('hashchange', () => reveal(false));
  if (location.hash) reveal(false);

  AWY.siteSearch = { open: openSearch, close: closeSearch };
})();
