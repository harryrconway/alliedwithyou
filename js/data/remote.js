/*
  The staff dashboard's data layer, backed by Supabase.

  Screens read and write through AWY.store using the dashboard's own names (staff,
  tasks, calendar, supportItems, settings, feedback, errorEvents). This file maps them
  to the database's tables and columns in both directions. What each person can see
  or change is decided by the database's Row Level Security, never here. Sections
  that aren't switched on have no tables yet, so they always come back empty.

  AWY.auth covers signing in, creating an account and setting a password.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const cfg = AWY.config;
  const D = AWY.date;

  /* Links from sign in emails arrive with details in the address. Note them before the client reads and clears them. */
  const callback = (function () {
    const read = (text) => new URLSearchParams(String(text || '').replace(/^[#?]/, ''));
    const hash = read(window.location.hash);
    const query = read(window.location.search);
    const has = (p) => p.has('access_token') || p.has('error_description') || p.has('error');
    const p = has(hash) ? hash : has(query) ? query : null;
    if (!p) return null;
    return { type: p.get('type') || '', error: p.get('error_description') || p.get('error') || '', code: p.get('error_code') || '' };
  })();

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'awy.auth' }
  });

  function StoreError(message, extra) {
    this.name = 'StoreError';
    this.message = message;
    Object.assign(this, extra || {});
  }
  StoreError.prototype = Object.create(Error.prototype);

  /*
    How each dashboard table maps to the database.
    columns: what the dashboard may write. Anything else in a record is ignored on save.
    nullable: columns where an empty value is stored as null.
    rename: dashboard names that differ from the column name in more than case.
  */
  const TABLES = {
    staff: {
      table: 'profiles', order: 'full_name',
      rename: { name: 'full_name' },
      columns: ['full_name', 'role', 'status', 'title', 'phone', 'registration'],
      nullable: []
    },
    tasks: {
      table: 'tasks', order: 'due_date',
      columns: ['title', 'description', 'due_date', 'priority', 'status', 'assigned_to', 'completed_at', 'completed_by', 'request_id'],
      nullable: ['completed_at', 'completed_by', 'request_id', 'client_id']
    },
    calendar: {
      table: 'calendar_blocks', order: 'starts_at',
      rename: { duration: 'duration_mins' },
      columns: ['staff_id', 'starts_at', 'duration_mins', 'time_zone', 'kind', 'note', 'request_id'],
      nullable: ['request_id']
    },
    supportItems: {
      table: 'price_items', order: 'effective_from',
      columns: ['key', 'name', 'funding', 'code', 'unit', 'rate', 'effective_from', 'effective_to', 'notes'],
      nullable: ['effective_to']
    },
    feedback: {
      table: 'feedback', order: 'created_at', desc: true, limit: 300,
      columns: ['kind', 'title', 'description', 'area', 'expected', 'actual', 'error_ref', 'status', 'response', 'priority', 'assigned_to', 'request_id'],
      nullable: ['request_id', 'assigned_to']
    },
    feedbackNotes: {
      table: 'feedback_notes', order: 'created_at', limit: 1000,
      columns: ['feedback_id', 'body', 'request_id'],
      nullable: ['request_id'],
      roles: ['administrator', 'developer']
    },
    feedbackEvents: {
      table: 'feedback_events', order: 'at', desc: true, limit: 2000,
      columns: [],
      nullable: [],
      roles: ['administrator', 'developer']
    },
    auditEvents: {
      table: 'audit_events', order: 'at', desc: true, limit: 500,
      columns: [],
      nullable: [],
      roles: ['administrator']
    },
    monitorChecks: {
      table: 'monitor_checks', order: 'name',
      columns: [],
      nullable: [],
      roles: ['administrator', 'developer']
    },
    templates: {
      table: 'templates', order: 'title',
      columns: ['title', 'category', 'funding', 'description', 'status', 'request_id'],
      nullable: ['request_id']
    },
    templateVersions: {
      table: 'template_versions', order: 'created_at', desc: true, limit: 1000,
      columns: ['template_id', 'file_path', 'file_name', 'mime_type', 'size_bytes', 'note'],
      nullable: []
    },
    staffChecks: {
      table: 'staff_checks', order: 'expires_on',
      columns: ['staff_id', 'kind', 'details', 'reference', 'issued_on', 'expires_on', 'sighted_on', 'notes', 'request_id'],
      nullable: ['issued_on', 'expires_on', 'sighted_on', 'request_id']
    },
    errorEvents: {
      table: 'error_events', order: 'created_at', desc: true, limit: 200,
      columns: [],
      nullable: [],
      roles: ['administrator', 'developer']
    }
  };

  const snake = (key) => key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  const camel = (col) => col.replace(/_([a-z])/g, (m, c) => c.toUpperCase());

  function toRow(name, record) {
    const def = TABLES[name];
    const rename = def.rename || {};
    const row = {};
    const source = name === 'calendar' ? withStart(record) : record;
    Object.keys(source).forEach((key) => {
      const col = rename[key] || snake(key);
      if (!def.columns.includes(col)) return;
      let value = source[key];
      if (typeof value === 'string') value = value.trim();
      if ((value === '' || value === undefined) && def.nullable.includes(col)) value = null;
      if (value === undefined) return;
      row[col] = value;
    });
    return row;
  }

  function fromRow(name, row) {
    const def = TABLES[name];
    const back = {};
    Object.keys(def.rename || {}).forEach((k) => (back[def.rename[k]] = k));
    const out = {};
    Object.keys(row).forEach((col) => {
      const value = row[col];
      out[back[col] || camel(col)] = value === null ? '' : value;
    });
    if (name === 'staff') out.active = out.status === 'active';
    if (name === 'supportItems') out.rate = Number(out.rate);
    if (name === 'calendar') {
      const local = D.zoneParts(out.startsAt, out.timeZone);
      out.date = local.date;
      out.start = local.time;
    }
    return out;
  }

  /* Calendar entries are entered as a local date and time in a chosen zone, and stored as an exact moment */
  function withStart(record) {
    const out = Object.assign({}, record);
    if (record.date && record.start && record.timeZone) out.startsAt = D.fromZone(record.date, record.start, record.timeZone);
    return out;
  }

  /* Turns a database error into one the screens and AWY.errors understand */
  function toError(name, error, status) {
    const code = String(error.code || '');
    const text = (error.message || '') + ' ' + (error.details || '');
    const e = new StoreError(error.message || 'The request failed', { code: code, status: status || 0 });
    const invalid = (friendly, errors) => Object.assign(e, { category: 'validation', friendly: friendly, errors: errors || {} });
    if (code === '23P01') invalid('This overlaps another calendar entry for the same person. Please choose a different time.', { start: 'Overlaps another entry for the same person' });
    else if (code === '23514' && /at least one active administrator/i.test(text)) invalid('There must always be at least one active administrator, so this change can\'t be made.');
    else if (code === '23514' || code === '23502') invalid('Some details aren\'t in the right format. Please check the form and try again.');
    else if (code === '22001') invalid('Some of the text is longer than allowed. Please shorten it and try again.');
    else if (code === '23505' && name === 'supportItems') invalid('A rate for this fee already starts on that date.', { effectiveFrom: 'A rate already starts on this date' });
    else if (code === '23505') invalid('This has already been saved.');
    return e;
  }

  function missing() {
    return new StoreError('No matching row', {
      category: 'validation',
      friendly: "That couldn't be saved. It may have been deleted, or your account may not be allowed to change it. Refresh the page to see the latest."
    });
  }

  let user = null;
  let calendarWindow = null;
  const listeners = [];

  function emit(event) {
    listeners.slice().forEach((fn) => {
      try {
        fn(event);
      } catch (error) {
        AWY.errors.capture(error, { operation: 'after a change' });
      }
    });
  }

  async function run(name, query) {
    const { data, error, status } = await query;
    if (error) throw toError(name, error, status);
    return data;
  }

  function list(name) {
    const def = TABLES[name];
    if (!def || (def.roles && !(user && def.roles.includes(user.role)))) return Promise.resolve([]);
    let q = client.from(def.table).select('*').order(def.order, { ascending: !def.desc });
    if (name === 'calendar') {
      const w = store.calendarWindow();
      q = q.gte('starts_at', D.addDays(w.from, -1)).lt('starts_at', D.addDays(w.to, 2));
    }
    if (name === 'tasks') q = q.or('status.eq.open,completed_at.gte.' + D.addDays(D.today(), -90));
    if (def.limit) q = q.limit(def.limit);
    return run(name, q).then((rows) => rows.map((r) => fromRow(name, r)));
  }

  async function readSettings() {
    const row = await run('settings', client.from('settings').select('*').eq('id', 'practice').maybeSingle());
    if (!row) return { id: 'practice' };
    return Object.assign({}, row.data, { id: row.id, updatedAt: row.updated_at, updatedBy: row.updated_by });
  }

  async function updateSettings(patch) {
    const current = await run('settings', client.from('settings').select('data').eq('id', 'practice').maybeSingle());
    if (!current) throw missing();
    const clean = Object.assign({}, patch);
    ['id', 'updatedAt', 'updatedBy'].forEach((k) => delete clean[k]);
    const next = Object.assign({}, current.data, clean);
    const row = await run('settings', client.from('settings').update({ data: next, updated_by: user ? user.id : null }).eq('id', 'practice').select().maybeSingle());
    if (!row) throw missing();
    return Object.assign({}, row.data, { id: row.id, updatedAt: row.updated_at });
  }

  const store = {
    StoreError: StoreError,

    setUser(profile) {
      user = profile;
    },

    on(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    /* The calendar loads a window of dates around what's on screen. Returns true when it had to move. */
    calendarWindow() {
      if (!calendarWindow) calendarWindow = { from: D.addDays(D.today(), -62), to: D.addDays(D.today(), 124) };
      return calendarWindow;
    },
    needCalendar(from, to) {
      const w = store.calendarWindow();
      if (from >= w.from && to <= w.to) return false;
      calendarWindow = { from: D.addDays(from, -62), to: D.addDays(to, 124) };
      return true;
    },

    /* Everything the open sections need, read in parallel */
    async snapshot() {
      const names = ['staff', 'tasks', 'calendar', 'supportItems', 'feedback', 'feedbackNotes', 'feedbackEvents', 'templates', 'templateVersions', 'staffChecks', 'errorEvents', 'auditEvents', 'monitorChecks'];
      const results = await Promise.all(names.map((n) => list(n)).concat([readSettings()]));
      const db = {};
      names.forEach((n, i) => (db[n] = results[i]));
      db.settings = [results[names.length]];
      return db;
    },

    list: list,

    async create(name, data, options) {
      const opts = options || {};
      const def = TABLES[name];
      const row = toRow(name, data);
      if (opts.requestId && def.columns.includes('request_id')) row.request_id = opts.requestId;
      const { data: saved, error, status } = await client.from(def.table).insert(row).select().maybeSingle();
      if (error) {
        /* A retry of a save that already went through: return what the first attempt saved */
        if (error.code === '23505' && row.request_id) {
          const again = await client.from(def.table).select('*').eq('request_id', row.request_id).maybeSingle();
          if (!again.error && again.data) {
            emit({ type: 'create', table: name });
            return fromRow(name, again.data);
          }
        }
        throw toError(name, error, status);
      }
      if (!saved) throw missing();
      emit({ type: 'create', table: name });
      return fromRow(name, saved);
    },

    async update(name, id, patch) {
      if (name === 'settings') {
        const out = await updateSettings(patch);
        emit({ type: 'update', table: name });
        return out;
      }
      const def = TABLES[name];
      const row = toRow(name, patch);
      const saved = await run(name, client.from(def.table).update(row).eq('id', id).select().maybeSingle());
      if (!saved) throw missing();
      emit({ type: 'update', table: name });
      return fromRow(name, saved);
    },

    async remove(name, id) {
      const def = TABLES[name];
      const rows = await run(name, client.from(def.table).delete().eq('id', id).select('id'));
      if (!rows.length) throw missing();
      emit({ type: 'remove', table: name });
      return { removed: rows.length };
    }
  };

  /* Files in private storage. Downloads use signed links that stop working after a few minutes. */

  const FILE_TYPES = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    odt: 'application/vnd.oasis.opendocument.text',
    txt: 'text/plain'
  };
  const MAX_FILE = 25 * 1024 * 1024;

  function storageError(error) {
    const status = Number(error.statusCode || error.status || 0);
    const e = new StoreError(error.message || 'The file could not be saved', { code: String(error.error || ''), status: status });
    const invalid = (friendly) => Object.assign(e, { category: 'validation', friendly: friendly, errors: { file: friendly } });
    if (/failed to fetch|load failed|networkerror/i.test(error.message || '')) return Object.assign(e, { message: 'Failed to fetch' });
    if (status === 413 || /too large|exceeded the maximum/i.test(error.message || '')) return invalid('That file is larger than 25 MB. Please choose a smaller one.');
    if (status === 415 || /mime type/i.test(error.message || '')) return invalid('That type of file can\'t be uploaded. Please use PDF, Word, Excel or plain text.');
    if (status === 403 || /row-level security|unauthori[sz]ed/i.test(error.message || '')) return Object.assign(e, { category: 'permission' });
    return e;
  }

  const files = {
    types: FILE_TYPES,
    accept: Object.keys(FILE_TYPES).map((ext) => '.' + ext).join(','),

    /* Checks a chosen file before anything is sent. Returns a message, or '' when it's fine. */
    check(file) {
      if (!file) return 'Please choose a file';
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!FILE_TYPES[ext]) return 'Please choose a PDF, Word, Excel or plain text file';
      if (file.size > MAX_FILE) return 'That file is larger than 25 MB';
      if (!file.size) return 'That file is empty';
      return '';
    },

    async upload(bucket, path, file) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const { error } = await client.storage.from(bucket).upload(path, file, { contentType: FILE_TYPES[ext] || file.type, upsert: false });
      if (error) throw storageError(error);
    },

    /* Clears up a file that never became part of a record, for example after a failed save */
    async discard(bucket, path) {
      try {
        await client.storage.from(bucket).remove([path]);
      } catch (error) {
        /* nothing else to do */
      }
    },

    async link(bucket, path, downloadName) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 120, { download: downloadName });
      if (error) throw storageError(error);
      return data.signedUrl;
    }
  };

  /* Sign in */

  function redirectUrl() {
    return window.location.origin + window.location.pathname;
  }

  function authError(error) {
    const code = String(error.code || '');
    const status = Number(error.status || 0);
    const e = new StoreError(error.message || 'Sign in failed', { code: code, status: status });
    const invalid = (friendly) => Object.assign(e, { category: 'validation', friendly: friendly });
    if (error.name === 'AuthRetryableFetchError' || /failed to fetch|load failed|networkerror/i.test(error.message || '')) {
      return Object.assign(e, { category: 'network', message: 'Failed to fetch' });
    }
    if (code === 'invalid_credentials') return invalid("That email or username and password don't match. Please check them and try again, or reset your password.");
    if (code === 'email_not_confirmed') return invalid("This email address hasn't been confirmed yet. Please use the link in the email we sent when the account was created.");
    if (status === 429 || /rate_limit/.test(code)) return invalid('There have been too many attempts in a short time. Please wait a few minutes and try again.');
    if (code === 'weak_password') return invalid('Please choose a stronger password, at least 12 characters long and not one you use anywhere else.');
    if (code === 'same_password') return invalid('Your new password needs to be different from the current one.');
    if (code === 'reauthentication_needed') return invalid('For security, please sign out and sign back in, then change your password.');
    if (code === 'signup_disabled') return invalid('New accounts are switched off at the moment. Please contact the practice.');
    if (code === 'mfa_verification_failed' || code === 'mfa_challenge_expired') return invalid("That code didn't work. Codes change every 30 seconds, so use the newest one and try again.");
    if (code === 'insufficient_aal') return invalid('Please enter a code from your authenticator app first.');
    return e;
  }

  const auth = {
    callback: callback,

    /* "jake" becomes jake@alliedwithyou.com.au */
    toEmail(identifier) {
      const v = String(identifier || '').trim().toLowerCase();
      return v.includes('@') ? v : v + '@' + cfg.emailDomain;
    },

    isReserved(email) {
      return cfg.reservedEmails.includes(String(email || '').trim().toLowerCase());
    },

    async session() {
      const { data } = await client.auth.getSession();
      return data.session;
    },

    async signIn(identifier, password) {
      const { data, error } = await client.auth.signInWithPassword({ email: auth.toEmail(identifier), password: password });
      if (error) throw authError(error);
      return data.session;
    },

    async signUp(name, email, password) {
      const { error } = await client.auth.signUp({
        email: auth.toEmail(email),
        password: password,
        options: { data: { full_name: name }, emailRedirectTo: redirectUrl() }
      });
      if (error) throw authError(error);
    },

    async sendReset(identifier) {
      const { error } = await client.auth.resetPasswordForEmail(auth.toEmail(identifier), { redirectTo: redirectUrl() });
      if (error) throw authError(error);
    },

    async setPassword(password) {
      const { error } = await client.auth.updateUser({ password: password });
      if (error) throw authError(error);
    },

    async signOut() {
      try {
        await client.auth.signOut({ scope: 'local' });
      } catch (error) {
        /* the local session is cleared either way */
      }
    },

    async profile(userId) {
      const row = await run('staff', client.from('profiles').select('*').eq('id', userId).maybeSingle());
      return row ? fromRow('staff', row) : null;
    },

    /* Two step sign in with an authenticator app */
    async twoStep() {
      const [aal, factors, required] = await Promise.all([
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
        client.auth.mfa.listFactors(),
        client.rpc('mfa_required')
      ]);
      if (aal.error) throw authError(aal.error);
      if (factors.error) throw authError(factors.error);
      if (required.error) throw toError('staff', required.error, required.status);
      const verified = (factors.data.totp || []).filter((f) => f.status === 'verified');
      return { level: aal.data.currentLevel, factor: verified[0] || null, required: !!required.data };
    },

    /* Starts setting up an app. Any half finished set up from before is cleared first. */
    async startTwoStep() {
      const list = await client.auth.mfa.listFactors();
      if (list.error) throw authError(list.error);
      for (const f of list.data.all || []) {
        if (f.status !== 'verified') await client.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
      if (error) throw authError(error);
      return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
    },

    async verifyTwoStep(factorId, code) {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factorId, code: String(code).replace(/\s/g, '') });
      if (error) throw authError(error);
    },

    async stopTwoStep(factorId) {
      const { error } = await client.auth.mfa.unenroll({ factorId: factorId });
      if (error) throw authError(error);
      await client.auth.refreshSession();
    },

    async saveName(userId, name) {
      await run('staff', client.from('profiles').update({ full_name: name }).eq('id', userId));
    },

    onChange(fn) {
      return client.auth.onAuthStateChange((event, session) => fn(event, session));
    }
  };

  AWY.client = client;
  AWY.store = store;
  AWY.auth = auth;
  AWY.files = files;
})();
