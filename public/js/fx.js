// SmartGreen micro-interactions. Watches the app's own DOM; app.js does not need to know about it.
(function () {
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('fx');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ------------------------------------------------ results: reveal on scroll
  function reveal(el) {
    el.classList.add('fx-show');
    el.classList.remove('fx-hide');
    $$('.nut .bar span', el).forEach((b, i) => { if (!b.closest('details:not([open])')) { b.style.setProperty('--fx-d', `${200 + i * 90}ms`); replay(b, 'fx-fill'); } });
    if (io) io.unobserve(el);
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    // Reveal everything that has reached the screen, including sections skipped by a fast scroll
    $$('#resultContent > .fx-hide').forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) reveal(el); });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;

  function animateResults() {
    const box = $('#resultContent');
    if (!box) return;
    const card = $('.primary-card', box);
    if (card) {
      replay(card, 'fx-sweep');
      const g = $('.gauge div.on', card); if (g) replay(g, 'fx-pop');
      const l = $('.lcc-seg.on', card); if (l) replay(l, 'fx-pop');
    }
    if (!io) return;
    let i = 0;
    for (const el of Array.from(box.children)) {
      el.classList.remove('fx-show');
      el.classList.add('fx-hide');
      el.style.setProperty('--fx-d', `${Math.min(i++, 3) * 70}ms`);
      io.observe(el);
    }
  }
  // Bars inside "ปกติ x ธาตุ" fill when it is opened
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open) return;
    $$('.nut .bar span', d).forEach((b, i) => { b.style.setProperty('--fx-d', `${i * 70}ms`); replay(b, 'fx-fill'); });
  }, true);

  // ------------------------------------------------ screens
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target;
      if (el.hidden) continue;
      replay(el, 'fx-enter');
      if (el.id === 'screenResults') animateResults();
      if (el.id === 'screenAnalyzing') el.classList.remove('az-done');
    }
  });
  $$('.screen').forEach((s) => mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }));
  // A result opened from the history page is already on screen before this file runs
  const res = $('#screenResults');
  if (res && !res.hidden) animateResults();

  // Stop the scan line once the progress reaches 100%
  const pct = $('#azPct');
  if (pct) new MutationObserver(() => {
    const az = $('#screenAnalyzing');
    if (az) az.classList.toggle('az-done', pct.textContent.trim() === '100%');
  }).observe(pct, { childList: true, characterData: true, subtree: true });

  // ------------------------------------------------ photo slots
  const cards = $('#leafCards');
  if (cards) {
    let prev = null;
    const state = () => $$('.leaf-card', cards).map((c) => c.classList.contains('ok'));
    const allRequired = () => $$('.leaf-card', cards).every((c) => !$('.req', c) || c.classList.contains('ok'));
    let wasReady = false;
    new MutationObserver(() => {
      const now = state();
      if (prev) $$('.leaf-card', cards).forEach((c, i) => { if (now[i] && !prev[i]) replay(c, 'fx-got'); });
      prev = now;
      const ready = now.length > 0 && allRequired();
      const btn = $('#submitBtn');
      if (btn && ready && !wasReady) replay(btn, 'fx-ready');
      wasReady = ready;
    }).observe(cards, { childList: true });
  }
})();
