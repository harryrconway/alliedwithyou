/*
  Invoices and payments.
  Every invoice here is fictional. Totals are always worked out from the line items.
  Issuing an invoice or recording a payment only changes the demo record:
  nothing is emailed and no money moves.
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

  A.draftInvoice = async function (clientId, button) {
    try {
      const inv = await AWY.ui.busy(button, () => AWY.automations.draftInvoice(clientId));
      AWY.ui.toast('Draft invoice ' + inv.number + ' created from verified services. It has not been issued.');
      AWY.router.go(['invoices', inv.id]);
    } catch (error) {
      AWY.ui.toast(error.message, { tone: 'error' });
    }
  };

  function readyByClient(db) {
    const map = {};
    db.supportLogs.filter((l) => l.status === 'verified' && !l.invoiceId).forEach((l) => {
      map[l.clientId] = map[l.clientId] || { clientId: l.clientId, count: 0, total: 0 };
      map[l.clientId].count += 1;
      map[l.clientId].total = rules.round2(map[l.clientId].total + rules.logAmount(l));
    });
    return Object.values(map).sort((a, b) => rules.clientNameById(db, a.clientId).localeCompare(rules.clientNameById(db, b.clientId)));
  }

  AWY.views.invoices = {
    title: 'Invoices',
    render(ctx) {
      const { db, state, today } = ctx;
      if (state.status === undefined) state.status = ctx.query.status || 'all';
      if (state.sort === undefined) state.sort = '-number';
      const list = db.invoices.map((i) => Object.assign({}, i, { _status: rules.invoiceStatus(i, today), _total: rules.invoiceTotal(db, i) }));
      const counts = {};
      list.forEach((i) => (counts[i._status] = (counts[i._status] || 0) + 1));
      const unpaid = list.filter((i) => i.status === 'issued');
      const seg = [
        { value: 'unpaid', label: 'Unpaid', count: unpaid.length },
        { value: 'overdue', label: 'Overdue', count: counts.overdue || 0 },
        { value: 'draft', label: 'Drafts', count: counts.draft || 0 },
        { value: 'paid', label: 'Paid', count: counts.paid || 0 },
        { value: 'cancelled', label: 'Cancelled', count: counts.cancelled || 0 },
        { value: 'all', label: 'All', count: list.length }
      ];
      const rows = list.filter((i) =>
        (state.status === 'all' || (state.status === 'unpaid' ? i.status === 'issued' : i._status === state.status)) &&
        C.matches(i, state.q, [(x) => 'invoice ' + x.number, (x) => rules.clientNameById(db, x.clientId), 'billToName'])
      );
      const ready = readyByClient(db);
      const monthStart = D.startOfMonth(today);
      const paidThisMonth = rules.sum(list.filter((i) => i.status === 'paid' && i.paidDate >= monthStart), (i) => i._total);
      const columns = [
        { key: 'number', label: 'Invoice', sortValue: (i) => i.number, render: (i) => html`Invoice ${i.number}<span class="sub">Fictional</span>` },
        { key: 'client', label: 'Client', sortValue: (i) => rules.clientNameById(db, i.clientId), render: (i) => C.clientLink(db, i.clientId, 'funding') },
        { key: 'billTo', label: 'Bill to', sortValue: (i) => i.billToName, render: (i) => html`${i.billToName}<span class="sub">${C.label('billTo', i.billTo)}</span>` },
        { key: 'issued', label: 'Issued', sortValue: (i) => i.issueDate, render: (i) => (i.status === 'draft' ? html`<span class="muted">Not issued</span>` : fmt.date(i.issueDate)) },
        { key: 'due', label: 'Due', sortValue: (i) => i.dueDate, render: (i) => C.due(i.dueDate, today, i.status !== 'issued') },
        { key: 'total', label: 'Total', num: true, sortValue: (i) => i._total, render: (i) => html`<strong>${fmt.money(i._total)}</strong>` },
        { key: 'status', label: 'Status', sortValue: (i) => i._status, render: (i) => C.badge('invoice', i._status) }
      ];

      ctx.el.innerHTML = String(html`
        ${C.pageHead({ title: 'Invoices', subtitle: 'Every invoice here is fictional. Nothing is emailed, charged or claimed.' })}
        <div class="figures" style="--cols:3">
          <a class="figure" href="#/invoices?status=unpaid"><span class="value">${fmt.money(rules.sum(unpaid, (i) => i._total))}</span><span class="label">Unpaid</span><span class="detail">${fmt.plural(unpaid.length, 'invoice')}</span></a>
          <a class="figure${counts.overdue ? ' is-alert' : ''}" href="#/invoices?status=overdue"><span class="value">${fmt.money(rules.sum(list.filter((i) => i._status === 'overdue'), (i) => i._total))}</span><span class="label">Overdue</span><span class="detail">${fmt.plural(counts.overdue || 0, 'invoice')} past due</span></a>
          <div class="figure"><span class="value">${fmt.money(paidThisMonth)}</span><span class="label">Paid this month</span><span class="detail">Recorded in the demo</span></div>
        </div>
        ${ready.length ? html`<section class="panel" style="margin-bottom:1.5rem" aria-labelledby="readyTitle">
          <div class="panel-head"><h2 id="readyTitle">Ready to invoice</h2><p>Verified services that aren't on an invoice yet</p></div>
          <ul class="rows">${ready.map((r) => html`<li>
            <div class="what">${C.clientLink(db, r.clientId, 'funding')}<div class="meta"><span>${fmt.plural(r.count, 'verified service')}</span><span>${fmt.money(r.total)}</span><span>Bill to ${rules.billTo(db, rules.client(db, r.clientId), today).billToName}</span></div></div>
            <div class="end"><button type="button" class="btn btn-secondary btn-sm" data-draft-invoice="${r.clientId}">${icon('receipt')}Create draft invoice</button></div>
          </li>`)}</ul>
        </section>` : ''}
        ${C.seg('status', seg, state.status)}
        <div class="toolbar">${C.search(state.q, 'Search by number, client or payer')}</div>
        ${C.table({ columns, rows, sort: state.sort, caption: 'Invoices', rowHref: (i) => '#/invoices/' + i.id, empty: C.empty({ icon: 'receipt', title: 'No invoices here' }) })}
      `);
      C.bindFilters(ctx);
      C.bindRows(ctx.el);
      AWY.on(ctx.el, 'click', '[data-draft-invoice]', (event, btn) => A.draftInvoice(btn.dataset.draftInvoice, btn));
    }
  };

  function editLines(db, inv) {
    const lines = rules.invoiceLines(db, inv.id);
    const modal = AWY.ui.modal({
      title: 'Edit invoice lines',
      subtitle: 'Invoice ' + inv.number + '. The total is worked out from these lines.',
      size: 'wide',
      form: true,
      body: html`<div class="form">
        <div class="form-summary"></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Description</th><th>Quantity</th><th>Rate</th><th>Remove</th></tr></thead>
          <tbody>${lines.map((l) => html`<tr>
            <td><label class="sr-only" for="d_${l.id}">Description</label><input class="input" id="d_${l.id}" name="desc_${l.id}" value="${l.description}" required><span class="sub">${fmt.date(l.date)}${l.code ? ', ' + l.code : ''}</span></td>
            <td style="width:7rem"><label class="sr-only" for="q_${l.id}">Quantity</label><input class="input" type="number" step="0.01" min="0" id="q_${l.id}" name="qty_${l.id}" value="${l.quantity}" required></td>
            <td style="width:8rem"><label class="sr-only" for="r_${l.id}">Rate</label><input class="input" type="number" step="0.01" min="0" id="r_${l.id}" name="rate_${l.id}" value="${l.rate}" required></td>
            <td style="width:5rem;text-align:center"><input type="checkbox" name="remove_${l.id}" aria-label="Remove this line" style="width:1.1rem;height:1.1rem"></td>
          </tr>`)}</tbody>
        </table></div>
        <fieldset><legend>Add a line <span class="optional">(optional)</span></legend>
          <div class="form-grid">
            <div class="field span-all"><label for="newDesc">Description</label><input class="input" id="newDesc" name="newDesc"></div>
            <div class="field"><label for="newDate">Date</label><input class="input" type="date" id="newDate" name="newDate" value="${D.today()}"></div>
            <div class="field"><label for="newQty">Quantity</label><input class="input" type="number" step="0.01" min="0" id="newQty" name="newQty"></div>
            <div class="field"><label for="newRate">Rate</label><input class="input" type="number" step="0.01" min="0" id="newRate" name="newRate"></div>
          </div>
        </fieldset>
      </div>`,
      footer: html`<button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="submit" class="btn">Save lines</button>`
    });
    modal.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const custom = (v) => (v.newDesc && (!v.newQty || !v.newRate) ? { newQty: 'Add a quantity and rate for the new line' } : {});
      const result = AWY.validate.form(modal.form, custom);
      if (!result.valid) return;
      const v = result.values;
      await AWY.ui.busy(modal.form.querySelector('[type="submit"]'), async () => {
        for (const l of lines) {
          if (v['remove_' + l.id]) {
            if (l.supportLogId) await store.update('supportLogs', l.supportLogId, { status: 'verified', invoiceId: null }, { audit: false, instant: true });
            await store.remove('invoiceLines', l.id);
          } else {
            const patch = { description: v['desc_' + l.id], quantity: Number(v['qty_' + l.id]), rate: Number(v['rate_' + l.id]) };
            if (patch.description !== l.description || patch.quantity !== l.quantity || patch.rate !== l.rate) await store.update('invoiceLines', l.id, patch, { audit: false, instant: true });
          }
        }
        if (v.newDesc) await store.create('invoiceLines', { invoiceId: inv.id, supportLogId: null, date: v.newDate, description: v.newDesc, quantity: Number(v.newQty), rate: Number(v.newRate), unit: 'each', code: '' }, { audit: false, instant: true });
        await store.update('invoices', inv.id, { linesEditedAt: D.now() }, { summary: 'Edited lines on Invoice ' + inv.number });
      });
      modal.close();
      AWY.ui.toast('Invoice lines saved. The total has been recalculated.');
    });
  }

  AWY.views.invoice = {
    title: (ctx) => {
      const i = ctx.db.invoices.find((x) => x.id === ctx.params.id);
      return i ? 'Invoice ' + i.number : 'Invoice';
    },
    render(ctx) {
      const { db, today, settings } = ctx;
      const inv = db.invoices.find((x) => x.id === ctx.params.id);
      if (!inv) {
        ctx.el.innerHTML = String(html`${C.pageHead({ title: 'Invoice not found', back: { href: '#/invoices', label: 'Invoices' } })}`);
        return;
      }
      const c = rules.client(db, inv.clientId);
      const lines = rules.invoiceLines(db, inv.id);
      const total = rules.invoiceTotal(db, inv);
      const status = rules.invoiceStatus(inv, today);
      const terms = Number(settings.invoiceTerms) || 14;

      const actions = [];
      if (inv.status === 'draft') {
        actions.push(html`<button type="button" class="btn btn-danger" data-delete>${icon('trash')}Delete draft</button>`);
        actions.push(html`<button type="button" class="btn btn-secondary" data-lines>${icon('edit')}Edit lines</button>`);
        actions.push(html`<button type="button" class="btn" data-issue>${icon('send')}Issue invoice</button>`);
      }
      if (inv.status === 'issued') {
        actions.push(html`<button type="button" class="btn btn-danger" data-cancel>Cancel invoice</button>`);
        actions.push(html`<button type="button" class="btn" data-pay>${icon('checkCircle')}Record payment</button>`);
      }

      const statusText = {
        draft: 'Draft. Not issued, so nobody has seen it.',
        issued: 'Marked as issued on ' + fmt.date(inv.issueDate) + '. Nothing was emailed from the demo.',
        overdue: 'Marked as issued on ' + fmt.date(inv.issueDate) + ' and now ' + D.diffDays(inv.dueDate, today) + ' days past due.',
        paid: 'Payment recorded on ' + fmt.date(inv.paidDate) + ' (' + C.label('paymentMethod', inv.paymentMethod).toLowerCase() + '). Demo record only, no money moved.',
        cancelled: 'Cancelled. ' + (inv.notes || '')
      }[status];

      ctx.el.innerHTML = String(html`
        <div class="doc-actions">
          <a class="back-link" style="margin:0" href="#/invoices">${icon('arrowLeft')}Invoices</a>
          <div class="btn-row"><button type="button" class="btn btn-secondary" data-print>${icon('printer')}Export as PDF</button>${actions}</div>
        </div>
        <div class="doc-actions no-print" style="justify-content:flex-start">${C.badge('invoice', status)}<span class="muted small">${statusText}</span></div>
        <div class="doc-wrap">
          <article class="doc">
            ${C.letterhead(settings)}
            <span class="doc-demo">Fictional invoice for testing. Not a request for payment.</span>
            <h1>Invoice ${inv.number}</h1>
            <dl class="doc-meta">
              <div><dt>Bill to</dt><dd>${inv.billToName}</dd></div>
              <div><dt>For services to</dt><dd>${c ? rules.clientFullName(c) : 'Deleted client'}${c && c.ndisNumber ? html`<br><span class="muted small">NDIS ${c.ndisNumber}</span>` : ''}</dd></div>
              <div><dt>Issue date</dt><dd>${inv.status === 'draft' ? 'Not issued yet' : fmt.dateFull(inv.issueDate)}</dd></div>
              <div><dt>Due date</dt><dd>${inv.status === 'draft' ? terms + ' days after issue' : fmt.dateFull(inv.dueDate)}</dd></div>
            </dl>
            <div class="doc-scroll"><table class="doc-table">
              <thead><tr><th>Date</th><th>Description</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
              <tbody>${lines.map((l) => html`<tr>
                <td class="nowrap">${fmt.date(l.date)}</td>
                <td>${l.description}${l.code ? html`<br><span class="muted small">${l.code}</span>` : ''}</td>
                <td class="num">${l.quantity}${l.unit === 'hour' ? ' hr' : ''}</td>
                <td class="num">${fmt.money(l.rate)}</td>
                <td class="num">${fmt.money(rules.lineAmount(l))}</td>
              </tr>`)}</tbody>
              <tfoot>
                <tr><td colspan="4">GST (occupational therapy is GST free)</td><td class="num">${fmt.money(0)}</td></tr>
                <tr class="total"><td colspan="4">Total</td><td class="num">${fmt.money(total)}</td></tr>
              </tfoot>
            </table></div>
            ${!lines.length ? html`<p class="muted" style="margin-top:1rem">This invoice has no lines.</p>` : ''}
            <section class="doc-section"><h2>Payment</h2><p>Please pay by bank transfer within ${terms} days, quoting the invoice number. Bank details: <span class="placeholder">to be confirmed</span></p></section>
            ${inv.notes && status !== 'cancelled' ? html`<section class="doc-section"><h2>Notes</h2><p>${inv.notes}</p></section>` : ''}
            <p class="doc-foot">Allied With You. ABN ${(settings.business || AWY.business).abn}. Fictional record from the demo.</p>
          </article>
        </div>
      `);

      const el = ctx.el;
      AWY.on(el, 'click', '[data-print]', () => C.print());
      AWY.on(el, 'click', '[data-lines]', () => editLines(db, inv));
      AWY.on(el, 'click', '[data-delete]', () => C.confirmDelete({ table: 'invoices', id: inv.id, label: 'draft Invoice ' + inv.number, after: () => AWY.router.go(['invoices']) }));
      AWY.on(el, 'click', '[data-issue]', async () => {
        if (!lines.length) return AWY.ui.toast('Add at least one line before issuing.', { tone: 'error' });
        const ok = await AWY.ui.confirm({ title: 'Issue Invoice ' + inv.number + '?', message: 'This marks the invoice as issued today with a due date ' + terms + ' days from now. In the demo nothing is emailed to ' + inv.billToName + '.', confirmLabel: 'Mark as issued' });
        if (ok) C.save(store.update('invoices', inv.id, { status: 'issued', issueDate: today, dueDate: D.addDays(today, terms) }), 'Invoice ' + inv.number + ' marked as issued. Nothing was emailed.');
      });
      AWY.on(el, 'click', '[data-pay]', () => {
        C.openForm({
          title: 'Record payment',
          subtitle: 'Invoice ' + inv.number + ', ' + fmt.money(total) + '. This only updates the demo record. No money moves.',
          fields: [
            { name: 'paidDate', label: 'Date paid', type: 'date', required: true },
            { name: 'paymentMethod', label: 'Method', type: 'select', options: C.options('paymentMethod'), required: true }
          ],
          values: { paidDate: today, paymentMethod: inv.billTo === 'planmanager' ? 'planmanager' : inv.billTo === 'provider' ? 'provider' : 'transfer' },
          db: db,
          submitLabel: 'Record payment',
          async onSubmit(v) {
            await store.update('invoices', inv.id, Object.assign(v, { status: 'paid' }), { summary: 'Recorded payment for Invoice ' + inv.number });
            AWY.ui.toast('Payment recorded in the demo. No money has moved.');
          }
        });
      });
      AWY.on(el, 'click', '[data-cancel]', async () => {
        const ok = await AWY.ui.confirm({ title: 'Cancel Invoice ' + inv.number + '?', message: 'The invoice is kept for the record but marked as cancelled. Its services go back to verified so they can be invoiced again.', confirmLabel: 'Cancel invoice', danger: true });
        if (!ok) return;
        for (const l of lines.filter((x) => x.supportLogId)) {
          await store.update('supportLogs', l.supportLogId, { status: 'verified', invoiceId: null }, { audit: false, instant: true });
        }
        await C.save(store.update('invoices', inv.id, { status: 'cancelled', notes: 'Cancelled on ' + fmt.date(today) + '.' }), 'Invoice cancelled. Its services can be invoiced again.');
      });
    }
  };
})();
