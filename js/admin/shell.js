/* The dashboard frame: demo notice, sidebar, top bar, global search and role switcher. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const icon = (n) => raw(AWY.icon(n));
  const access = AWY.access;
  const rules = AWY.rules;

  function nav() {
    const groups = [];
    access.SECTIONS.filter((s) => access.canSee(s.key)).forEach((s) => {
      let g = groups.find((x) => x.name === s.group);
      if (!g) groups.push((g = { name: s.group, items: [] }));
      g.items.push(s);
    });
    return groups.map((g) => html`<div class="side-group">
      <h2>${g.name}</h2>
      <ul>${g.items.map((s) => html`<li><a class="side-link" href="${s.key === 'dashboard' ? '#/' : '#/' + s.key}" data-section="${s.key}">${icon(s.icon)}<span>${s.label}</span><span class="count" data-count="${s.key}" hidden></span></a></li>`)}</ul>
    </div>`);
  }

  function render(user, db) {
    const staffOptions = db.staff.filter((s) => s.active !== false);
    return html`
      <div class="demo-bar" role="note">
        <span><strong>Demo environment.</strong> All information is fictional<span class="hide-small">, and nothing is sent, charged or submitted</span>.</span>
        <button type="button" data-action="reset">Reset demo data</button>
      </div>
      <div class="app">
        <aside class="sidebar" id="sidebar" aria-label="Dashboard">
          <a class="side-brand" href="#/">
            <img src="../images/logomark.svg" alt="" width="36" height="36">
            <span>Allied <span class="with">With</span> You<small>Practice dashboard</small></span>
          </a>
          <nav class="side-nav" aria-label="Sections">${nav()}</nav>
          <div class="side-user">
            <span class="avatar" aria-hidden="true">${AWY.fmt.initials(user.name)}</span>
            <div><strong>${user.name}</strong><span>${access.roleLabel(user.role)}</span></div>
            <button type="button" class="btn btn-quiet btn-icon" data-action="signout" aria-label="Leave the demo dashboard" title="Leave the demo dashboard">${icon('logout')}</button>
          </div>
        </aside>
        <div class="drawer-backdrop" data-action="close-drawer"></div>
        <div class="main-col">
          <header class="topbar">
            <button type="button" class="btn btn-secondary btn-icon menu-btn" data-action="menu" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button>
            <div class="search" role="search">
              ${icon('search')}
              <label class="sr-only" for="globalSearch">Search clients and records</label>
              <input class="input" id="globalSearch" type="search" placeholder="Search clients, referrals, invoices" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="searchResults" aria-autocomplete="list">
              <div class="search-results" id="searchResults" role="listbox" aria-label="Search results" hidden></div>
            </div>
            <div class="topbar-actions">
              <label class="sr-only" for="roleSwitch">Viewing the demo as</label>
              <select class="select hide-small" id="roleSwitch" style="width:auto;min-height:2.4rem" title="Switch demo person to see other access levels">
                ${staffOptions.map((s) => html`<option value="${s.id}" ${raw(s.id === user.id ? 'selected' : '')}>${s.name}, ${access.roleLabel(s.role).toLowerCase()}</option>`)}
              </select>
              ${access.canSee('calendar') ? html`<a class="btn btn-sm hide-small" href="#/calendar?new=1">${icon('plus')}New appointment</a>` : ''}
            </div>
          </header>
          <main id="main" class="view" tabindex="-1"></main>
        </div>
      </div>`;
  }

  /* Small counts beside sidebar links, worked out from the data */
  function updateCounts(db) {
    const today = AWY.date.today();
    const user = access.user();
    const d = rules.dashboard(db, today);
    const mine = (list, field) => (user.role === 'owner' || user.role === 'admin' ? list : list.filter((x) => x[field] === user.id));
    const counts = {
      referrals: { n: d.newReferrals.length },
      notes: { n: mine(d.notesOutstanding.map((x) => x.appointment), 'staffId').length, alert: true },
      tasks: { n: mine(d.overdueTasks, 'assignedTo').length, alert: true },
      invoices: { n: d.overdueInvoices.length, alert: true },
      incidents: { n: db.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length }
    };
    AWY.$$('[data-count]').forEach((el) => {
      const c = counts[el.dataset.count];
      el.hidden = !c || !c.n;
      if (c && c.n) {
        el.textContent = c.n;
        el.classList.toggle('is-alert', !!c.alert);
        el.setAttribute('aria-label', c.n + (c.alert ? ' need attention' : ' new'));
      }
    });
  }

  function setActive(section) {
    AWY.$$('.side-link').forEach((a) => {
      if (a.dataset.section === section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* Global search across the main record types */
  function searchResults(db, q) {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    const has = (...vals) => vals.some((v) => String(v || '').toLowerCase().includes(query));
    const groups = [];
    const clients = db.clients.filter((c) => has(c.firstName + ' ' + c.lastName, c.preferredName, c.suburb, c.phone, c.ndisNumber, c.ref)).slice(0, 6);
    if (clients.length) groups.push({ label: 'Clients', items: clients.map((c) => ({ href: '#/clients/' + c.id, title: rules.clientName(c), sub: 'Client ' + c.ref + ', ' + c.suburb })) });
    if (access.canSee('referrals')) {
      const refs = db.referrals.filter((r) => has(r.firstName + ' ' + r.lastName, r.referrerName, r.suburb, r.ref)).slice(0, 4);
      if (refs.length) groups.push({ label: 'Referrals', items: refs.map((r) => ({ href: '#/referrals/' + r.id, title: r.firstName + ' ' + r.lastName, sub: AWY.schema.status('referral', r.status).label + ', received ' + AWY.fmt.date(r.receivedDate) })) });
    }
    if (access.canSee('invoices')) {
      const inv = db.invoices.filter((i) => has('invoice ' + i.number, i.billToName)).slice(0, 4);
      if (inv.length) groups.push({ label: 'Invoices', items: inv.map((i) => ({ href: '#/invoices/' + i.id, title: 'Invoice ' + i.number, sub: rules.clientNameById(db, i.clientId) })) });
    }
    if (access.canSee('reports')) {
      const reps = db.reports.filter((r) => has(r.title, rules.clientNameById(db, r.clientId))).slice(0, 4);
      if (reps.length) groups.push({ label: 'Reports', items: reps.map((r) => ({ href: '#/reports/' + r.id, title: r.title, sub: rules.clientNameById(db, r.clientId) })) });
    }
    return groups;
  }

  function bindSearch(getDb) {
    const input = AWY.$('#globalSearch');
    const box = AWY.$('#searchResults');
    let active = -1;
    const close = () => {
      box.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      active = -1;
    };
    const links = () => AWY.$$('a', box);
    const highlight = () => {
      links().forEach((a, i) => {
        a.classList.toggle('is-active', i === active);
        a.setAttribute('aria-selected', String(i === active));
      });
      const current = links()[active];
      if (current) input.setAttribute('aria-activedescendant', current.id);
    };
    input.addEventListener('input', AWY.debounce(() => {
      const groups = searchResults(getDb(), input.value);
      if (!input.value.trim()) return close();
      let n = 0;
      box.innerHTML = String(groups.length
        ? html`${groups.map((g) => html`<div class="group">${g.label}</div>${g.items.map((it) => html`<a href="${it.href}" id="sr${n++}" role="option">${icon(g.label === 'Clients' ? 'user' : g.label === 'Referrals' ? 'inbox' : g.label === 'Invoices' ? 'receipt' : 'report')}<span>${it.title}<small>${it.sub}</small></span></a>`)}`)}`
        : html`<p class="muted small" style="padding:0.75rem">No matches for "${input.value}"</p>`);
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    }, 120));
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
        window.location.hash = list[active >= 0 ? active : 0].getAttribute('href').slice(1);
        input.value = '';
        close();
      } else if (event.key === 'Escape') {
        input.value = '';
        close();
      }
    });
    box.addEventListener('click', () => {
      input.value = '';
      close();
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.search')) close();
    });
  }

  function openDrawer(open) {
    const sidebar = AWY.$('#sidebar');
    const backdrop = AWY.$('.drawer-backdrop');
    const btn = AWY.$('.menu-btn');
    sidebar.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = sidebar.querySelector('a');
      if (first) first.focus();
    }
  }

  AWY.shell = { render: render, updateCounts: updateCounts, setActive: setActive, bindSearch: bindSearch, openDrawer: openDrawer };
})();
