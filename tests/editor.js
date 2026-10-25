/*
  The template editor, the logo library and deleting a template for good, in a real browser
  against the test (staging) project. Also checks the Word files the editor makes are sound,
  and that only administrators can use the logo library or delete a template.
  Everything it creates is removed afterwards. Never runs against production.
  Set SHOTS to a folder to save screenshots of the editor along the way.
*/
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { open } = require('./page');
const { readEnv } = require('./env');
const totp = require('./totp');

/* Reads the files out of a zip written without compression, as the dashboard writes them */
function unzip(buffer) {
  const out = {};
  let i = 0;
  while (buffer.readUInt32LE(i) === 0x04034b50) {
    const size = buffer.readUInt32LE(i + 18);
    const nameLength = buffer.readUInt16LE(i + 26);
    const extra = buffer.readUInt16LE(i + 28);
    const name = buffer.slice(i + 30, i + 30 + nameLength).toString('utf8');
    const start = i + 30 + nameLength + extra;
    out[name] = buffer.slice(start, start + size);
    i = start + size;
  }
  return out;
}

module.exports = async function editor(ctx) {
  const env = readEnv(ctx.root);
  if (!env.STAGING_URL || !env.STAGING_SECRET_KEY) return ['The .env file has no staging project keys, so the editor could not be tested'];
  if (env.STAGING_URL === env.PROD_URL) return ['Refusing to run: the staging address matches production'];

  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };
  const service = createClient(env.STAGING_URL, env.STAGING_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = Date.now().toString(36);
  const password = 'Test' + Math.random().toString(36).slice(2) + 'Aa9!';
  const made = [];
  const cleanup = { templates: [], logos: [] };
  const shots = process.env.SHOTS;
  const shot = async (p, name) => {
    if (!shots) return;
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(shots, name + '.png') });
  };

  async function makeUser(label, profile) {
    const email = 'qa.editor' + label + '.' + stamp + '@example.com';
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'QA ' + label } });
    if (error) throw new Error('Could not create ' + label + ': ' + error.message);
    made.push(data.user.id);
    const { error: e2 } = await service.from('profiles').update(profile).eq('id', data.user.id);
    if (e2) throw new Error('Could not set up ' + label + ': ' + e2.message);
    return { id: data.user.id, email };
  }

  async function toast(p, pattern) {
    return p.waitForSelector('.toast >> text=' + pattern, { timeout: 10000 }).then(() => true, () => false);
  }

  const expected = /ERR_FAILED|Failed to load resource|status of 400|status of 401|status of 403|400 for .*token\?grant_type=password/;
  const pages = [];

  try {
    const admin = await makeUser('admin', { role: 'administrator', status: 'active' });
    const therapist = await makeUser('therapist', { role: 'therapist', status: 'active' });

    /* Only administrators can use the logo library or delete a template, whatever the screens do */
    const asTherapist = createClient(env.STAGING_URL, env.STAGING_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await asTherapist.auth.signInWithPassword({ email: therapist.email, password });
    ok(!signInError, 'The therapist could not sign in for the security checks');
    const { error: logoError } = await asTherapist.from('template_logos').insert({ name: 'QA', file_path: 'qa' + stamp + '.png', mime_type: 'image/png', width: 10, height: 10, size_bytes: 10 });
    ok(logoError, 'A therapist could add a logo');
    const { error: deleteError } = await asTherapist.rpc('delete_template', { target: '00000000-0000-0000-0000-000000000000' });
    ok(deleteError && /administrators/i.test(deleteError.message), 'A therapist was not refused when deleting a template');
    const { error: uploadError } = await asTherapist.storage.from('logos').upload('qa' + stamp + '.png', fs.readFileSync(path.join(ctx.root, 'images', 'touchicon.png')), { contentType: 'image/png' });
    ok(uploadError, 'A therapist could upload a logo file');
    await asTherapist.auth.signOut();

    /* The administrator signs in, setting up two step sign in the first time and using a code after that */
    let key = '';
    async function signIn(pg) {
      await pg.goto(ctx.base + 'admin/', { waitUntil: 'networkidle' });
      await pg.fill('#identifier', admin.email);
      await pg.fill('#password', password);
      await pg.click('#signinForm [type="submit"]');
      if (!key) {
        await pg.waitForSelector('#twoStepSetupForm', { timeout: 12000 });
        key = await pg.getAttribute('[data-twostep-key]', 'data-twostep-key');
        await pg.fill('#setupCode', await totp.fresh(key));
        await pg.click('#twoStepSetupForm [type="submit"]');
      } else {
        await pg.waitForSelector('#twoStepCodeForm', { timeout: 12000 });
        await pg.fill('#signinCode', await totp.fresh(key));
        await pg.click('#twoStepCodeForm [type="submit"]');
      }
      return pg.waitForSelector('h1:has-text("Good")', { timeout: 15000 }).then(() => true, () => false);
    }
    const p = await open(ctx, 1366);
    pages.push(p);
    ok(await signIn(p), 'The administrator could not reach the dashboard');

    /* Every part of a Word file the editor makes is sound XML, and every kind of section comes out */
    const parts = await p.evaluate(() => {
      const content = { blocks: AWY.editor.KINDS.map((k) => ({ type: k.type, text: 'QA ' + k.type + ' & **bold**', lead: 'Lead', items: ['One', 'Two'], rows: k.type === 'fields' ? [{ label: 'Name', hint: 'Hint' }] : [['A', ''], ['B', '']], columns: ['First', 'Second'], labels: true, heading: 'Box', lines: 3 })) };
      const files = AWY.docx.parts(content, { title: 'QA', logo: { data: new Uint8Array([137, 80, 78, 71]), type: 'image/png', width: 640, height: 465 }, watermark: { data: new Uint8Array([137, 80, 78, 71]) } });
      const text = new TextDecoder();
      return files.map((f) => {
        if (!/\.(xml|rels)$/.test(f.name)) return { name: f.name, bad: false };
        const xml = text.decode(f.data);
        return { name: f.name, bad: !!new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror'), xml: f.name === 'word/document.xml' || f.name === 'word/header1.xml' ? xml : '' };
      });
    });
    ok(parts.every((f) => !f.bad), 'A part of the Word file was not sound XML: ' + parts.filter((f) => f.bad).map((f) => f.name).join(', '));
    ok(['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/header1.xml', 'word/media/logo.png', 'word/media/watermark.png'].every((n) => parts.some((f) => f.name === n)), 'The Word file was missing a part');
    ok(/behindDoc="1"/.test((parts.find((f) => f.name === 'word/header1.xml') || {}).xml || ''), 'The faint background logo was not behind the text on every page');
    const body = (parts.find((f) => f.name === 'word/document.xml') || {}).xml || '';
    ok(/QA text &amp; <\/w:t><\/w:r><w:r><w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">bold<\/w:t>/.test(body), 'Bold words or symbols in text did not come out right in the Word file');
    ok(/w:w="11906" w:h="16838"/.test(body) && /w:type="page"/.test(body) && /☐/.test(body), 'The Word file was not A4, or lost its page break or tick boxes');

    /* A new template from the report layout */
    const title = 'QA editor ' + stamp;
    await p.goto(ctx.base + 'admin/#/templates');
    await p.click('.page-head [data-new-template]');
    await p.fill('dialog input[name="title"]', title);
    await p.selectOption('dialog select[name="category"]', 'form');
    ok(!(await p.isVisible('dialog input[name="file"]')), 'The file picker showed for a template built in the editor');
    await p.selectOption('dialog select[name="start"]', 'report');
    await p.click('dialog [type="submit"]');
    await p.waitForSelector('dialog.modal-editor', { timeout: 8000 });
    ok(/QA editor/.test(await p.textContent('.ed-page .pv-title')), 'The preview did not show the new template\'s title');
    ok((await p.$$('.ed-block')).length >= 10, 'The report layout did not start with its sections');
    await shot(p, 'editor');

    /* Change a heading, add tick boxes at the end and a row to a table, and make some words bold */
    await p.fill('.ed-block:nth-child(3) input[data-f="text"]', 'About the client');
    await p.selectOption('[data-add-end]', 'ticks');
    await p.fill('.ed-block:last-child textarea[data-f="items"]', 'Checked the hob\nChecked the rails');
    const tableBlock = await p.$('.ed-block:has(.ed-grid)');
    await (await tableBlock.$('[data-row-add]')).click();
    await p.waitForTimeout(250);
    ok((await p.$eval('.ed-block:has(.ed-grid)', (el) => el.querySelectorAll('tbody tr').length)) === 4, 'Adding a row to a table did not work');
    await p.selectOption('[data-add-end]', 'text');
    const area = '.ed-block:last-child textarea[data-f="text"]';
    await p.fill(area, 'Please read every part');
    await p.$eval(area, (el) => el.setSelectionRange(7, 11));
    await p.click('.ed-block:last-child [data-bold]');
    ok((await p.inputValue(area)) === 'Please **read** every part', 'The Bold button did not mark the selected words');
    await p.waitForTimeout(400);
    ok(await p.isVisible('.ed-page strong:has-text("read")') && await p.isVisible('.ed-page h2:has-text("About the client")') && await p.isVisible('.ed-page .pv-tick:has-text("Checked the rails")'), 'The preview did not follow the changes');

    /* Moving a section up */
    const before = await p.$$eval('.ed-block .ed-kind', (els) => els.map((e) => e.textContent));
    await p.click('.ed-block:last-child [data-move="-1"]');
    const after = await p.$$eval('.ed-block .ed-kind', (els) => els.map((e) => e.textContent));
    ok(after[after.length - 2] === before[before.length - 1], 'Moving a section up did not work');

    await p.click('dialog.modal-editor [data-ed-save]');
    ok(await toast(p, 'added as a draft'), 'Saving a new template from the editor did not work');
    const { data: rows } = await service.from('templates').select('id, status, current_version_id').eq('title', title);
    ok(rows && rows.length === 1 && rows[0].status === 'draft', 'The template made in the editor was not saved as a draft');
    cleanup.templates = (rows || []).map((t) => t.id);
    const id = rows[0].id;
    const { data: v1 } = await service.from('template_versions').select('id, file_path, file_name, content, editable').eq('template_id', id).single();
    ok(v1 && v1.editable && v1.content && v1.content.blocks.some((b) => b.type === 'ticks'), 'The first version did not keep its sections');
    const { data: file1 } = await service.storage.from('templates').download(v1.file_path);
    const word1 = unzip(Buffer.from(await file1.arrayBuffer()));
    ok(word1['word/document.xml'] && /About the client/.test(word1['word/document.xml'].toString()), 'The saved Word file did not have the edited heading');
    ok(word1['word/media/logo.png'] && word1['word/media/logo.png'].equals(fs.readFileSync(path.join(ctx.root, 'images', 'wordlogo.png'))), 'The saved Word file did not have the main logo');
    ok(v1.file_name === title + '.docx', 'The Word file was not named after the template');

    /* The logo library */
    await p.click('.page-head [data-logos]');
    await p.fill('dialog #logoName', 'QA logo ' + stamp);
    await p.setInputFiles('dialog #logoFile', path.join(ctx.root, 'images', 'touchicon.png'));
    await p.click('dialog .logo-upload [type="submit"]');
    ok(await toast(p, 'added to the logos'), 'An administrator could not add a logo');
    const { data: logoRows } = await service.from('template_logos').select('id, file_path, width, height').eq('name', 'QA logo ' + stamp);
    cleanup.logos = logoRows || [];
    ok(logoRows && logoRows.length === 1 && logoRows[0].width > 0, 'The logo was not saved with its size');
    await p.waitForSelector('dialog [data-picture] [src^="data:image"], dialog img[data-picture][src^="data:image"]', { timeout: 8000 }).catch(() => null);
    ok(await p.isVisible('dialog img[data-picture][src^="data:image"]'), 'The logo library did not show the new logo');
    await shot(p, 'logos');
    await p.click('dialog [data-close] >> nth=-1');

    /* Editing it again: a new logo and footer make version 2 */
    await p.waitForTimeout(800);
    await p.click('[data-open-template="' + id + '"] >> nth=0');
    await p.click('dialog [data-act="editor"]');
    await p.waitForSelector('dialog.modal-editor', { timeout: 8000 });
    ok((await p.inputValue('.ed-block:nth-child(3) input[data-f="text"]')) === 'About the client', 'Editing again did not open the saved sections');
    await p.selectOption('#edLogo', logoRows[0].id);
    await p.fill('#edFooter', 'QA footer');
    await p.waitForSelector('.ed-page .pv-logo[src^="data:image"]', { timeout: 8000 }).catch(() => null);
    ok(await p.isVisible('.ed-page .pv-logo[src^="data:image"]'), 'The preview did not show the chosen logo');

    /* Leaving with unsaved changes asks first */
    await p.keyboard.press('Escape');
    ok(await p.waitForSelector('dialog >> text=Leave without saving?', { timeout: 5000 }).then(() => true, () => false), 'Leaving with unsaved changes did not ask first');
    await p.click('dialog >> text=Keep editing');
    ok(await p.isVisible('dialog.modal-editor'), 'Choosing to keep editing closed the editor');

    await p.click('dialog.modal-editor [data-ed-save]');
    await p.fill('dialog input[name="note"]', 'QA logo and footer');
    await p.click('dialog:has(input[name="note"]) [type="submit"]');
    ok(await toast(p, 'Version 2'), 'Saving a second version from the editor did not work');
    const { data: v2 } = await service.from('template_versions').select('file_path, content, note').eq('template_id', id).eq('version_no', 2).single();
    ok(v2 && v2.content.logo === logoRows[0].id && v2.content.footer === 'QA footer' && v2.note === 'QA logo and footer', 'Version 2 did not keep its logo, footer and note');
    const { data: file2 } = await service.storage.from('templates').download(v2.file_path);
    const word2 = unzip(Buffer.from(await file2.arrayBuffer()));
    ok(word2['word/media/logo.png'] && word2['word/media/logo.png'].equals(fs.readFileSync(path.join(ctx.root, 'images', 'touchicon.png'))), 'Version 2 did not have the chosen logo');
    ok(/QA footer/.test((word2['word/footer1.xml'] || '').toString()), 'Version 2 did not have the new footer');

    /* The editor fits a phone, with sections and preview on separate tabs */
    const phone = await open(ctx, 390);
    pages.push(phone);
    ok(await signIn(phone), 'The administrator could not sign in on a phone');
    await phone.goto(ctx.base + 'admin/#/templates', { waitUntil: 'networkidle' });
    await phone.waitForSelector('[data-open-template="' + id + '"]', { timeout: 15000 });
    await phone.click('[data-open-template="' + id + '"] >> nth=0');
    await phone.click('dialog [data-act="editor"]');
    await phone.waitForSelector('dialog.modal-editor', { timeout: 8000 });
    const wide = await phone.$eval('dialog.modal-editor', (d) => d.scrollWidth - d.clientWidth);
    ok(wide <= 1, 'The editor scrolls sideways on a phone');
    await shot(phone, 'phone');
    await phone.click('[data-tab-show="preview"]');
    ok(await phone.isVisible('.ed-page') && !(await phone.isVisible('.ed-blocks')), 'The phone tabs did not switch to the preview');
    await shot(phone, 'phonepreview');

    /* A converted template, if the test project has one, opens with every section and closes without asking when nothing changed */
    const { data: big } = await service.from('templates').select('id').eq('title', 'Functional capacity assessment').maybeSingle();
    if (big) {
      await p.click('[data-open-template="' + big.id + '"] >> nth=0');
      if (await p.isVisible('dialog [data-act="editor"]')) {
        const started = Date.now();
        await p.click('dialog [data-act="editor"]');
        await p.waitForSelector('dialog.modal-editor .ed-block', { timeout: 10000 });
        ok(Date.now() - started < 6000, 'A long template took more than six seconds to open in the editor');
        ok((await p.$$('.ed-block')).length >= 60 && (await p.$$('.ed-page .pv-table')).length >= 20, 'A converted template did not open with all its sections');
        await shot(p, 'converted');
        await p.click('dialog.modal-editor [data-ed-cancel]');
        ok(!(await p.isVisible('dialog.modal-editor')), 'Closing the editor with no changes asked first or stayed open');
      } else {
        await p.click('dialog [data-close] >> nth=0');
      }
    }

    /* Deleting it for good, with a record in Change history */
    await p.click('[data-open-template="' + id + '"] >> nth=0');
    await p.click('dialog [data-act="delete"]');
    await p.click('dialog [data-confirm]');
    ok(await toast(p, title + ' deleted'), 'An administrator could not delete a template');
    const { data: gone } = await service.from('templates').select('id').eq('id', id);
    const { data: goneVersions } = await service.from('template_versions').select('id').eq('template_id', id);
    ok(gone && !gone.length && goneVersions && !goneVersions.length, 'The template or its versions were still there after deleting');
    const { data: left } = await service.storage.from('templates').list(id);
    ok(left && !left.length, 'The template\'s files were still there after deleting');
    const { data: trail } = await service.from('audit_events').select('summary, actor_id').eq('table_name', 'templates').eq('record_id', id).eq('action', 'delete');
    ok(trail && trail.some((t) => t.summary === 'Deleted template for good: ' + title + ', with 2 versions' && t.actor_id === admin.id), 'Change history did not record what was deleted and by whom');

    /* Deleting the logo */
    await p.click('.page-head [data-logos]');
    await p.click('dialog [data-delete-logo="' + logoRows[0].id + '"]');
    await p.click('dialog [data-confirm]');
    ok(await toast(p, 'QA logo ' + stamp + ' deleted'), 'An administrator could not delete a logo');
    const { data: logoLeft } = await service.from('template_logos').select('id').eq('id', logoRows[0].id);
    ok(logoLeft && !logoLeft.length, 'The logo was still there after deleting');

    for (const pg of pages) pg.problems.filter((x) => !expected.test(x)).forEach((x) => failures.push(x));
  } catch (error) {
    failures.push('The check stopped: ' + error.message.split('\n')[0]);
  } finally {
    for (const pg of pages) await pg.close().catch(() => null);
    for (const id of cleanup.templates) {
      const { data: files } = await service.storage.from('templates').list(id);
      if (files && files.length) await service.storage.from('templates').remove(files.map((f) => id + '/' + f.name));
      await service.from('templates').delete().eq('id', id);
    }
    for (const l of cleanup.logos) {
      await service.storage.from('logos').remove([l.file_path]);
      await service.from('template_logos').delete().eq('id', l.id);
    }
    for (const id of made) await service.from('error_events').delete().eq('user_id', id);
    for (const id of made.slice().reverse()) await service.auth.admin.deleteUser(id);
  }
  return failures;
};
