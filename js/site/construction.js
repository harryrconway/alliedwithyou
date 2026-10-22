/*
  The under construction page: the places we'll see people take turns in the pill, and the
  colour behind leans gently towards the pointer. Nothing moves for people who ask their
  device for less motion.
*/
(function () {
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (calm) return;

  /* One phrase at a time, the pill easing to the width of each */
  const pill = document.querySelector('.soon-rotate');
  if (pill) {
    const words = Array.from(pill.children);
    let current = 0;
    const fit = (word) => {
      pill.style.width = word.scrollWidth + 30 + 'px';
    };
    fit(words[0]);
    setInterval(() => {
      if (document.hidden) return;
      const leaving = words[current];
      current = (current + 1) % words.length;
      const coming = words[current];
      leaving.classList.remove('is-on');
      leaving.classList.add('is-off');
      coming.classList.remove('is-off');
      coming.classList.add('is-on');
      fit(coming);
      setTimeout(() => leaving.classList.remove('is-off'), 500);
    }, 2600);
  }

  /* The colour leans towards the pointer, on devices that have one */
  if (window.matchMedia('(pointer: fine)').matches) {
    const root = document.body;
    let frame = 0;
    window.addEventListener('pointermove', (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty('--mx', ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty('--my', ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    });
  }
})();
