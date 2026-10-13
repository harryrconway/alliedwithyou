/*
  Starts the dashboard: demo entry screen, session, routing and screen updates.

  Entering without a password is for this demo only. The live system must use
  proper sign in, secure account recovery and multi factor authentication.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const icon = (n) => raw(AWY.icon(n));
  const store = AWY.store;
  const access = AWY.access;

  const SESSION_KEY = 'awy.session';
  AWY.views = AWY.views || {};

  const app = {
    db: null,
    current: null,
    states: {},
    rendering: false
  };

  function readSession() {
    try {
      return JSON.parse(window.localStorage.getItem(SESSION_KEY));
    } catch (error) {
      return null;
    }
  }

  function writeSession(value) {
    try {
      if (value) window.localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* the session simply won't be remembered */
    }
  }

  /* Demo entry: choose a person, no password */
  function renderEntry() {
    const staff = store.peek().staff.filter((s) => s.active !== false);
    document.title = 'Practice dashboard | Allied With You';
    document.body.innerHTML = String(html`
      <div class="demo-bar" role="note"><span><strong>Demo environment.</strong> All information is fictional, and nothing is sent, charged or submitted.</span></div>
      <main class="entry" id="main">
        <div class="entry-card">
          <img src="../images/logo.svg" alt="Allied With You" width="144" height="104">
          <h1>Practice dashboard</h1>
          <p>Testing version for Allied With You</p>
          <div class="notice notice-warning" style="margin-top:1.5rem">
            ${icon('alert')}
            <div><strong>Everything here is made up</strong>Clients, notes, invoices and staff are fictional. Nothing is emailed, charged or submitted. Changes are saved in this browser only, and you can reset them at any time.</div>
          </div>
          <form id="entryForm">
            <fieldset class="people-pick">
              <legend class="label" style="margin-bottom:0.5rem;font-weight:680">Who would you like to sign in as?</legend>
              ${staff.map((s, i) => html`<label>
                <input type="radio" name="staff" value="${s.id}" ${raw(i === 0 ? 'checked' : '')}>
                <span class="avatar" aria-hidden="true">${AWY.fmt.initials(s.name)}</span>
                <span><strong>${s.name}, ${s.title.toLowerCase()}</strong><span>${access.ROLES[s.role].summary}</span></span>
              </label>`)}
            </fieldset>
            <button class="btn" type="submit">Enter demo dashboard</button>
          </form>
          <p class="small">The live system will use secure sign in with multi factor authentication. Entering without a password is only for testing.</p>
          <p class="small"><a href="../index.html">Back to the website</a></p>
        </div>
      </main>`);
    AWY.$('#entryForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const id = new FormData(event.target).get('staff');
      writeSession({ staffId: id });
      enter(id);
    });
  }

  function enter(staffId) {
    const db = store.peek();
    const user = db.staff.find((s) => s.id === staffId);
    if (!user) {
      writeSession(null);
      renderEntry();
      return;
    }
    access.setUser(user);
    store.setActor(user.id);
    document.body.innerHTML = '<a class="skip" href="#main">Skip to main content</a>' + String(AWY.shell.render(user, db));
    bindShell();
    if (!window.location.hash) history.replaceState(null, '', '#/');
    route();
  }

  function bindShell() {
    AWY.shell.bindSearch(() => app.db || store.peek());
    document.body.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-action]');
      if (!action) return;
      const name = action.dataset.action;
      if (name === 'menu') AWY.shell.openDrawer(true);
      if (name === 'close-drawer') AWY.shell.openDrawer(false);
      if (name === 'signout') {
        writeSession(null);
        access.setUser(null);
        window.location.hash = '';
        renderEntry();
      }
      if (name === 'reset') {
        const ok = await AWY.ui.confirm({
          title: 'Reset the demo data?',
          message: 'All changes made while testing will be cleared and the original sample records restored. This includes any test enquiries sent from the website.',
          confirmLabel: 'Reset demo data',
          danger: true
        });
        if (!ok) return;
        await store.reset();
        app.states = {};
        AWY.ui.toast('Demo data reset to the original sample records.');
        AWY.router.go([]);
      }
    });
    AWY.$('#roleSwitch').addEventListener('change', (event) => {
      writeSession({ staffId: event.target.value });
      const person = store.peek().staff.find((s) => s.id === event.target.value);
      enter(event.target.value);
      AWY.ui.toast('Now viewing as ' + person.name + ', ' + access.roleLabel(person.role).toLowerCase() + '. Access is simulated in the demo.');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && AWY.$('#sidebar') && AWY.$('#sidebar').classList.contains('is-open')) AWY.shell.openDrawer(false);
    });
  }

  /* Maps an address to a screen */
  function resolve(path) {
    const [a, b, c] = path;
    if (!a) return { view: 'dashboard', section: 'dashboard', params: {} };
    const detail = { clients: 'client', referrals: 'referral', notes: 'note', reports: 'report', agreements: 'agreement', invoices: 'invoice' };
    if (b && detail[a]) return { view: detail[a], section: a, params: { id: b, tab: c || '' } };
    return { view: a, section: a, params: { id: b || '' } };
  }

  function loading() {
    return html`<div class="view-loading" aria-busy="true" aria-label="Loading">
      <span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span>
    </div>`;
  }

  function noAccess(section) {
    const s = access.SECTIONS.find((x) => x.key === section);
    return html`${AWY.c.pageHead({ title: s ? s.label : 'Not available' })}
      <div class="notice notice-warning">${icon('lock')}<div><strong>Not available with this demo role</strong>${access.roleLabel(access.role())} access doesn't include this section. Switch person in the top bar to see it. In the live system, this restriction will be enforced by the server and database, not just hidden in the interface.</div></div>`;
  }

  function notFound() {
    return html`${AWY.c.pageHead({ title: 'Page not found' })}
      <p>That screen doesn't exist. <a href="#/">Go to the dashboard</a>.</p>`;
  }

  async function route() {
    const parsed = AWY.router.parse();
    const target = resolve(parsed.path);
    const main = AWY.$('#main');
    if (!main) return;
    AWY.shell.openDrawer(false);
    AWY.shell.setActive(target.section);
    app.current = Object.assign({ query: parsed.query, key: parsed.key }, target);
    const token = (app.token = {});
    main.innerHTML = String(loading());
    window.scrollTo(0, 0);
    app.db = await store.snapshot();
    if (token !== app.token) return;
    draw(true);
  }

  /* Draws the current screen from the latest snapshot. */
  function draw(fresh) {
    const main = AWY.$('#main');
    const cur = app.current;
    if (!main || !cur) return;
    AWY.shell.updateCounts(app.db);
    const view = AWY.views[cur.view];

    const active = document.activeElement;
    const focusId = active && main.contains(active) ? active.id : '';
    const selection = focusId && active.setSelectionRange && active.type !== 'email' && active.type !== 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = window.scrollY;

    const el = document.createElement('div');
    main.innerHTML = '';
    main.appendChild(el);

    if (!view) {
      el.innerHTML = String(notFound());
      return;
    }
    if (!access.canSee(cur.section)) {
      el.innerHTML = String(noAccess(cur.section));
      document.title = 'Not available | Practice dashboard';
      return;
    }
    const stateKey = cur.view + ':' + (cur.params.id || '');
    app.states[stateKey] = app.states[stateKey] || {};
    const ctx = {
      el: el,
      db: app.db,
      params: cur.params,
      query: cur.query,
      today: AWY.date.today(),
      user: access.user(),
      settings: app.db.settings[0] || {},
      state: app.states[stateKey],
      refresh: () => draw(false),
      reload: () => reload()
    };
    try {
      view.render(ctx);
    } catch (error) {
      console.error(error);
      el.innerHTML = String(html`<div class="notice notice-danger">${icon('alertCircle')}<div><strong>This screen couldn't be shown</strong>The record may have been deleted. <a href="#/">Go to the dashboard</a>.</div></div>`);
    }
    document.title = (view.title ? (typeof view.title === 'function' ? view.title(ctx) : view.title) + ' | ' : '') + 'Practice dashboard';

    if (fresh) {
      main.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, scroll);
      if (focusId) {
        const again = document.getElementById(focusId);
        if (again) {
          again.focus({ preventScroll: true });
          if (selection && again.setSelectionRange) {
            try {
              again.setSelectionRange(selection[0], selection[1]);
            } catch (error) {
              /* some inputs don't support selection */
            }
          }
        }
      }
    }
  }

  /* Fresh data after a change, without the loading skeleton */
  const reload = AWY.debounce(async () => {
    if (!app.current) return;
    app.db = await store.snapshot();
    draw(false);
  }, 40);

  store.on((event) => {
    if (!access.user()) return;
    if (event.type === 'reset') return;
    reload();
  });

  window.addEventListener('hashchange', () => {
    if (access.user()) route();
  });

  AWY.app = app;
  AWY.app.reload = reload;

  const session = readSession();
  if (session && session.staffId) enter(session.staffId);
  else renderEntry();
})();
