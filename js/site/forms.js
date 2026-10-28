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

  /* Free support lines, shown once a form is sent. Every one is national and free to call. */
  const LINES = [
    ['13 11 14', '131114', 'Lifeline, crisis support and suicide prevention, any time'],
    ['1800 022 222', '1800022222', 'healthdirect, talk to a registered nurse, any time'],
    ['1800 737 732', '1800737732', '1800RESPECT, family, domestic and sexual violence, any time'],
    ['1300 22 4636', '1300224636', 'Beyond Blue, anxiety and depression, any time'],
    ['13 92 76', '139276', '13YARN, for Aboriginal and Torres Strait Islander people, any time'],
    ['1800 353 374', '1800353374', 'Elder abuse helpline, for older people and those who care for them']
  ];

  /* What happens after each kind of form */
  const NEXT = {
    contact: {
      title: 'Thanks, your message has been sent',
      lead: "We'll get back to you soon, by your preferred method.",
      steps: [
        ['First', 'Jake or Chelsie reads your message.'],
        ['Then', 'We get in touch to talk about your goals, fees and funding.'],
        ['After that', 'We book your first visit, at home, in the community or by telehealth.']
      ],
      more: ['firstvisit.html', 'Your first appointment']
    },
    referral: {
      title: 'Thanks, your referral has been sent',
      lead: "We'll contact the person, or their representative, and let you know once we've been in touch.",
      steps: [
        ['First', 'Jake or Chelsie reviews the referral.'],
        ['Then', 'We call the person to talk about goals, funding and timing.'],
        ['After that', "We let you know, and send reports when they're ready."]
      ],
      more: ['referrers.html', 'Information for referrers']
    }
  };

  /* Confirms the send, with what happens next and where to get help now. It stays on screen, so there's time to read it. */
  function done(form, kind) {
    clearDraft(kind);
    const panel = form.closest('.form-panel');
    const root = document.body.dataset.root || '';
    const next = NEXT[kind === 'referral' ? 'referral' : 'contact'];
    panel.innerHTML = String(html`<div class="form-done" tabindex="-1">
      <div class="done-alert">
        ${raw(AWY.icon('alert'))}
        <p><strong>If someone is in danger, call <a href="tel:000">000</a> now.</strong> We aren't an emergency service and don't watch messages around the clock.</p>
      </div>
      <div class="done-head">
        <span class="done-tick" aria-hidden="true">${raw(AWY.icon('check'))}</span>
        <div role="status">
          <h2>${next.title}</h2>
          <p>${next.lead}</p>
        </div>
      </div>
      <ul class="done-steps">
        ${next.steps.map((st) => html`<li><span>${st[0]}</span>${st[1]}</li>`)}
      </ul>
      <section class="done-help" aria-labelledby="doneHelp">
        <h3 id="doneHelp">Free, confidential support</h3>
        <ul class="done-lines">
          ${LINES.map((l) => html`<li><a href="tel:${l[1]}"><strong>${l[0]}</strong><span>${l[2]}</span></a></li>`)}
        </ul>
        <p class="done-small">Need an interpreter? Call TIS National on <a href="tel:131450">131 450</a>. Deaf, or find it hard to hear or speak? Use the <a href="https://www.accesshub.gov.au/about-the-nrs" rel="noopener">National Relay Service</a>.</p>
      </section>
      <div class="btn-row">
        <a class="btn" href="${root + next.more[0]}">${next.more[1]}</a>
        <a class="btn btn-secondary" href="${root}index.html">Back to the home page</a>
      </div>
      <p class="done-small">Questions? Email ${email}</p>
    </div>`);
    panel.querySelector('.form-done').focus();
  }

  /*
    Email suggestions. As someone types their email, a list underneath offers to finish it
    with a common provider, and a likely typo such as gmial.com is offered as a fix.
  */
  const DOMAINS = [
    'gmail.com', 'outlook.com', 'icloud.com', 'hotmail.com', 'bigpond.com', 'yahoo.com',
    'outlook.com.au', 'hotmail.com.au', 'live.com.au', 'yahoo.com.au', 'me.com', 'optusnet.com.au',
    'iinet.net.au', 'tpg.com.au', 'bigpond.net.au', 'westnet.com.au', 'internode.on.net', 'live.com',
    'msn.com', 'proton.me', 'protonmail.com', 'aol.com', 'health.qld.gov.au', 'health.nsw.gov.au'
  ];
  const SHOWN = 6;

  function distance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  function emailIdeas(value) {
    const v = value.trim().toLowerCase();
    if (!v || /\s/.test(v)) return { items: [], fix: false };
    const at = v.indexOf('@');
    if (at < 0) return { items: DOMAINS.slice(0, SHOWN).map((d) => v + '@' + d), fix: false };
    const local = v.slice(0, at);
    const typed = v.slice(at + 1);
    if (!local || typed.includes('@')) return { items: [], fix: false };
    if (DOMAINS.includes(typed)) return { items: [], fix: false };
    const starts = DOMAINS.filter((d) => d.startsWith(typed));
    if (starts.length) return { items: starts.slice(0, SHOWN).map((d) => local + '@' + d), fix: false };
    /* No provider starts that way: if it's close to one, it's probably a typo */
    if (typed.length >= 4 && typed.includes('.')) {
      const best = DOMAINS.map((d) => ({ d: d, n: distance(typed, d) })).sort((a, b) => a.n - b.n)[0];
      if (best.n > 0 && best.n <= 2) return { items: [local + '@' + best.d], fix: true };
    }
    return { items: [], fix: false };
  }

  function emailHints(input) {
    const field = input.closest('.field');
    const list = document.createElement('ul');
    list.className = 'email-hints';
    list.id = input.id + 'Hints';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Suggested email addresses');
    list.hidden = true;
    field.classList.add('has-hints');
    input.insertAdjacentElement('afterend', list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);
    const status = document.createElement('p');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    field.appendChild(status);
    let active = -1;
    let items = [];
    const options = () => Array.from(list.querySelectorAll('[role="option"]'));

    const close = () => {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    };
    const highlight = () => {
      options().forEach((li, i) => {
        li.classList.toggle('is-active', i === active);
        li.setAttribute('aria-selected', String(i === active));
      });
      if (active >= 0) input.setAttribute('aria-activedescendant', options()[active].id);
      else input.removeAttribute('aria-activedescendant');
    };
    const choose = (i) => {
      input.value = items[i];
      close();
      status.textContent = 'Email set to ' + items[i];
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const show = () => {
      const result = emailIdeas(input.value);
      items = result.items;
      if (!items.length || document.activeElement !== input) return close();
      list.innerHTML = String(html`${result.fix ? html`<li class="email-hints-note" role="presentation">Did you mean</li>` : ''}${items.map((it, i) => html`<li role="option" id="${list.id + i}" aria-selected="false"><span>${it.slice(0, it.indexOf('@'))}</span><strong>${it.slice(it.indexOf('@'))}</strong></li>`)}`);
      options().forEach((li, i) => {
        li.addEventListener('mousedown', (event) => event.preventDefault());
        li.addEventListener('click', () => choose(i));
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
      highlight();
      status.textContent = items.length + (items.length === 1 ? ' suggestion' : ' suggestions') + ', use the arrow keys to choose';
    };

    input.addEventListener('input', show);
    input.addEventListener('focus', show);
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', (event) => {
      if (list.hidden) return;
      const n = options().length;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        active = (active + 1) % n;
        highlight();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        active = (active - 1 + n) % n;
        highlight();
      } else if ((event.key === 'Enter' || event.key === 'Tab') && active >= 0) {
        if (event.key === 'Enter') event.preventDefault();
        choose(active);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    });
  }

  /*
    What someone has typed is kept in this browser tab until they send it, so a reload or a
    wrong click doesn't lose it. It's cleared once sent, and when the tab is closed.
  */
  const draftKey = (kind) => 'awy.draft.' + kind;

  function saveDraft(form, kind) {
    const data = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name || el.name === 'website' || el.type === 'submit') return;
      if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else if (el.type === 'checkbox') {
        data[el.name] = el.checked;
      } else {
        data[el.name] = el.value;
      }
    });
    try {
      sessionStorage.setItem(draftKey(kind), JSON.stringify(data));
    } catch (error) {
      /* storage blocked: the form still works, it just isn't kept */
    }
  }

  function loadDraft(form, kind) {
    let data = null;
    try {
      data = JSON.parse(sessionStorage.getItem(draftKey(kind)) || 'null');
    } catch (error) {
      data = null;
    }
    if (!data) return false;
    let any = false;
    Object.keys(data).forEach((name) => {
      const el = form.elements[name];
      if (!el) return;
      if (el instanceof RadioNodeList || (el.length && !el.tagName)) {
        Array.from(el).forEach((r) => { r.checked = r.value === data[name]; });
      } else if (el.type === 'checkbox') {
        el.checked = !!data[name];
        any = any || el.checked;
      } else if (el.tagName === 'SELECT') {
        el.value = data[name];
        el.dispatchEvent(new Event('change'));
        any = any || !!data[name];
      } else {
        el.value = data[name];
        any = any || !!data[name];
      }
    });
    return any;
  }

  function clearDraft(kind) {
    try {
      sessionStorage.removeItem(draftKey(kind));
    } catch (error) {
      /* nothing to clear */
    }
  }

  /*
    The preferred therapist and how someone heard about us travel at the end of the message
    (or the reason for a referral), since the enquiry function only sends the fields it knows.
  */
  function withExtras(body, kind) {
    const out = Object.assign({}, body);
    const lines = [];
    if (out.therapist && !/^no preference/i.test(out.therapist)) lines.push('Preferred therapist: ' + out.therapist);
    if (out.heardFrom) lines.push('Heard about us through: ' + out.heardFrom);
    delete out.therapist;
    delete out.heardFrom;
    const field = kind === 'referral' ? 'reason' : 'message';
    if (lines.length && out[field] !== undefined) out[field] = String(out[field]).trim() + '\n\n' + lines.join('\n');
    return out;
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

    /* Once the type of referral is chosen, the funding question only offers the options that fit it */
    const type = form.elements.referralType;
    const fundingSelect = form.elements.fundingType;
    if (type && fundingSelect) {
      const all = Array.from(fundingSelect.options).map((o) => o.cloneNode(true));
      const fit = () => {
        const current = fundingSelect.value;
        fundingSelect.innerHTML = '';
        all.filter((o) => !o.value || !o.dataset.for || !type.value || o.dataset.for === type.value)
          .forEach((o) => fundingSelect.appendChild(o.cloneNode(true)));
        fundingSelect.value = Array.from(fundingSelect.options).some((o) => o.value === current) ? current : '';
        fundingSelect.dispatchEvent(new Event('change'));
      };
      type.addEventListener('change', fit);
      fit();
    }

    AWY.$$('input[type="email"]', form).forEach(emailHints);

    /* Anything typed earlier in this tab comes back, and is kept as they go */
    const restored = loadDraft(form, kind);
    let saving = null;
    form.addEventListener('input', () => {
      clearTimeout(saving);
      saving = setTimeout(() => saveDraft(form, kind), 250);
    });
    form.addEventListener('change', () => saveDraft(form, kind));
    const keep = form.querySelector('[data-draft-note]');
    if (keep) {
      keep.innerHTML = String(html`<span>${restored ? 'We kept what you typed earlier in this tab.' : 'What you type is kept in this tab until you send it.'}</span> <button type="button" class="link-btn" data-clear-draft>Clear the form</button>`);
      keep.querySelector('[data-clear-draft]').addEventListener('click', () => {
        form.reset();
        clearDraft(kind);
        AWY.$$('select', form).forEach((el) => el.dispatchEvent(new Event('change')));
        keep.querySelector('span').textContent = 'The form is clear. What you type is kept in this tab until you send it.';
        const first = form.querySelector('input:not([type="hidden"]):not([tabindex="-1"]), select, textarea');
        if (first) first.focus();
      });
    }

    /* Arriving from "Ask to see Jake" on the team page picks them as the preferred therapist */
    const asked = { jake: 'jake', chelsie: 'chelsie' }[new URLSearchParams(location.search).get('with')];
    if (asked && form.elements.therapist) form.elements.therapist.value = asked;

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
        reply = await AWY.ui.busy(button, () => send(withExtras(Object.assign({ kind: kind }, readable(form, result.values)), kind)));
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
