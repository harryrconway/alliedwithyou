/* Small DOM helpers and a safe HTML template tag. */
(function () {
  const AWY = (window.AWY = window.AWY || {});

  function Raw(value) {
    this.value = value;
  }
  Raw.prototype.toString = function () {
    return this.value;
  };

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function render(value) {
    if (value === null || value === undefined || value === false) return '';
    if (value instanceof Raw) return value.value;
    if (Array.isArray(value)) return value.map(render).join('');
    return esc(value);
  }

  /* Interpolated values are escaped unless they are themselves html`` results or AWY.raw() */
  AWY.html = function (strings) {
    let out = '';
    for (let i = 0; i < strings.length; i += 1) {
      out += strings[i];
      if (i + 1 < arguments.length) out += render(arguments[i + 1]);
    }
    return new Raw(out);
  };

  AWY.raw = function (value) {
    return new Raw(value === null || value === undefined ? '' : String(value));
  };

  AWY.esc = esc;

  AWY.$ = function (selector, root) {
    return (root || document).querySelector(selector);
  };

  AWY.$$ = function (selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  };

  /* Event delegation: handler receives (event, matchedElement) */
  AWY.on = function (root, type, selector, handler) {
    root.addEventListener(type, function (event) {
      const target = event.target.closest(selector);
      if (target && root.contains(target)) handler(event, target);
    });
  };

  AWY.uid = function (prefix) {
    const rand = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '_' + Date.now().toString(36) + rand;
  };

  /* A random unique id, used to stop retries creating duplicate records */
  AWY.uuid = function () {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    const b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  AWY.debounce = function (fn, wait) {
    let timer;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  };

  /* Reads named form controls into a plain object; checkbox groups become arrays */
  AWY.formValues = function (form) {
    const values = {};
    Array.from(form.elements).forEach(function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') {
        const group = form.querySelectorAll('input[type="checkbox"][name="' + el.name + '"]');
        if (group.length > 1) {
          values[el.name] = values[el.name] || [];
          if (el.checked) values[el.name].push(el.value);
        } else {
          values[el.name] = el.checked;
        }
      } else if (el.type === 'radio') {
        if (el.checked) values[el.name] = el.value;
        else if (!(el.name in values)) values[el.name] = '';
      } else if (el.type === 'number') {
        values[el.name] = el.value === '' ? '' : Number(el.value);
      } else if (el.type !== 'file') {
        values[el.name] = el.value.trim();
      }
    });
    return values;
  };
})();
