/* The dashboard frame: sidebar, top bar and search of the database itself. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const icon = (n) => raw(AWY.icon(n));
  const access = AWY.access;
  const rules = AWY.rules;
  const C = AWY.c;
  const schema = AWY.schema;

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
              <label class="sr-only" for="globalSearch">Search the whole dashboard</label>
              <input class="input" id="globalSearch" type="search" placeholder="Search people, tasks, templates and more" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="searchResults" aria-autocomplete="list" aria-keyshortcuts="Control+K Meta+K /">
              <kbd class="search-hint" aria-hidden="true">${/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'}</kbd>
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
      staff: { n: access.can('manageStaff') ? rules.approvableStaff(db, AWY.auth.isReserved).length : 0 },
      feedback: { n: access.can('reviewFeedback') ? db.feedback.filter((f) => f.status === 'submitted').length : 0 },
      privacy: { n: access.can('managePrivacy') ? db.privacyRequests.filter((p) => p.status === 'received' || p.status === 'in_progress').length : 0 }
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

  /*
    Search. Matches from what the dashboard has already loaded show straight away, then the
    database's own search adds anything older, such as a task completed last year. Row Level
    Security decides what that search can find, the same as every other read. Typing the
    name of a section, or something in it such as "fees", offers to jump straight there.
  */
  const PLACES = [
    { section: 'dashboard', label: 'Dashboard', href: '#/', words: 'home overview' },
    { section: 'calendar', label: 'Calendar', href: '#/calendar', words: 'bookings availability leave diary schedule' },
    { section: 'tasks', label: 'Tasks', href: '#/tasks', words: 'to do reminders follow up' },
    { section: 'templates', label: 'Templates', href: '#/templates', words: 'forms agreements contracts letters documents' },
    { section: 'staff', label: 'Team and access', href: '#/staff', words: 'staff people roles approvals accounts' },
    { section: 'staff', label: 'Checks and registrations', href: '#/staff/checks', words: 'police working with children blue card ochre ahpra insurance first aid screening' },
    { section: 'statistics', label: 'Reports', href: '#/statistics', words: 'statistics hours figures' },
    { section: 'statistics', label: 'Downloads', href: '#/statistics/downloads', words: 'export backup copy zip spreadsheet' },
    { section: 'history', label: 'Change history', href: '#/history', words: 'audit log changes' },
    { section: 'settings', label: 'Settings', href: '#/settings', words: 'fees rates business services funding two step time zone' },
    { section: 'feedback', label: 'Feedback and issues', href: '#/feedback', words: 'tickets bugs errors problems' },
    { section: 'privacy', label: 'Privacy requests', href: '#/privacy', words: 'access correction deletion personal information' }
  ];

  const lower = (text) => String(text || '').toLowerCase();
  const statusLabel = (key, value) => schema.status(key, value).label;
  const join = (parts) => parts.filter(Boolean).join(', ');

  const KINDS = {
    task: {
      label: 'Tasks', icon: 'tasks', href: (r) => '#/tasks?task=' + r.id,
      sub: (r) => join([r.status === 'done' ? 'Done' : 'Due ' + (r.meta1 ? AWY.fmt.date(r.meta1) : 'any time'), r.meta2])
    },
    staff: {
      label: 'Team', icon: 'user', href: (r) => '#/staff?open=' + r.id,
      sub: (r) => join([access.roleLabel(r.meta1), lower(r.meta2) !== lower(access.roleLabel(r.meta1)) ? r.meta2 : '', r.status && r.status !== 'active' ? statusLabel('account', r.status) : ''])
    },
    template: {
      label: 'Templates', icon: 'clipboard', href: (r) => '#/templates?open=' + r.id,
      sub: (r) => join([C.label('templateCategory', r.meta1), r.meta2 && r.meta2 !== 'any' ? C.label('templateFunding', r.meta2) : '', r.status === 'draft' ? 'Draft' : ''])
    },
    feedback: {
      label: 'Feedback and issues', icon: 'message', href: (r) => '#/feedback?open=' + r.id,
      sub: (r) => join([r.ref, statusLabel('feedback', r.status)])
    },
    privacy: {
      label: 'Privacy requests', icon: 'lock', href: (r) => '#/privacy?open=' + r.id,
      sub: (r) => join([r.ref, C.label('privacyKind', r.meta1), statusLabel('privacyRequest', r.status)])
    }
  };

  /* The same matching as the database's search, over what's already loaded */
  function localMatches(db, q) {
    const has = (...values) => values.some((v) => lower(v).includes(q));
    const out = [];
    const add = (r) => out.push(Object.assign({ ref: '', meta1: '', meta2: '', status: '' }, r));
    (db.tasks || []).forEach((t) => {
      if (has(t.title, t.description)) add({ kind: 'task', id: t.id, title: t.title, meta1: t.dueDate, meta2: rules.staffName(db, t.assignedTo), status: t.status, createdAt: t.createdAt });
    });
    (db.staff || []).forEach((p) => {
      if ((p.status === 'active' || access.can('manageStaff')) && has(p.name, p.email, p.title)) add({ kind: 'staff', id: p.id, title: p.name || p.email, meta1: p.role, meta2: p.title, status: p.status, createdAt: p.createdAt });
    });
    (db.templates || []).forEach((t) => {
      if (t.status !== 'retired' && has(t.title, t.description)) add({ kind: 'template', id: t.id, title: t.title, meta1: t.category, meta2: t.funding, status: t.status, createdAt: t.createdAt });
    });
    (db.feedback || []).forEach((f) => {
      if (has(f.title, f.description, f.ref)) add({ kind: 'feedback', id: f.id, ref: f.ref, title: f.title, meta1: f.kind, meta2: f.priority, status: f.status, createdAt: f.createdAt });
    });
    (db.privacyRequests || []).forEach((p) => {
      if (has(p.requesterName, p.details, p.ref)) add({ kind: 'privacy', id: p.id, ref: p.ref, title: p.requesterName, meta1: p.kind, status: p.status, createdAt: p.createdAt });
    });
    return out;
  }

  /* Best first: a title or reference that starts with what was typed, then one that contains it, then a match in the details */
  function rank(r, q) {
    if (lower(r.title).startsWith(q) || lower(r.ref).startsWith(q)) return 0;
    return lower(r.title).includes(q) ? 1 : 2;
  }

  function placeMatches(q) {
    return PLACES.filter((p) => access.canSee(p.section) && (' ' + lower(p.label) + ' ' + p.words).includes(' ' + q)).slice(0, 3);
  }

  /* Groups in order of their best match, so what was most likely meant comes first */
  function searchGroups(q, local, server) {
    const byKey = new Map();
    local.concat(server || []).forEach((r) => byKey.set(r.kind + ':' + r.id, r));
    const rows = Array.from(byKey.values())
      .map((r) => Object.assign(r, { rank: rank(r, q) }))
      .sort((a, b) => a.rank - b.rank || String(b.createdAt).localeCompare(String(a.createdAt)));
    const groups = [];
    const places = placeMatches(q);
    if (places.length) groups.push({ label: 'Go to', icon: 'arrowRight', best: -1, total: places.length, items: places.map((p) => ({ href: p.href, title: p.label, sub: '' })) });
    Object.keys(KINDS).forEach((kind) => {
      const meta = KINDS[kind];
      const items = rows.filter((r) => r.kind === kind);
      if (items.length) groups.push({ label: meta.label, icon: meta.icon, best: items[0].rank, total: items.length, items: items.slice(0, 5).map((r) => ({ href: meta.href(r), title: r.title, sub: meta.sub(r) })) });
    });
    return groups.sort((a, b) => a.best - b.best);
  }

  /* The part of a title that matched, highlighted */
  function mark(text, q) {
    const s = String(text || '');
    const i = lower(s).indexOf(q);
    if (i < 0) return s;
    return html`${s.slice(0, i)}<mark>${s.slice(i, i + q.length)}</mark>${s.slice(i + q.length)}`;
  }

  function bindSearch(getDb) {
    const input = AWY.$('#globalSearch');
    const box = AWY.$('#searchResults');
    let active = -1;
    let request = 0;
    let timer = null;
    const links = () => AWY.$$('a', box);
    const close = () => {
      box.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    };
    const highlight = () => {
      links().forEach((a, i) => {
        a.classList.toggle('is-active', i === active);
        a.setAttribute('aria-selected', String(i === active));
      });
      const current = links()[active];
      if (current) {
        input.setAttribute('aria-activedescendant', current.id);
        current.scrollIntoView({ block: 'nearest' });
      }
    };

    function show(typed, q, local, server, pending, failed) {
      const keep = active >= 0 && links()[active] ? links()[active].getAttribute('href') : '';
      const groups = searchGroups(q, local, server);
      let n = 0;
      const results = groups.map((g) => html`<div class="group" role="presentation"><span>${g.label}</span>${g.total > g.items.length ? html`<span class="n">${g.items.length} of ${g.total}</span>` : ''}</div>
        ${g.items.map((it) => html`<a href="${it.href}" id="sr${n++}" role="option" aria-selected="false">${icon(g.icon)}<span class="hit"><span class="hit-title">${mark(it.title, q)}</span>${it.sub ? html`<small>${it.sub}</small>` : ''}</span></a>`)}`);
      const empty = !groups.length && !pending ? html`<p class="search-empty"><strong>No matches for “${typed}”</strong>Search covers tasks, the team, templates, feedback and privacy requests.</p>` : '';
      const status = pending
        ? html`<p class="search-status" role="status">${icon('refresh')}<span>Searching older records</span></p>`
        : failed ? html`<p class="search-status is-problem" role="status">${icon('alertCircle')}<span>Older records couldn't be searched just now, so these are from what's loaded.</span></p>` : '';
      box.innerHTML = String(html`${results}${empty}${status}<p class="search-keys" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></p>`);
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = keep ? links().findIndex((a) => a.getAttribute('href') === keep) : -1;
      highlight();
    }

    function update() {
      const typed = input.value.trim();
      const q = lower(typed);
      const mine = (request += 1);
      clearTimeout(timer);
      if (q.length < 2) return close();
      const db = getDb ? getDb() : null;
      const local = db ? localMatches(db, q) : [];
      show(typed, q, local, null, true, false);
      timer = setTimeout(async () => {
        let server = null;
        let failed = false;
        try {
          server = await AWY.store.globalSearch(typed);
        } catch (error) {
          failed = true;
        }
        if (mine === request) show(typed, q, local, server, false, failed);
      }, 160);
    }

    input.addEventListener('input', update);
    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2 && box.hidden) update();
    });
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
        input.blur();
      } else if (event.key === 'Escape') {
        if (input.value) {
          input.value = '';
          close();
        } else {
          input.blur();
        }
      }
    });
    box.addEventListener('mousemove', (event) => {
      const a = event.target.closest('a');
      const i = a ? links().indexOf(a) : -1;
      if (i >= 0 && i !== active) {
        active = i;
        links().forEach((x, j) => x.classList.toggle('is-active', j === active));
      }
    });
    box.addEventListener('click', (event) => {
      if (!event.target.closest('a')) return;
      input.value = '';
      close();
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.search')) close();
    });
    /* Ctrl K, Command K or / jumps to search from anywhere, unless someone is typing elsewhere */
    document.addEventListener('keydown', (event) => {
      const typing = event.target.closest && event.target.closest('input, textarea, select, [contenteditable="true"]');
      const shortcut = (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);
      if (shortcut || (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey)) {
        if (document.querySelector('dialog[open]')) return;
        event.preventDefault();
        input.focus();
        input.select();
      }
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
