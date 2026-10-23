/*
  Reusable pieces for dashboard screens: badges, tables, filters, forms built from
  the schema and record dialogs.
  Everything returns safe HTML from the AWY.html template tag.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const schema = AWY.schema;
  const fmt = AWY.fmt;
  const rules = AWY.rules;

  const icon = (name, cls) => raw(AWY.icon(name, cls));
  let formCount = 0;

  const C = {
    icon: icon,

    badge(statusKey, value, label) {
      const s = schema.status(statusKey, value);
      return html`<span class="badge tone-${s.tone}">${icon(s.icon)}${label || s.label}</span>`;
    },

    pageHead(opts) {
      return html`<div class="page-head">
        <div>
          ${opts.back ? html`<a class="back-link" href="${opts.back.href}">${icon('arrowLeft')}${opts.back.label}</a>` : ''}
          <h1>${opts.title}</h1>
          ${opts.subtitle ? html`<p>${opts.subtitle}</p>` : ''}
        </div>
        ${opts.actions ? html`<div class="btn-row">${opts.actions}</div>` : ''}
      </div>`;
    },

    empty(opts) {
      return html`<div class="empty">
        ${icon(opts.icon || 'inbox')}
        <strong>${opts.title}</strong>
        ${opts.text ? html`<span>${opts.text}</span>` : ''}
        ${opts.action || ''}
      </div>`;
    },

    person(db, staffId, withAvatar) {
      const name = rules.staffName(db, staffId);
      if (withAvatar === false) return name;
      return html`<span class="person"><span class="avatar" aria-hidden="true">${fmt.initials(name)}</span>${name}</span>`;
    },

    kv(pairs) {
      const items = pairs.filter((p) => p && p[1] !== '' && p[1] !== null && p[1] !== undefined && p[1] !== false);
      if (!items.length) return html`<p class="muted">Nothing recorded yet.</p>`;
      return html`<dl class="kv">${items.map((p) => html`<dt>${p[0]}</dt><dd>${p[1]}</dd>`)}</dl>`;
    },

    tabs(items, active, label) {
      return html`<nav class="tabs" aria-label="${label || 'Sections'}">${items.map(
        (t) => html`<a class="tab" href="${t.href}" ${raw(t.key === active ? 'aria-current="page"' : '')}>${t.label}${t.count !== undefined ? html`<span class="count">${t.count}</span>` : ''}</a>`
      )}</nav>`;
    },

    search(value, placeholder, name) {
      return html`<div class="search">
        ${icon('search')}
        <label class="sr-only" for="filter_${name || 'q'}">${placeholder}</label>
        <input class="input" type="search" id="filter_${name || 'q'}" data-filter="${name || 'q'}" value="${value || ''}" placeholder="${placeholder}" autocomplete="off">
      </div>`;
    },

    select(name, label, options, value, allLabel) {
      return html`<div class="field">
        <label for="filter_${name}">${label}</label>
        <select class="select" id="filter_${name}" data-filter="${name}">
          ${allLabel !== false ? html`<option value="">${allLabel || 'All'}</option>` : ''}
          ${options.map((o) => html`<option value="${o.value}" ${raw(String(o.value) === String(value) ? 'selected' : '')}>${o.label}</option>`)}
        </select>
      </div>`;
    },

    seg(name, options, value) {
      return html`<div class="seg" role="group" aria-label="Filter">
        ${options.map((o) => html`<button type="button" data-seg="${name}" data-value="${o.value}" aria-pressed="${String(o.value) === String(value)}">${o.label}${o.count !== undefined ? html` <span class="n">${o.count}</span>` : ''}</button>`)}
      </div>`;
    },

    /*
      Wires up search boxes, selects and segmented buttons in a view so they
      update ctx.state and redraw the screen.
    */
    bindFilters(ctx) {
      const el = ctx.el;
      el.addEventListener('input', AWY.debounce((event) => {
        const f = event.target.dataset && event.target.dataset.filter;
        if (!f || event.target.tagName !== 'INPUT') return;
        ctx.state[f] = event.target.value;
        ctx.refresh();
      }, 220));
      el.addEventListener('change', (event) => {
        const f = event.target.dataset && event.target.dataset.filter;
        if (!f || event.target.tagName !== 'SELECT') return;
        ctx.state[f] = event.target.value;
        ctx.refresh();
      });
      AWY.on(el, 'click', '[data-seg]', (event, btn) => {
        ctx.state[btn.dataset.seg] = btn.dataset.value;
        ctx.refresh();
      });
      AWY.on(el, 'click', '[data-sort]', (event, btn) => {
        const key = btn.dataset.sort;
        const cur = ctx.state.sort || '';
        ctx.state.sort = cur === key ? '-' + key : key;
        ctx.refresh();
      });
    },

    matches(row, query, fields) {
      if (!query) return true;
      const q = query.toLowerCase().trim();
      return fields.some((f) => String(typeof f === 'function' ? f(row) : row[f] || '').toLowerCase().includes(q));
    },

    sortRows(rows, columns, sort) {
      if (!sort) return rows;
      const desc = sort.startsWith('-');
      const key = desc ? sort.slice(1) : sort;
      const col = columns.find((c) => c.key === key);
      if (!col || !col.sortValue) return rows;
      return rows.slice().sort((a, b) => {
        const x = col.sortValue(a);
        const y = col.sortValue(b);
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true });
        return desc ? -r : r;
      });
    },

    /*
      columns: [{ key, label, render(row), sortValue(row), num, main }]
      rowHref(row): makes the whole row open a record
    */
    table(opts) {
      const sort = opts.sort || '';
      const rows = C.sortRows(opts.rows, opts.columns, sort);
      if (!rows.length) return opts.empty || C.empty({ title: 'Nothing to show', text: 'Try changing the filters.' });
      const head = opts.columns.map((c) => {
        const dir = sort === c.key ? 'ascending' : sort === '-' + c.key ? 'descending' : 'none';
        const label = c.sortValue
          ? html`<button type="button" class="sort-btn" data-sort="${c.key}">${c.label}${icon(dir === 'none' ? 'sort' : dir === 'ascending' ? 'chevronUp' : 'chevronDown')}</button>`
          : c.label;
        return html`<th scope="col" class="${c.num ? 'num' : ''}" ${raw(c.sortValue ? 'aria-sort="' + dir + '"' : '')}>${label}</th>`;
      });
      const body = rows.map((row) => {
        const href = opts.rowHref ? opts.rowHref(row) : '';
        const cells = opts.columns.map((c, i) => {
          const content = c.render ? c.render(row) : row[c.key];
          const inner = i === 0 && href ? html`<a href="${href}" class="primary">${content}</a>` : content;
          return html`<td class="${[c.num ? 'num' : '', c.main || i === 0 ? 'cell-main' : ''].join(' ')}" data-label="${i === 0 ? '' : c.label}">${inner}</td>`;
        });
        return html`<tr class="${href ? 'is-clickable' : ''}" ${raw(href ? 'data-href="' + AWY.esc(href) + '"' : '')}>${cells}</tr>`;
      });
      return html`<div class="table-wrap">
        <table class="table table-stack">
          ${opts.caption ? html`<caption class="sr-only">${opts.caption}</caption>` : ''}
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    },

    /*
      Opens the record a link points to, such as a search result. The address is tidied
      first, so it opens once. Anything older than the dashboard has loaded is read from the
      database, and Row Level Security decides whether this person can see it.
      opts: { param, path, list, table, open(record) }
    */
    openLinked(ctx, opts) {
      const id = ctx.query[opts.param || 'open'];
      if (!id) return;
      AWY.router.replace(opts.path);
      const found = (opts.list || []).find((x) => x.id === id);
      if (found) return opts.open(found);
      AWY.store.one(opts.table, id).then((record) => {
        if (record) opts.open(record);
        else AWY.ui.toast("That couldn't be opened. It may have been deleted, or your account can't see it.", { tone: 'error' });
      }, (error) => {
        const r = AWY.errors.capture(error, { area: opts.path[0], operation: 'open from a link' });
        AWY.ui.toast(r.message, { tone: 'error' });
      });
    },

    /* Lets a click anywhere on a row follow its link, without breaking buttons inside it */
    bindRows(el) {
      AWY.on(el, 'click', 'tr[data-href]', (event, row) => {
        if (event.target.closest('a, button, input, select, label')) return;
        window.location.hash = row.dataset.href.slice(1);
      });
    },

    /* Form fields generated from schema definitions */
    field(def, value, db, prefix) {
      const id = prefix + def.name;
      const req = def.required ? raw('required') : '';
      const hintId = def.hint ? id + 'Hint' : '';
      const described = hintId ? raw('aria-describedby="' + hintId + '"') : '';
      const hint = def.hint ? html`<p class="hint" id="${hintId}">${def.hint}</p>` : '';
      const label = html`<label for="${id}">${def.label}${def.required ? '' : html` <span class="optional">(optional)</span>`}</label>`;
      const span = def.span === 'all' ? ' span-all' : '';
      const v = value === undefined || value === null ? '' : value;

      if (def.type === 'checkbox') {
        return html`<div class="field${span}"><label class="choice"><input type="checkbox" id="${id}" name="${def.name}" value="yes" ${raw(v ? 'checked' : '')}> ${def.label}</label>${hint}</div>`;
      }
      if (def.type === 'checks') {
        const list = Array.isArray(v) ? v : [];
        return html`<fieldset class="field${span}">
          <legend>${def.label}</legend>
          <div class="choices inline">
            ${def.options.map((o) => html`<label class="choice"><input type="checkbox" name="${def.name}" value="${o.value}" ${raw(list.includes(o.value) ? 'checked' : '')}> ${o.label}</label>`)}
          </div>${hint}
        </fieldset>`;
      }
      if (def.type === 'textarea') {
        return html`<div class="field${span}">${label}<textarea class="textarea" id="${id}" name="${def.name}" ${req} ${described} rows="${def.rows || 4}">${v}</textarea>${hint}</div>`;
      }
      if (def.type === 'select' || def.type === 'staff') {
        let options = def.options || [];
        if (def.type === 'staff') options = C.staffOptions(db, v);
        return html`<div class="field${span}">${label}
          <select class="select" id="${id}" name="${def.name}" ${req} ${described}>
            <option value="">Choose one</option>
            ${options.map((o) => html`<option value="${o.value}" ${raw(String(o.value) === String(v) ? 'selected' : '')} ${raw(o.disabled ? 'disabled' : '')}>${o.label}</option>`)}
          </select>${hint}</div>`;
      }
      const type = def.type === 'money' ? 'number' : def.type || 'text';
      const extra = [
        def.rule ? 'data-rule="' + def.rule + '"' : '',
        def.type === 'money' ? 'step="0.01" min="0" inputmode="decimal"' : '',
        def.type === 'number' && def.min !== undefined ? 'min="' + def.min + '"' : '',
        def.type === 'number' && def.max !== undefined ? 'max="' + def.max + '"' : '',
        def.type === 'number' && def.step ? 'step="' + def.step + '"' : '',
        def.autocomplete ? 'autocomplete="' + def.autocomplete + '"' : '',
        def.minlength ? 'minlength="' + def.minlength + '"' : '',
        def.maxlength ? 'maxlength="' + def.maxlength + '"' : '',
        def.accept ? 'accept="' + def.accept + '"' : ''
      ].join(' ');
      return html`<div class="field${span}">${label}<input class="input" type="${type}" id="${id}" name="${def.name}" value="${v}" ${req} ${described} ${raw(extra)}>${hint}</div>`;
    },

    fields(defs, values, db, prefix) {
      return html`<div class="form-grid">${defs.map((d) => C.field(d, (values || {})[d.name], db, prefix))}</div>`;
    },

    /* Active staff, plus whoever is already chosen so an old record still shows them */
    staffOptions(db, current) {
      return db.staff
        .filter((s) => s.status === 'active' || s.id === current)
        .slice()
        .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
        .map((s) => ({ value: s.id, label: (s.name || s.email) + (s.title ? ', ' + s.title.toLowerCase() : '') + (s.status !== 'active' ? ' (no longer active)' : '') }));
    },

    /* Converts raw form values into the right types for each field */
    coerce(defs, form, values) {
      const out = Object.assign({}, values);
      defs.forEach((d) => {
        if (d.type === 'checks') out[d.name] = AWY.$$('input[name="' + d.name + '"]:checked', form).map((i) => i.value);
        else if (d.type === 'checkbox') out[d.name] = !!(form.elements[d.name] && form.elements[d.name].checked);
        else if (d.type === 'number' || d.type === 'money') out[d.name] = out[d.name] === '' || out[d.name] === undefined ? '' : Number(out[d.name]);
      });
      return out;
    },

    /*
      Opens a dialog with a form built from field definitions.
      onSubmit(values) should return a promise; the dialog closes when it resolves.
    */
    openForm(opts) {
      formCount += 1;
      const prefix = 'f' + formCount + '_';
      const defs = opts.fields;
      const modal = AWY.ui.modal({
        title: opts.title,
        subtitle: opts.subtitle,
        size: opts.size || (defs.length > 6 ? 'wide' : ''),
        form: true,
        body: html`<div class="form">
          <div class="form-summary"></div>
          ${opts.intro || ''}
          ${C.fields(defs, opts.values, opts.db, prefix)}
          ${opts.after || ''}
        </div>`,
        footer: html`${opts.footerStart ? html`<div class="spacer">${opts.footerStart}</div>` : ''}
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="submit" class="btn">${opts.submitLabel || 'Save'}</button>`,
        onOpen: opts.onOpen
      });
      modal.requestId = AWY.uuid();
      modal.form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const custom = (values) => {
          const errs = {};
          defs.forEach((d) => {
            if (d.type === 'checks' && d.required && !AWY.$$('input[name="' + d.name + '"]:checked', modal.form).length) errs[d.name] = 'Please choose at least one';
          });
          return Object.assign(errs, opts.validate ? opts.validate(C.coerce(defs, modal.form, values)) || {} : {});
        };
        const result = AWY.validate.form(modal.form, custom);
        if (!result.valid) return;
        const values = C.coerce(defs, modal.form, result.values);
        const button = modal.form.querySelector('[type="submit"]');
        try {
          await AWY.ui.busy(button, () => opts.onSubmit(values, modal));
          modal.close();
        } catch (error) {
          C.showStoreError(modal.form, error, prefix, { area: opts.area || opts.title, operation: opts.submitLabel || 'Save' });
        }
      });
      return modal;
    },

    /* Shows a failed save inside the form, keeping everything the person typed */
    showStoreError(form, error, prefix, where) {
      const summary = form.querySelector('.form-summary');
      if (error && error.errors && Object.keys(error.errors).length) {
        Object.keys(error.errors).forEach((name) => {
          const el = form.elements[name];
          if (el) AWY.validate.showError(el.tagName ? el : el[0], error.errors[name]);
        });
      }
      const result = AWY.errors.capture(error, Object.assign({ write: true }, where || {}));
      if (summary) {
        summary.innerHTML = String(html`<div class="notice notice-danger" role="alert">${icon('alertCircle')}<div>${result.message}${result.category !== 'validation' && AWY.actions.reportIssue ? html` <button type="button" class="btn btn-quiet btn-sm" data-report-ref="${result.ref}">Report this issue</button>` : ''}</div></div>`);
        const btn = summary.querySelector('[data-report-ref]');
        if (btn) btn.addEventListener('click', () => AWY.actions.reportIssue({ errorRef: btn.dataset.reportRef }));
      }
    },

    /* Saves a record, shows a message and reports errors as a toast */
    async save(promise, message, where) {
      try {
        const result = await promise;
        if (message) AWY.ui.toast(message);
        return result;
      } catch (error) {
        const r = AWY.errors.capture(error, Object.assign({ write: true }, where || {}));
        AWY.ui.toast(r.message, {
          tone: 'error',
          action: r.category !== 'validation' && AWY.actions.reportIssue ? { label: 'Report this issue', onClick: () => AWY.actions.reportIssue({ errorRef: r.ref }) } : null
        });
        return undefined;
      }
    },

    /* Asks first, then deletes and says what happened */
    async confirmDelete(opts) {
      const ok = await AWY.ui.confirm({
        title: 'Delete ' + opts.label + '?',
        message: 'This permanently removes the ' + schema.tables[opts.table].singular + '. It cannot be undone.',
        confirmLabel: 'Delete',
        danger: true
      });
      if (!ok) return false;
      const done = await C.save(AWY.store.remove(opts.table, opts.id), (schema.tables[opts.table].singular.charAt(0).toUpperCase() + schema.tables[opts.table].singular.slice(1)) + ' deleted.', { area: opts.table, operation: 'delete' });
      if (done && opts.after) opts.after();
      return !!done;
    },

    listText(parts) {
      if (parts.length <= 1) return parts.join('');
      return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
    },

    options(key) {
      return schema.options[key];
    },

    label(key, value) {
      return schema.labelOf(key, value);
    },

    money: (n) => fmt.money(n),

    due(date, today, done) {
      if (!date) return '';
      const late = !done && date < today;
      return html`<span class="${late ? 'nowrap' : 'nowrap'}" ${raw(late ? 'style="color:var(--color-danger);font-weight:680"' : '')}>${fmt.date(date)}${late ? html` <span class="sr-only">(overdue)</span>` : ''}</span>`;
    }
  };

  AWY.c = C;
  AWY.views = AWY.views || {};
  AWY.actions = AWY.actions || {};
})();
