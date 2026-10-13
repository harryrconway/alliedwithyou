/*
  Website enquiry and referral forms.
  In this testing version nothing is emailed or sent anywhere. A submission is saved
  in the demo data inside this browser, so it appears in the demo dashboard as a new referral.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const root = document.body.dataset.root || '';

  const ABOUT_TO_SOURCE = { myself: 'self', family: 'family', professional: 'alliedhealth', coordinator: 'coordinator', other: 'other' };

  function toReferral(kind, v) {
    const base = {
      receivedDate: AWY.date.today(),
      status: 'new',
      kind: kind,
      createdVia: 'website',
      clientId: null,
      assignedTo: '',
      nextAction: kind === 'referral' ? 'Contact the referrer and the client' : 'Reply to the enquiry',
      nextActionDate: AWY.date.addBusinessDays(AWY.date.today(), 2)
    };
    if (kind === 'referral') {
      return Object.assign(base, {
        source: v.referrerRole,
        referrerName: v.referrerName,
        referrerOrg: v.referrerOrg,
        referrerPhone: v.referrerPhone,
        referrerEmail: v.referrerEmail,
        firstName: v.firstName,
        lastName: v.lastName,
        phone: v.phone,
        email: '',
        suburb: v.suburb,
        state: v.state,
        fundingType: v.fundingType === 'unsure' ? '' : v.fundingType,
        ndisNumber: v.ndisNumber,
        service: v.service,
        reason: v.reason,
        consentToContact: v.consent === true,
        notes: 'Submitted through the website referral form.'
      });
    }
    return Object.assign(base, {
      source: ABOUT_TO_SOURCE[v.about] || 'other',
      firstName: v.firstName,
      lastName: v.lastName,
      phone: v.phone,
      email: v.email,
      suburb: v.suburb,
      state: '',
      fundingType: '',
      service: 'unsure',
      reason: v.message,
      preferredContact: v.preferredContact,
      consentToContact: true,
      notes: 'Submitted through the website contact form. Prefers to be contacted by ' + (v.preferredContact || 'email') + '.'
    });
  }

  function done(form, kind, record) {
    const panel = form.closest('.form-panel');
    const what = kind === 'referral' ? 'referral' : 'enquiry';
    panel.innerHTML = String(html`<div class="form-done" role="status" tabindex="-1">
      ${AWY.raw(AWY.icon('checkCircle'))}
      <h2>Thanks, your test ${what} has been saved</h2>
      <p>This is a testing version of the website, so nothing has been emailed or sent to anyone. Your ${what} is stored only in this browser, and it now appears in the demo dashboard as a new referral.</p>
      <div class="btn-row">
        <a class="btn" href="${root}admin/index.html#/referrals/${record.id}">See it in the demo dashboard</a>
        <a class="btn btn-secondary" href="">Fill in another</a>
      </div>
    </div>`);
    panel.querySelector('.form-done').focus();
  }

  AWY.$$('form[data-demo-form]').forEach((form) => {
    const kind = form.dataset.demoForm;
    AWY.validate.live(form);

    /* Show the NDIS number field only when it is relevant */
    const funding = form.elements.fundingType;
    const ndisField = form.querySelector('[data-show-for-ndis]');
    if (funding && ndisField) {
      const sync = () => {
        ndisField.hidden = !String(funding.value).startsWith('ndis');
      };
      funding.addEventListener('change', sync);
      sync();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = AWY.validate.form(form, (v) => (kind === 'contact' && v.preferredContact === 'phone' && !v.phone ? { phone: 'Please add a phone number so we can call you back' } : {}));
      if (!result.valid) return;
      const button = form.querySelector('[type="submit"]');
      try {
        const record = await AWY.ui.busy(button, () => AWY.store.create('referrals', toReferral(kind, result.values), { actor: 'website', summary: 'Received through the website: ' + result.values.firstName + ' ' + result.values.lastName }));
        done(form, kind, record);
      } catch (error) {
        const summary = form.querySelector('.form-summary');
        summary.innerHTML = String(html`<div class="notice notice-danger" role="alert">${AWY.raw(AWY.icon('alertCircle'))}<div>Sorry, that didn't save. ${error.message || ''} Please try again.</div></div>`);
      }
    });
  });

  AWY.hydrateIcons();
})();
