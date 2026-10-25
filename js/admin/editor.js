/*
  The template editor and the logo library. Administrators only, and the database checks
  that on every save.

  A template is built from sections (see js/admin/docx.js), shown beside a preview of how
  it will print. Saving makes the Word file and keeps it as a new version, along with the
  sections, so it can be opened and changed again. Earlier versions are never changed.

  Logos go in the header. The main logo is part of the website and always available; the
  library holds any others, in a private storage bucket.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const C = AWY.c;
  const store = AWY.store;
  const files = AWY.files;
  const docx = AWY.docx;
  const icon = (n) => raw(AWY.icon(n));

  const MAIN = { src: '../images/wordlogo.png', type: 'image/png', width: 640, height: 465 };

  const KINDS = [
    { type: 'title', label: 'Title' },
    { type: 'heading', label: 'Heading' },
    { type: 'subheading', label: 'Smaller heading' },
    { type: 'text', label: 'Text' },
    { type: 'bullets', label: 'Bullet points' },
    { type: 'ticks', label: 'Tick boxes' },
    { type: 'fields', label: 'Fill in table' },
    { type: 'table', label: 'Table with columns' },
    { type: 'box', label: 'Shaded box' },
    { type: 'space', label: 'Writing space' },
    { type: 'pagebreak', label: 'Page break' }
  ];
  const kindLabel = (type) => (KINDS.find((k) => k.type === type) || { label: type }).label;

  function fresh(type) {
    switch (type) {
      case 'title': return { type: 'title', text: 'Title', lead: '' };
      case 'heading': return { type: 'heading', text: 'New heading' };
      case 'subheading': return { type: 'subheading', text: 'New smaller heading' };
      case 'text': return { type: 'text', text: '', guide: false };
      case 'bullets': return { type: 'bullets', items: [''] };
      case 'ticks': return { type: 'ticks', items: [''] };
      case 'fields': return { type: 'fields', rows: [{ label: 'Name', hint: '' }, { label: 'Date', hint: '' }] };
      case 'table': return { type: 'table', columns: ['Column one', 'Column two', 'Column three'], rows: [['', '', ''], ['', '', '']], labels: false, widths: null };
      case 'box': return { type: 'box', heading: 'Before you start', items: [''] };
      case 'space': return { type: 'space', lines: 4 };
      default: return { type: 'pagebreak' };
    }
  }

  /* Starting points for a new template */

  const LAYOUTS = [
    { value: 'blank', label: 'A blank page with a title' },
    { value: 'form', label: 'A form to fill in' },
    { value: 'letter', label: 'A letter' },
    { value: 'report', label: 'A report' },
    { value: 'agreement', label: 'An agreement' },
    { value: 'checklist', label: 'A checklist' }
  ];

  function layout(key, title) {
    const fields = (labels) => ({ type: 'fields', rows: labels.map((l) => (Array.isArray(l) ? { label: l[0], hint: l[1] } : { label: l, hint: '' })) });
    const heading = (text) => ({ type: 'heading', text: text });
    const sign = [heading('Signature'), fields(['Name', 'Signature', 'Date'])];
    const blank = (cols, n) => Array.from({ length: n }, () => cols.map(() => ''));
    const top = (lead) => ({ type: 'title', text: title, lead: lead || '' });
    switch (key) {
      case 'form':
        return [top('What this form is for, in a sentence.'), heading('About you'), fields(['Full name', 'Date of birth', 'Address', 'Phone', 'Email']),
          heading('Details'), { type: 'text', text: 'Change these to the questions this form needs.', guide: true }, fields(['First question', 'Second question'])].concat(sign);
      case 'letter':
        return [top(), { type: 'text', text: 'Date: ____________________\n\nTo: ____________________\n\nDear ____________________,\n\nWrite the letter here.\n\nKind regards,\n\n____________________\nAllied With You' }];
      case 'report': {
        const area = ['Area', 'What you found', 'How you know'];
        const rec = ['Recommendation', 'Why it is needed', 'How much'];
        return [top('What this report is for.'),
          { type: 'box', heading: 'Before you start', items: ['Grey text is guidance. Delete it before the report goes out.', 'Write so the person can read the report and recognise themselves in it.'] },
          heading('About the person'), fields(['Full name', 'Date of birth', 'Address']),
          heading('Background'), { type: 'text', text: 'Relevant history, living situation and supports.', guide: true }, { type: 'space', lines: 6 },
          heading('Assessment'), { type: 'table', columns: area, rows: blank(area, 3), labels: true, widths: null },
          heading('Summary'), { type: 'space', lines: 6 },
          heading('Recommendations'), { type: 'table', columns: rec, rows: blank(rec, 3), labels: false, widths: null },
          heading('Assessor'), fields(['Name', 'Qualifications', ['Ahpra registration number', 'Three letters then ten numbers'], 'Signature', 'Date'])];
      }
      case 'agreement': {
        const fees = ['Service', 'Rate', 'How often'];
        return [top('Between the client and Allied With You'),
          heading('About this agreement'), { type: 'text', text: 'This agreement sets out the services we will provide, what they cost and how we will work together. Please ask us to explain any part of it.' },
          heading('Client details'), fields(['Client name', 'Date of birth', 'Address', 'Phone', 'Email', 'Representative, if any']),
          heading('What we will do'), { type: 'bullets', items: ['Provide services safely, with care and skill', 'Keep your information private and secure', 'Give you notice in writing before any change'] },
          heading('What we ask of you'), { type: 'bullets', items: ['Tell us about changes to your needs', 'Let us know as early as you can if you need to cancel'] },
          heading('Fees'), { type: 'table', columns: fees, rows: blank(fees, 3), labels: false, widths: null },
          heading('Cancellations'), { type: 'text', text: 'Please give us at least ____________ notice if you need to cancel.' },
          heading('Signatures'), { type: 'subheading', text: 'Client or representative' }, fields(['Name', 'Signature', 'Date']),
          { type: 'subheading', text: 'For Allied With You' }, fields(['Name', 'Signature', 'Date'])];
      }
      case 'checklist':
        return [top('What this checklist is for.'),
          heading('Before'), { type: 'ticks', items: ['First thing to check', 'Second thing to check'] },
          heading('During'), { type: 'ticks', items: ['First thing to check', 'Second thing to check'] },
          heading('After'), { type: 'ticks', items: ['First thing to check', 'Second thing to check'] },
          heading('Completed by'), fields(['Name', 'Date'])];
      default:
        return [top()];
    }
  }

  /* Logos: the library as last seen, the files as data the page can show, and their bytes for Word files */

  const known = new Map();
  const pictures = new Map();
  const bytes = new Map();

  function remember(list) {
    (list || []).forEach((l) => known.set(l.id, l));
  }
  const library = () => Array.from(known.values()).sort((a, b) => a.name.localeCompare(b.name));

  function readAs(blob, how) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      if (how === 'url') reader.readAsDataURL(blob);
      else reader.readAsArrayBuffer(blob);
    });
  }

  async function logoBlob(l) {
    if (!bytes.has(l.id)) bytes.set(l.id, files.download('logos', l.filePath));
    return bytes.get(l.id);
  }

  /* The page's security rules only allow pictures from the site itself or written out as data */
  async function picture(l) {
    if (!pictures.has(l.id)) pictures.set(l.id, logoBlob(l).then((b) => readAs(b, 'url')));
    return pictures.get(l.id);
  }

  /* The logo to put in the Word file, or null for none */
  async function logoFor(content) {
    if (content.logo === 'none') return null;
    const l = content.logo ? known.get(content.logo) : null;
    if (l) {
      const data = new Uint8Array(await readAs(await logoBlob(l), 'buffer'));
      return { data: data, type: l.mimeType, width: l.width, height: l.height };
    }
    content.logo = null;
    const res = await fetch(MAIN.src);
    if (!res.ok) throw new Error('The main logo could not be loaded');
    return { data: new Uint8Array(await res.arrayBuffer()), type: MAIN.type, width: MAIN.width, height: MAIN.height };
  }

  /* The preview, drawn like the printed page */

  const esc = AWY.esc;
  const bold = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const lines = (s) => String(s).split('\n').map(bold).join('<br>');

  function previewBlock(b) {
    switch (b.type) {
      case 'title':
        return '<h1 class="pv-title">' + bold(b.text) + '</h1>' + (b.lead ? '<p class="pv-lead">' + lines(b.lead) + '</p>' : '');
      case 'heading':
        return '<h2 class="pv-heading">' + bold(b.text) + '</h2>';
      case 'subheading':
        return '<h3 class="pv-subheading">' + bold(b.text) + '</h3>';
      case 'text':
        return String(b.text).split(/\n[ \t]*\n/).filter((p) => p.trim()).map((p) => '<p class="' + (b.guide ? 'pv-guide' : 'pv-text') + '">' + lines(p.trim()) + '</p>').join('') ||
          '<p class="pv-empty">Empty text</p>';
      case 'bullets':
        return '<ul class="pv-bullets">' + b.items.filter((i) => i.trim()).map((i) => '<li>' + bold(i) + '</li>').join('') + '</ul>';
      case 'ticks':
        return b.items.filter((i) => i.trim()).map((i) => '<p class="pv-tick"><span aria-hidden="true">☐</span> ' + bold(i) + '</p>').join('');
      case 'fields':
        return '<table class="pv-table pv-fields"><tbody>' + b.rows.map((r) => '<tr><th>' + bold(r.label) + (r.hint ? '<small>' + esc(r.hint) + '</small>' : '') + '</th><td></td></tr>').join('') + '</tbody></table>';
      case 'table':
        return '<table class="pv-table"><thead><tr>' + b.columns.map((h) => '<th>' + bold(h) + '</th>').join('') + '</tr></thead><tbody>' +
          b.rows.map((r) => '<tr>' + r.map((c, i) => (b.labels && i === 0 ? '<th>' + bold(c) + '</th>' : '<td>' + bold(c) + '</td>')).join('') + '</tr>').join('') + '</tbody></table>';
      case 'box':
        return '<div class="pv-box">' + (b.heading ? '<strong>' + bold(b.heading) + '</strong>' : '') + '<ul class="pv-bullets">' + b.items.filter((i) => i.trim()).map((i) => '<li>' + bold(i) + '</li>').join('') + '</ul></div>';
      case 'space':
        return '<div class="pv-space" style="height:' + (b.lines * 1.3) + 'em"></div>';
      case 'pagebreak':
        return '<div class="pv-break"><span>New page</span></div>';
      default:
        return '';
    }
  }

  /* Editing one section */

  function sectionBody(b) {
    const area = (f, value, label, rows) => html`<textarea class="textarea" data-f="${f}" data-lines aria-label="${label}" rows="${rows || Math.max(2, value.length + 1)}">${value.join('\n')}</textarea>`;
    switch (b.type) {
      case 'title':
        return html`<input class="input ed-big" data-f="text" aria-label="Title" maxlength="160" value="${b.text}">
          <input class="input" data-f="lead" aria-label="Line under the title" maxlength="600" placeholder="A line under the title (optional)" value="${b.lead}">`;
      case 'heading':
      case 'subheading':
        return html`<input class="input" data-f="text" aria-label="${kindLabel(b.type)}" maxlength="160" value="${b.text}">`;
      case 'text':
        return html`<div class="ed-texttools"><button type="button" class="btn btn-quiet btn-sm" data-bold title="Make the selected words bold"><strong>B</strong> Bold</button></div>
          <textarea class="textarea" data-f="text" aria-label="Text" rows="${Math.min(14, Math.max(3, b.text.split('\n').length + 1))}">${b.text}</textarea>
          <p class="hint">Leave a blank line to start a new paragraph. Words between two pairs of stars, like **this**, are bold.</p>
          <label class="choice"><input type="checkbox" data-f="guide" ${raw(b.guide ? 'checked' : '')}> Guidance note: grey, smaller text for the person filling it in, to delete before sending</label>`;
      case 'bullets':
      case 'ticks':
        return html`${area('items', b.items, kindLabel(b.type))}<p class="hint">One per line.</p>`;
      case 'fields':
        return html`<div class="ed-rows">${b.rows.map((r, i) => html`<div class="ed-row">
            <input class="input" data-row="${i}" data-k="label" aria-label="Label ${i + 1}" maxlength="200" placeholder="Label" value="${r.label}">
            <input class="input" data-row="${i}" data-k="hint" aria-label="Note under label ${i + 1}" maxlength="300" placeholder="Small note under the label (optional)" value="${r.hint}">
            <button type="button" class="btn btn-quiet btn-icon btn-sm" data-row-remove="${i}" aria-label="Remove row ${i + 1}">${icon('close')}</button>
          </div>`)}</div>
          <button type="button" class="btn btn-secondary btn-sm" data-row-add>${icon('plus')}Add a row</button>`;
      case 'table':
        return html`<label class="choice"><input type="checkbox" data-f="labels" ${raw(b.labels ? 'checked' : '')}> Shade the first column, for labels down the side</label>
          <div class="ed-gridwrap"><table class="ed-grid">
            <thead><tr>${b.columns.map((h, j) => html`<th><div class="ed-cell">
              <input class="input" data-col="${j}" aria-label="Heading for column ${j + 1}" maxlength="120" value="${h}">
              ${b.columns.length > 1 ? html`<button type="button" class="btn btn-quiet btn-icon btn-sm" data-col-remove="${j}" aria-label="Remove column ${j + 1}">${icon('close')}</button>` : ''}
            </div></th>`)}<th class="ed-gridend"></th></tr></thead>
            <tbody>${b.rows.map((r, i) => html`<tr>${r.map((c, j) => html`<td><input class="input" data-cell="${i + ':' + j}" aria-label="Row ${i + 1}, column ${j + 1}" maxlength="400" value="${c}"></td>`)}
              <td class="ed-gridend"><button type="button" class="btn btn-quiet btn-icon btn-sm" data-row-remove="${i}" aria-label="Remove row ${i + 1}">${icon('close')}</button></td></tr>`)}</tbody>
          </table></div>
          <div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-row-add>${icon('plus')}Add a row</button>
            <button type="button" class="btn btn-secondary btn-sm" data-col-add ${raw(b.columns.length >= 8 ? 'disabled' : '')}>${icon('plus')}Add a column</button></div>
          <p class="hint">Leave cells empty for people to write in.</p>`;
      case 'box':
        return html`<input class="input" data-f="heading" aria-label="Heading for the box" maxlength="160" placeholder="Heading (optional)" value="${b.heading}">
          ${area('items', b.items, 'Points in the box')}<p class="hint">One point per line.</p>`;
      case 'space':
        return html`<label class="ed-inline">Lines of space <input class="input" type="number" min="1" max="30" data-f="lines" value="${b.lines}"></label>`;
      default:
        return html`<p class="hint">The next section starts on a new page.</p>`;
    }
  }

  const kindOptions = () => KINDS.map((k) => html`<option value="${k.type}">${k.label}</option>`);

  function card(b, i, count) {
    return html`<li class="ed-block" data-i="${i}">
      <div class="ed-head">
        <span class="ed-kind">${kindLabel(b.type)}</span>
        <span class="ed-tools">
          <button type="button" class="btn btn-quiet btn-icon btn-sm" data-move="-1" aria-label="Move up" ${raw(i === 0 ? 'disabled' : '')}>${icon('chevronUp')}</button>
          <button type="button" class="btn btn-quiet btn-icon btn-sm" data-move="1" aria-label="Move down" ${raw(i === count - 1 ? 'disabled' : '')}>${icon('chevronDown')}</button>
          <button type="button" class="btn btn-quiet btn-icon btn-sm" data-remove aria-label="Remove this section">${icon('trash')}</button>
        </span>
      </div>
      <div class="ed-body">${sectionBody(b)}</div>
      <div class="ed-insert"><select class="select" data-add-below aria-label="Add a section below this one"><option value="">Add a section below</option>${kindOptions()}</select></div>
    </li>`;
  }

  /* Asks what changed, for the version history. Resolves with the note, or null if they go back. */
  function askNote() {
    return new Promise((resolve) => {
      let answered = false;
      const m = C.openForm({
        title: 'Save a new version',
        subtitle: 'The team keeps using the current version until this one is saved. Earlier versions stay in the history.',
        area: 'templates',
        fields: [{ name: 'note', label: 'What changed', type: 'text', required: true, span: 'all', maxlength: 500, hint: 'For example, added a question about pets' }],
        values: {},
        submitLabel: 'Save version',
        async onSubmit(values) {
          answered = true;
          resolve(values.note);
        }
      });
      m.el.addEventListener('close', () => {
        if (!answered) resolve(null);
      });
    });
  }

  const fileName = (title) => String(title).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 190) + '.docx';

  /*
    Opens the editor.
    opts: { template } to edit, or { pending: { title, category, funding, description } } for a new one,
    and content to start from.
  */
  function open(opts) {
    const db = AWY.app.db;
    remember(db.templateLogos);
    const doc = docx.normalise(opts.content || { blocks: layout('blank', (opts.template || opts.pending).title) });
    let template = opts.template || null;
    let dirty = !template;
    const requestId = AWY.uuid();
    const title = () => (template || opts.pending).title;

    const modal = AWY.ui.modal({
      title: template ? 'Edit ' + template.title : 'New template: ' + opts.pending.title,
      subtitle: template ? 'Saving keeps this as a new version. Earlier versions stay in the history.' : 'It is saved as a draft, which only administrators can see.',
      size: 'editor',
      body: html`<div class="ed" data-tab="edit">
        <div class="ed-tabs" role="group" aria-label="Show">
          <button type="button" class="btn btn-secondary btn-sm" data-tab-show="edit" aria-pressed="true">Sections</button>
          <button type="button" class="btn btn-secondary btn-sm" data-tab-show="preview" aria-pressed="false">Preview</button>
        </div>
        <div class="ed-panes">
          <section class="ed-edit" aria-label="Sections">
            <div class="ed-settings">
              <div class="field"><label for="edLogo">Logo</label>
                <div class="ed-logo"><select class="select" id="edLogo" data-set="logo"></select>
                <button type="button" class="btn btn-quiet btn-sm" data-manage-logos>${icon('settings')}Logos</button></div></div>
              <div class="field"><label for="edFooter">Footer</label><input class="input" id="edFooter" data-set="footer" maxlength="200" value="${doc.footer}"></div>
              <label class="choice"><input type="checkbox" data-set="pageNumbers" ${raw(doc.pageNumbers ? 'checked' : '')}> Page numbers in the footer</label>
            </div>
            <ol class="ed-blocks"></ol>
            <div class="ed-insert ed-end"><select class="select" data-add-end aria-label="Add a section at the end"><option value="">Add a section at the end</option>${kindOptions()}</select></div>
          </section>
          <section class="ed-preview" aria-label="Preview"><div class="ed-page"></div></section>
        </div>
      </div>`,
      footer: html`<div class="spacer"><button type="button" class="btn btn-quiet" data-ed-download aria-label="Download a copy">${icon('download')}<span class="ed-long">Download a copy</span><span class="ed-short" aria-hidden="true">Download</span></button></div>
        <button type="button" class="btn btn-secondary" data-ed-cancel>Cancel</button>
        <button type="button" class="btn" data-ed-save>${icon('check')}Save</button>`
    });
    const el = modal.el;
    const list = el.querySelector('.ed-blocks');
    const page = el.querySelector('.ed-page');

    function logoOptions() {
      const select = el.querySelector('#edLogo');
      const options = [{ value: '', label: 'Main logo' }].concat(library().map((l) => ({ value: l.id, label: l.name })), [{ value: 'none', label: 'No logo' }]);
      if (doc.logo && doc.logo !== 'none' && !known.has(doc.logo)) doc.logo = null;
      select.innerHTML = String(html`${options.map((o) => html`<option value="${o.value}" ${raw(o.value === (doc.logo || '') ? 'selected' : '')}>${o.label}</option>`)}`);
    }

    let previewTimer = 0;
    async function preview() {
      clearTimeout(previewTimer);
      let logo = '';
      if (doc.logo !== 'none') {
        const l = doc.logo ? known.get(doc.logo) : null;
        const src = l ? await picture(l).catch(() => '') : MAIN.src;
        if (src) logo = '<img class="pv-logo" alt="" src="' + esc(src) + '">';
      }
      const foot = [doc.footer, doc.pageNumbers ? 'Page 1 of 1' : ''].filter((x) => x).join('   |   ');
      page.innerHTML = logo + (doc.blocks.map(previewBlock).join('') || '<p class="pv-empty">Add a section to start.</p>') + (foot ? '<p class="pv-foot">' + esc(foot) + '</p>' : '');
    }
    const later = () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(preview, 160);
    };

    function draw(focusIndex, selector) {
      list.innerHTML = String(html`${doc.blocks.map((b, i) => card(b, i, doc.blocks.length))}`);
      if (focusIndex != null) {
        const li = list.querySelector('[data-i="' + focusIndex + '"]');
        const target = li && (li.querySelector(selector || 'input, textarea') || li.querySelector('button'));
        if (target) {
          target.focus();
          if (!selector) li.scrollIntoView({ block: 'nearest' });
        }
      }
      preview();
    }

    const changed = () => {
      dirty = true;
      later();
    };
    const at = (node) => {
      const li = node.closest('.ed-block');
      return li ? { li: li, i: Number(li.dataset.i), b: doc.blocks[Number(li.dataset.i)] } : null;
    };

    el.addEventListener('input', (event) => {
      const t = event.target;
      if (t.dataset.set) {
        if (t.dataset.set === 'footer') doc.footer = t.value;
        if (t.dataset.set === 'pageNumbers') doc.pageNumbers = t.checked;
        return changed();
      }
      const s = at(t);
      if (!s) return;
      if (t.dataset.f) {
        if (t.type === 'checkbox') s.b[t.dataset.f] = t.checked;
        else if ('lines' in t.dataset) s.b[t.dataset.f] = t.value.split('\n');
        else if (t.dataset.f === 'lines') s.b.lines = Math.min(30, Math.max(1, Number(t.value) || 1));
        else s.b[t.dataset.f] = t.value;
      } else if (t.dataset.row != null && t.dataset.k) {
        s.b.rows[Number(t.dataset.row)][t.dataset.k] = t.value;
      } else if (t.dataset.col != null) {
        s.b.columns[Number(t.dataset.col)] = t.value;
      } else if (t.dataset.cell) {
        const [r, c] = t.dataset.cell.split(':').map(Number);
        s.b.rows[r][c] = t.value;
      }
      changed();
    });

    el.addEventListener('change', (event) => {
      const t = event.target;
      if (t.dataset.f === 'lines') {
        const s = at(t);
        if (s) t.value = s.b.lines;
        return;
      }
      if (t.dataset.set === 'logo') {
        doc.logo = t.value || null;
        dirty = true;
        return preview();
      }
      if ('addBelow' in t.dataset || 'addEnd' in t.dataset) {
        if (!t.value) return;
        const s = at(t);
        const index = s ? s.i + 1 : doc.blocks.length;
        doc.blocks.splice(index, 0, fresh(t.value));
        dirty = true;
        draw(index);
      }
    });

    AWY.on(el, 'click', '[data-move]', (event, btn) => {
      const s = at(btn);
      const to = s.i + Number(btn.dataset.move);
      if (to < 0 || to >= doc.blocks.length) return;
      doc.blocks.splice(to, 0, doc.blocks.splice(s.i, 1)[0]);
      dirty = true;
      draw(to, '[data-move="' + btn.dataset.move + '"]:not([disabled]), [data-remove]');
    });

    AWY.on(el, 'click', '[data-remove]', (event, btn) => {
      const s = at(btn);
      const removed = doc.blocks.splice(s.i, 1)[0];
      dirty = true;
      draw(Math.min(s.i, doc.blocks.length - 1) >= 0 ? Math.min(s.i, doc.blocks.length - 1) : null, '[data-remove]');
      AWY.ui.toast(kindLabel(removed.type) + ' removed.', {
        action: { label: 'Undo', onClick: () => {
          doc.blocks.splice(s.i, 0, removed);
          draw(s.i);
        } }
      });
    });

    AWY.on(el, 'click', '[data-row-add]', (event, btn) => {
      const s = at(btn);
      if (s.b.type === 'fields') s.b.rows.push({ label: '', hint: '' });
      else s.b.rows.push(s.b.columns.map(() => ''));
      dirty = true;
      draw(s.i, s.b.type === 'fields' ? '[data-row="' + (s.b.rows.length - 1) + '"]' : '[data-cell="' + (s.b.rows.length - 1) + ':0"]');
    });

    AWY.on(el, 'click', '[data-row-remove]', (event, btn) => {
      const s = at(btn);
      s.b.rows.splice(Number(btn.dataset.rowRemove), 1);
      dirty = true;
      draw(s.i, '[data-row-add]');
    });

    AWY.on(el, 'click', '[data-col-add]', (event, btn) => {
      const s = at(btn);
      if (s.b.columns.length >= 8) return;
      s.b.columns.push('');
      s.b.rows.forEach((r) => r.push(''));
      s.b.widths = null;
      dirty = true;
      draw(s.i, '[data-col="' + (s.b.columns.length - 1) + '"]');
    });

    AWY.on(el, 'click', '[data-col-remove]', (event, btn) => {
      const s = at(btn);
      const j = Number(btn.dataset.colRemove);
      s.b.columns.splice(j, 1);
      s.b.rows.forEach((r) => r.splice(j, 1));
      s.b.widths = null;
      dirty = true;
      draw(s.i, '[data-col-add]');
    });

    /* Wraps the selected words in ** so they print in bold */
    AWY.on(el, 'click', '[data-bold]', (event, btn) => {
      const s = at(btn);
      const area = s.li.querySelector('textarea[data-f="text"]');
      const a = area.selectionStart;
      const z = area.selectionEnd;
      if (a === z) return area.focus();
      area.value = area.value.slice(0, a) + '**' + area.value.slice(a, z) + '**' + area.value.slice(z);
      s.b.text = area.value;
      area.focus();
      area.setSelectionRange(a + 2, z + 2);
      changed();
    });

    AWY.on(el, 'click', '[data-tab-show]', (event, btn) => {
      el.querySelector('.ed').dataset.tab = btn.dataset.tabShow;
      AWY.$$('[data-tab-show]', el).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    });

    AWY.on(el, 'click', '[data-manage-logos]', () => logos({ onChange: () => {
      logoOptions();
      preview();
    } }));

    AWY.on(el, 'click', '[data-ed-download]', (event, btn) => AWY.ui.busy(btn, async () => {
      const content = docx.normalise(doc);
      const blob = await C.save((async () => docx.build(content, { title: title(), logo: await logoFor(content) }))(), '', { area: 'templates', operation: 'download a copy' });
      if (blob) AWY.exports.save(fileName(title() + ', unsaved copy'), blob);
    }));

    /* Saves the Word file and the sections as a new version. A file left behind by a failed save is removed. */
    async function saveVersion(content, note) {
      const logo = await logoFor(content);
      if (!template) template = await store.create('templates', Object.assign({}, opts.pending, { status: 'draft' }), { requestId: requestId });
      const blob = docx.build(content, { title: template.title, logo: logo });
      const name = fileName(template.title);
      const path = template.id + '/' + AWY.uuid() + '.docx';
      await files.upload('templates', path, new File([blob], name, { type: docx.MIME }));
      try {
        return await store.create('templateVersions', {
          templateId: template.id, filePath: path, fileName: name, mimeType: docx.MIME, sizeBytes: blob.size, note: note, content: content
        });
      } catch (error) {
        await files.discard('templates', path);
        throw error;
      }
    }

    AWY.on(el, 'click', '[data-ed-save]', async (event, btn) => {
      const content = docx.normalise(doc);
      if (!content.blocks.length) return AWY.ui.toast('Add at least one section before saving.', { tone: 'error' });
      const isNew = !template;
      const note = isNew ? 'First version' : await askNote();
      if (note === null) return;
      const v = await AWY.ui.busy(btn, () => C.save(saveVersion(content, note), '', { area: 'templates', operation: 'save from the editor' }));
      if (!v) return;
      dirty = false;
      modal.close();
      AWY.ui.toast(isNew ? template.title + ' added as a draft.' : 'Version ' + v.versionNo + ' of ' + template.title + ' saved.');
    });

    /* Leaving with unsaved changes asks first */
    async function leave() {
      if (dirty && !(await AWY.ui.confirm({ title: 'Leave without saving?', message: 'The changes you made here will be lost.', confirmLabel: 'Leave without saving', cancelLabel: 'Keep editing', danger: true }))) return;
      dirty = false;
      modal.close();
    }
    el.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]') && dirty) {
        event.stopPropagation();
        leave();
      }
    }, true);
    /* Chrome closes a dialog without asking if Escape is pressed twice with no click in between, so the key is handled here */
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dirty) {
        event.preventDefault();
        leave();
      }
    });
    el.addEventListener('cancel', (event) => {
      if (dirty) {
        event.preventDefault();
        leave();
      }
    });
    AWY.on(el, 'click', '[data-ed-cancel]', () => leave());

    logoOptions();
    draw();
    return modal;
  }

  /* The logo library */

  function logos(opts) {
    const o = opts || {};
    remember(AWY.app.db.templateLogos);
    const modal = AWY.ui.modal({
      title: 'Logos',
      subtitle: 'Pictures for the top of templates. Every template uses the main logo unless it picks another one.',
      size: 'wide',
      body: html`<ul class="rows logo-list"></ul>
        <form class="logo-upload" novalidate>
          <h3>Add a logo</h3>
          <div class="form-summary"></div>
          <div class="form-grid">
            <div class="field"><label for="logoName">Name</label><input class="input" id="logoName" name="name" maxlength="80" required></div>
            <div class="field"><label for="logoFile">Picture</label><input class="input" id="logoFile" name="file" type="file" accept="${files.imageAccept}" required aria-describedby="logoFileHint"><p class="hint" id="logoFileHint">PNG or JPEG, up to 2 MB. A clear picture about 600 pixels wide looks best.</p></div>
          </div>
          <div class="btn-row"><button type="submit" class="btn">${icon('upload')}Add logo</button></div>
        </form>`,
      footer: html`<button type="button" class="btn btn-secondary" data-close>Done</button>`
    });
    const el = modal.el;
    const ul = el.querySelector('.logo-list');

    function draw() {
      ul.innerHTML = String(html`<li>
          <span class="logo-thumb"><img src="${MAIN.src}" alt=""></span>
          <div class="what"><strong>Main logo</strong><div class="meta"><span>Used unless a template picks another</span></div></div>
          <div class="end"><span class="tag">Default</span></div>
        </li>
        ${library().map((l) => html`<li data-logo="${l.id}">
          <span class="logo-thumb"><img alt="" data-picture="${l.id}"></span>
          <div class="what"><strong>${l.name}</strong><div class="meta"><span>${l.width} by ${l.height} pixels</span><span>${AWY.fmt.fileSize(l.sizeBytes)}</span></div></div>
          <div class="end">
            <button type="button" class="btn btn-quiet btn-sm" data-rename="${l.id}">${icon('edit')}Rename</button>
            <button type="button" class="btn btn-quiet btn-sm" data-delete-logo="${l.id}">${icon('trash')}Delete</button>
          </div>
        </li>`)}`);
      library().forEach((l) => picture(l).then((src) => {
        const img = ul.querySelector('[data-picture="' + l.id + '"]');
        if (img) img.src = src;
      }).catch(() => null));
    }

    function size(file) {
      return readAs(file, 'url').then((src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new store.StoreError('That picture could not be read', { category: 'validation', friendly: 'That picture could not be read. Please try a different PNG or JPEG.', errors: { file: 'That picture could not be read' } }));
        img.src = src;
      }));
    }

    const form = el.querySelector('.logo-upload');
    AWY.validate.live(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = AWY.validate.form(form);
      if (!result.valid) return;
      const file = form.elements.file.files[0];
      const button = form.querySelector('[type="submit"]');
      try {
        await AWY.ui.busy(button, async () => {
          const problem = files.checkImage(file);
          if (problem) throw new store.StoreError(problem, { category: 'validation', friendly: problem, errors: { file: problem } });
          const dims = await size(file);
          const ext = file.name.split('.').pop().toLowerCase();
          const path = AWY.uuid() + '.' + ext;
          await files.upload('logos', path, file);
          let row;
          try {
            row = await store.create('templateLogos', { name: result.values.name, filePath: path, mimeType: files.imageTypes[ext], width: dims.width, height: dims.height, sizeBytes: file.size });
          } catch (error) {
            await files.discard('logos', path);
            throw error;
          }
          known.set(row.id, row);
          form.reset();
          form.querySelector('.form-summary').innerHTML = '';
          AWY.ui.toast(row.name + ' added to the logos.');
          draw();
          if (o.onChange) o.onChange();
        });
      } catch (error) {
        C.showStoreError(form, error, '', { area: 'templates', operation: 'add a logo' });
      }
    });

    AWY.on(el, 'click', '[data-rename]', (event, btn) => {
      const l = known.get(btn.dataset.rename);
      C.openForm({
        title: 'Rename logo',
        area: 'templates',
        fields: [{ name: 'name', label: 'Name', type: 'text', required: true, span: 'all', maxlength: 80 }],
        values: { name: l.name },
        submitLabel: 'Save name',
        async onSubmit(values) {
          const row = await store.update('templateLogos', l.id, { name: values.name });
          known.set(row.id, row);
          draw();
          if (o.onChange) o.onChange();
          AWY.ui.toast('Logo renamed.');
        }
      });
    });

    AWY.on(el, 'click', '[data-delete-logo]', async (event, btn) => {
      const l = known.get(btn.dataset.deleteLogo);
      const ok = await AWY.ui.confirm({
        title: 'Delete ' + l.name + '?',
        message: 'Templates that use it will show the main logo the next time they are saved. Word files already saved keep the logo they have.',
        confirmLabel: 'Delete logo',
        danger: true
      });
      if (!ok) return;
      const done = await C.save(store.remove('templateLogos', l.id), l.name + ' deleted.', { area: 'templates', operation: 'delete a logo' });
      if (!done) return;
      await files.discard('logos', l.filePath);
      known.delete(l.id);
      pictures.delete(l.id);
      bytes.delete(l.id);
      draw();
      if (o.onChange) o.onChange();
    });

    draw();
    return modal;
  }

  AWY.editor = { open: open, logos: logos, layout: layout, LAYOUTS: LAYOUTS, KINDS: KINDS };
})();
