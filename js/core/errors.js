/*
  Shared error handling for the staff dashboard.

  Every failure gets a short reference the person can quote, a clear message about what
  happened and what to do next, and a safe diagnostic record. Diagnostics never include
  record contents, passwords, tokens or personal details. If logging itself fails, the
  dashboard carries on and keeps a few events to send later.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  const QUEUE_KEY = 'awy.errors.queue';
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let logging = false;
  let recent = [];

  function ref() {
    let out = '';
    const bytes = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    for (let i = 0; i < 6; i += 1) out += CHARS[bytes[i] % CHARS.length];
    return out;
  }

  /* Removes anything that could identify a person, then shortens it */
  function scrub(text) {
    return String(text || '')
      .replace(/[\w.+]+@[\w.]+\.\w+/g, '[email]')
      .replace(/\b\d[\d\s]{6,}\d\b/g, '[number]')
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
      .replace(/sb_(publishable|secret)_\w+/g, '[key]')
      .slice(0, 300);
  }

  /*
    validation   the person needs to fix something in the form
    permission   their account isn't allowed to do this
    network      the request never reached the server
    uncertain    the request may have reached the server, but no answer came back
    server       the server answered with an error
    unexpected   anything else
  */
  function classify(error, opts) {
    const e = error || {};
    if (e.category) return e.category;
    if (e.errors && Object.keys(e.errors).length) return 'validation';
    const code = String(e.code || '');
    const status = Number(e.status || 0);
    if (code === '42501' || code === 'PGRST301' || status === 401 || status === 403) return 'permission';
    if (code === '23514' || code === '23505' || code === '23P01' || code === '22001' || code === '23502') return 'validation';
    if ((e.name === 'TypeError' || !e.code) && /failed to fetch|networkerror|load failed|network request failed/i.test(e.message || '')) {
      return opts && opts.write ? 'uncertain' : 'network';
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
    if (status >= 500 || /^PGRST/.test(code)) return 'server';
    return 'unexpected';
  }

  /* write is true for a save, so the wording says whether changes were kept */
  const MESSAGES = {
    validation: (r, e) => (e && e.friendly) || 'Some details need checking before this can be saved.',
    permission: (r) => "Your account isn't allowed to do that. If you think it should be, ask an administrator. Reference " + r + '.',
    network: (r, e, write) => (write ? "Your changes couldn't be saved" : "This couldn't be loaded") + ' because the connection dropped. Please check your connection and try again. Reference ' + r + '.',
    uncertain: (r) => "We couldn't confirm whether that saved, because the connection dropped. Please check before trying again. Reference " + r + '.',
    server: (r, e, write) => 'Something went wrong on our side' + (write ? " and your changes weren't saved" : '') + '. Please try again. If it keeps happening, report the issue with reference ' + r + '.',
    unexpected: (r) => 'Something unexpected went wrong. Please try again. If it keeps happening, report the issue with reference ' + r + '.'
  };

  function readQueue() {
    try {
      return JSON.parse(window.sessionStorage.getItem(QUEUE_KEY)) || [];
    } catch (err) {
      return [];
    }
  }

  function writeQueue(list) {
    try {
      window.sessionStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-10)));
    } catch (err) {
      /* storage may be unavailable; the event is simply dropped */
    }
  }

  async function send(event) {
    const client = AWY.client;
    if (!client) throw new Error('No database connection');
    const { error } = await client.rpc('log_error', {
      p_ref: event.ref, p_category: event.category, p_area: event.area, p_operation: event.operation,
      p_message: event.message, p_app_version: event.version, p_fingerprint: event.fingerprint
    });
    if (error) throw error;
  }

  /* Sends queued events, quietly. Never throws and never logs its own failures. */
  async function flush() {
    if (logging) return;
    const queue = readQueue();
    if (!queue.length) return;
    logging = true;
    const left = [];
    for (const event of queue) {
      try {
        await send(event);
      } catch (err) {
        left.push(event);
      }
    }
    writeQueue(left);
    logging = false;
  }

  /*
    Records a failure and returns { ref, category, message } for the screen.
    opts: { area, operation, write } where write marks a save, so a dropped
    connection is reported as an uncertain outcome.
  */
  function capture(error, opts) {
    const o = opts || {};
    if (error && typeof error === 'object') {
      if (error.awyCaptured) return error.awyCaptured;
    }
    const category = classify(error, o);
    const r = ref();
    const message = MESSAGES[category](r, error, !!o.write);
    if (category === 'validation') return { ref: r, category: category, message: message };

    const fingerprint = (o.area || '') + '|' + (o.operation || '') + '|' + category + '|' + String((error && error.code) || '');
    const now = Date.now();
    recent = recent.filter((x) => now - x.at < 60000);
    const repeat = recent.some((x) => x.fingerprint === fingerprint);
    recent.push({ fingerprint: fingerprint, at: now });

    if (!repeat) {
      const event = {
        ref: r, category: category, area: o.area || (window.location.hash || '').split('?')[0].slice(0, 60), operation: o.operation || '',
        message: scrub((error && (error.code ? error.code + ' ' : '') + (error.message || error)) || ''),
        version: (AWY.config && AWY.config.version) || '', fingerprint: fingerprint.slice(0, 64)
      };
      writeQueue(readQueue().concat([event]));
      flush();
    }
    if (window.console) console.error('Reference ' + r, error);
    const result = { ref: r, category: category, message: message };
    if (error && typeof error === 'object') {
      try {
        Object.defineProperty(error, 'awyCaptured', { value: result, enumerable: false });
      } catch (err) {
        /* frozen errors can't be marked */
      }
    }
    return result;
  }

  /* Unexpected script errors anywhere on the page */
  window.addEventListener('error', (event) => {
    if (!event.error) return;
    capture(event.error, { operation: 'unhandled error' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    capture(event.reason || new Error('Unhandled rejection'), { operation: 'unhandled rejection' });
  });

  AWY.errors = { capture: capture, classify: classify, scrub: scrub, flush: flush, ref: ref, messages: MESSAGES };
})();
