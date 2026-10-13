/*
  Business reports.
  Every figure and chart is worked out from the current demo records for the
  chosen date range, so they change as records change.
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

  function rangeFor(key, today, custom) {
    const fyStart = Number(today.slice(5, 7)) >= 7 ? today.slice(0, 4) + '-07-01' : Number(today.slice(0, 4)) - 1 + '-07-01';
    switch (key) {
      case 'month': return [D.startOfMonth(today), D.endOfMonth(today)];
      case 'lastmonth': {
        const s = D.addMonths(D.startOfMonth(today), -1);
        return [s, D.endOfMonth(s)];
      }
      case 'quarter': return [D.addDays(today, -90), today];
      case 'fy': return [fyStart, today];
      case 'custom': return [custom.from || D.addDays(today, -30), custom.to || today];
      default: return [D.addDays(today, -56), D.addDays(today, 28)];
    }
  }

  /* Column chart: one series, thin columns with rounded tops, hover and focus tooltips */
  function columns(points, label) {
    if (!points.length) return C.empty({ icon: 'chart', title: 'No data in this range' });
    const w = 680;
    const h = 220;
    const left = 32;
    const bottom = 28;
    const top = 18;
    const max = Math.max(1, ...points.map((p) => p.value));
    const step = max <= 5 ? 1 : max <= 12 ? 2 : Math.ceil(max / 5);
    const ceiling = Math.ceil(max / step) * step;
    const slot = (w - left) / points.length;
    const bw = Math.min(24, slot * 0.6);
    const y = (v) => h - bottom - (v / ceiling) * (h - bottom - top);
    const ticks = [];
    for (let v = 0; v <= ceiling; v += step) ticks.push(v);
    const labelEvery = points.length > 14 ? 2 : 1;
    const peak = points.reduce((m, p, i) => (p.value > points[m].value ? i : m), 0);
    const bar = (p, i) => {
      const x = left + slot * i + (slot - bw) / 2;
      const yt = y(p.value);
      const hgt = h - bottom - yt;
      const r = Math.min(4, hgt);
      const d = hgt <= 0 ? '' : 'M' + x + ' ' + (h - bottom) + 'V' + (yt + r) + 'Q' + x + ' ' + yt + ' ' + (x + r) + ' ' + yt + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + yt + ' ' + (x + bw) + ' ' + (yt + r) + 'V' + (h - bottom) + 'Z';
      return html`<g class="col" tabindex="0" role="img" aria-label="${p.label}: ${p.detail}" data-tip="${p.label}" data-tip-value="${p.detail}">
        <rect x="${left + slot * i}" y="${top}" width="${slot}" height="${h - bottom - top}" fill="transparent"></rect>
        ${d ? html`<path class="bar" d="${d}"></path>` : ''}
        ${i === peak || i === points.length - 1 ? html`<text class="value" x="${x + bw / 2}" y="${yt - 5}" text-anchor="middle">${p.value}</text>` : ''}
        ${i % labelEvery === 0 ? html`<text x="${x + bw / 2}" y="${h - 9}" text-anchor="middle">${p.short}</text>` : ''}
      </g>`;
    };
    return html`<div class="chart-wrap">
      <svg class="chart" viewBox="0 0 ${w} ${h}" aria-label="${label}">
        ${ticks.map((v) => html`<line class="grid" x1="${left}" x2="${w}" y1="${y(v)}" y2="${y(v)}"></line><text x="${left - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`)}
        ${points.map(bar)}
      </svg>
      <div class="chart-tip" hidden><strong></strong><span></span></div>
    </div>`;
  }

  /* Horizontal bars for categories, sorted largest first, value at the tip */
  function hbars(items) {
    const list = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    if (!list.length) return C.empty({ icon: 'chart', title: 'No data in this range' });
    const max = Math.max(...list.map((x) => x.value));
    return html`<div class="hbars">${list.map((x) => html`<div class="hbar">
      <span>${x.label}</span>
      <span class="track"><span class="fill" style="width:${Math.max(2, (x.value / max) * 100)}%"></span></span>
      <span class="n">${x.display || x.value}</span>
    </div>`)}</div>`;
  }

  function tableView(headers, rows) {
    return html`<details class="table-view">
      <summary>Show as a table</summary>
      <div class="table-wrap" style="margin-top:0.75rem"><table class="table">
        <thead><tr>${headers.map((h, i) => html`<th scope="col" class="${i ? 'num' : ''}">${h}</th>`)}</tr></thead>
        <tbody>${rows.map((r) => html`<tr>${r.map((c, i) => html`<td class="${i ? 'num' : ''}">${c}</td>`)}</tr>`)}</tbody>
      </table></div>
    </details>`;
  }

  function bindTips(el) {
    const show = (target) => {
      const wrap = target.closest('.chart-wrap');
      if (!wrap) return;
      const tip = wrap.querySelector('.chart-tip');
      tip.querySelector('strong').textContent = target.getAttribute('data-tip-value');
      tip.querySelector('span').textContent = target.getAttribute('data-tip');
      const box = target.getBoundingClientRect();
      const host = wrap.getBoundingClientRect();
      tip.hidden = false;
      tip.style.left = Math.min(host.width - tip.offsetWidth, Math.max(0, box.left - host.left + box.width / 2 - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(0, box.top - host.top - tip.offsetHeight - 6) + 'px';
    };
    const hide = (target) => {
      const wrap = target.closest('.chart-wrap');
      if (wrap) wrap.querySelector('.chart-tip').hidden = true;
    };
    el.addEventListener('pointerover', (e) => {
      const t = e.target.closest('.col');
      if (t) show(t);
    });
    el.addEventListener('pointerout', (e) => {
      const t = e.target.closest('.col');
      if (t) hide(t);
    });
    el.addEventListener('focusin', (e) => {
      const t = e.target.closest('.col');
      if (t) show(t);
    });
    el.addEventListener('focusout', (e) => {
      const t = e.target.closest('.col');
      if (t) hide(t);
    });
  }

  AWY.views.statistics = {
    title: 'Business reports',
    render(ctx) {
      const { db, state, today } = ctx;
      if (!state.range) state.range = 'default';
      if (!state.show) state.show = 'all';
      const [from, to] = rangeFor(state.range, today, { from: state.from, to: state.to });
      const s = rules.statistics(db, from, to);
      const show = (k) => state.show === 'all' || state.show === k;

      const weekPoints = s.weeks.map((w) => ({ label: 'Week of ' + fmt.date(w.start), short: fmt.date(w.start).replace(/ \d{4}$/, ''), value: w.booked, detail: fmt.plural(w.booked, 'appointment') + ', ' + w.completed + ' completed' }));
      const sources = Object.keys(s.referralSources).map((k) => ({ label: C.label('referralSource', k), value: s.referralSources[k] }));
      const mix = Object.keys(s.fundingMix).map((k) => ({ label: C.label('fundingType', k), value: s.fundingMix[k] }));
      const types = Object.keys(s.appointmentTypes).map((k) => ({ label: C.label('appointmentType', k), value: s.appointmentTypes[k] }));
      const invoiceRows = ['draft', 'issued', 'overdue', 'paid', 'cancelled'].filter((k) => s.invoiceSummary[k]).map((k) => [C.badge('invoice', k), s.invoiceSummary[k].count, fmt.money(s.invoiceSummary[k].total)]);

      const tile = (value, label, detail) => html`<div class="figure"><span class="value">${value}</span><span class="label">${label}</span>${detail ? html`<span class="detail">${detail}</span>` : ''}</div>`;

      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Business reports', subtitle: 'How the practice is going, worked out from the current records. ' + fmt.date(from) + ' to ' + fmt.date(to) + '.' })}
        <div class="toolbar">
          ${C.select('range', 'Date range', [
            { value: 'default', label: 'Last 8 weeks and next 4' },
            { value: 'month', label: 'This month' },
            { value: 'lastmonth', label: 'Last month' },
            { value: 'quarter', label: 'Last 90 days' },
            { value: 'fy', label: 'This financial year' },
            { value: 'custom', label: 'Custom range' }
          ], state.range, false)}
          ${state.range === 'custom' ? html`
            <div class="field"><label for="statFrom">From</label><input class="input" type="date" id="statFrom" data-date="from" value="${from}"></div>
            <div class="field"><label for="statTo">To</label><input class="input" type="date" id="statTo" data-date="to" value="${to}"></div>` : ''}
          ${C.select('show', 'Show', [
            { value: 'all', label: 'Everything' },
            { value: 'clients', label: 'Clients and referrals' },
            { value: 'appointments', label: 'Appointments and services' },
            { value: 'billing', label: 'Billing' }
          ], state.show, false)}
        </div>

        ${show('clients') ? html`<h2 class="section-title">Clients and referrals</h2>
          <div class="figures" style="--cols:4">
            ${tile(s.activeClients, 'Active clients', 'Right now')}
            ${tile(s.newClients, 'New clients', 'Started in this range')}
            ${tile(s.referrals, 'Referrals received', 'In this range')}
            ${tile(s.assessmentsCompleted, 'Assessments completed', 'In this range')}
          </div>
          <div class="columns even">
            <section class="panel"><div class="panel-head"><h2>Where referrals came from</h2></div><div class="panel-body">
              ${hbars(sources)}
              ${sources.length ? tableView(['Source', 'Referrals'], sources.map((x) => [x.label, x.value])) : ''}
            </div></section>
            <section class="panel"><div class="panel-head"><h2>How active clients are funded</h2></div><div class="panel-body">
              ${hbars(mix)}
              ${tableView(['Funding', 'Clients'], mix.map((x) => [x.label, x.value]))}
            </div></section>
          </div>` : ''}

        ${show('appointments') ? html`<h2 class="section-title">Appointments and services</h2>
          <div class="figures" style="--cols:4">
            ${tile(s.appointments, 'Appointments booked', s.completedAppointments + ' completed')}
            ${tile(s.cancelled, 'Cancellations', s.lateCancellations + ' at short notice')}
            ${tile(fmt.number(Math.round(s.serviceHours * 10) / 10), 'Hours of service', fmt.number(Math.round(s.travelHours * 10) / 10) + ' hours of travel')}
            ${tile(s.reportsDelivered, 'Reports delivered', s.reportsOutstanding + ' outstanding now')}
          </div>
          <div class="columns">
            <section class="panel"><div class="panel-head"><h2>Appointments per week</h2><p>Booked, not counting cancellations</p></div><div class="panel-body">
              ${columns(weekPoints, 'Appointments per week')}
              ${tableView(['Week starting', 'Booked', 'Completed'], s.weeks.map((w) => [fmt.date(w.start), w.booked, w.completed]))}
            </div></section>
            <section class="panel"><div class="panel-head"><h2>Completed appointments by type</h2></div><div class="panel-body">
              ${hbars(types)}
              ${types.length ? tableView(['Type', 'Completed'], types.map((x) => [x.label, x.value])) : ''}
            </div></section>
          </div>` : ''}

        ${show('billing') && AWY.access.can('billing') ? html`<h2 class="section-title">Billing</h2>
          <div class="figures" style="--cols:3">
            ${tile(fmt.money(s.deliveredValue), 'Services delivered', 'Value at the rates that applied')}
            ${tile(fmt.money(s.invoiced), 'Invoiced', 'Issued in this range')}
            ${tile(fmt.money(s.paid), 'Paid', 'Recorded in the demo')}
          </div>
          <section class="panel"><div class="panel-head"><h2>Invoices issued in this range, by status</h2></div>
            ${invoiceRows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Status</th><th class="num">Invoices</th><th class="num">Total</th></tr></thead><tbody>${invoiceRows.map((r) => html`<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td></tr>`)}</tbody></table></div>` : html`<div class="panel-body">${C.empty({ icon: 'receipt', title: 'No invoices in this range' })}</div>`}
          </section>` : ''}
        <p class="small muted" style="margin-top:1.5rem">${icon('info')} All figures are worked out from the demo records each time this page opens, so they change as you add or edit records.</p>
      `);
      C.bindFilters(ctx);
      bindTips(ctx.el);
      ctx.el.addEventListener('change', (event) => {
        const k = event.target.dataset && event.target.dataset.date;
        if (!k) return;
        state[k] = event.target.value;
        ctx.refresh();
      });
    }
  };
})();
