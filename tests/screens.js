/*
  Every dashboard screen for every role draws without errors, sections a role
  shouldn't see are refused, and every record dialog opens cleanly.
*/
const { open, signIn, route, ADMIN_ROUTES } = require('./page');

const ROLES = { st_hannah: 'owner', st_priya: 'therapist', st_tom: 'admin', st_mia: 'support' };
const DIALOG_SCREENS = ['', 'clients', 'clients/cl_jack', 'clients/cl_jack/details', 'clients/cl_jack/goals', 'clients/cl_jack/records', 'clients/cl_jack/funding', 'referrals/rf_olivia', 'calendar', 'assessments', 'goals', 'documents', 'agreements/cl_aisha_agr', 'funding/plans', 'funding/services', 'funding/prices', 'invoices/in_1041', 'tasks', 'incidents', 'staff'];
const OPENERS = '[data-new-client],[data-new-task],[data-new-appt],[data-new-referral],[data-new-assessment],[data-new-goal],[data-new-report],[data-new-consent],[data-new-document],[data-new-agreement],[data-new-plan],[data-new-incident],[data-new-staff],[data-new-rate],[data-appt],[data-goal],[data-assessment],[data-consent],[data-doc],[data-plan],[data-incident],[data-edit-staff],[data-task-edit],[data-edit-contact],[data-new-contact],[data-edit-client],[data-edit-referral],[data-sign],[data-lines],[data-pay],[data-edit-log]';

module.exports = async function screens(ctx) {
  const failures = [];
  const p = await open(ctx);

  for (const [staffId, role] of Object.entries(ROLES)) {
    await signIn(p, ctx, staffId);
    for (const r of ADMIN_ROUTES) {
      p.problems.length = 0;
      await route(p, r);
      const state = await p.evaluate((hash) => {
        const main = document.querySelector('#main');
        const section = hash.split('/')[0].split('?')[0] || 'dashboard';
        return {
          broken: !main || main.innerText.includes("couldn't be shown"),
          refused: !!main && main.innerText.includes('Not available with this demo role'),
          allowed: AWY.access.canSee(section)
        };
      }, r);
      if (state.broken) failures.push(role + ' #/' + r + ' failed to draw');
      if (state.refused === state.allowed) failures.push(role + ' #/' + r + (state.allowed ? ' was refused but should be allowed' : ' was shown but should be refused'));
      p.problems.forEach((x) => failures.push(role + ' #/' + r + ': ' + x));
    }
  }

  /* Every kind of record dialog, as the owner */
  await signIn(p, ctx, 'st_hannah');
  let opened = 0;
  for (const s of DIALOG_SCREENS) {
    await route(p, s);
    const marks = await p.evaluate((sel) => {
      const seen = new Set();
      const out = [];
      document.querySelectorAll(sel.split(',').map((x) => '#main ' + x).join(',')).forEach((el, i) => {
        const key = Array.from(el.attributes).map((a) => a.name).filter((n) => n.startsWith('data-')).join(',');
        if (!seen.has(key)) {
          seen.add(key);
          el.setAttribute('data-test-open', String(i));
          out.push(i);
        }
      });
      return out;
    }, OPENERS);
    for (const i of marks) {
      p.problems.length = 0;
      const el = await p.$('[data-test-open="' + i + '"]');
      if (!el) continue;
      const what = await el.evaluate((e) => Array.from(e.attributes).filter((a) => a.name.startsWith('data-') && a.name !== 'data-test-open').map((a) => a.name).join(','));
      await el.click();
      await p.waitForTimeout(200);
      if (await p.$('dialog[open]')) {
        opened += 1;
        await p.keyboard.press('Escape');
        await p.waitForTimeout(120);
      } else {
        failures.push('No dialog opened for ' + what + ' on #/' + s);
      }
      p.problems.forEach((x) => failures.push(what + ' on #/' + s + ': ' + x));
      if ((await p.evaluate(() => location.hash)) !== '#/' + s) await route(p, s);
    }
  }
  if (opened < 40) failures.push('Only ' + opened + ' dialogs were opened, expected at least 40');
  await p.close();
  return failures;
};
