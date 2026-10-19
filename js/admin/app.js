/*
  Starts the staff dashboard: sign in, account checks, routing and screen updates.

  Signing in is handled by Supabase Auth. Whether an account is approved, and what it
  may see or change, is checked again by the database on every request, so nothing
  here is the only protection.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const icon = (n) => raw(AWY.icon(n));
  const store = AWY.store;
  const access = AWY.access;
  const auth = AWY.auth;
  const cfg = AWY.config;

  const ACTIVE_KEY = 'awy.lastActive';
  const IDLE_MS = cfg.idleMinutes * 60000;
  AWY.views = AWY.views || {};

  const app = {
    db: null,
    current: null,
    states: {},
    entered: false,
    loadedAt: 0
  };

  /* Signing out after a period without activity, shared across tabs */

  let lastLocal = 0;
  function touch() {
    lastLocal = Date.now();
    try {
      window.localStorage.setItem(ACTIVE_KEY, String(lastLocal));
    } catch (error) {
      /* this tab still keeps its own record */
    }
  }
  function lastActive() {
    let stored = 0;
    try {
      stored = Number(window.localStorage.getItem(ACTIVE_KEY)) || 0;
    } catch (error) {
      stored = 0;
    }
    return Math.max(stored, lastLocal);
  }
  function idleExpired() {
    const t = lastActive();
    return !!t && Date.now() - t > IDLE_MS;
  }
  let touchedAt = 0;
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
    window.addEventListener(type, () => {
      if (!app.entered || Date.now() - touchedAt < 15000) return;
      touchedAt = Date.now();
      touch();
    }, { passive: true });
  });
  setInterval(() => {
    if (app.entered && idleExpired()) signOut('You were signed out after ' + cfg.idleMinutes + ' minutes without activity. Please sign in again.');
  }, 30000);

  /* Screens outside the dashboard: sign in, waiting for approval and similar */

  function screen(content, title) {
    app.entered = false;
    access.setUser(null);
    document.title = (title ? title + ' | ' : '') + 'Practice dashboard | Allied With You';
    document.body.innerHTML = String(html`<main class="entry" id="main" tabindex="-1">
      <div class="entry-card">
        <img src="../images/logo.svg" alt="Allied With You" width="144" height="104">
        ${content}
      </div>
    </main>`);
    const main = AWY.$('#main');
    const first = main.querySelector('[autofocus]');
    if (first) first.focus();
    else main.focus({ preventScroll: true });
  }

  function notice(tone, message) {
    if (!message) return '';
    return html`<div class="notice notice-${tone}" role="${tone === 'danger' ? 'alert' : 'status'}">${icon(tone === 'danger' ? 'alertCircle' : tone === 'success' ? 'checkCircle' : 'info')}<div>${message}</div></div>`;
  }

  /* A message for a failed sign in step. Reasons the person can fix are shown as they are. */
  function authMessage(error, operation) {
    const r = AWY.errors.capture(error, { area: 'sign in', operation: operation });
    if (r.category === 'validation') return r.message;
    if (r.category === 'network' || r.category === 'uncertain') return "We couldn't reach the sign in service. Please check your internet connection and try again.";
    return 'Something went wrong. Please try again in a minute. If it keeps happening, email ' + cfg.practiceEmail + ' and quote reference ' + r.ref + '.';
  }

  function bindForm(form, work) {
    AWY.validate.live(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = AWY.validate.form(form, form.customCheck);
      if (!result.valid) return;
      const summary = form.querySelector('.form-summary');
      summary.innerHTML = '';
      try {
        await AWY.ui.busy(form.querySelector('[type="submit"]'), () => work(result.values));
      } catch (error) {
        summary.innerHTML = String(notice('danger', authMessage(error, form.dataset.operation)));
        summary.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  const passwordHint = 'At least 12 characters. A short sentence you can remember works well.';

  function showAuth(tab, message) {
    const t = tab || 'signin';
    const tabs = html`<div class="seg auth-tabs" role="group" aria-label="Sign in or create an account">
      <button type="button" data-tab="signin" aria-pressed="${t === 'signin'}">Sign in</button>
      <button type="button" data-tab="create" aria-pressed="${t === 'create'}">Create account</button>
    </div>`;
    let body;
    if (t === 'signin') {
      body = html`<form class="form auth-form" id="signinForm" data-operation="sign in" novalidate>
        <div class="form-summary"></div>
        <div class="field">
          <label for="identifier">Email or username</label>
          <input class="input" id="identifier" name="identifier" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus aria-describedby="identifierHint">
          <p class="hint" id="identifierHint">With a practice email you can use just the first part, for example jake.</p>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
        </div>
        <button class="btn" type="submit">Sign in</button>
        <button class="btn btn-quiet" type="button" data-tab="forgot">Forgotten your password?</button>
      </form>`;
    } else if (t === 'create') {
      body = html`<form class="form auth-form" id="createForm" data-operation="create account" novalidate>
        <div class="form-summary"></div>
        <div class="field">
          <label for="fullName">Full name</label>
          <input class="input" id="fullName" name="fullName" type="text" autocomplete="name" required autofocus>
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input class="input" id="email" name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required>
        </div>
        <div class="field">
          <label for="newPassword">Password</label>
          <input class="input" id="newPassword" name="password" type="password" autocomplete="new-password" minlength="12" required aria-describedby="newPasswordHint">
          <p class="hint" id="newPasswordHint">${passwordHint}</p>
        </div>
        <div class="field">
          <label for="confirmPassword">Password again</label>
          <input class="input" id="confirmPassword" name="confirm" type="password" autocomplete="new-password" required>
        </div>
        <button class="btn" type="submit">Create account</button>
        <p class="small">New accounts are checked by the practice before they can be used. You'll get an email to confirm your address first.</p>
      </form>`;
    } else {
      body = html`<form class="form auth-form" id="forgotForm" data-operation="reset password" novalidate>
        <div class="form-summary"></div>
        <p>Enter your email or username and we'll send you a link to choose a new password.</p>
        <div class="field">
          <label for="resetIdentifier">Email or username</label>
          <input class="input" id="resetIdentifier" name="identifier" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
        </div>
        <button class="btn" type="submit">Send reset link</button>
        <button class="btn btn-quiet" type="button" data-tab="signin">Back to sign in</button>
      </form>`;
    }

    screen(html`<h1>${t === 'forgot' ? 'Reset your password' : 'Staff dashboard'}</h1>
      <p>${t === 'create' ? 'Create an account to use the practice dashboard.' : t === 'forgot' ? '' : 'Sign in to the Allied With You practice dashboard.'}</p>
      ${t === 'forgot' ? '' : tabs}
      ${notice('info', message)}
      ${body}
      <p class="small"><a href="../index.html">Back to the website</a></p>`, t === 'create' ? 'Create account' : t === 'forgot' ? 'Reset password' : 'Sign in');

    AWY.$$('[data-tab]').forEach((b) => b.addEventListener('click', () => showAuth(b.dataset.tab)));

    const signin = AWY.$('#signinForm');
    if (signin) {
      bindForm(signin, async (v) => {
        const session = await auth.signIn(v.identifier, AWY.$('#password').value);
        touch();
        await check(session);
      });
    }

    const create = AWY.$('#createForm');
    if (create) {
      create.customCheck = (v) => {
        const errs = {};
        if (auth.isReserved(v.email)) errs.email = 'This address has its own invitation. Use the link in the invitation email, or reset your password from the sign in screen.';
        if (AWY.$('#newPassword').value !== AWY.$('#confirmPassword').value) errs.confirm = "The two passwords don't match";
        return errs;
      };
      bindForm(create, async (v) => {
        await auth.signUp(v.fullName, v.email, AWY.$('#newPassword').value);
        screen(html`<h1>Check your email</h1>
          ${notice('success', html`Open the link we sent to <span class="nowrap">${auth.toEmail(v.email)}</span> to confirm your address.`)}
          <p style="margin-top:1rem">After that, someone at the practice needs to approve your account before you can use the dashboard. If the email hasn't arrived in a few minutes, check your junk folder.</p>
          <p class="small"><a href="./">Back to sign in</a></p>`, 'Check your email');
      });
    }

    const forgot = AWY.$('#forgotForm');
    if (forgot) {
      bindForm(forgot, async (v) => {
        await auth.sendReset(v.identifier);
        showAuth('signin', "If there's an account for that address, we've emailed a link to reset the password. It works for an hour.");
      });
    }
  }

  /* Choosing a password from an invitation or a reset link */
  function showSetPassword(kind, profile) {
    const needName = kind === 'invite' && profile && !profile.name;
    screen(html`<h1>${kind === 'invite' ? 'Welcome to the practice dashboard' : 'Choose a new password'}</h1>
      <p>${kind === 'invite' ? 'Choose a password to finish setting up your account.' : 'Enter a new password for your account.'}</p>
      <form class="form auth-form" id="setPasswordForm" data-operation="set password" novalidate>
        <div class="form-summary"></div>
        ${needName ? html`<div class="field"><label for="setName">Full name</label><input class="input" id="setName" name="fullName" type="text" autocomplete="name" required autofocus></div>` : ''}
        <div class="field">
          <label for="setPassword">New password</label>
          <input class="input" id="setPassword" name="password" type="password" autocomplete="new-password" minlength="12" required ${raw(needName ? '' : 'autofocus')} aria-describedby="setPasswordHint">
          <p class="hint" id="setPasswordHint">${passwordHint}</p>
        </div>
        <div class="field">
          <label for="setConfirm">New password again</label>
          <input class="input" id="setConfirm" name="confirm" type="password" autocomplete="new-password" required>
        </div>
        <button class="btn" type="submit">Save password</button>
      </form>`, 'Choose a password');
    const form = AWY.$('#setPasswordForm');
    form.customCheck = () => (AWY.$('#setPassword').value !== AWY.$('#setConfirm').value ? { confirm: "The two passwords don't match" } : {});
    bindForm(form, async (v) => {
      await auth.setPassword(AWY.$('#setPassword').value);
      if (needName && v.fullName) await auth.saveName(profile.id, v.fullName);
      touch();
      const session = await auth.session();
      await check(session, kind === 'invite' ? "Your password is saved and you're signed in." : 'Your new password is saved.');
    });
  }

  function accountScreen(profile) {
    const signOutButton = html`<button type="button" class="btn btn-secondary" data-signout>${icon('logout')}Sign out</button>`;
    const states = {
      pending: {
        title: 'Waiting for approval',
        text: html`Thanks${profile.name ? ', ' + profile.name.split(' ')[0] : ''}. Your account is set up and your email is confirmed. Someone at the practice now needs to approve it before you can use the dashboard.`,
        extra: html`<button type="button" class="btn" data-recheck>${icon('refresh')}Check again</button>`
      },
      declined: {
        title: 'Account not approved',
        text: html`This account hasn't been approved for the practice dashboard. If you think that's a mistake, email <a href="mailto:${cfg.practiceEmail}">${cfg.practiceEmail}</a>.`
      },
      disabled: {
        title: 'Account switched off',
        text: html`This account has been switched off. If you need access again, email <a href="mailto:${cfg.practiceEmail}">${cfg.practiceEmail}</a>.`
      }
    };
    const s = states[profile.status] || states.disabled;
    screen(html`<h1>${s.title}</h1>
      <p>${profile.email}</p>
      <div class="notice" style="margin-top:1.5rem">${icon(profile.status === 'pending' ? 'clock' : 'lock')}<div>${s.text}</div></div>
      <div class="btn-row entry-actions">${s.extra || ''}${signOutButton}</div>`, s.title);
    AWY.$('[data-signout]').addEventListener('click', () => signOut());
    const again = AWY.$('[data-recheck]');
    if (again) again.addEventListener('click', () => AWY.ui.busy(again, async () => check(await auth.session())));
  }

  function linkProblem(cb) {
    const expired = /expired|invalid/i.test(cb.error + ' ' + cb.code);
    showAuth('signin', expired
      ? 'That link has expired or has already been used. Sign in below, or choose Forgotten your password to get a new link. Invitations can be sent again by an administrator.'
      : "That link didn't work. Please try signing in, or ask an administrator for a new invitation.");
  }

  function failedStart(error, retry) {
    const r = AWY.errors.capture(error, { area: 'sign in', operation: 'start' });
    screen(html`<h1>Staff dashboard</h1>
      ${notice('danger', r.category === 'network' ? "We couldn't connect. Please check your internet connection and try again." : r.message)}
      <div class="btn-row entry-actions"><button type="button" class="btn" data-retry>${icon('refresh')}Try again</button><button type="button" class="btn btn-secondary" data-signout>Sign out</button></div>`, 'Problem connecting');
    AWY.$('[data-retry]').addEventListener('click', retry);
    AWY.$('[data-signout]').addEventListener('click', () => signOut());
  }

  /* Decides where a signed in person goes, based on their account status */
  async function check(session, welcome) {
    if (!session) return showAuth('signin');
    let profile;
    try {
      profile = await auth.profile(session.user.id);
    } catch (error) {
      return failedStart(error, () => check(session, welcome));
    }
    if (!profile) return accountScreen({ email: session.user.email, status: 'pending', name: '' });
    if (profile.status !== 'active') return accountScreen(profile);
    enter(profile, welcome);
  }

  async function signOut(message) {
    app.entered = false;
    app.db = null;
    app.states = {};
    await auth.signOut();
    try {
      window.localStorage.removeItem(ACTIVE_KEY);
    } catch (error) {
      /* nothing to clear */
    }
    lastLocal = 0;
    history.replaceState(null, '', window.location.pathname);
    showAuth('signin', message || "You've signed out.");
  }

  /* The dashboard itself */

  let shellBound = false;

  function enter(profile, welcome) {
    access.setUser(profile);
    store.setUser(profile);
    app.entered = true;
    app.states = {};
    touch();
    document.body.innerHTML = '<a class="skip" href="#main">Skip to main content</a>' + String(AWY.shell.render(profile));
    AWY.shell.bindSearch(() => app.db);
    bindShell();
    if (!window.location.hash || window.location.hash === '#') history.replaceState(null, '', '#/');
    AWY.errors.flush();
    route();
    if (welcome) AWY.ui.toast(welcome);
  }

  function bindShell() {
    if (shellBound) return;
    shellBound = true;
    document.body.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      if (!action || !app.entered) return;
      const name = action.dataset.action;
      if (name === 'menu') AWY.shell.openDrawer(true);
      if (name === 'close-drawer') AWY.shell.openDrawer(false);
      if (name === 'signout') signOut();
      if (name === 'account') AWY.actions.accountForm();
      if (name === 'report') AWY.actions.reportIssue();
      if (name === 'new-task') AWY.actions.taskForm(null);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && AWY.$('#sidebar') && AWY.$('#sidebar').classList.contains('is-open')) AWY.shell.openDrawer(false);
    });
  }

  /* Maps an address to a screen */
  function resolve(path) {
    const [a, b] = path;
    if (!a) return { view: 'dashboard', section: 'dashboard', params: {} };
    return { view: a, section: a, params: { id: b || '' } };
  }

  function loading() {
    return html`<div class="view-loading" aria-busy="true" aria-label="Loading">
      <span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span>
    </div>`;
  }

  function locked(section) {
    const s = access.section(section);
    return html`${AWY.c.pageHead({ title: s.label })}
      <div class="notice">${icon('lock')}<div><strong>Not switched on yet</strong>This part of the dashboard will open once the practice is ready to keep this information here. Until then, nothing can be added to it.</div></div>`;
  }

  function noAccess(section) {
    const s = access.section(section);
    return html`${AWY.c.pageHead({ title: s ? s.label : 'Not available' })}
      <div class="notice notice-warning">${icon('lock')}<div><strong>Not part of your role</strong>${access.roleLabel(access.role())} accounts don't include this section. If you need it, ask an administrator.</div></div>`;
  }

  function notFound() {
    return html`${AWY.c.pageHead({ title: 'Page not found' })}
      <p>That screen doesn't exist. <a href="#/">Go to the dashboard</a>.</p>`;
  }

  function loadFailed(error) {
    const r = AWY.errors.capture(error, { area: app.current ? app.current.section : '', operation: 'load' });
    return html`<div class="notice notice-danger" role="alert">${icon('alertCircle')}<div>${r.message}
      <div class="btn-row" style="margin-top:0.75rem"><button type="button" class="btn btn-secondary btn-sm" data-retry-load>${icon('refresh')}Try again</button></div></div></div>`;
  }

  /* Picks up changes to your own account made by an administrator, such as a new role */
  function syncUser() {
    const me = access.user();
    const fresh = app.db.staff.find((s) => s.id === me.id);
    if (!fresh || fresh.status !== 'active') {
      auth.session().then((session) => check(session));
      return false;
    }
    if (fresh.role !== me.role) {
      enter(fresh);
      return false;
    }
    access.setUser(fresh);
    store.setUser(fresh);
    return true;
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
    window.scrollTo(0, 0);

    /* Locked and unknown sections don't need any data */
    if (access.isLocked(target.section) || !AWY.views[target.view] || !access.canSee(target.section)) {
      draw(true);
      return;
    }
    if (!app.db) main.innerHTML = String(loading());
    try {
      app.db = await store.snapshot();
      app.loadedAt = Date.now();
    } catch (error) {
      if (token !== app.token) return;
      main.innerHTML = String(loadFailed(error));
      main.querySelector('[data-retry-load]').addEventListener('click', route);
      return;
    }
    if (token !== app.token || !app.entered) return;
    if (!syncUser()) return;
    draw(true);
  }

  /* Draws the current screen from the latest snapshot */
  function draw(fresh) {
    const main = AWY.$('#main');
    const cur = app.current;
    if (!main || !cur) return;
    if (app.db) AWY.shell.updateCounts(app.db);
    const view = AWY.views[cur.view];
    const section = access.section(cur.section);

    const active = document.activeElement;
    const focusId = active && main.contains(active) ? active.id : '';
    const selection = focusId && active.setSelectionRange && active.type !== 'email' && active.type !== 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = window.scrollY;

    const el = document.createElement('div');
    main.innerHTML = '';
    main.appendChild(el);

    if (section && access.isLocked(cur.section)) {
      el.innerHTML = String(locked(cur.section));
      document.title = section.label + ' | Practice dashboard';
      main.focus({ preventScroll: true });
      return;
    }
    if (!view) {
      el.innerHTML = String(notFound());
      document.title = 'Page not found | Practice dashboard';
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
      const r = AWY.errors.capture(error, { area: cur.section, operation: 'show screen' });
      el.innerHTML = String(html`<div class="notice notice-danger">${icon('alertCircle')}<div><strong>This screen couldn't be shown</strong>${r.message} <a href="#/">Go to the dashboard</a>.</div></div>`);
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
    if (!app.current || !app.entered) return;
    try {
      app.db = await store.snapshot();
      app.loadedAt = Date.now();
    } catch (error) {
      const r = AWY.errors.capture(error, { area: app.current.section, operation: 'refresh' });
      AWY.ui.toast(r.message, { tone: 'error' });
      return;
    }
    if (!app.entered || !syncUser()) return;
    draw(false);
  }, 40);

  store.on(() => {
    if (app.entered) reload();
  });

  window.addEventListener('hashchange', () => {
    if (app.entered) route();
  });

  /* Coming back to the tab after a while shows the latest changes */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !app.entered) return;
    if (idleExpired()) return signOut('You were signed out after ' + cfg.idleMinutes + ' minutes without activity. Please sign in again.');
    if (Date.now() - app.loadedAt > 60000) reload();
  });

  auth.onChange((event) => {
    /* Run outside the auth callback, as the client asks */
    setTimeout(() => {
      if (event === 'SIGNED_OUT' && app.entered) {
        app.entered = false;
        showAuth('signin', 'Your session has ended. Please sign in again.');
      }
    }, 0);
  });

  app.reload = reload;
  app.updateUser = (profile) => {
    access.setUser(profile);
    store.setUser(profile);
    AWY.shell.updateUser(profile);
  };
  AWY.app = app;

  async function boot() {
    const cb = auth.callback;
    let session;
    try {
      session = await auth.session();
    } catch (error) {
      return failedStart(error, boot);
    }
    if (cb) history.replaceState(null, '', window.location.pathname + '#/');
    if (cb && cb.error) return linkProblem(cb);
    if (!session) return showAuth('signin');
    if (!cb && idleExpired()) {
      return signOut('You were signed out after ' + cfg.idleMinutes + ' minutes without activity. Please sign in again.');
    }
    touch();
    if (cb && (cb.type === 'invite' || cb.type === 'recovery')) {
      let profile = null;
      try {
        profile = await auth.profile(session.user.id);
      } catch (error) {
        profile = null;
      }
      return showSetPassword(cb.type, profile || { id: session.user.id, name: '' });
    }
    return check(session, cb && cb.type === 'signup' ? 'Your email is confirmed.' : '');
  }

  boot();
})();
