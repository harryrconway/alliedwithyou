/*
  Change history: who changed what in the dashboard, and when, from the audit trail the
  database writes. Administrators only. The records can't be changed or deleted by anyone,
  and they name the fields that changed, not their values, apart from roles and status.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const rules = AWY.rules;
  const icon = (n) => raw(AWY.icon(n));

  const PERIODS = [
    { value: '1', label: 'Today' },
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: 'all', label: 'Everything shown' }
  ];

  const who = (db, e) => (e.actorId ? rules.staffName(db, e.actorId) : 'Automatic');
  const fieldsText = (e) => (e.fields || []).map((f) => f.replace(/_/g, ' ')).join(', ');

  function filtered(db, state, today) {
    const since = state.period === 'all' ? '' : D.addDays(today, -(Number(state.period) - 1));
    return db.auditEvents.filter((e) =>
      (!since || D.stampDate(e.at) >= since) &&
      (!state.area || e.tableName === state.area) &&
      (!state.person || (state.person === 'automatic' ? !e.actorId : e.actorId === state.person)) &&
      C.matches(e, state.q, ['summary', fieldsText, (x) => who(db, x)])
    );
  }

  /* A spreadsheet friendly copy of what's on screen */
  function download(db, list) {
    const cell = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['When', 'Who', 'Area', 'What happened', 'Fields changed'].map(cell).join(',')].concat(list.map((e) =>
      [fmt.stamp(e.at), who(db, e), C.label('auditTable', e.tableName), e.summary, fieldsText(e)].map(cell).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Change history ' + D.today() + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  AWY.views.history = {
    title: 'Change history',
    render(ctx) {
      const { db, state, today } = ctx;
      if (state.period === undefined) state.period = '7';
      const list = filtered(db, state, today);
      const people = rules.activeStaff(db).map((s) => ({ value: s.id, label: s.name || s.email })).concat([{ value: 'automatic', label: 'Automatic' }]);
      const columns = [
        { key: 'at', label: 'When', sortValue: (e) => e.at, render: (e) => html`<span class="nowrap">${fmt.stamp(e.at)}</span>` },
        { key: 'who', label: 'Who', sortValue: (e) => who(db, e), render: (e) => who(db, e) },
        { key: 'area', label: 'Area', sortValue: (e) => C.label('auditTable', e.tableName), render: (e) => C.label('auditTable', e.tableName) },
        { key: 'what', label: 'What happened', render: (e) => html`${e.summary}${e.fields && e.fields.length ? html`<span class="sub">Changed: ${fieldsText(e)}</span>` : ''}` }
      ];

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Change history',
          subtitle: 'Who changed what in the dashboard, and when. These records can\'t be changed or deleted.',
          actions: html`<button type="button" class="btn btn-secondary" data-download ${raw(list.length ? '' : 'disabled')}>${icon('download')}Download</button>`
        })}
        ${C.seg('period', PERIODS, state.period)}
        <div class="toolbar">
          ${C.search(state.q, 'Search changes')}
          ${C.select('area', 'Area', C.options('auditTable'), state.area, 'Everything')}
          ${C.select('person', 'Who', people, state.person, 'Anyone')}
        </div>
        ${C.table({ columns: columns, rows: list, sort: state.sort || '-at', caption: 'Change history', empty: C.empty({ icon: 'history', title: 'No changes match', text: 'Try a longer period or fewer filters.' }) })}
        <p class="small muted" style="margin-top:0.75rem">Showing ${fmt.plural(list.length, 'change')} from the latest ${db.auditEvents.length} recorded. The history names the fields that changed, not what they changed to, except for roles and account status. Automatic means a change made by the system, such as an accepted invitation.</p>
      `);
      C.bindFilters(ctx);
      AWY.on(ctx.el, 'click', '[data-download]', () => download(db, C.sortRows(list, columns, state.sort || '-at')));
    }
  };
})();
