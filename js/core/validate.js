/*
  Form validation shared by the website and the dashboard.
  Rules come from the markup: required, type="email", minlength, min, max,
  and data-rule="phone | postcode | ndis". data-error overrides the message.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  const rules = {
    email(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter an email address like name@example.com';
    },
    phone(v) {
      const digits = v.replace(/[\s()+]/g, '').replace(/^61/, '0');
      return /^\d{8,10}$/.test(digits) ? '' : 'Please enter a phone number, including the area code';
    },
    postcode(v) {
      return /^\d{4}$/.test(v) ? '' : 'Postcodes have four digits';
    },
    ndis(v) {
      return /^\d{9}$/.test(v.replace(/\s/g, '')) ? '' : 'NDIS numbers have nine digits';
    }
  };

  function fieldOf(el) {
    return el.closest('.field') || el.closest('fieldset') || el.parentElement;
  }

  function requiredMessage(el) {
    if (el.type === 'checkbox') return 'Please tick this box to continue';
    if (el.type === 'radio') return 'Please choose one option';
    if (el.tagName === 'SELECT') return 'Please choose an option';
    if (el.type === 'date') return 'Please choose a date';
    return 'Please fill this in';
  }

  function check(el, form) {
    const value = el.type === 'checkbox' || el.type === 'radio' ? null : el.value.trim();

    if (el.required) {
      if (el.type === 'radio') {
        const any = form.querySelector('input[type="radio"][name="' + el.name + '"]:checked');
        if (!any) return el.dataset.error || requiredMessage(el);
        return '';
      }
      if (el.type === 'checkbox' && !el.checked) return el.dataset.error || requiredMessage(el);
      if (value === '') return el.dataset.error || requiredMessage(el);
    }

    if (value === '' || value === null) return '';

    if (el.type === 'email') {
      const msg = rules.email(value);
      if (msg) return msg;
    }
    if (el.dataset.rule && rules[el.dataset.rule]) {
      const msg = rules[el.dataset.rule](value);
      if (msg) return msg;
    }
    if (el.minLength > 0 && value.length < el.minLength) {
      return 'Please write at least ' + el.minLength + ' characters';
    }
    if (el.type === 'number') {
      const n = Number(value);
      if (Number.isNaN(n)) return 'Please enter a number';
      if (el.min !== '' && n < Number(el.min)) return 'Please enter ' + el.min + ' or more';
      if (el.max !== '' && n > Number(el.max)) return 'Please enter ' + el.max + ' or less';
    }
    return '';
  }

  function clearField(el) {
    const field = fieldOf(el);
    if (!field) return;
    field.classList.remove('has-error');
    const existing = field.querySelector(':scope > .field-error');
    if (existing) existing.remove();
    field.querySelectorAll('[aria-invalid]').forEach(function (input) {
      input.removeAttribute('aria-invalid');
      const ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(function (id) {
        return id && !id.endsWith('Error');
      });
      if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
      else input.removeAttribute('aria-describedby');
    });
  }

  function showError(el, message) {
    const field = fieldOf(el);
    if (!field) return;
    clearField(el);
    field.classList.add('has-error');
    const id = (el.id || el.name || AWY.uid('field')) + 'Error';
    const p = document.createElement('p');
    p.className = 'field-error';
    p.id = id;
    p.innerHTML = AWY.icon('alertCircle') + '<span>' + AWY.esc(message) + '</span>';
    field.appendChild(p);
    const inputs = el.type === 'radio' || (el.type === 'checkbox' && field.tagName === 'FIELDSET') ? field.querySelectorAll('input') : [el];
    inputs.forEach(function (input) {
      input.setAttribute('aria-invalid', 'true');
      const ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
      ids.push(id);
      input.setAttribute('aria-describedby', ids.join(' '));
    });
  }

  const validate = {
    /*
      Checks every named control. `custom` can return extra errors as { name: message }.
      Returns { valid, values, errors }.
    */
    form(form, custom) {
      const errors = {};
      let first = null;
      const seen = new Set();
      Array.from(form.elements).forEach(function (el) {
        if (!el.name || el.disabled || el.type === 'hidden' || el.type === 'submit' || el.tagName === 'BUTTON') return;
        if (el.type === 'radio' && seen.has(el.name)) return;
        seen.add(el.name);
        clearField(el);
        const message = check(el, form);
        if (message) {
          errors[el.name] = message;
          showError(el, message);
          if (!first) first = el;
        }
      });

      const values = AWY.formValues(form);
      if (custom) {
        const extra = custom(values) || {};
        Object.keys(extra).forEach(function (name) {
          if (!extra[name] || errors[name]) return;
          errors[name] = extra[name];
          const el = form.elements[name];
          const target = el && el.length !== undefined && !el.tagName ? el[0] : el;
          if (target) {
            showError(target, extra[name]);
            if (!first) first = target;
          }
        });
      }

      const count = Object.keys(errors).length;
      const summary = form.querySelector('.form-summary');
      if (summary) {
        summary.innerHTML = count
          ? '<div class="notice notice-danger" role="alert">' + AWY.icon('alertCircle') + '<div>' +
            (count === 1 ? 'One detail needs checking before this can be saved.' : count + ' details need checking before this can be saved.') +
            '</div></div>'
          : '';
      }
      if (first) first.focus();
      return { valid: count === 0, values: values, errors: errors };
    },

    clear(form) {
      Array.from(form.elements).forEach(function (el) {
        if (el.name) clearField(el);
      });
      const summary = form.querySelector('.form-summary');
      if (summary) summary.innerHTML = '';
    },

    /* Clears a field's error as soon as the person starts fixing it */
    live(form) {
      form.addEventListener('input', function (event) {
        if (event.target.name && fieldOf(event.target).classList.contains('has-error')) clearField(event.target);
      });
      form.addEventListener('change', function (event) {
        if (event.target.name && fieldOf(event.target) && fieldOf(event.target).classList.contains('has-error')) clearField(event.target);
      });
    },

    showError: showError,
    rules: rules
  };

  AWY.validate = validate;
})();
