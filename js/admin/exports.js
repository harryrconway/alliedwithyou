/*
  Spreadsheet downloads, and a copy of everything for administrators.

  A Download button beside a list saves what's on screen. The full copy reads every record
  the person may see straight from the database, a page at a time so nothing is missed,
  and packs a spreadsheet for each area and every template file into one zip file.

  Spreadsheets open in Excel, Numbers or Google Sheets. Text that starts with = + - or @
  gets an apostrophe in front, so a spreadsheet never runs someone's typing as a formula.
  Every download is noted in the change history, as the files hold staff details.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const C = AWY.c;
  const fmt = AWY.fmt;
  const D = AWY.date;
  const rules = AWY.rules;
  const store = AWY.store;
  const access = AWY.access;

  /* Spreadsheets */

  function cell(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return String(value);
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function csv(columns, rows) {
    const lines = [columns.map((c) => cell(c[0])).join(',')].concat(rows.map((r) => columns.map((c) => cell(c[1](r))).join(',')));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  function save(fileName, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* Noted in the change history. A note that fails to save doesn't stop the download. */
  function note(what) {
    try {
      return AWY.client.rpc('log_download', { p_what: what }).then(() => {}, () => {});
    } catch (error) {
      return Promise.resolve();
    }
  }

  /* Saves one list as a spreadsheet named after it and today's date, or the dates it covers */
  function sheet(name, columns, rows, dates) {
    note('Downloaded the ' + name + ' spreadsheet' + (dates ? ' for ' + dates : '') + ', ' + fmt.plural(rows.length, 'row'));
    save(name + ' ' + (dates || D.today()) + '.csv', csv(columns, rows));
  }

  /* One zip file of many, from js/core/zip.js */
  const zip = AWY.zip;

  /* Column definitions: [heading, value(row)]. db is the snapshot, for names and labels. */

  const who = (db, id) => (id ? rules.staffName(db, id) : '');
  const when = (stamp) => (stamp ? fmt.stamp(stamp) : '');
  const day = (iso) => (iso ? fmt.date(iso) : '');

  const COLUMNS = {
    tasks: (db, today) => [
      ['Task', (t) => t.title],
      ['Details', (t) => t.description],
      ['Assigned to', (t) => who(db, t.assignedTo)],
      ['Due', (t) => day(t.dueDate)],
      ['Priority', (t) => C.label('priority', t.priority)],
      ['Status', (t) => AWY.schema.status('task', rules.taskStatus(t, today)).label],
      ['Completed', (t) => when(t.completedAt)],
      ['Completed by', (t) => who(db, t.completedBy)],
      ['Added', (t) => when(t.createdAt)],
      ['Added by', (t) => who(db, t.createdBy)]
    ],
    calendar: (db) => [
      ['Date', (b) => day(b.date)],
      ['Start', (b) => fmt.time(b.start)],
      ['Finish', (b) => fmt.time(D.addMinutes(b.start, Number(b.duration)))],
      ['State or territory', (b) => D.zoneShort(b.timeZone)],
      ['Length in minutes', (b) => Number(b.duration)],
      ['Staff member', (b) => who(db, b.staffId)],
      ['Type', (b) => C.label('blockKind', b.kind)],
      ['Note', (b) => b.note],
      ['Added by', (b) => who(db, b.createdBy)]
    ],
    staff: () => [
      ['Name', (s) => s.name],
      ['Email', (s) => s.email],
      ['Role', (s) => access.roleLabel(s.role)],
      ['Position title', (s) => s.title],
      ['Phone', (s) => s.phone],
      ['AHPRA registration', (s) => s.registration],
      ['Account', (s) => AWY.schema.status('account', s.status).label],
      ['Two step sign in', (s) => (s.mfaEnabled ? 'On' : 'Off')],
      ['Signed up', (s) => when(s.createdAt)]
    ],
    staffChecks: (db, today) => [
      ['Staff member', (c) => who(db, c.staffId)],
      ['Check or document', (c) => C.label('checkKind', c.kind)],
      ['Details', (c) => c.details],
      ['Number or reference', (c) => c.reference],
      ['Issued', (c) => day(c.issuedOn)],
      ['Expires', (c) => day(c.expiresOn)],
      ['Original sighted', (c) => day(c.sightedOn)],
      ['Status', (c) => AWY.schema.status('check', rules.checkStatus(c, today)).label],
      ['Notes', (c) => c.notes]
    ],
    supportItems: () => [
      ['Fee', (i) => i.name],
      ['Fee schedule', (i) => C.label('itemFunding', i.funding)],
      ['Support item or item number', (i) => i.code],
      ['Unit', (i) => C.label('unit', i.unit)],
      ['Rate', (i) => Number(i.rate)],
      ['Applies from', (i) => day(i.effectiveFrom)],
      ['Applies until', (i) => day(i.effectiveTo)],
      ['Notes', (i) => i.notes]
    ],
    templates: (db) => [
      ['Template', (t) => t.title],
      ['Category', (t) => C.label('templateCategory', t.category)],
      ['For', (t) => C.label('templateFunding', t.funding)],
      ['Status', (t) => AWY.schema.status('template', t.status).label],
      ['What it is for', (t) => t.description],
      ['Approved', (t) => when(t.approvedAt)],
      ['Approved by', (t) => who(db, t.approvedBy)],
      ['Last changed', (t) => when(t.updatedAt)]
    ],
    templateVersions: (db, today, extra) => [
      ['Template', (v) => (extra.templates.find((t) => t.id === v.templateId) || {}).title || ''],
      ['Version', (v) => Number(v.versionNo)],
      ['File name', (v) => v.fileName],
      ['Size', (v) => fmt.fileSize(v.sizeBytes)],
      ['Note', (v) => v.note],
      ['Added', (v) => when(v.createdAt)],
      ['Added by', (v) => who(db, v.uploadedBy)]
    ],
    feedback: (db) => [
      ['Reference', (f) => f.ref],
      ['Type', (f) => C.label('feedbackKind', f.kind)],
      ['Summary', (f) => f.title],
      ['Details', (f) => f.description],
      ['Status', (f) => AWY.schema.status('feedback', f.status).label],
      ['Priority', (f) => C.label('ticketPriority', f.priority)],
      ['Assigned to', (f) => who(db, f.assignedTo)],
      ['Reported by', (f) => who(db, f.createdBy)],
      ['Reported', (f) => when(f.createdAt)],
      ['Resolved', (f) => when(f.resolvedAt)],
      ['Reply', (f) => f.response]
    ],
    feedbackNotes: (db, today, extra) => [
      ['Ticket', (n) => (extra.feedback.find((f) => f.id === n.feedbackId) || {}).ref || ''],
      ['Note', (n) => n.body],
      ['Added by', (n) => who(db, n.authorId)],
      ['Added', (n) => when(n.createdAt)]
    ],
    privacyRequests: (db) => [
      ['Reference', (p) => p.ref],
      ['Asking for', (p) => C.label('privacyKind', p.kind)],
      ['Name', (p) => p.requesterName],
      ['Email', (p) => p.requesterEmail],
      ['Phone', (p) => p.requesterPhone],
      ['What they asked', (p) => p.details],
      ['Status', (p) => AWY.schema.status('privacyRequest', p.status).label],
      ['Working on it', (p) => who(db, p.assignedTo)],
      ['Internal notes', (p) => p.internalNotes],
      ['Logged', (p) => when(p.createdAt)],
      ['Logged by', (p) => who(db, p.createdBy)],
      ['Resolved', (p) => when(p.resolvedAt)]
    ],
    auditEvents: (db) => [
      ['When', (e) => when(e.at)],
      ['Who', (e) => (e.actorId ? who(db, e.actorId) : 'Automatic')],
      ['Area', (e) => C.label('auditTable', e.tableName)],
      ['What happened', (e) => e.summary],
      ['Fields changed', (e) => (e.fields || []).map((f) => f.replace(/_/g, ' ')).join(', ')]
    ]
  };

  /* Everything that goes into the full copy, in the order listed in the read me */
  const SETS = [
    { name: 'tasks', file: 'Tasks', label: 'Tasks', sort: (a, b) => a.dueDate.localeCompare(b.dueDate) },
    { name: 'calendar', file: 'Calendar', label: 'Calendar entries', sort: (a, b) => a.startsAt.localeCompare(b.startsAt) },
    { name: 'staff', file: 'Team', label: 'Team' },
    { name: 'staffChecks', file: 'Staff checks', label: 'Checks and registrations' },
    { name: 'supportItems', file: 'Fees', label: 'Fees' },
    { name: 'templates', file: 'Templates', label: 'Templates' },
    { name: 'templateVersions', file: 'Template versions', label: 'Template versions' },
    { name: 'feedback', file: 'Tickets', label: 'Feedback and issues' },
    { name: 'feedbackNotes', file: 'Ticket notes', label: 'Private ticket notes' },
    { name: 'privacyRequests', file: 'Privacy requests', label: 'Privacy requests' },
    { name: 'auditEvents', file: 'Change history', label: 'Change history' }
  ];

  function settingsRows(s) {
    const b = s.business || {};
    const list = (key, values) => (values || []).map((v) => C.label(key, v)).join(', ');
    const rows = [
      ['Practice name', b.name], ['Email', b.email], ['Phone', b.phone], ['ABN', b.abn], ['Postal address', b.postal], ['Service area', b.areaDetail],
      ['Services offered', list('service', s.services)], ['Funding accepted', list('fundingType', s.acceptedFunding)],
      ['Working day starts', fmt.time(s.dayStart)], ['Working day ends', fmt.time(s.dayEnd)],
      ['Gap between visits, minutes', s.travelBuffer], ['Invoice payment terms, days', s.invoiceTerms],
      ['Usual time zone', C.label('timeZone', s.defaultTimeZone)], ['Two step sign in required for', s.mfaFor === 'everyone' ? 'Everyone' : 'Administrators']
    ];
    C.options('appointmentType').forEach((o) => rows.push([o.label + ', minutes', (s.durations || {})[o.value]]));
    return rows.filter((r) => r[1] !== undefined && r[1] !== '');
  }

  const safeName = (text) => String(text || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

  /*
    Reads everything, then saves one zip file. progress(text) reports each step.
    Returns what was included, so the screen can say so.
  */
  async function everything(db, progress) {
    const say = progress || function () {};
    const today = D.today();
    const encoder = new TextEncoder();
    const files = [];
    const data = {};
    for (const set of SETS) {
      say('Reading ' + set.label.toLowerCase());
      data[set.name] = await store.all(set.name);
    }
    const settings = await store.settings();
    store.placeBlocks(data.calendar, settings.defaultTimeZone);
    const counts = [];
    SETS.forEach((set) => {
      const rows = set.sort ? data[set.name].slice().sort(set.sort) : data[set.name];
      files.push({ name: set.file + '.csv', data: encoder.encode(csv(COLUMNS[set.name](db, today, data), rows)) });
      counts.push(set.label + ': ' + rows.length);
    });
    files.push({ name: 'Practice settings.csv', data: encoder.encode(csv([['Setting', (r) => r[0]], ['Value', (r) => r[1]]], settingsRows(settings))) });

    /* Every version of every template, in a folder for each template */
    const used = {};
    let n = 0;
    for (const v of data.templateVersions) {
      n += 1;
      say('Copying template file ' + n + ' of ' + data.templateVersions.length);
      const t = data.templates.find((x) => x.id === v.templateId) || {};
      let path = 'Template files/' + safeName(t.title) + '/Version ' + v.versionNo + ', ' + safeName(v.fileName);
      while (used[path]) path = path.replace(/(\.[^.\/]+)?$/, ' again$1');
      used[path] = true;
      const link = await AWY.files.link('templates', v.filePath);
      const res = await fetch(link);
      if (!res.ok) throw new Error('A template file could not be read');
      files.push({ name: path, data: new Uint8Array(await res.arrayBuffer()) });
    }
    counts.push('Template files: ' + data.templateVersions.length);

    const me = access.user();
    const readme = [
      'Allied With You practice dashboard',
      'A copy of everything in the dashboard, downloaded ' + fmt.stamp(new Date().toISOString()) + ' by ' + (me.name || me.email) + '.',
      '',
      'Each spreadsheet opens in Excel, Numbers or Google Sheets. Template files holds every version of every template.',
      'Calendar times are in the state or territory each entry was booked in.',
      '',
      counts.join('\r\n'),
      '',
      'This file includes staff contact details, check numbers and the details of anyone who made a privacy request. Keep it somewhere private, such as the practice\'s own storage, and delete old copies you no longer need.'
    ].join('\r\n');
    files.unshift({ name: 'Read me.txt', data: encoder.encode(readme + '\r\n') });

    say('Saving the zip file');
    await note('Downloaded a copy of everything, ' + fmt.plural(files.length, 'file'));
    save('Allied With You dashboard ' + today + '.zip', zip(files));
    return { files: files.length, templates: data.templateVersions.length };
  }

  AWY.exports = { csv, save, sheet, zip, note, COLUMNS, SETS, everything };
})();
