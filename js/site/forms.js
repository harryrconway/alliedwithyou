/*
  Website enquiry and referral forms.
  A submission is emailed to the practice through the enquiry function. Nothing is kept
  on the website. If sending fails, the visitor keeps what they typed and is offered the
  practice's email address instead.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const raw = AWY.raw;
  const cfg = AWY.config;
  const email = html`<a href="mailto:${cfg.practiceEmail}">${cfg.practiceEmail}</a>`;

  /* Sends the wording people chose, such as "For myself", rather than the internal values */
  function readable(form, values) {
    const out = Object.assign({}, values);
    AWY.$$('select', form).forEach((el) => {
      if (el.name && el.value) out[el.name] = el.options[el.selectedIndex].text.trim();
    });
    AWY.$$('input[type="radio"]:checked', form).forEach((el) => {
      const label = el.closest('label');
      if (label) out[el.name] = label.textContent.trim();
    });
    if ('consent' in out) out.consent = out.consent ? 'yes' : '';
    return out;
  }

  function problem(form, message) {
    const summary = form.querySelector('.form-summary');
    summary.innerHTML = String(html`<div class="notice notice-danger" role="alert" tabindex="-1">${raw(AWY.icon('alertCircle'))}<div>${message}</div></div>`);
    summary.querySelector('.notice').focus();
  }

  function done(form, kind) {
    const panel = form.closest('.form-panel');
    panel.innerHTML = String(html`<div class="form-done" role="status" tabindex="-1">
      ${raw(AWY.icon('checkCircle'))}
      <h2>Thanks, your ${kind === 'referral' ? 'referral' : 'message'} has been sent</h2>
      <p>${kind === 'referral'
        ? "We'll contact the person, or their representative, and let you know once we've been in touch."
        : "We'll get back to you soon, by your preferred method."}</p>
      <div class="btn-row"><a class="btn btn-secondary" href="">Send another</a></div>
    </div>`);
    panel.querySelector('.form-done').focus();
  }

  async function send(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(cfg.enquiryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data: data };
    } finally {
      clearTimeout(timer);
    }
  }

  AWY.$$('form[data-enquiry]').forEach((form) => {
    const kind = form.dataset.enquiry;
    AWY.validate.live(form);

    /* The NDIS number field only shows when it's relevant */
    const funding = form.elements.fundingType;
    const ndisField = form.querySelector('[data-show-for-ndis]');
    if (funding && ndisField) {
      const sync = () => {
        ndisField.hidden = !String(funding.value).startsWith('ndis');
        if (ndisField.hidden) form.elements.ndisNumber.value = '';
      };
      funding.addEventListener('change', sync);
      sync();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = AWY.validate.form(form, (v) => (kind === 'contact' && v.preferredContact === 'phone' && !v.phone ? { phone: 'Please add a phone number so we can call you back' } : {}));
      if (!result.valid) return;
      form.querySelector('.form-summary').innerHTML = '';
      const button = form.querySelector('[type="submit"]');
      let reply;
      try {
        reply = await AWY.ui.busy(button, () => send(Object.assign({ kind: kind }, readable(form, result.values))));
      } catch (error) {
        problem(form, html`Your ${kind === 'referral' ? 'referral' : 'message'} couldn't be sent, because the connection dropped. Please check your connection and try again, or email us at ${email}. Everything you typed is still here.`);
        return;
      }
      if (reply.status === 200 && reply.data.ok) {
        done(form, kind);
      } else if (reply.status === 429) {
        problem(form, html`Several messages have been sent from this connection in the last hour, so the form is paused for a little while. Please email us at ${email} instead.`);
      } else if (reply.status === 400 && Array.isArray(reply.data.fields) && reply.data.fields.length) {
        reply.data.fields.forEach((name) => {
          const el = form.elements[name];
          if (el) AWY.validate.showError(el.tagName ? el : el[0], 'Please fill this in');
        });
        problem(form, 'Some details are missing. Please check the highlighted fields.');
      } else {
        problem(form, html`Sorry, your ${kind === 'referral' ? 'referral' : 'message'} couldn't be sent just now. Please try again in a few minutes, or email us at ${email}. Everything you typed is still here.`);
      }
    });
  });
})();
