/*
  Clinical notes.
  Drafts can be edited. Once finalised, a note is locked and the original text is kept;
  changes are added as corrections with who made them, when and why.
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
  const icon = (n) => raw(AWY.icon(n));

  /* Draft templates, to be reviewed with the therapist before real use */
  const TEMPLATES = {
    session: {
      reason: ['Reason for the session', 'What this session was for'],
      interventions: ['Activities and interventions', 'What you did together, including equipment, strategies and education'],
      observations: ['Observations and findings', 'What you saw and measured, and how the client responded'],
      progress: ['Progress towards goals', 'Any change against the goals addressed, in the client\'s words where possible'],
      plan: ['Recommendations and next steps', 'What happens next and who is responsible']
    },
    initial: {
      reason: ['Reason for referral', 'Who referred and why'],
      interventions: ['Assessment completed', 'Interview, observations and any standardised tools used'],
      observations: ['Key findings', 'Strengths, difficulties and risks'],
      progress: ['Client priorities and goals', 'What the client wants to work on'],
      plan: ['Recommendations and plan', 'Services recommended, frequency and next steps']
    },
    progress: {
      reason: ['Period covered', 'For example, the last three months of therapy'],
      interventions: ['Therapy provided', 'Number and type of sessions, and the main approaches used'],
      observations: ['Current function', 'How the client is managing now'],
      progress: ['Progress against each goal', 'Starting point, current rating and comments for each goal'],
      plan: ['Plan for the next period', 'Changes to goals, frequency or approach']
    },
    discharge: {
      reason: ['Reason for discharge', 'Goals met, client choice, funding ended or another reason'],
      interventions: ['Summary of services', 'What was provided over the whole period'],
      observations: ['Outcomes', 'Function at discharge compared with the start'],
      progress: ['Goals at discharge', 'Status of each goal'],
      plan: ['Recommendations after discharge', 'Self management, equipment care and when to get back in touch']
    }
  };
  const FIELDS = ['reason', 'interventions', 'observations', 'progress', 'plan'];
  const REQUIRED_TO_FINALISE = ['reason', 'interventions', 'observations', 'plan'];

  function scopeNotes(db, user) {
    if (user.role === 'support') return db.notes.filter((n) => n.authorId === user.id || db.appointments.some((a) => a.id === n.appointmentId && a.staffId === user.id));
    return db.notes;
  }

  AWY.views.notes = {
    title: 'Clinical notes',
    render(ctx) {
      const { db, state, today, user } = ctx;
      if (state.status === undefined) state.status = 'all';
      if (state.sort === undefined) state.sort = '-date';
      const wide = user.role === 'owner' || user.role === 'admin';
      const outstanding = rules.notesOutstanding(db, today).filter((x) => wide || x.appointment.staffId === user.id).reverse();
      const notes = scopeNotes(db, user);
      const counts = { draft: notes.filter((n) => n.status === 'draft').length, final: notes.filter((n) => n.status === 'final').length };
      const rows = notes.filter((n) =>
        (state.status === 'all' || n.status === state.status) &&
        (!state.author || n.authorId === state.author) &&
        C.matches(n, state.q, [(x) => rules.clientNameById(db, x.clientId), 'reason', 'plan'])
      );
      const columns = [
        { key: 'date', label: 'Date', sortValue: (n) => n.date, render: (n) => html`${fmt.date(n.date)}<span class="sub">${C.label('noteTemplate', n.template)}</span>` },
        { key: 'client', label: 'Client', sortValue: (n) => rules.clientNameById(db, n.clientId), render: (n) => rules.clientNameById(db, n.clientId) },
        { key: 'reason', label: 'Summary', render: (n) => html`<span style="display:block;max-width:28rem">${n.reason}</span>` },
        { key: 'author', label: 'Author', sortValue: (n) => rules.staffName(db, n.authorId), render: (n) => rules.staffName(db, n.authorId) },
        { key: 'status', label: 'Status', sortValue: (n) => n.status, render: (n) => html`${C.badge('note', n.status)}${(n.amendments || []).length ? html` <span class="tag">${fmt.plural(n.amendments.length, 'correction')}</span>` : ''}` }
      ];

      ctx.el.innerHTML = String(html`
        ${C.pageHead({
          title: 'Clinical notes',
          subtitle: 'Session notes, initial assessment notes, progress updates and discharge summaries.',
          actions: html`<a class="btn" href="#/notes/new">${icon('plus')}New note</a>`
        })}
        <section class="panel" style="margin-bottom:1.5rem" id="outstanding" aria-labelledby="outTitle">
          <div class="panel-head"><h2 id="outTitle">Sessions waiting for a note</h2><p>${wide ? 'Across the practice' : 'Your completed sessions'}</p></div>
          ${outstanding.length ? html`<ul class="rows">${outstanding.map((x) => html`<li>
              <div class="when">${fmt.dateDay(x.appointment.date)}<small>${fmt.time(x.appointment.start)}</small></div>
              <div class="what">${C.clientLink(db, x.appointment.clientId)}<div class="meta"><span>${C.label('appointmentType', x.appointment.type)}</span><span>${rules.staffName(db, x.appointment.staffId)}</span><span>${fmt.relative(x.appointment.date)}</span></div></div>
              <div class="end">${x.note ? html`${C.badge('note', 'draft')}<a class="btn btn-secondary btn-sm" href="#/notes/${x.note.id}">Finish draft</a>` : html`<a class="btn btn-sm" href="#/notes/new?appointment=${x.appointment.id}">Write note</a>`}</div>
            </li>`)}</ul>` : html`<div class="panel-body">${C.empty({ icon: 'checkCircle', title: 'All caught up', text: 'Every completed session has a finalised note.' })}</div>`}
        </section>
        ${C.seg('status', [{ value: 'all', label: 'All', count: notes.length }, { value: 'draft', label: 'Drafts', count: counts.draft }, { value: 'final', label: 'Finalised', count: counts.final }], state.status)}
        <div class="toolbar">
          ${C.search(state.q, 'Search by client or content')}
          ${C.select('author', 'Author', db.staff.filter((s) => s.role !== 'admin').map((s) => ({ value: s.id, label: s.name })), state.author)}
        </div>
        ${C.table({ columns, rows, sort: state.sort, caption: 'Clinical notes', rowHref: (n) => '#/notes/' + n.id, empty: C.empty({ icon: 'note', title: 'No notes match' }) })}
      `);
      C.bindFilters(ctx);
      C.bindRows(ctx.el);
      if (ctx.query.show === 'outstanding' && !ctx.state.scrolled) {
        ctx.state.scrolled = true;
        const target = ctx.el.querySelector('#outstanding');
        if (target) target.scrollIntoView();
      }
    }
  };

  function editor(ctx, note) {
    const { db, user, today, query } = ctx;
    const isNew = !note;
    const appt = isNew ? db.appointments.find((a) => a.id === query.appointment) : db.appointments.find((a) => a.id === note.appointmentId);
    const clientId = isNew ? (appt ? appt.clientId : query.client || '') : note.clientId;
    const client = rules.client(db, clientId);
    const values = note || {
      template: appt && appt.type === 'initial' ? 'initial' : 'session',
      date: appt ? appt.date : today,
      appointmentId: appt ? appt.id : '',
      goalIds: appt ? appt.goalIds || [] : [],
      reason: '', interventions: '', observations: '', progress: '', plan: '', followUp: ''
    };
    const tpl = TEMPLATES[values.template] || TEMPLATES.session;
    const goals = client ? db.goals.filter((g) => g.clientId === client.id && (g.status === 'active' || g.status === 'planned' || (values.goalIds || []).includes(g.id))) : [];
    const appts = client ? db.appointments.filter((a) => a.clientId === client.id && a.status === 'completed').sort((a, b) => b.date.localeCompare(a.date)) : [];

    return html`
      ${C.pageHead({
        back: { href: client ? '#/clients/' + client.id + '/notes' : '#/notes', label: client ? rules.clientName(client) : 'Clinical notes' },
        title: isNew ? 'New clinical note' : 'Draft ' + C.label('noteTemplate', note.template).toLowerCase(),
        subtitle: client ? rules.clientName(client) + (appt ? ', ' + C.label('appointmentType', appt.type).toLowerCase() + ' on ' + fmt.dateLong(appt.date) : '') : 'Choose the client first'
      })}
      <div class="notice" style="margin-bottom:1.25rem">${icon('info')}<div>These templates are drafts for the therapist to review. Drafts can be edited. Once a note is finalised it is locked, and any later changes are added as corrections alongside the original.</div></div>
      <form class="panel" id="noteForm" novalidate>
        <div class="panel-body form">
          <div class="form-summary"></div>
          <div class="form-grid">
            ${!client ? C.field({ name: 'clientId', label: 'Client', type: 'client', required: true }, '', db, 'n_') : ''}
            <div class="field">
              <label for="n_template">Note type</label>
              <select class="select" id="n_template" name="template">${C.options('noteTemplate').map((o) => html`<option value="${o.value}" ${raw(o.value === values.template ? 'selected' : '')}>${o.label}</option>`)}</select>
            </div>
            <div class="field"><label for="n_date">Date of service</label><input class="input" type="date" id="n_date" name="date" value="${values.date}" required></div>
            ${client ? html`<div class="field">
              <label for="n_appt">Appointment</label>
              <select class="select" id="n_appt" name="appointmentId">
                <option value="">Not linked to an appointment</option>
                ${appts.map((a) => html`<option value="${a.id}" ${raw(a.id === values.appointmentId ? 'selected' : '')}>${fmt.dateDay(a.date)}, ${C.label('appointmentType', a.type).toLowerCase()}</option>`)}
              </select>
            </div>` : ''}
            ${goals.length ? html`<fieldset class="field span-all"><legend>Goals addressed</legend><div class="choices">
              ${goals.map((g) => html`<label class="choice"><input type="checkbox" name="goalIds" value="${g.id}" ${raw((values.goalIds || []).includes(g.id) ? 'checked' : '')}> ${g.description}</label>`)}
            </div></fieldset>` : ''}
            ${FIELDS.map((f) => html`<div class="field span-all">
              <label for="n_${f}" data-label-for="${f}">${tpl[f][0]}</label>
              <textarea class="textarea" id="n_${f}" name="${f}" rows="${f === 'reason' ? 2 : 4}" aria-describedby="n_${f}Hint" ${raw(f === 'reason' ? 'required' : '')}>${values[f] || ''}</textarea>
              <p class="hint" id="n_${f}Hint" data-hint-for="${f}">${tpl[f][1]}</p>
            </div>`)}
            <div class="field span-all"><label for="n_followUp">Follow up required <span class="optional">(optional)</span></label><input class="input" id="n_followUp" name="followUp" value="${values.followUp || ''}"></div>
          </div>
        </div>
        <div class="modal-foot" style="border-radius:0 0 var(--radius) var(--radius)">
          ${!isNew ? html`<button type="button" class="btn btn-danger spacer" data-delete-draft>${icon('trash')}Delete draft</button>` : ''}
          <button type="submit" class="btn btn-secondary" name="intent" value="draft">Save draft</button>
          <button type="submit" class="btn" name="intent" value="final">${icon('lock')}Finalise note</button>
        </div>
      </form>
      <p class="small muted" style="margin-top:1rem">Author: ${isNew ? user.name : rules.staffName(db, note.authorId)}${!isNew ? '. Last saved ' + fmt.stamp(note.updatedAt) : ''}.</p>`;
  }

  function readOnly(ctx, note) {
    const { db } = ctx;
    const client = rules.client(db, note.clientId);
    const appt = db.appointments.find((a) => a.id === note.appointmentId);
    const tpl = TEMPLATES[note.template] || TEMPLATES.session;
    const goals = db.goals.filter((g) => (note.goalIds || []).includes(g.id));
    return html`
      <div class="doc-actions">
        <a class="back-link" style="margin:0" href="${client ? '#/clients/' + client.id + '/notes' : '#/notes'}">${icon('arrowLeft')}${client ? rules.clientName(client) : 'Clinical notes'}</a>
        <div class="btn-row">
          <button type="button" class="btn btn-secondary" data-print>${icon('printer')}Print</button>
          ${access.can('clinical') ? html`<button type="button" class="btn" data-amend>${icon('edit')}Add correction</button>` : ''}
        </div>
      </div>
      <div class="doc-wrap">
        <article class="doc">
          <p class="muted small">${C.badge('note', 'final')} by ${rules.staffName(db, note.finalisedBy)} on ${fmt.stamp(note.finalisedAt)}</p>
          <h1>${C.label('noteTemplate', note.template)}</h1>
          <dl class="doc-meta">
            <div><dt>Client</dt><dd>${client ? rules.clientFullName(client) : 'Deleted client'}</dd></div>
            <div><dt>Date of service</dt><dd>${fmt.dateFull(note.date)}</dd></div>
            <div><dt>Appointment</dt><dd>${appt ? C.label('appointmentType', appt.type) + ', ' + fmt.timeRange(appt.start, appt.duration) : 'Not linked'}</dd></div>
            <div><dt>Author</dt><dd>${rules.staffName(db, note.authorId)}</dd></div>
          </dl>
          ${goals.length ? html`<section class="doc-section"><h2>Goals addressed</h2><ul>${goals.map((g) => html`<li>${g.description}</li>`)}</ul></section>` : ''}
          ${FIELDS.filter((f) => note[f]).map((f) => html`<section class="doc-section"><h2>${tpl[f][0]}</h2><p>${note[f]}</p></section>`)}
          ${note.followUp ? html`<section class="doc-section"><h2>Follow up required</h2><p>${note.followUp}</p></section>` : ''}
          ${(note.amendments || []).length ? html`<section class="doc-section"><h2>Corrections</h2>
            ${note.amendments.map((am) => html`<div class="amendment"><p class="meta">Added by ${rules.staffName(db, am.by)} on ${fmt.stamp(am.at)}. Reason: ${am.reason}</p><p>${am.text}</p></div>`)}
          </section>` : ''}
          <p class="doc-foot">${icon('lock')} This note is locked. The original wording above is preserved exactly as finalised. Fictional demo record.</p>
        </article>
      </div>`;
  }

  AWY.views.note = {
    title: (ctx) => (ctx.params.id === 'new' ? 'New clinical note' : 'Clinical note'),
    render(ctx) {
      const { db, user, params } = ctx;
      const note = params.id === 'new' ? null : db.notes.find((n) => n.id === params.id);
      if (params.id !== 'new' && !note) {
        ctx.el.innerHTML = String(html`${C.pageHead({ title: 'Note not found', back: { href: '#/notes', label: 'Clinical notes' } })}<p>It may have been deleted or the demo data was reset.</p>`);
        return;
      }
      if (note && note.status === 'final') {
        ctx.el.innerHTML = String(readOnly(ctx, note));
        AWY.on(ctx.el, 'click', '[data-print]', () => C.print());
        AWY.on(ctx.el, 'click', '[data-amend]', () => {
          C.openForm({
            title: 'Add a correction',
            subtitle: 'The original note will stay exactly as it is. Your correction is added underneath with your name and the time.',
            fields: [
              { name: 'reason', label: 'Reason for the correction', type: 'text', required: true, span: 'all', hint: 'For example, wrong date recorded or information left out' },
              { name: 'text', label: 'Correction', type: 'textarea', required: true, span: 'all', rows: 5 }
            ],
            values: {},
            db: db,
            submitLabel: 'Add correction',
            async onSubmit(v) {
              await store.amendNote(note.id, v.reason, v.text);
              AWY.ui.toast('Correction added. The original note is unchanged.');
            }
          });
        });
        return;
      }

      ctx.el.innerHTML = String(editor(ctx, note));
      const form = ctx.el.querySelector('#noteForm');
      AWY.validate.live(form);

      /* Changing the template updates the prompts without losing what has been typed */
      form.elements.template.addEventListener('change', () => {
        const tpl = TEMPLATES[form.elements.template.value];
        FIELDS.forEach((f) => {
          form.querySelector('[data-label-for="' + f + '"]').textContent = tpl[f][0];
          form.querySelector('[data-hint-for="' + f + '"]').textContent = tpl[f][1];
        });
      });

      const del = ctx.el.querySelector('[data-delete-draft]');
      if (del) del.addEventListener('click', () => C.confirmDelete({ table: 'notes', id: note.id, label: 'this draft note', after: () => AWY.router.go(['notes']) }));

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const intent = event.submitter ? event.submitter.value : 'draft';
        const custom = (v) => {
          if (intent !== 'final') return {};
          const errs = {};
          REQUIRED_TO_FINALISE.forEach((f) => {
            if (!v[f]) errs[f] = 'Needed before the note can be finalised';
          });
          return errs;
        };
        const result = AWY.validate.form(form, custom);
        if (!result.valid) return;
        const v = result.values;
        const goalIds = AWY.$$('input[name="goalIds"]:checked', form).map((i) => i.value);
        const data = {
          template: v.template, date: v.date, appointmentId: v.appointmentId !== undefined ? v.appointmentId || null : note ? note.appointmentId : null,
          goalIds: goalIds, reason: v.reason, interventions: v.interventions, observations: v.observations, progress: v.progress, plan: v.plan, followUp: v.followUp
        };
        if (intent === 'final') {
          const ok = await AWY.ui.confirm({
            title: 'Finalise this note?',
            message: 'Once finalised, the note is locked and can\'t be edited. If something needs fixing later, you can add a correction and the original stays on record.',
            confirmLabel: 'Finalise note'
          });
          if (!ok) return;
        }
        const button = event.submitter || form.querySelector('[type="submit"]');
        try {
          await AWY.ui.busy(button, async () => {
            let saved = note;
            if (!note) {
              const clientId = v.clientId || (data.appointmentId ? db.appointments.find((a) => a.id === data.appointmentId).clientId : '') || ctx.query.client;
              const appt = db.appointments.find((a) => a.id === (data.appointmentId || ctx.query.appointment));
              saved = await store.create('notes', Object.assign(data, {
                clientId: clientId || (appt && appt.clientId), authorId: user.id, status: 'draft', amendments: [], type: appt ? appt.type : 'therapy'
              }));
            } else {
              await store.update('notes', note.id, data);
            }
            if (intent === 'final') {
              await store.update('notes', saved.id, { status: 'final', finalisedAt: D.now(), finalisedBy: user.id }, { action: 'finalised', summary: 'Finalised ' + C.label('noteTemplate', data.template).toLowerCase() + ' for ' + fmt.date(data.date) });
              AWY.ui.toast('Note finalised and locked. Corrections can still be added.');
            } else {
              AWY.ui.toast('Draft saved.');
            }
            if (!note) AWY.router.go(['notes', saved.id]);
          });
        } catch (error) {
          C.showStoreError(form, error);
        }
      });
    }
  };
})();
