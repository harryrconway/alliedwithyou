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
    private: { icon: 'wallet', title: 'Paying privately', text: "Anyone can see us privately, and you don't need a referral. We'll always confirm costs with you before we start.", href: 'contact.html', link: 'Ask us about costs' }
  };

  function picks(a) {
    const list = [];
    if (a.ndis === 'self' || a.ndis === 'plan') list.push('ndis');
    if (a.ndis === 'agency') list.push('agency');
    if (a.aged === 'approved') list.push('approved');
    if (a.aged === 'waiting') list.push('waiting');
    list.push('private');
    return list;
  }

  function answers() {
    const a = {};
    ['ndis', 'aged'].forEach((name) => {
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
    const total = Object.keys(a).length;
    out.innerHTML = String(html`${answered < total ? html`<p class="helper-note">${total - answered === 1 ? 'One more question' : total - answered + ' more questions'} to go. Here's what fits so far.</p>` : ''}
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
