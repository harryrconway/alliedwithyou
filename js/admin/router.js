/*
  Hash based routing, so every screen has its own address and the browser back
  button works, including when the files are opened straight from the computer.
  Example: #/clients/cl_margaret/notes?from=dashboard
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  function parse() {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const path = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
    const query = {};
    new URLSearchParams(queryPart || '').forEach((value, key) => {
      query[key] = value;
    });
    return { path: path, query: query, key: pathPart || '' };
  }

  function href(path, query) {
    const parts = (Array.isArray(path) ? path : [path]).filter((p) => p !== '' && p !== null && p !== undefined);
    let out = '#/' + parts.map(encodeURIComponent).join('/');
    const q = new URLSearchParams();
    Object.keys(query || {}).forEach((k) => {
      if (query[k] !== '' && query[k] !== null && query[k] !== undefined) q.set(k, query[k]);
    });
    const qs = q.toString();
    return qs ? out + '?' + qs : out;
  }

  function go(path, query) {
    const next = typeof path === 'string' && path.startsWith('#') ? path : href(path, query);
    if (window.location.hash === next) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = next;
    }
  }

  /* Updates the address without loading a new screen, for things like filters */
  function replace(path, query) {
    history.replaceState(null, '', href(path, query));
  }

  AWY.router = { parse: parse, href: href, go: go, replace: replace };
})();
