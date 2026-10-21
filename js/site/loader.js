/*
  The home page's loading screen. Plays once a visit, never again until the browser
  tab or session ends. Reduced motion skips it entirely, since there's nothing left
  to show without the animation.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const KEY = 'awy.homeLoaded';

  function already() {
    try {
      return sessionStorage.getItem(KEY) === 'yes';
    } catch (error) {
      return true;
    }
  }

  function remember() {
    try {
      sessionStorage.setItem(KEY, 'yes');
    } catch (error) {
      /* private browsing or blocked storage: it still plays once, just isn't remembered */
    }
  }

  const el = document.getElementById('loadScreen');
  if (!el) return;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (already() || reduceMotion) {
    el.remove();
    return;
  }
  remember();
  setTimeout(() => {
    el.classList.add('is-done');
    setTimeout(() => el.remove(), 650);
  }, 2000);
})();
