/* Shared header and footer for every public page. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const biz = AWY.business;

  const root = document.body.dataset.root || '';
  const current = document.body.dataset.page || '';

  /*
    Text size and contrast, chosen from the header and remembered in this browser. Applied
    first, before anything is drawn, so the page doesn't jump.
  */
  const SIZES = { standard: '', large: 'text-large', larger: 'text-larger' };
  function readDisplay() {
    try {
      const saved = JSON.parse(localStorage.getItem('awy.display') || '{}');
      return { size: SIZES[saved.size] !== undefined ? saved.size : 'standard', contrast: saved.contrast === 'high' ? 'high' : 'standard' };
    } catch (error) {
      return { size: 'standard', contrast: 'standard' };
    }
  }
  function applyDisplay(d) {
    const el = document.documentElement;
    el.classList.remove('text-large', 'text-larger', 'contrast-high');
    if (SIZES[d.size]) el.classList.add(SIZES[d.size]);
    if (d.contrast === 'high') el.classList.add('contrast-high');
  }
  let display = readDisplay();
  applyDisplay(display);

  const NAV = [
    { key: 'about', href: 'about.html', label: 'About', icon: 'info' },
    { key: 'team', href: 'team.html', label: 'Our team', icon: 'users' },
    { key: 'services', href: 'services.html', label: 'Services', icon: 'clipboard' },
    { key: 'ndis', href: 'ndis.html', label: 'NDIS', icon: 'target' },
    { key: 'faq', href: 'faq.html', label: 'FAQs', icon: 'message' },
    { key: 'contact', href: 'contact.html', label: 'Contact', icon: 'mail' }
  ];

  const icon = (name) => AWY.raw(AWY.icon(name));

  /* The choices themselves, the same in the header panel and the phone menu */
  function displayChoices(prefix) {
    const size = (value, label, cls) => html`<label class="display-choice ${cls}"><input type="radio" name="${prefix}Size" value="${value}" ${AWY.raw(display.size === value ? 'checked' : '')}><span aria-hidden="true">A</span><span class="sr-only">${label}</span></label>`;
    const contrast = (value, label) => html`<label class="display-choice is-word"><input type="radio" name="${prefix}Contrast" value="${value}" ${AWY.raw(display.contrast === value ? 'checked' : '')}><span>${label}</span></label>`;
    return html`<fieldset class="display-group"><legend>Text size</legend><div class="display-row">${size('standard', 'Standard text', 'is-a1')}${size('large', 'Large text', 'is-a2')}${size('larger', 'Larger text', 'is-a3')}</div></fieldset>
      <fieldset class="display-group"><legend>Contrast</legend><div class="display-row">${contrast('standard', 'Standard')}${contrast('high', 'High')}</div></fieldset>`;
  }
  const here = (key) => AWY.raw(key === current ? 'aria-current="page"' : '');

  /*
    On phones and tablets the menu fills the screen under the header. The extra details
    at the bottom only show there; on wide screens the links sit in the header as usual.
  */
  function header() {
    const links = NAV.map(
      (item, i) => html`<a href="${root + item.href}" ${here(item.key)} style="--i:${i}">${icon(item.icon)}<span>${item.label}</span></a>`
    );
    return html`<div class="wrap">
      <a class="brand" href="${root}index.html" aria-label="Allied With You, home">
        <img src="${root}images/logomark.svg" alt="" width="42" height="42">
        <span>Allied <span class="with">With</span> You</span>
      </a>
      <nav class="nav" id="siteNav" aria-label="Main">
        <div class="nav-links">${links}</div>
        <div class="nav-actions">
          <a class="btn" href="${root}referrals.html" ${here('referrals')}>Make a referral</a>
          <a class="btn btn-secondary nav-only" href="${root}contact.html">Make an enquiry</a>
        </div>
        <div class="nav-mark nav-only" aria-hidden="true"><span><img src="${root}images/logomark.svg" alt="" width="120" height="120"></span></div>
        <div class="nav-display nav-only">${displayChoices('menu')}</div>
        <ul class="nav-info nav-only" aria-label="About the practice">
          <li>${icon('mail')}<a href="mailto:${biz.email}">${biz.email}</a></li>
          <li>${icon('pin')}<span>Home visits across the ${biz.areas[0]} and ${biz.areas[1]}</span></li>
          <li>${icon('video')}<span>Telehealth anywhere in Australia</span></li>
        </ul>
      </nav>
      <div class="display-wrap">
        <button class="display-btn" id="displayButton" type="button" aria-expanded="false" aria-controls="displayPanel"><span aria-hidden="true">Aa</span><span class="sr-only">Text size and contrast</span></button>
        <div class="display-panel" id="displayPanel" role="group" aria-label="Text size and contrast" hidden>
          ${displayChoices('panel')}
          <a class="display-easy" href="${root}easyread.html">Read this website in Easy Read</a>
        </div>
      </div>
      <button class="search-btn" id="siteSearchButton" type="button" aria-haspopup="dialog" aria-expanded="false" aria-keyshortcuts="Control+K Meta+K /">${icon('search')}<span class="search-btn-label">Search</span><kbd aria-hidden="true">Ctrl K</kbd></button>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="siteNav"><span class="nav-toggle-icon" aria-hidden="true"><span></span><span></span><span></span></span><span class="nav-toggle-label">Menu</span></button>
    </div>`;
  }

  function footer() {
    const year = new Date().getFullYear();
    return html`<div class="wrap">
      <div class="footer-main">
        <div>
          <p class="footer-brand">Allied <span class="with">With</span> You</p>
          <p>Occupational therapy at home and in the community across the ${biz.areas[0]} and ${biz.areas[1]}, and by telehealth anywhere in Australia.</p>
        </div>
        <div>
          <h2>Get in touch</h2>
          <ul>
            <li><a href="mailto:${biz.email}">${biz.email}</a></li>
            <li><a href="${root}contact.html">Contact us</a></li>
          </ul>
        </div>
        <div>
          <h2>Explore</h2>
          <ul>
            <li><a href="${root}about.html">About us</a></li>
            <li><a href="${root}team.html">Our team</a></li>
            <li><a href="${root}services.html">Services</a></li>
            <li><a href="${root}ndis.html">NDIS participants</a></li>
            <li><a href="${root}myagedcare.html">My Aged Care</a></li>
            <li><a href="${root}process.html">How it works</a></li>
            <li><a href="${root}faq.html">Questions people ask</a></li>
            <li><a href="${root}funding.html">Which funding fits me?</a></li>
            <li><a href="${root}firstvisit.html">Your first appointment</a></li>
            <li><a href="${root}glossary.html">Words we use</a></li>
            <li><a href="${root}easyread.html">Easy Read</a></li>
          </ul>
        </div>
        <div>
          <h2>Where we work</h2>
          <ul>
            <li><a href="${root}northernrivers.html">Northern Rivers</a></li>
            <li><a href="${root}goldcoast.html">Gold Coast</a></li>
            <li><a href="${root}process.html#byTelehealth">Telehealth across Australia</a></li>
          </ul>
        </div>
        <div>
          <h2>For referrers</h2>
          <ul>
            <li><a href="${root}referrals.html">Make a referral</a></li>
            <li><a href="${root}referrers.html">Information for referrers</a></li>
            <li><a href="${root}privacy.html">Privacy</a></li>
            <li><a href="${root}complaints.html">Complaints and feedback</a></li>
            <li><a href="${root}accessibility.html">Accessibility</a></li>
          </ul>
        </div>
      </div>
      <p class="acknowledgement">We acknowledge the Bundjalung and Yugambeh peoples, the Traditional Custodians of the land where we live and work, and pay our respects to Elders past and present.</p>
      <div class="footer-base">
        <span>Copyright ${year} Allied With You</span>
        <a href="${root}admin/">Staff sign in</a>
      </div>
    </div>`;
  }

  function mount(selector, render) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = String(render());
    return el;
  }

  const head = mount('[data-site-header]', header);
  mount('[data-site-footer]', footer);
  AWY.hydrateIcons();

  /* Text size and contrast: both sets of choices stay in step, and the choice is remembered */
  if (head) {
    const syncChoices = () => {
      AWY.$$('input[name$="Size"]', head).forEach((r) => { r.checked = r.value === display.size; });
      AWY.$$('input[name$="Contrast"]', head).forEach((r) => { r.checked = r.value === display.contrast; });
    };
    head.addEventListener('change', (event) => {
      const r = event.target;
      if (!r.name || !/(Size|Contrast)$/.test(r.name)) return;
      display = Object.assign({}, display, /Size$/.test(r.name) ? { size: r.value } : { contrast: r.value });
      applyDisplay(display);
      syncChoices();
      try {
        localStorage.setItem('awy.display', JSON.stringify(display));
      } catch (error) {
        /* storage blocked: the choice still applies to this page */
      }
    });
    const btn = head.querySelector('#displayButton');
    const panel = head.querySelector('#displayPanel');
    const setPanel = (open, focusBack) => {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        const first = panel.querySelector('input:checked') || panel.querySelector('input');
        if (first) first.focus();
      } else if (focusBack) {
        btn.focus();
      }
    };
    btn.addEventListener('click', () => setPanel(panel.hidden, false));
    document.addEventListener('click', (event) => {
      if (!panel.hidden && !event.target.closest('.display-wrap')) setPanel(false, false);
    });
    head.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        event.stopPropagation();
        setPanel(false, true);
      }
    });
  }

  /* Printing: questions open up so their answers print too, then go back as they were */
  window.addEventListener('beforeprint', () => {
    AWY.$$('details:not([open])').forEach((d) => {
      d.dataset.printOpened = 'yes';
      d.open = true;
    });
  });
  window.addEventListener('afterprint', () => {
    AWY.$$('details[data-print-opened]').forEach((d) => {
      d.open = false;
      delete d.dataset.printOpened;
    });
  });

  /* Search across the whole website, from the button in the header (js/site/search.js) */
  if (head) {
    const script = document.createElement('script');
    script.src = root + 'js/site/search.js';
    document.body.appendChild(script);
    /* Words explained where they appear (js/site/terms.js) */
    const terms = document.createElement('script');
    terms.src = root + 'js/site/terms.js';
    document.body.appendChild(terms);

    /* Print buttons print the page as it is, with the menu and footer left off */
    AWY.$$('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));
  }

  /*
    Holds the page still behind the menu or search, including on iPhones, where hiding
    overflow alone still lets the page scroll. Either one can hold it; it lets go when both have.
  */
  let holds = 0;
  let heldAt = 0;
  AWY.holdPage = function (hold) {
    holds = Math.max(0, holds + (hold ? 1 : -1));
    const body = document.body;
    if (hold && holds === 1) {
      heldAt = window.scrollY;
      /* Room for the scroll bar that's about to disappear, so nothing shifts sideways */
      const bar = window.innerWidth - document.documentElement.clientWidth;
      body.style.top = -heldAt + 'px';
      if (bar > 0) body.style.paddingRight = bar + 'px';
      document.documentElement.classList.add('is-held');
    } else if (!hold && holds === 0) {
      document.documentElement.classList.remove('is-held');
      body.style.top = '';
      body.style.paddingRight = '';
      window.scrollTo({ top: heldAt, behavior: 'instant' });
    }
  };

  /* The menu on phones and tablets: fills the screen, everything behind it held still and set aside */
  if (head) {
    const toggle = head.querySelector('.nav-toggle');
    const label = toggle.querySelector('.nav-toggle-label');
    const nav = head.querySelector('.nav');
    const behind = () => Array.from(document.body.children).filter((el) => el !== head && el.tagName !== 'SCRIPT' && el.tagName !== 'DIALOG');
    let open = false;

    const setOpen = (next, returnFocus) => {
      if (next === open) return;
      open = next;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      label.textContent = open ? 'Close' : 'Menu';
      head.classList.toggle('menu-open', open);
      nav.classList.toggle('is-open', open);
      behind().forEach((el) => {
        if (open) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
      });
      AWY.holdPage(open);
      if (open) {
        const first = nav.querySelector('a');
        if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
      } else if (returnFocus) {
        toggle.focus();
      }
    };
    toggle.setAttribute('aria-label', 'Open menu');

    toggle.addEventListener('click', () => setOpen(!open, false));
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false, false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && open && !document.querySelector('dialog[open]')) {
        setOpen(false, true);
      }
    });
    /* Turning a tablet or widening the window past the menu's width puts everything back */
    window.addEventListener('resize', () => {
      if (open && getComputedStyle(toggle).display === 'none') setOpen(false, false);
    });
    /* Coming back to a page from the browser's history never finds the menu still open */
    window.addEventListener('pageshow', () => setOpen(false, false));
    /* Search opened from the header closes the menu first */
    head.querySelector('#siteSearchButton').addEventListener('click', () => setOpen(false, false), true);
    AWY.closeMenu = () => setOpen(false, false);

    const onScroll = () => head.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
