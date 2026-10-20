/*
  The staff calendar: who is booked, away or unavailable, with week, month and list views.
  Entries only ever say "Booked" and similar, never who the client is.
  Everything is laid out in one time zone, this device's when it's in Australia, so a day
  reads in order. Each entry is marked with the state or territory it was booked in, and
  its clock time there when that's different.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const rules = AWY.rules;
  const access = AWY.access;
  const store = AWY.store;
  const A = AWY.actions;
  const icon = (n) => raw(AWY.icon(n));

  const KINDS = ['booked', 'unavailable', 'leave', 'admin', 'travel'];

  /* Places overlapping entries side by side, for example two staff booked at once */
  function layout(events) {
    const sorted = events.slice().sort((a, b) => D.minutes(a.viewStart) - D.minutes(b.viewStart));
    const clusters = [];
    let current = null;
    sorted.forEach((e) => {
      const s = D.minutes(e.viewStart);
      const end = s + Number(e.duration);
      if (!current || s >= current.end) {
        current = { end: end, items: [] };
        clusters.push(current);
      }
      current.end = Math.max(current.end, end);
      current.items.push(e);
    });
    const placed = [];
    clusters.forEach((cl) => {
      const lanes = [];
      cl.items.forEach((e) => {
        const s = D.minutes(e.viewStart);
        let lane = lanes.findIndex((endAt) => endAt <= s);
        if (lane < 0) {
          lane = lanes.length;
          lanes.push(0);
        }
        lanes[lane] = s + Number(e.duration);
        placed.push({ e: e, lane: lane, cluster: cl });
      });
      cl.lanes = lanes.length;
    });
    return placed.map((p) => ({ e: p.e, lane: p.lane, lanes: p.cluster.lanes }));
  }

  function label(db, b) {
    return C.label('blockKind', b.kind) + ', ' + rules.staffName(db, b.staffId) + ', ' + A.blockWhen(b);
  }

  /* Hours shown in the week, widened to fit anything booked early or late */
  function hourRange(blocks, settings) {
    let first = Math.min(7, Number(String(settings.dayStart || '08:00').slice(0, 2)));
    let last = Math.max(18, Math.ceil(D.minutes(settings.dayEnd || '17:30') / 60));
    blocks.forEach((b) => {
      first = Math.min(first, Math.floor(D.minutes(b.viewStart) / 60));
      last = Math.max(last, Math.min(24, Math.ceil((D.minutes(b.viewStart) + Number(b.duration)) / 60)));
    });
    return { first: first, last: last };
  }

  function weekView(ctx, blocks, anchor) {
    const { db, today, settings } = ctx;
    const monday = D.startOfWeek(anchor);
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => D.addDays(monday, i));
    const inWeek = blocks.filter((b) => b.viewDate >= days[0] && b.viewDate <= days[6]);
    const range = hourRange(inWeek, settings);
    const hours = [];
    for (let h = range.first; h < range.last; h += 1) hours.push(h);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const cols = days.map((day) => {
      const placed = layout(inWeek.filter((b) => b.viewDate === day));
      return html`<div class="cal-col${day === today ? ' is-today' : ''}" role="group" aria-label="${fmt.dateLong(day)}">
        ${hours.map((h) => html`<button type="button" class="cal-slot" data-slot="${day}" data-hour="${h}" aria-label="New calendar entry ${fmt.dateDay(day)} at ${fmt.time(String(h).padStart(2, '0') + ':00')}"></button>`)}
        ${placed.map(({ e, lane, lanes }) => {
          const top = (D.minutes(e.viewStart) - range.first * 60) / 60;
          const height = Math.max(Number(e.duration) / 60, 0.42);
          const left = 'calc(' + (lane / lanes) * 100 + '% + 3px)';
          const width = 'calc(' + 100 / lanes + '% - 6px)';
          const short = Number(e.duration) < 45 ? ' is-short' : '';
          return html`<button type="button" class="cal-event is-${e.kind}${short}" data-block="${e.id}" style="top:calc(var(--hour) * ${top});height:calc(var(--hour) * ${height} - 2px);left:${left};width:${width};right:auto" aria-label="${label(db, e)}">
            <strong>${C.label('blockKind', e.kind)}</strong>
            <span>${fmt.time(e.viewStart)} ${A.zoneTag(e)}</span>
            ${!ctx.state.staff ? html`<span>${rules.staffFirstName(db, e.staffId)}</span>` : ''}
          </button>`;
        })}
        ${day === today && nowMin > range.first * 60 && nowMin < range.last * 60 ? html`<div class="cal-now" style="top:calc(var(--hour) * ${(nowMin - range.first * 60) / 60})" aria-hidden="true"></div>` : ''}
      </div>`;
    });

    return html`<div class="cal-week" style="--days:7">
      <div class="cal-corner"></div>
      ${days.map((d) => html`<div class="cal-day-head${d === today ? ' is-today' : ''}">${fmt.dayShort(d)}<strong>${Number(d.slice(8, 10))}</strong></div>`)}
      <div class="cal-times" aria-hidden="true">${hours.map((h) => html`<span>${fmt.time(String(h).padStart(2, '0') + ':00').replace(':00', '')}</span>`)}</div>
      ${cols}
    </div>`;
  }

  function monthView(ctx, blocks, anchor) {
    const { db, today } = ctx;
    const first = D.startOfMonth(anchor);
    const last = D.endOfMonth(anchor);
    let day = D.startOfWeek(first);
    const cells = [];
    while (day <= last || D.weekday(day) !== 1) {
      const list = blocks.filter((b) => b.viewDate === day).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const other = day < first || day > last;
      cells.push(html`<div class="cell${other ? ' is-other' : ''}${day === today ? ' is-today' : ''}">
        <span class="date">${Number(day.slice(8, 10))}</span>
        ${list.slice(0, 3).map((b) => html`<button type="button" class="cal-chip is-${b.kind}" data-block="${b.id}" aria-label="${label(db, b)}">${fmt.time(b.viewStart).replace(' ', '')} ${C.label('blockKind', b.kind)}${ctx.state.staff ? '' : ', ' + rules.staffFirstName(db, b.staffId)}</button>`)}
        ${list.length > 3 ? html`<button type="button" class="cal-more" data-goto-week="${day}">${list.length - 3} more</button>` : ''}
      </div>`);
      day = D.addDays(day, 1);
      if (cells.length > 42) break;
    }
    return html`<div class="cal-month">
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => html`<div class="head">${d}</div>`)}
      ${cells}
    </div>`;
  }

  function listView(ctx, blocks, anchor) {
    const { db } = ctx;
    const until = D.addDays(anchor, 13);
    const list = blocks.filter((b) => b.viewDate >= anchor && b.viewDate <= until).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (!list.length) return C.empty({ icon: 'calendar', title: 'Nothing in the calendar for these two weeks' });
    const byDay = {};
    list.forEach((b) => (byDay[b.viewDate] = byDay[b.viewDate] || []).push(b));
    return html`<section class="panel">${Object.keys(byDay).sort().map((day) => html`
      <div class="day-label">${fmt.dateLong(day)}</div>
      <ul class="rows">${byDay[day].map((b) => html`<li>
        <div class="when">${fmt.time(b.viewStart)}<small>${fmt.duration(b.duration)}</small></div>
        <div class="what">
          <button type="button" class="link-button" data-block="${b.id}">${C.label('blockKind', b.kind)}</button>
          <div class="meta"><span>${icon('user')}${rules.staffName(db, b.staffId)}</span><span>${A.zoneTag(b)}</span>${b.note ? html`<span>${b.note}</span>` : ''}</div>
        </div>
        <div class="end"><button type="button" class="btn btn-quiet btn-sm" data-block="${b.id}">Open</button></div>
      </li>`)}</ul>`)}</section>`;
  }

  AWY.views.calendar = {
    title: 'Calendar',
    render(ctx) {
      const { db, state, today, user, query } = ctx;
      if (!state.view) state.view = window.innerWidth < 720 ? 'list' : 'week';
      if (!state.date) state.date = query.date || today;
      if (state.staff === undefined) state.staff = access.can('everyCalendar') ? '' : user.id;

      const anchor = state.date;
      let title;
      let from;
      let to;
      if (state.view === 'week') {
        from = D.startOfWeek(anchor);
        to = D.addDays(from, 6);
        title = fmt.date(from).replace(/ \d{4}$/, '') + ' to ' + fmt.date(to);
      } else if (state.view === 'month') {
        from = D.startOfWeek(D.startOfMonth(anchor));
        to = D.addDays(D.endOfMonth(anchor), 7);
        title = fmt.monthYear(anchor);
      } else {
        from = anchor;
        to = D.addDays(anchor, 13);
        title = fmt.date(anchor) + ' to ' + fmt.date(to);
      }
      /* Moving well beyond the dates already loaded fetches more */
      if (store.needCalendar(from, to)) ctx.reload();

      const blocks = db.calendar.filter((b) => !state.staff || b.staffId === state.staff);
      const staffOptions = rules.activeStaff(db).map((s) => ({ value: s.id, label: (s.name || s.email) + (s.id === user.id ? ' (you)' : '') }));
      const body = state.view === 'week' ? weekView(ctx, blocks, anchor) : state.view === 'month' ? monthView(ctx, blocks, anchor) : listView(ctx, blocks, anchor);
      const local = D.localZone();
      const zoneNote = D.ZONES[local]
        ? 'Times show in ' + D.zoneLabel(db.viewZone) + ', as this device is set to it.'
        : 'This device is set to ' + D.zoneLabel(local) + ', so times show in ' + D.zoneLabel(db.viewZone) + ', the practice\'s usual time zone.';
      const shown = blocks.filter((b) => b.viewDate >= from && b.viewDate <= to).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Calendar',
          subtitle: 'When each person is booked, away or unavailable. Entries never show who a booking is with.',
          actions: html`<button type="button" class="btn btn-secondary" data-download ${raw(shown.length ? '' : 'disabled')}>${icon('download')}Download</button><button type="button" class="btn" data-new-block>${icon('plus')}New entry</button>`
        })}
        <div class="cal-toolbar">
          <div class="cal-nav">
            <button type="button" class="btn btn-secondary btn-icon" data-step="-1" aria-label="Previous">${icon('chevronLeft')}</button>
            <button type="button" class="btn btn-secondary btn-sm" data-step="0">Today</button>
            <button type="button" class="btn btn-secondary btn-icon" data-step="1" aria-label="Next">${icon('chevronRight')}</button>
          </div>
          <h2 aria-live="polite">${title}</h2>
          <div class="seg" style="margin:0" role="group" aria-label="Calendar view">
            ${['week', 'month', 'list'].map((v) => html`<button type="button" data-seg="view" data-value="${v}" aria-pressed="${state.view === v}">${v.charAt(0).toUpperCase() + v.slice(1)}</button>`)}
          </div>
          <div class="toolbar" style="margin:0 0 0 auto">
            ${C.select('staff', 'Staff', staffOptions, state.staff, 'Everyone')}
          </div>
        </div>
        ${body}
        <div class="cal-legend" aria-hidden="true">
          ${KINDS.map((k) => html`<span><i class="cal-key is-${k}"></i>${C.label('blockKind', k)}</span>`)}
        </div>
        <p class="small muted" style="margin-top:0.75rem">${icon('clock')} ${zoneNote} Each entry is marked with the state or territory it was booked in, and shows the time there when it's different.</p>
      `);

      const el = ctx.el;
      C.bindFilters(ctx);
      A.bindCommon(ctx);
      AWY.on(el, 'click', '[data-step]', (event, btn) => {
        const step = Number(btn.dataset.step);
        if (step === 0) state.date = today;
        else if (state.view === 'week') state.date = D.addDays(state.date, 7 * step);
        else if (state.view === 'month') state.date = D.addMonths(D.startOfMonth(state.date), step);
        else state.date = D.addDays(state.date, 14 * step);
        ctx.refresh();
      });
      AWY.on(el, 'click', '[data-download]', () => AWY.exports.sheet('Calendar', AWY.exports.COLUMNS.calendar(db), shown));
      AWY.on(el, 'click', '[data-goto-week]', (event, btn) => {
        state.view = 'week';
        state.date = btn.dataset.gotoWeek;
        ctx.refresh();
      });
      AWY.on(el, 'click', '[data-slot]', (event, btn) => {
        const half = event.offsetY > btn.offsetHeight / 2 ? '30' : '00';
        A.blockForm(null, { date: btn.dataset.slot, start: String(btn.dataset.hour).padStart(2, '0') + ':' + half, staffId: state.staff || user.id });
      });
    }
  };
})();
