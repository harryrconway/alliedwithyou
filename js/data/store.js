/*
  The demo data layer.

  Behaves like a small database kept in the browser. Every screen reads and writes
  through these functions, never directly, so this file can later be replaced by
  Supabase queries without rebuilding the interface.

  Reads and writes are async and include a short delay, so loading and saving states
  look the way they will with a real server. Changes are saved to localStorage and
  can be reset to the original sample data at any time.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const schema = AWY.schema;

  const KEY = 'awy.demo';
  const VERSION = 1;
  const TABLES = Object.keys(schema.tables);

  /* Tables that get a human friendly running number */
  const NUMBERED = {
    clients: { field: 'ref', start: 1001 },
    referrals: { field: 'ref', start: 501 },
    invoices: { field: 'number', start: 1041 },
    reports: { field: 'ref', start: 301 },
    agreements: { field: 'ref', start: 201 },
    incidents: { field: 'ref', start: 101 }
  };

  const PREFIX = {
    staff: 'st', clients: 'cl', contacts: 'ct', referrals: 'rf', consents: 'cs', agreements: 'ag',
    appointments: 'ap', notes: 'nt', assessments: 'as', goals: 'gl', progress: 'pg', reports: 'rp',
    documents: 'dc', fundingPlans: 'fp', supportItems: 'si', supportLogs: 'sl', invoices: 'in',
    invoiceLines: 'il', tasks: 'tk', incidents: 'ic', auditEvents: 'ev', settings: 'set'
  };

  let state = null;
  let currentActor = null;
  const listeners = [];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function storage() {
    try {
      const ls = window.localStorage;
      ls.getItem(KEY);
      return ls;
    } catch (error) {
      return null;
    }
  }

  function ensureTables() {
    TABLES.forEach((t) => {
      if (!Array.isArray(state.tables[t])) state.tables[t] = [];
    });
  }

  function seed() {
    state = {
      version: VERSION,
      seededAt: AWY.date.now(),
      tables: AWY.seed.build(AWY.date.today())
    };
    ensureTables();
    save();
  }

  function load() {
    const ls = storage();
    let saved = null;
    if (ls) {
      try {
        saved = JSON.parse(ls.getItem(KEY));
      } catch (error) {
        saved = null;
      }
    }
    if (saved && saved.version === VERSION && saved.tables) {
      state = saved;
      ensureTables();
    } else {
      seed();
    }
  }

  function save() {
    const ls = storage();
    if (!ls) return;
    try {
      ls.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Demo data could not be saved in this browser.', error);
    }
  }

  function emit(event) {
    listeners.slice().forEach((fn) => {
      try {
        fn(event);
      } catch (error) {
        console.error(error);
      }
    });
  }

  function rows(table) {
    if (!state.tables[table]) throw new StoreError('Unknown table: ' + table);
    return state.tables[table];
  }

  function find(table, id) {
    return rows(table).find((r) => r.id === id) || null;
  }

  function StoreError(message, errors) {
    this.name = 'StoreError';
    this.message = message;
    this.errors = errors || {};
  }
  StoreError.prototype = Object.create(Error.prototype);

  function empty(value) {
    return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  }

  function checkRequired(table, record) {
    const def = schema.tables[table];
    const errors = {};
    (def.fields || []).forEach((f) => {
      if (f.required && empty(record[f.name])) errors[f.name] = f.label + ' is required';
    });
    if (Object.keys(errors).length) {
      throw new StoreError('Some required details are missing.', errors);
    }
  }

  function nextNumber(table) {
    const cfg = NUMBERED[table];
    const max = rows(table).reduce((m, r) => Math.max(m, Number(r[cfg.field]) || 0), cfg.start - 1);
    return max + 1;
  }

  function titleOf(table, record) {
    try {
      return schema.tables[table].title(record, state.tables);
    } catch (error) {
      return record.id;
    }
  }

  function clientIdOf(table, record) {
    if (table === 'clients') return record.id;
    if (record.clientId) return record.clientId;
    if (table === 'invoiceLines') {
      const inv = find('invoices', record.invoiceId);
      return inv ? inv.clientId : null;
    }
    return null;
  }

  function audit(action, table, record, summary, fields, actor) {
    if (table === 'auditEvents') return;
    rows('auditEvents').push({
      id: AWY.uid('ev'),
      at: AWY.date.now(),
      actorId: actor || currentActor || 'system',
      action: action,
      table: table,
      recordId: record.id,
      clientId: action === 'deleted' && table === 'clients' ? null : clientIdOf(table, record),
      summary: summary,
      fields: fields || []
    });
  }

  function describeChange(table, before, after) {
    const def = schema.tables[table];
    const changed = Object.keys(after).filter((k) => k !== 'updatedAt' && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    const statusKey = def.statusKey;
    if (statusKey && changed.includes('status')) {
      const from = schema.status(statusKey, before.status).label;
      const to = schema.status(statusKey, after.status).label;
      return { fields: changed.map((k) => schema.fieldLabel(table, k)), summary: 'Changed ' + def.singular + ' from ' + from + ' to ' + to + ': ' + titleOf(table, after) };
    }
    return { fields: changed.map((k) => schema.fieldLabel(table, k)), summary: 'Updated ' + def.singular + ': ' + titleOf(table, after) };
  }

  /* What else is removed or unlinked when a record is deleted, so nothing points at a missing record */
  function dependents(table, id) {
    const plan = [];
    const t = state.tables;
    if (table === 'clients') {
      ['contacts', 'consents', 'agreements', 'appointments', 'notes', 'assessments', 'goals', 'progress', 'reports', 'documents', 'fundingPlans', 'supportLogs', 'invoices', 'tasks'].forEach((name) => {
        t[name].filter((r) => r.clientId === id).forEach((r) => plan.push({ table: name, id: r.id, op: 'delete' }));
      });
      t.invoices.filter((r) => r.clientId === id).forEach((inv) => {
        t.invoiceLines.filter((l) => l.invoiceId === inv.id).forEach((l) => plan.push({ table: 'invoiceLines', id: l.id, op: 'delete' }));
      });
      t.referrals.filter((r) => r.clientId === id).forEach((r) => plan.push({ table: 'referrals', id: r.id, op: 'patch', patch: { clientId: null } }));
      t.incidents.filter((r) => r.clientId === id).forEach((r) => plan.push({ table: 'incidents', id: r.id, op: 'patch', patch: { clientId: null } }));
    }
    if (table === 'goals') {
      t.progress.filter((r) => r.goalId === id).forEach((r) => plan.push({ table: 'progress', id: r.id, op: 'delete' }));
    }
    if (table === 'invoices') {
      t.invoiceLines.filter((l) => l.invoiceId === id).forEach((l) => plan.push({ table: 'invoiceLines', id: l.id, op: 'delete' }));
      t.supportLogs.filter((l) => l.invoiceId === id).forEach((l) => plan.push({ table: 'supportLogs', id: l.id, op: 'patch', patch: { invoiceId: null, status: 'verified' } }));
    }
    if (table === 'appointments') {
      t.notes.filter((n) => n.appointmentId === id).forEach((n) => plan.push({ table: 'notes', id: n.id, op: 'patch', patch: { appointmentId: null } }));
      t.supportLogs.filter((l) => l.appointmentId === id && l.status !== 'invoiced').forEach((l) => plan.push({ table: 'supportLogs', id: l.id, op: 'delete' }));
      t.supportLogs.filter((l) => l.appointmentId === id && l.status === 'invoiced').forEach((l) => plan.push({ table: 'supportLogs', id: l.id, op: 'patch', patch: { appointmentId: null } }));
    }
    if (table === 'assessments') {
      t.reports.filter((r) => r.assessmentId === id).forEach((r) => plan.push({ table: 'reports', id: r.id, op: 'patch', patch: { assessmentId: null } }));
    }
    if (table === 'supportLogs') {
      t.invoiceLines.filter((l) => l.supportLogId === id).forEach((l) => plan.push({ table: 'invoiceLines', id: l.id, op: 'patch', patch: { supportLogId: null } }));
    }
    return plan;
  }

  const store = {
    latency: { read: 90, write: 220 },
    StoreError: StoreError,

    setActor(id) {
      currentActor = id;
    },

    actor() {
      return currentActor;
    },

    on(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    /* A full copy of every table. Rules and screens work from this. */
    async snapshot() {
      await wait(store.latency.read);
      return clone(state.tables);
    },

    /* Synchronous view of the data, used by automations straight after a change */
    peek() {
      return state.tables;
    },

    seededAt() {
      return state.seededAt;
    },

    async list(table, options) {
      const opts = options || {};
      await wait(store.latency.read);
      let out = rows(table).slice();
      if (opts.where) {
        if (typeof opts.where === 'function') out = out.filter(opts.where);
        else out = out.filter((r) => Object.keys(opts.where).every((k) => r[k] === opts.where[k]));
      }
      if (opts.search) {
        const q = opts.search.toLowerCase();
        out = out.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
      }
      if (opts.sort) {
        const desc = opts.sort.startsWith('-');
        const key = desc ? opts.sort.slice(1) : opts.sort;
        out.sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || ''), 'en', { numeric: true }) * (desc ? -1 : 1));
      }
      if (opts.limit) out = out.slice(0, opts.limit);
      return clone(out);
    },

    async get(table, id) {
      await wait(store.latency.read);
      const r = find(table, id);
      return r ? clone(r) : null;
    },

    async create(table, data, options) {
      const opts = options || {};
      await wait(opts.instant ? 0 : store.latency.write);
      const now = AWY.date.now();
      const record = Object.assign({}, data, {
        id: data.id || AWY.uid(PREFIX[table] || 'id'),
        createdAt: now,
        updatedAt: now,
        createdBy: data.createdBy || opts.actor || currentActor || 'system'
      });
      if (NUMBERED[table] && empty(record[NUMBERED[table].field])) record[NUMBERED[table].field] = nextNumber(table);
      if (!opts.skipValidation) checkRequired(table, record);
      rows(table).push(record);
      if (opts.audit !== false) {
        audit('created', table, record, opts.summary || 'Added ' + schema.tables[table].singular + ': ' + titleOf(table, record), [], opts.actor);
      }
      save();
      emit({ type: 'create', table: table, record: clone(record), actor: opts.actor || currentActor });
      return clone(record);
    },

    async update(table, id, patch, options) {
      const opts = options || {};
      await wait(opts.instant ? 0 : store.latency.write);
      const record = find(table, id);
      if (!record) throw new StoreError('That record could not be found. It may have been deleted.');
      const def = schema.tables[table];
      if (def.lockedWhen && def.lockedWhen(record)) {
        const allowed = def.editableWhenLocked || [];
        const blocked = Object.keys(patch).filter((k) => !allowed.includes(k) && JSON.stringify(patch[k]) !== JSON.stringify(record[k]));
        if (blocked.length) {
          throw new StoreError('This ' + def.singular + ' has been finalised, so it can no longer be changed. Add a correction instead.');
        }
      }
      const before = clone(record);
      Object.assign(record, patch, { updatedAt: AWY.date.now() });
      if (!opts.skipValidation) {
        try {
          checkRequired(table, record);
        } catch (error) {
          Object.keys(record).forEach((k) => delete record[k]);
          Object.assign(record, before);
          throw error;
        }
      }
      const change = describeChange(table, before, record);
      if (opts.audit !== false && change.fields.length) {
        audit(opts.action || 'updated', table, record, opts.summary || change.summary, change.fields, opts.actor);
      }
      save();
      emit({ type: 'update', table: table, record: clone(record), previous: before, actor: opts.actor || currentActor });
      return clone(record);
    },

    /* Counts what a delete would affect, for the confirmation message */
    impact(table, id) {
      const counts = {};
      dependents(table, id).forEach((d) => {
        if (d.op !== 'delete') return;
        counts[d.table] = (counts[d.table] || 0) + 1;
      });
      return counts;
    },

    async remove(table, id, options) {
      const opts = options || {};
      await wait(store.latency.write);
      const record = find(table, id);
      if (!record) throw new StoreError('That record could not be found. It may already have been deleted.');
      const title = titleOf(table, record);
      const plan = dependents(table, id);
      plan.forEach((d) => {
        const list = rows(d.table);
        const i = list.findIndex((r) => r.id === d.id);
        if (i < 0) return;
        if (d.op === 'delete') list.splice(i, 1);
        else Object.assign(list[i], d.patch, { updatedAt: AWY.date.now() });
      });
      const list = rows(table);
      list.splice(list.indexOf(record), 1);
      if (table === 'clients') {
        state.tables.auditEvents = state.tables.auditEvents.filter((e) => e.clientId !== id);
      }
      audit('deleted', table, record, opts.summary || 'Deleted ' + schema.tables[table].singular + ': ' + title, [], opts.actor);
      save();
      emit({ type: 'remove', table: table, record: clone(record), actor: opts.actor || currentActor });
      return { removed: plan.filter((d) => d.op === 'delete').length + 1 };
    },

    /* Finalised notes keep their original text. Corrections are added alongside it. */
    async amendNote(id, reason, text) {
      const note = find('notes', id);
      if (!note) throw new StoreError('That note could not be found.');
      if (note.status !== 'final') throw new StoreError('Draft notes can be edited directly.');
      const amendments = (note.amendments || []).concat([{
        id: AWY.uid('am'),
        at: AWY.date.now(),
        by: currentActor,
        reason: reason,
        text: text
      }]);
      return store.update('notes', id, { amendments: amendments }, { action: 'amended', summary: 'Added a correction to ' + titleOf('notes', note) });
    },

    settings() {
      return clone(rows('settings')[0] || {});
    },

    async reset() {
      await wait(400);
      seed();
      emit({ type: 'reset' });
    }
  };

  load();

  /* Keeps tabs in step, so a website enquiry shows up in an open dashboard */
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      const next = JSON.parse(event.newValue);
      if (next && next.version === VERSION) {
        state = next;
        ensureTables();
        emit({ type: 'external' });
      }
    } catch (error) {
      /* ignore malformed data from another tab */
    }
  });

  AWY.store = store;
})();
