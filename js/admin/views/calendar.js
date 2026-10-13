/* Appointments calendar with week, month and list views. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const rules = AWY.rules;
  const access = AWY.access;
  const A = AWY.actions;
  const icon = (n) => raw(AWY.icon(n));

  const START_HOUR = 7;
  const END_HOUR = 18;

  /* Places overlapping appointments side by side */
  function layout(events) {
    const sorted = events.slice().sort((a, b) => D.minutes(a.start) - D.minutes(b.start));
    const clusters = [];
    let current = null;
    sorted.forEach((e) => {
      const s = D.minutes(e.start) - (e.travelMins || 0);
      const end = D.minutes(e.start) + Number(e.duration);
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
        const s = D.minutes(e.start) - (e.travelMins || 0);
        let lane = lanes.findIndex((endAt) => endAt <= s);
        if (lane < 0) {
          lane = lanes.length;
          lanes.push(0);
        }
        lanes[lane] = D.minutes(e.start) + Number(e.duration);
        placed.push({ e: e, lane: lane, cluster: cl });
      });
      cl.lanes = lanes.length;
    });
    return placed.map((p) => ({ e: p.e, lane: p.lane, lanes: p.cluster.lanes }));
  }

  function eventLabel(db, a) {
    return C.label('appointmentType', a.type) + ' with ' + rules.clientNameById(db, a.clientId) + ', ' + fmt.timeRange(a.start, a.duration) + ', ' + AWY.schema.status('appointment', a.status).label;
  }

  function weekView(ctx, appts, anchor) {
    const { db, today } = ctx;
    const monday = D.startOfWeek(anchor);
    const days = [0, 1, 2, 3, 4, 5].map((i) => D.addDays(monday, i));
    const hours = [];
    for (let h = START_HOUR; h < END_HOUR; h += 1) hours.push(h);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    const cols = days.map((day) => {
      const dayAppts = appts.filter((a) => a.date === day);
      const placed = layout(dayAppts);
      return html`<div class="cal-col${day === today ? ' is-today' : ''}" role="group" aria-label="${fmt.dateLong(day)}">
        ${hours.map((h) => html`<button type="button" class="cal-slot" data-slot="${day}" data-hour="${h}" aria-label="New appointment ${fmt.dateDay(day)} at ${fmt.time(String(h).padStart(2, '0') + ':00')}"></button>`)}
        ${placed.map(({ e, lane, lanes }) => {
          const top = (D.minutes(e.start) - START_HOUR * 60) / 60;
          const height = Math.max(Number(e.duration) / 60, 0.42);
          const left = 'calc(' + (lane / lanes) * 100 + '% + 3px)';
          const width = 'calc(' + 100 / lanes + '% - 6px)';
          const travel = e.travelMins && e.status !== 'cancelled' ? html`<div class="cal-travel" style="top:calc(var(--hour) * ${top - e.travelMins / 60});height:calc(var(--hour) * ${e.travelMins / 60});left:${left};width:${width}" title="${e.travelMins} minutes travel"></div>` : '';
          const short = Number(e.duration) < 45 ? ' is-short' : '';
          return html`${travel}<button type="button" class="cal-event is-${e.status}${short}" data-appt="${e.id}" style="top:calc(var(--hour) * ${top});height:calc(var(--hour) * ${height} - 2px);left:${left};width:${width};right:auto" aria-label="${eventLabel(db, e)}">
            <strong>${rules.clientNameById(db, e.clientId)}</strong>
            <span>${fmt.time(e.start)}, ${C.label('appointmentType', e.type).toLowerCase()}</span>
            ${!ctx.state.staff ? html`<span>${rules.staffFirstName(db, e.staffId)}</span>` : ''}
          </button>`;
        })}
        ${day === today && nowMin > START_HOUR * 60 && nowMin < END_HOUR * 60 ? html`<div class="cal-now" style="top:calc(var(--hour) * ${(nowMin - START_HOUR * 60) / 60})" aria-hidden="true"></div>` : ''}
      </div>`;
    });

    return html`<div class="cal-week" style="--days:6">
      <div class="cal-corner"></div>
      ${days.map((d) => html`<div class="cal-day-head${d === today ? ' is-today' : ''}">${fmt.dayShort(d)}<strong>${Number(d.slice(8, 10))}</strong></div>`)}
      <div class="cal-times" aria-hidden="true">${hours.map((h) => html`<span>${fmt.time(String(h).padStart(2, '0') + ':00').replace(':00', '')}</span>`)}</div>
      ${cols}
    </div>`;
  }

  function monthView(ctx, appts, anchor) {
    const { db, today } = ctx;
    const first = D.startOfMonth(anchor);
    const last = D.endOfMonth(anchor);
    let day = D.startOfWeek(first);
    const cells = [];
    while (day <= last || D.weekday(day) !== 1) {
      const list = appts.filter((a) => a.date === day).sort((a, b) => a.start.localeCompare(b.start));
      const other = day < first || day > last;
      cells.push(html`<div class="cell${other ? ' is-other' : ''}${day === today ? ' is-today' : ''}">
        <span class="date">${Number(day.slice(8, 10))}</span>
        ${list.slice(0, 3).map((a) => html`<button type="button" class="cal-chip is-${a.status}" data-appt="${a.id}" aria-label="${eventLabel(db, a)}">${fmt.time(a.start).replace(' ', '')} ${rules.clientNameById(db, a.clientId)}</button>`)}
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

  function listView(ctx, appts, anchor) {
    const { db } = ctx;
    const until = D.addDays(anchor, 13);
    const list = appts.filter((a) => a.date >= anchor && a.date <= until).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    if (!list.length) return C.empty({ icon: 'calendar', title: 'Nothing booked in these two weeks' });
    const byDay = {};
    list.forEach((a) => (byDay[a.date] = byDay[a.date] || []).push(a));
    return html`<section class="panel">${Object.keys(byDay).map((day) => html`
      <div class="day-label">${fmt.dateLong(day)}</div>
      <ul class="rows">${byDay[day].map((a) => html`<li>
        <div class="when">${fmt.time(a.start)}<small>${fmt.duration(a.duration)}</small></div>
        <div class="what">
          <button type="button" style="all:unset;cursor:pointer;font-weight:680" data-appt="${a.id}">${rules.clientNameById(db, a.clientId)}</button>
          <div class="meta"><span>${C.label('appointmentType', a.type)}</span><span>${C.label('location', a.location)}</span>${a.travelMins ? html`<span>${icon('car')}${a.travelMins} min travel</span>` : ''}<span>${icon('user')}${rules.staffName(db, a.staffId)}</span></div>
        </div>
        <div class="end">${C.badge('appointment', a.status)}<button type="button" class="btn btn-quiet btn-sm" data-appt="${a.id}">Open</button></div>
      </li>`)}</ul>`)}</section>`;
  }

  AWY.views.calendar = {
    title: 'Appointments',
    render(ctx) {
      const { db, state, today, user, query } = ctx;
      if (!state.view) state.view = window.innerWidth < 720 ? 'list' : 'week';
      if (!state.date) state.date = query.date || today;
      if (state.staff === undefined) state.staff = user.role === 'therapist' || user.role === 'support' ? user.id : '';
      if (state.showCancelled === undefined) state.showCancelled = 'yes';

      const appts = db.appointments.filter((a) => (!state.staff || a.staffId === state.staff) && (state.showCancelled === 'yes' || a.status !== 'cancelled'));
      const anchor = state.date;
      let title;
      if (state.view === 'week') {
        const mon = D.startOfWeek(anchor);
        title = fmt.date(mon).replace(/ \d{4}$/, '') + ' to ' + fmt.date(D.addDays(mon, 5));
      } else if (state.view === 'month') {
        title = fmt.monthYear(anchor);
      } else {
        title = fmt.date(anchor) + ' to ' + fmt.date(D.addDays(anchor, 13));
      }

      const staffOptions = db.staff.filter((s) => s.role !== 'admin').map((s) => ({ value: s.id, label: s.name }));
      const body = state.view === 'week' ? weekView(ctx, appts, anchor) : state.view === 'month' ? monthView(ctx, appts, anchor) : listView(ctx, appts, anchor);

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Appointments',
          subtitle: 'Bookings for the whole practice. Reminders are not sent from the demo.',
          actions: html`<button type="button" class="btn" data-new-appt>${icon('plus')}New appointment</button>`
        })}
        <div class="cal-toolbar">
          <div class="cal-nav">
            <button type="button" class="btn btn-secondary btn-icon" data-step="-1" aria-label="Previous">${icon('chevronLeft')}</button>
            <button type="button" class="btn btn-secondary btn-sm" data-step="0">Today</button>
            <button type="button" class="btn btn-secondary btn-icon" data-step="1" aria-label="Next">${icon('chevronRight')}</button>
          </div>
          <h2 aria-live="polite">${title}</h2>
          <div class="seg" style="margin:0" role="group" aria-label="Calendar view">
            ${['week', 'month', 'list'].map((v) => html`<button type="button" data-seg="view" data-value="${v}" aria-pressed="${state.view === v}">${v === 'list' ? 'List' : v.charAt(0).toUpperCase() + v.slice(1)}</button>`)}
          </div>
          <div class="toolbar" style="margin:0 0 0 auto">
            ${C.select('staff', 'Staff', staffOptions, state.staff, 'Everyone')}
            ${C.select('showCancelled', 'Cancelled', [{ value: 'yes', label: 'Show' }, { value: 'no', label: 'Hide' }], state.showCancelled, false)}
          </div>
        </div>
        ${body}
        <div class="cal-legend" aria-hidden="true">
          <span><i style="background:var(--color-blue-pale);border-left:3px solid var(--color-blue)"></i>Scheduled</span>
          <span><i style="background:var(--color-warning-bg);border-left:3px solid #d39b2b"></i>Rescheduled</span>
          <span><i style="background:var(--color-success-bg);border-left:3px solid var(--color-success)"></i>Completed</span>
          <span><i style="background:var(--color-neutral-bg);border-left:3px solid var(--color-grey)"></i>Cancelled</span>
          <span><i style="background:repeating-linear-gradient(135deg,#eef2f5 0 4px,#e3e9ee 4px 8px)"></i>Travel time</span>
        </div>
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
      AWY.on(el, 'click', '[data-goto-week]', (event, btn) => {
        state.view = 'week';
        state.date = btn.dataset.gotoWeek;
        ctx.refresh();
      });
      AWY.on(el, 'click', '[data-slot]', (event, btn) => {
        const half = event.offsetY > btn.offsetHeight / 2 ? '30' : '00';
        A.appointmentForm(null, { date: btn.dataset.slot, start: String(btn.dataset.hour).padStart(2, '0') + ':' + half, staffId: state.staff || (user.role === 'admin' ? '' : user.id) });
      });

      /* Opened from a "New appointment" link elsewhere */
      if (query.new && state.openedFor !== query) {
        state.openedFor = query;
        AWY.router.replace(['calendar']);
        A.appointmentForm(null, state.staff ? { staffId: state.staff } : {});
      }
    }
  };
})();
