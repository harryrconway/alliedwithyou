/* The dashboard frame: sidebar, top bar and search across tasks and the team. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const icon = (n) => raw(AWY.icon(n));
  const access = AWY.access;
  const rules = AWY.rules;

  /* Every section in the person's role is listed. Ones not switched on yet are greyed and can't be opened. */
  function nav() {
    const groups = [];
    access.SECTIONS.filter((s) => access.inRole(s.key)).forEach((s) => {
      let g = groups.find((x) => x.name === s.group);
      if (!g) groups.push((g = { name: s.group, items: [] }));
      g.items.push(s);
    });
    return groups.map((g) => html`<div class="side-group">
      <h2>${g.name}</h2>
      <ul>${g.items.map((s) => (access.isLocked(s.key)
        ? html`<li><span class="side-link is-locked" aria-disabled="true" title="Not switched on yet">${icon(s.icon)}<span>${s.label}<span class="sr-only">, not switched on yet</span></span>${icon('lock')}</span></li>`
        : html`<li><a class="side-link" href="${s.key === 'dashboard' ? '#/' : '#/' + s.key}" data-section="${s.key}">${icon(s.icon)}<span>${s.label}</span><span class="count" data-count="${s.key}" hidden></span></a></li>`))}</ul>
    </div>`);
  }

  function userPanel(user) {
    return html`<button type="button" class="side-account" data-action="account" title="Your account">
        <span class="avatar" aria-hidden="true">${AWY.fmt.initials(user.name || user.email)}</span>
        <span><strong>${user.name || user.email}</strong><span>${access.roleLabel(user.role)}</span></span>
      </button>
      <button type="button" class="btn btn-quiet btn-icon" data-action="signout" aria-label="Sign out" title="Sign out">${icon('logout')}</button>`;
  }

  function render(user) {
    return html`
      <div class="app">
        <aside class="sidebar" id="sidebar" aria-label="Dashboard">
          <a class="side-brand" href="#/">
            <img src="../images/logomark.svg" alt="" width="36" height="36">
            <span>Allied <span class="with">With</span> You<small>Practice dashboard</small></span>
          </a>
          <nav class="side-nav" aria-label="Sections">
            ${nav()}
            <p class="side-note">${icon('lock')}<span>Greyed sections aren't switched on yet.</span></p>
          </nav>
          <div class="side-user" id="sideUser">${userPanel(user)}</div>
        </aside>
        <div class="drawer-backdrop" data-action="close-drawer"></div>
        <div class="main-col">
          <header class="topbar">
            <button type="button" class="btn btn-secondary btn-icon menu-btn" data-action="menu" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button>
            <div class="search" role="search">
              ${icon('search')}
              <label class="sr-only" for="globalSearch">Search tasks and the team</label>
              <input class="input" id="globalSearch" type="search" placeholder="Search tasks and the team" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="searchResults" aria-autocomplete="list">
              <div class="search-results" id="searchResults" role="listbox" aria-label="Search results" hidden></div>
            </div>
            <div class="topbar-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-action="report" aria-label="Report an issue">${icon('message')}<span class="hide-small">Report an issue</span></button>
              ${access.canSee('tasks') ? html`<button type="button" class="btn btn-sm hide-small" data-action="new-task">${icon('plus')}New task</button>` : ''}
            </div>
          </header>
          <main id="main" class="view" tabindex="-1"></main>
        </div>
      </div>`;
  }

  function updateUser(user) {
    const el = AWY.$('#sideUser');
    if (el) el.innerHTML = String(userPanel(user));
  }

  /* Small counts beside sidebar links, worked out from the data */
  function updateCounts(db) {
    const today = AWY.date.today();
    const user = access.user();
    const counts = {
      tasks: { n: rules.overdueTasks(db, today, user.id).length, alert: true },
      staff: { n: access.can('manageStaff') ? rules.pendingStaff(db).length : 0 },
      feedback: { n: access.can('reviewFeedback') ? db.feedback.filter((f) => f.status === 'submitted').length : 0 }
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
    AWY.$$('.side-link[data-section]').forEach((a) => {
      if (a.dataset.section === section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* Search across tasks and the team */
  function searchResults(db, q) {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    const has = (...vals) => vals.some((v) => String(v || '').toLowerCase().includes(query));
    const groups = [];
    if (access.canSee('tasks')) {
      const tasks = db.tasks.filter((t) => t.status === 'open' && has(t.title, t.description)).slice(0, 6);
      if (tasks.length) groups.push({ label: 'Tasks', icon: 'tasks', items: tasks.map((t) => ({ href: '#/tasks?task=' + t.id, title: t.title, sub: 'Due ' + AWY.fmt.date(t.dueDate) + ', ' + rules.staffName(db, t.assignedTo) })) });
    }
    if (access.canSee('staff')) {
      const people = db.staff.filter((s) => s.status === 'active' && has(s.name, s.email, s.title)).slice(0, 6);
      if (people.length) groups.push({ label: 'Team', icon: 'user', items: people.map((s) => ({ href: '#/staff', title: s.name || s.email, sub: access.roleLabel(s.role) + (s.title ? ', ' + s.title : '') })) });
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
      const db = getDb();
      if (!input.value.trim() || !db) return close();
      const groups = searchResults(db, input.value);
      let n = 0;
      box.innerHTML = String(groups.length
        ? html`${groups.map((g) => html`<div class="group">${g.label}</div>${g.items.map((it) => html`<a href="${it.href}" id="sr${n++}" role="option">${icon(g.icon)}<span>${it.title}<small>${it.sub}</small></span></a>`)}`)}`
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
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = sidebar.querySelector('a');
      if (first) first.focus();
    }
  }

  AWY.shell = { render: render, updateUser: updateUser, updateCounts: updateCounts, setActive: setActive, bindSearch: bindSearch, openDrawer: openDrawer };
})();
