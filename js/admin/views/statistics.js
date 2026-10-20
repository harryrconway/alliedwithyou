/*
  Reports and downloads, for administrators.

  Reports cover what the open sections hold: booked time by person and by state or
  territory, tasks, staff checks and tickets. Calendar, task and ticket figures read every
  record for the period straight from the database, not just what the dashboard has loaded.
  Downloads give a spreadsheet of each area, or one zip file with everything.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const rules = AWY.rules;
  const store = AWY.store;
  const X = AWY.exports;
  const icon = (n) => raw(AWY.icon(n));

  const PERIODS = [
    { value: 'month', label: 'This month' },
    { value: 'last', label: 'Last month' },
    { value: 'quarter', label: 'Last 3 months' },
    { value: 'fy', label: 'This financial year' },
    { value: 'year', label: 'Last 12 months' }
  ];

  function period(key, today) {
    const fyStart = (Number(today.slice(5, 7)) >= 7 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1) + '-07-01';
    if (key === 'last') {
      const s = D.addMonths(D.startOfMonth(today), -1);
      return [s, D.endOfMonth(s)];
    }
    if (key === 'quarter') return [D.addMonths(D.startOfMonth(today), -2), today];
    if (key === 'fy') return [fyStart, D.addDays(D.addMonths(fyStart, 12), -1)];
    if (key === 'year') return [D.addMonths(D.startOfMonth(today), -11), today];
    return [D.startOfMonth(today), D.endOfMonth(today)];
  }

  const KINDS = ['booked', 'admin', 'travel', 'leave', 'unavailable'];
  const hours = (mins) => Math.round((mins / 60) * 10) / 10;

  function meter(value, max, text) {
    const width = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100)) : 0;
    return html`<span class="meter"><span class="meter-n">${text}</span><span class="meter-track" aria-hidden="true"><span class="meter-fill" style="width:${width}%"></span></span></span>`;
  }

  /* Reads the records a period needs. Kept until the dashboard next refreshes its data. */
  async function load(ctx, from, to) {
    const zone = ctx.db.viewZone;
    const [blocks, tasks, tickets] = await Promise.all([
      store.all('calendar', { column: 'starts_at', from: D.fromZone(from, '00:00', zone), to: D.fromZone(D.addDays(to, 1), '00:00', zone) }),
      store.all('tasks'),
      store.all('feedback')
    ]);
    store.placeBlocks(blocks, ctx.settings.defaultTimeZone);
    return { blocks: blocks.filter((b) => b.viewDate >= from && b.viewDate <= to), tasks: tasks, tickets: tickets };
  }

  function figures(r) {
    const tile = (value, label, detail, tone) => html`<div class="figure${tone ? ' is-' + tone : ''}"><span class="value">${value}</span><span class="label">${label}</span>${detail ? html`<span class="detail">${detail}</span>` : ''}</div>`;
    return html`<div class="figures" style="--cols:5">
      ${tile(fmt.number(hours(r.bookedMins)), 'Hours booked', fmt.plural(r.bookedCount, 'booking'))}
      ${tile(r.completed.length, 'Tasks completed', r.completed.length ? fmt.percent(r.onTime) + ' on time' : 'In this period')}
      ${tile(r.overdue, 'Tasks overdue', 'Right now', r.overdue ? 'alert' : '')}
      ${tile(r.checksDue, 'Checks to renew', 'Expired or within 60 days', r.checksDue ? 'warning' : '')}
      ${tile(r.openTickets, 'Open tickets', r.reported + ' reported in this period')}
    </div>`;
  }

  function panel(id, title, intro, body, canDownload) {
    return html`<section class="panel report" aria-labelledby="${id}Title">
      <div class="panel-head">
        <div><h2 id="${id}Title">${title}</h2>${intro ? html`<p>${intro}</p>` : ''}</div>
        ${canDownload ? html`<button type="button" class="btn btn-quiet btn-sm" data-report="${id}">${icon('download')}Download</button>` : ''}
      </div>
      ${body}
    </section>`;
  }

  /* Works out every table on the page, so the screen and the downloads use the same figures */
  function build(ctx, data, from, to) {
    const { db, today } = ctx;
    const name = (id) => rules.staffName(db, id);

    /* Calendar time by person, and booked time by state or territory */
    const byPerson = {};
    const byState = {};
    data.blocks.forEach((b) => {
      const p = (byPerson[b.staffId] = byPerson[b.staffId] || { staffId: b.staffId, booked: 0, admin: 0, travel: 0, leave: 0, unavailable: 0 });
      p[b.kind] += Number(b.duration);
      if (b.kind !== 'booked') return;
      const key = D.zoneShort(b.timeZone);
      const s = (byState[key] = byState[key] || { state: key, mins: 0, count: 0 });
      s.mins += Number(b.duration);
      s.count += 1;
    });
    const byName = (a, b) => name(a.staffId).localeCompare(name(b.staffId));
    const time = Object.values(byPerson).sort((a, b) => b.booked - a.booked || byName(a, b));
    const order = Object.values(D.ZONES);
    const states = Object.values(byState).sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
    const bookedMins = states.reduce((n, s) => n + s.mins, 0);

    /* Tasks by person */
    const done = (t) => t.status === 'done' && t.completedAt && D.stampDate(t.completedAt) >= from && D.stampDate(t.completedAt) <= to;
    const completed = data.tasks.filter(done);
    const onTime = completed.filter((t) => D.stampDate(t.completedAt) <= t.dueDate);
    const taskPeople = {};
    const person = (id) => (taskPeople[id] = taskPeople[id] || { staffId: id, open: 0, overdue: 0, completed: 0, onTime: 0 });
    data.tasks.forEach((t) => {
      if (t.status === 'open') {
        person(t.assignedTo).open += 1;
        if (t.dueDate < today) person(t.assignedTo).overdue += 1;
      }
      if (done(t)) {
        person(t.assignedTo).completed += 1;
        if (D.stampDate(t.completedAt) <= t.dueDate) person(t.assignedTo).onTime += 1;
      }
    });

    /* Checks for everyone active, including people with nothing recorded */
    const checks = rules.activeStaff(db).map((s) => {
      const mine = db.staffChecks.filter((c) => c.staffId === s.id);
      const count = (status) => mine.filter((c) => rules.checkStatus(c, today) === status).length;
      return { staffId: s.id, total: mine.length, current: count('current'), expiring: count('expiring'), expired: count('expired'), noexpiry: count('noexpiry') };
    });

    /* Tickets */
    const inPeriod = (stamp) => stamp && D.stampDate(stamp) >= from && D.stampDate(stamp) <= to;
    const reported = data.tickets.filter((f) => inPeriod(f.createdAt));
    const resolved = data.tickets.filter((f) => inPeriod(f.resolvedAt));
    const open = data.tickets.filter((f) => !['completed', 'declined'].includes(f.status));
    const days = resolved.map((f) => (new Date(f.resolvedAt) - new Date(f.createdAt)) / 86400000).sort((a, b) => a - b);
    const median = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) : null;
    const priorities = ['urgent', 'high', 'normal', 'low'].map((p) => ({ priority: p, open: open.filter((f) => f.priority === p).length, reported: reported.filter((f) => f.priority === p).length }));

    return {
      bookedMins: bookedMins,
      bookedCount: states.reduce((n, s) => n + s.count, 0),
      completed: completed,
      onTime: completed.length ? (onTime.length / completed.length) * 100 : 0,
      overdue: data.tasks.filter((t) => t.status === 'open' && t.dueDate < today).length,
      checksDue: rules.checksDue(db, today).length,
      openTickets: open.length,
      reported: reported.length,
      resolved: resolved.length,
      median: median,
      tables: {
        time: {
          file: 'Calendar time',
          rows: time,
          columns: [['Staff member', (r) => name(r.staffId)]].concat(KINDS.map((k) => [C.label('blockKind', k) + ', hours', (r) => hours(r[k])]))
        },
        states: {
          file: 'Booked time by state',
          rows: states,
          columns: [['State or territory', (r) => r.state], ['Bookings', (r) => r.count], ['Hours booked', (r) => hours(r.mins)]]
        },
        tasks: {
          file: 'Tasks by person',
          rows: Object.values(taskPeople).sort((a, b) => b.open - a.open || byName(a, b)),
          columns: [['Staff member', (r) => name(r.staffId)], ['Open', (r) => r.open], ['Overdue', (r) => r.overdue], ['Completed in period', (r) => r.completed], ['Completed on time', (r) => r.onTime]]
        },
        checks: {
          file: 'Checks by person',
          rows: checks,
          columns: [['Staff member', (r) => name(r.staffId)], ['Recorded', (r) => r.total], ['Current', (r) => r.current], ['Renew soon', (r) => r.expiring], ['Expired', (r) => r.expired], ['No expiry date', (r) => r.noexpiry]]
        },
        tickets: {
          file: 'Tickets by priority',
          rows: priorities,
          columns: [['Priority', (r) => C.label('ticketPriority', r.priority)], ['Open now', (r) => r.open], ['Reported in period', (r) => r.reported]]
        }
      }
    };
  }

  function reports(ctx, r, from, to) {
    const name = (id) => rules.staffName(ctx.db, id);
    const t = r.tables;
    const maxBooked = Math.max(0, ...t.time.rows.map((x) => x.booked));
    const maxState = Math.max(0, ...t.states.rows.map((x) => x.mins));
    const maxOpen = Math.max(0, ...t.tasks.rows.map((x) => x.open));
    const nothing = (title) => html`<div class="panel-body">${C.empty({ icon: 'chart', title: title })}</div>`;

    const timeTable = t.time.rows.length ? C.table({
      caption: 'Calendar time by person',
      rows: t.time.rows,
      columns: [{ key: 'name', label: 'Staff member', render: (x) => name(x.staffId) }].concat(KINDS.map((k) => ({
        key: k, label: C.label('blockKind', k), num: true,
        render: (x) => (k === 'booked' ? meter(x.booked, maxBooked, fmt.number(hours(x.booked))) : fmt.number(hours(x[k])))
      })))
    }) : nothing('Nothing in the calendar for this period');

    const stateTable = t.states.rows.length ? html`<div class="table-wrap"><table class="table table-stack">
      <caption class="sr-only">Booked time by state or territory</caption>
      <thead><tr><th scope="col">State or territory</th><th scope="col" class="num">Bookings</th><th scope="col" class="num">Hours booked</th></tr></thead>
      <tbody>${t.states.rows.map((x) => html`<tr>
        <td class="cell-main" data-label=""><span class="zone-tag">${x.state}</span> ${C.label('timeZone', Object.keys(D.ZONES).find((z) => D.ZONES[z] === x.state))}</td>
        <td class="num" data-label="Bookings">${x.count}</td>
        <td class="num" data-label="Hours booked">${meter(x.mins, maxState, fmt.number(hours(x.mins)))}</td>
      </tr>`)}</tbody>
    </table></div>` : nothing('No bookings in this period');

    const taskTable = t.tasks.rows.length ? C.table({
      caption: 'Tasks by person',
      rows: t.tasks.rows,
      columns: [
        { key: 'name', label: 'Staff member', render: (x) => name(x.staffId) },
        { key: 'open', label: 'Open', num: true, render: (x) => meter(x.open, maxOpen, String(x.open)) },
        { key: 'overdue', label: 'Overdue', num: true, render: (x) => (x.overdue ? html`<span class="text-danger">${x.overdue}</span>` : '0') },
        { key: 'completed', label: 'Completed', num: true, render: (x) => String(x.completed) },
        { key: 'ontime', label: 'On time', num: true, render: (x) => (x.completed ? fmt.percent((x.onTime / x.completed) * 100) : '') }
      ]
    }) : nothing('No tasks yet');

    const checkTable = t.checks.rows.length ? C.table({
      caption: 'Checks by person',
      rows: t.checks.rows,
      columns: [
        { key: 'name', label: 'Staff member', render: (x) => html`${name(x.staffId)}${x.total ? '' : html`<span class="sub">Nothing recorded yet</span>`}` },
        { key: 'current', label: 'Current', num: true, render: (x) => String(x.current) },
        { key: 'expiring', label: 'Renew soon', num: true, render: (x) => (x.expiring ? html`<span class="text-warning">${x.expiring}</span>` : '0') },
        { key: 'expired', label: 'Expired', num: true, render: (x) => (x.expired ? html`<span class="text-danger">${x.expired}</span>` : '0') },
        { key: 'noexpiry', label: 'No expiry date', num: true, render: (x) => String(x.noexpiry) }
      ]
    }) : nothing('No active staff');

    const ticketBody = html`<div class="panel-body">
      <dl class="kv">
        <dt>Reported in this period</dt><dd>${r.reported}</dd>
        <dt>Resolved in this period</dt><dd>${r.resolved}</dd>
        <dt>Usual time to resolve</dt><dd>${r.median === null ? 'Nothing resolved in this period' : r.median < 1 ? 'Under a day' : fmt.plural(Math.round(r.median), 'day')}</dd>
      </dl>
    </div>
    ${C.table({
      caption: 'Tickets by priority',
      rows: t.tickets.rows,
      columns: [
        { key: 'priority', label: 'Priority', render: (x) => C.badge('priority', x.priority, C.label('ticketPriority', x.priority)) },
        { key: 'open', label: 'Open now', num: true, render: (x) => String(x.open) },
        { key: 'reported', label: 'Reported in period', num: true, render: (x) => String(x.reported) }
      ]
    })}`;

    return html`
      ${figures(r)}
      <div class="stack-panels">
        ${panel('time', 'Calendar time by person', 'Hours in the calendar for ' + fmt.date(from) + ' to ' + fmt.date(to) + ', including anything still to come.', timeTable, t.time.rows.length)}
        ${panel('states', 'Booked time by state or territory', 'Where bookings were made, from the state or territory chosen for each entry. Telehealth bookings outside NSW and Queensland show here.', stateTable, t.states.rows.length)}
        ${panel('tasks', 'Tasks by person', 'Open and overdue tasks right now, and tasks completed in this period. On time means completed by the due date.', taskTable, t.tasks.rows.length)}
        ${panel('checks', 'Checks and registrations', 'Where each person is up to right now. Renew soon means within 60 days.', checkTable, t.checks.rows.length)}
        ${panel('tickets', 'Feedback and issues', 'Tickets reported and resolved in this period, and what is still open.', ticketBody, true)}
      </div>`;
  }

  function downloads() {
    return html`
      <div class="notice" style="margin-bottom:1rem">${icon('shield')}<div>These files include staff contact details and check numbers. Keep them somewhere private, such as the practice's own storage, and delete old copies you no longer need. Each download is noted in Change history.</div></div>
      <div class="stack-panels">
        <section class="panel" aria-labelledby="allTitle">
          <div class="panel-head">
            <div><h2 id="allTitle">A copy of everything</h2><p>One zip file with a spreadsheet for each area below, the practice settings, and every version of every template. Useful as your own copy while the dashboard has no backups.</p></div>
            <button type="button" class="btn" data-everything>${icon('download')}Download everything</button>
          </div>
          <div class="panel-body"><p class="small muted" data-progress role="status" aria-live="polite">Everything is read fresh from the database, including completed tasks and past calendar entries.</p></div>
        </section>
        <section class="panel" aria-labelledby="oneTitle">
          <div class="panel-head"><div><h2 id="oneTitle">One spreadsheet at a time</h2><p>Every record in that area, not just what's on screen.</p></div></div>
          <ul class="rows">${X.SETS.map((s) => html`<li>
            <span class="icon-tile" aria-hidden="true">${icon('download')}</span>
            <div class="what"><strong>${s.label}</strong><div class="meta"><span>${s.file}.csv</span></div></div>
            <div class="end"><button type="button" class="btn btn-secondary btn-sm" data-sheet="${s.name}" aria-label="Download ${s.label.toLowerCase()}">Download</button></div>
          </li>`)}</ul>
        </section>
      </div>`;
  }

  AWY.views.statistics = {
    title: 'Reports and downloads',
    render(ctx) {
      const { state, today } = ctx;
      const tab = ctx.params.id === 'downloads' ? 'downloads' : 'reports';
      const tabs = html`<div class="tabs-wrap">${C.tabs([
        { key: 'reports', label: 'Reports', href: '#/statistics' },
        { key: 'downloads', label: 'Downloads', href: '#/statistics/downloads' }
      ], tab)}</div>`;
      const head = C.pageHead({ title: 'Reports and downloads', subtitle: 'How the practice is going, and copies of the dashboard\'s records.' });

      if (tab === 'downloads') {
        ctx.el.innerHTML = String(html`${head}${tabs}${downloads()}`);
        bindDownloads(ctx);
        return;
      }

      if (!state.period) state.period = 'month';
      const [from, to] = period(state.period, today);
      const key = state.period + ':' + from + ':' + (AWY.app.loadedAt || 0);
      const data = state.cache && state.cache.key === key ? state.cache : null;

      let body;
      if (data && data.error) {
        body = html`<div class="notice notice-danger">${icon('alertCircle')}<div><strong>The reports couldn't be worked out</strong>${data.error} <button type="button" class="link-button" data-retry>Try again</button></div></div>`;
      } else if (data) {
        state.report = build(ctx, data, from, to);
        body = reports(ctx, state.report, from, to);
      } else {
        body = html`<div class="panel"><div class="panel-body"><p class="muted" role="status">${icon('refresh')} Working out the figures for ${fmt.date(from)} to ${fmt.date(to)}.</p></div></div>`;
        if (state.loading !== key) {
          state.loading = key;
          load(ctx, from, to).then((loaded) => {
            state.cache = Object.assign({ key: key }, loaded);
          }, (error) => {
            const r = AWY.errors.capture(error, { area: 'reports', operation: 'load reports' });
            state.cache = { key: key, error: r.message };
          }).then(() => {
            state.loading = '';
            if (ctx.el.isConnected) ctx.refresh();
          });
        }
      }

      ctx.el.innerHTML = String(html`
        ${head}
        ${tabs}
        ${C.seg('period', PERIODS, state.period)}
        <p class="small muted" style="margin:-0.25rem 0 1rem">${fmt.date(from)} to ${fmt.date(to)}. Calendar figures use ${D.zoneLabel(ctx.db.viewZone)}.</p>
        ${body}
      `);
      C.bindFilters(ctx);
      AWY.on(ctx.el, 'click', '[data-retry]', () => {
        state.cache = null;
        ctx.refresh();
      });
      AWY.on(ctx.el, 'click', '[data-report]', (event, btn) => {
        const t = state.report && state.report.tables[btn.dataset.report];
        if (t) X.sheet(t.file, t.columns, t.rows, from + ' to ' + to);
      });
    }
  };

  function bindDownloads(ctx) {
    const el = ctx.el;
    const progress = el.querySelector('[data-progress]');
    AWY.on(el, 'click', '[data-everything]', async (event, btn) => {
      await AWY.ui.busy(btn, async () => {
        try {
          const done = await X.everything(ctx.db, (text) => (progress.textContent = text + '.'));
          progress.textContent = 'Saved. The zip file holds ' + fmt.plural(done.files, 'file') + ', including ' + fmt.plural(done.templates, 'template file') + '.';
        } catch (error) {
          const r = AWY.errors.capture(error, { area: 'downloads', operation: 'download everything' });
          progress.textContent = '';
          AWY.ui.toast(r.message, { tone: 'error' });
        }
      });
    });
    AWY.on(el, 'click', '[data-sheet]', async (event, btn) => {
      const set = X.SETS.find((s) => s.name === btn.dataset.sheet);
      await AWY.ui.busy(btn, async () => {
        try {
          const extra = {};
          if (set.name === 'templateVersions') extra.templates = await store.all('templates');
          if (set.name === 'feedbackNotes') extra.feedback = await store.all('feedback');
          let rows = await store.all(set.name);
          if (set.sort) rows = rows.slice().sort(set.sort);
          X.sheet(set.file, X.COLUMNS[set.name](ctx.db, ctx.today, extra), rows);
        } catch (error) {
          const r = AWY.errors.capture(error, { area: 'downloads', operation: 'download ' + set.file.toLowerCase() });
          AWY.ui.toast(r.message, { tone: 'error' });
        }
      });
    });
  }
})();
