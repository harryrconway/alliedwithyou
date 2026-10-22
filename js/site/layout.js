/* Shared header and footer for every public page. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const biz = AWY.business;

  const root = document.body.dataset.root || '';
  const current = document.body.dataset.page || '';

  const NAV = [
    { key: 'about', href: 'about.html', label: 'About', icon: 'users' },
    { key: 'services', href: 'services.html', label: 'Services', icon: 'clipboard' },
    { key: 'ndis', href: 'ndis.html', label: 'NDIS', icon: 'target' },
    { key: 'myagedcare', href: 'myagedcare.html', label: 'My Aged Care', icon: 'heart' },
    { key: 'process', href: 'process.html', label: 'How it works', icon: 'chart' },
    { key: 'fees', href: 'fees.html', label: 'Fees', icon: 'wallet' },
    { key: 'faq', href: 'faq.html', label: 'FAQs', icon: 'message' },
    { key: 'contact', href: 'contact.html', label: 'Contact', icon: 'mail' }
  ];

  const icon = (name) => AWY.raw(AWY.icon(name));
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
        <ul class="nav-info nav-only" aria-label="About the practice">
          <li>${icon('mail')}<a href="mailto:${biz.email}">${biz.email}</a></li>
          <li>${icon('pin')}<span>Home visits across the ${biz.areas[0]} and ${biz.areas[1]}</span></li>
          <li>${icon('video')}<span>Telehealth anywhere in Australia</span></li>
        </ul>
      </nav>
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
            <li><a href="${root}services.html">Services</a></li>
            <li><a href="${root}ndis.html">NDIS participants</a></li>
            <li><a href="${root}myagedcare.html">My Aged Care</a></li>
            <li><a href="${root}process.html">How it works</a></li>
            <li><a href="${root}fees.html">Fees and cancellations</a></li>
            <li><a href="${root}faq.html">Questions people ask</a></li>
          </ul>
        </div>
        <div>
          <h2>For referrers</h2>
          <ul>
            <li><a href="${root}referrals.html">Make a referral</a></li>
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

  /* Search across the whole website, from the button in the header (js/site/search.js) */
  if (head) {
    const script = document.createElement('script');
    script.src = root + 'js/site/search.js';
    document.body.appendChild(script);
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
    const wide = window.matchMedia('(width > 1140px)');
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
    wide.addEventListener('change', (event) => {
      if (event.matches) setOpen(false, false);
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
