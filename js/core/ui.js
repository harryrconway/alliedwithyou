/* Toast messages, dialogs, confirmations and busy buttons. */
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const html = AWY.html;

  let toastHost = null;

  function toast(message, options) {
    const opts = options || {};
    /* The page body is replaced when someone signs in or out, so the holder is made again if it's gone */
    if (!toastHost || !document.body.contains(toastHost)) {
      toastHost = document.createElement('div');
      toastHost.className = 'toasts';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (opts.tone === 'error' ? ' toast-error' : '');
    el.innerHTML = AWY.icon(opts.tone === 'error' ? 'alertCircle' : 'checkCircle') + '<div>' + AWY.esc(message) +
      (opts.action ? '<br><button type="button" class="toast-action">' + AWY.esc(opts.action.label) + '</button>' : '') + '</div>';
    if (opts.action) {
      el.querySelector('.toast-action').addEventListener('click', () => {
        el.remove();
        opts.action.onClick();
      });
    }
    toastHost.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity 200ms';
      el.style.opacity = '0';
      setTimeout(function () {
        el.remove();
      }, 220);
    }, opts.duration || (opts.action ? 12000 : 5200));
  }

  /*
    Opens a dialog. Pass form: true to wrap the body and footer in a <form>,
    so a submit button in the footer submits it.
    Returns { el, form, body, close }.
  */
  function modal(options) {
    const opts = options || {};
    const returnFocus = document.activeElement;
    const titleId = AWY.uid('dialogTitle');
    const dlg = document.createElement('dialog');
    dlg.className = 'modal' + (opts.size ? ' modal-' + opts.size : '');
    dlg.setAttribute('aria-labelledby', titleId);

    const head = html`<div class="modal-head">
      <div>
        <h2 id="${titleId}">${opts.title}</h2>
        ${opts.subtitle ? html`<p>${opts.subtitle}</p>` : ''}
      </div>
      <button type="button" class="btn btn-quiet btn-icon" data-close aria-label="Close">${AWY.raw(AWY.icon('close'))}</button>
    </div>`;
    const body = html`<div class="modal-body">${opts.body || ''}</div>`;
    const foot = opts.footer ? html`<div class="modal-foot">${opts.footer}</div>` : '';

    if (opts.form) {
      dlg.innerHTML = head + '<form class="modal-form" novalidate style="display:contents">' + body + foot + '</form>';
    } else {
      dlg.innerHTML = head + body + foot;
    }
    document.body.appendChild(dlg);

    const api = {
      el: dlg,
      form: dlg.querySelector('form'),
      body: dlg.querySelector('.modal-body'),
      close: function (value) {
        if (dlg.open) dlg.close(value || '');
      }
    };

    dlg.addEventListener('click', function (event) {
      if (event.target.closest('[data-close]')) api.close();
    });
    dlg.addEventListener('close', function () {
      if (opts.onClose) opts.onClose(dlg.returnValue);
      dlg.remove();
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    });

    if (api.form) AWY.validate.live(api.form);
    dlg.showModal();
    const focusTarget = dlg.querySelector('[autofocus]') || dlg.querySelector('.modal-body input:not([type="hidden"]), .modal-body select, .modal-body textarea');
    if (focusTarget) focusTarget.focus();
    if (opts.onOpen) opts.onOpen(api);
    return api;
  }

  function confirm(options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      let answered = false;
      const m = modal({
        title: opts.title || 'Are you sure?',
        size: 'narrow',
        body: html`<p>${opts.message || ''}</p>${opts.detail ? html`<div class="notice notice-warning" style="margin-top:1rem">${AWY.raw(AWY.icon('alert'))}<div>${opts.detail}</div></div>` : ''}`,
        footer: html`<button type="button" class="btn btn-secondary" data-close>${opts.cancelLabel || 'Cancel'}</button>
          <button type="button" class="btn ${opts.danger ? 'btn-danger-solid' : ''}" data-confirm>${opts.confirmLabel || 'Confirm'}</button>`,
        onClose: function () {
          if (!answered) resolve(false);
        }
      });
      m.el.querySelector('[data-confirm]').addEventListener('click', function () {
        answered = true;
        resolve(true);
        m.close();
      });
      m.el.querySelector('[data-confirm]').focus();
    });
  }

  /* Shows a spinner on a button while the work runs */
  async function busy(button, work) {
    if (!button) return work();
    button.dataset.busy = 'true';
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    try {
      return await (typeof work === 'function' ? work() : work);
    } finally {
      delete button.dataset.busy;
      button.removeAttribute('aria-busy');
      button.disabled = false;
    }
  }

  AWY.ui = { toast: toast, modal: modal, confirm: confirm, busy: busy };
})();
