/*
  Which funding fits me? Shows the ways someone could pay, from their answers, as they
  choose. Everything here stays in the browser; nothing is sent anywhere.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;
  const form = document.querySelector('[data-funding-helper]');
  const out = document.querySelector('[data-funding-results]');
  if (!form || !out) return;
  const icon = (name) => AWY.raw(AWY.icon(name));

  const CARDS = {
    ndis: { icon: 'target', title: 'Your NDIS plan', text: 'Occupational therapy usually comes from Improved Daily Living, in the Capacity Building part of your plan. Equipment and home modifications usually come from the Capital budget.', href: 'ndis.html', link: 'How the NDIS works with us' },
    agency: { icon: 'target', title: 'Your plan is managed by the NDIA', text: "We work with NDIS plans that are self managed or plan managed. Talk to your support coordinator or the NDIA about your options, or you're welcome to see us privately.", href: 'ndis.html', link: 'More about the NDIS and us' },
    approved: { icon: 'heart', title: 'Support at Home', text: "Occupational therapy is a clinical support, so you don't pay a contribution towards it. We invoice your provider at the rate agreed with them. Let your provider know you'd like to see us.", href: 'myagedcare.html#alreadyHaveSupportAt', link: 'Using Support at Home with us' },
    waiting: { icon: 'heart', title: 'While you wait for Support at Home', text: "Waiting for funding to start can take time. If you'd rather not wait, you're welcome to see us privately in the meantime.", href: 'myagedcare.html#seeingUsWhileWait', link: 'Seeing us while you wait' },
    gp: { icon: 'clipboard', title: 'Medicare GP plan', text: 'Medicare pays a rebate towards up to five allied health sessions a year, shared across all the allied health professionals you see. You pay our fee and claim the rebate, or we can help you claim it.', href: 'fees.html#medicareGpPlans', link: 'Medicare GP plans' },
    gpUnsure: { icon: 'clipboard', title: 'Ask your GP about a plan', text: 'If you have a chronic condition, your GP can tell you whether a chronic condition management plan suits you. With one, Medicare pays a rebate towards up to five allied health sessions a year.', href: 'fees.html#medicareGpPlans', link: 'Medicare GP plans' },
    fund: { icon: 'shield', title: 'Private health insurance', text: 'You can claim part of the cost from your fund, and we give you an itemised receipt to claim with. Rebates vary between funds and policies, so check with yours first.', href: 'fees.html#privateHealthInsurance', link: 'Private health insurance' },
    fundUnsure: { icon: 'shield', title: 'Check your extras cover', text: "Many extras policies include occupational therapy. Your fund can tell you what you're covered for and how much you'd get back.", href: 'fees.html#privateHealthInsurance', link: 'Private health insurance' },
    private: { icon: 'wallet', title: 'Paying privately', text: "Anyone can see us privately, and you don't need a referral. We'll always confirm costs with you before we start.", href: 'fees.html#privateFees', link: 'Our fees' }
  };

  function picks(a) {
    const list = [];
    if (a.ndis === 'self' || a.ndis === 'plan') list.push('ndis');
    if (a.ndis === 'agency') list.push('agency');
    if (a.aged === 'approved') list.push('approved');
    if (a.aged === 'waiting') list.push('waiting');
    if (a.gp === 'yes') list.push('gp');
    if (a.gp === 'unsure') list.push('gpUnsure');
    if (a.fund === 'yes') list.push('fund');
    if (a.fund === 'unsure') list.push('fundUnsure');
    list.push('private');
    return list;
  }

  function answers() {
    const a = {};
    ['ndis', 'aged', 'gp', 'fund'].forEach((name) => {
      const r = form.querySelector('input[name="' + name + '"]:checked');
      a[name] = r ? r.value : '';
    });
    return a;
  }

  function render() {
    const a = answers();
    const answered = Object.values(a).filter(Boolean).length;
    if (!answered) {
      out.innerHTML = String(html`<p class="helper-empty">Answer the questions and the options that fit will show here.</p>`);
      return;
    }
    const list = picks(a);
    out.innerHTML = String(html`${answered < 4 ? html`<p class="helper-note">${4 - answered === 1 ? 'One more question' : 4 - answered + ' more questions'} to go. Here's what fits so far.</p>` : ''}
      <ul class="helper-cards">${list.map((k, i) => {
        const c = CARDS[k];
        return html`<li class="helper-card${i === 0 ? ' is-first' : ''}">${icon(c.icon)}<div><h3>${c.title}</h3><p>${c.text}</p><a class="text-link" href="${c.href}">${c.link}${icon('arrowRight')}</a></div></li>`;
      })}</ul>
      <p class="helper-next">Ready when you are: <a href="contact.html">make an enquiry</a>, and tell us how you'd like to pay.</p>`);
  }

  form.addEventListener('change', render);
  form.addEventListener('reset', () => setTimeout(render, 0));
  render();
})();
