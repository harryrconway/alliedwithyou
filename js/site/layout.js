/* Shared header and footer for every public page. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const biz = AWY.business;

  const root = document.body.dataset.root || '';
  const current = document.body.dataset.page || '';

  const NAV = [
    { key: 'about', href: 'about.html', label: 'About' },
    { key: 'services', href: 'services.html', label: 'Services' },
    { key: 'ndis', href: 'ndis.html', label: 'NDIS' },
    { key: 'myagedcare', href: 'myagedcare.html', label: 'My Aged Care' },
    { key: 'process', href: 'process.html', label: 'How it works' },
    { key: 'fees', href: 'fees.html', label: 'Fees' },
    { key: 'faq', href: 'faq.html', label: 'FAQs' },
    { key: 'contact', href: 'contact.html', label: 'Contact' }
  ];

  const icon = (name) => AWY.raw(AWY.icon(name));

  function header() {
    const links = NAV.map(
      (item) => html`<a href="${root + item.href}" ${AWY.raw(item.key === current ? 'aria-current="page"' : '')}>${item.label}</a>`
    );
    return html`<div class="wrap">
      <a class="brand" href="${root}index.html" aria-label="Allied With You, home">
        <img src="${root}images/logomark.svg" alt="" width="42" height="42">
        <span>Allied <span class="with">With</span> You</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="siteNav">${icon('menu')}<span>Menu</span></button>
      <nav class="nav" id="siteNav" aria-label="Main">
        ${links}
        <a class="btn" href="${root}referrals.html" ${AWY.raw(current === 'referrals' ? 'aria-current="page"' : '')}>Make a referral</a>
      </nav>
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

  /* Mobile menu */
  if (head) {
    const toggle = head.querySelector('.nav-toggle');
    const nav = head.querySelector('.nav');
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    const onScroll = () => head.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
