// CYBEV Mobile responsive helper (Fold/Small screens)
// Sets viewport CSS vars and applies a few defensive fixes.

(function () {
  function setVars() {
    const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const h = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    document.documentElement.style.setProperty('--vw', w + 'px');
    document.documentElement.style.setProperty('--vh', h + 'px');
  }

  // Fix common cause of "cut off" UI: accidental horizontal overflow
  function hardenOverflow() {
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
  }

  // Optional: add/ensure viewport meta is sane (helps some WebViews)
  function ensureViewportMeta() {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      document.head.appendChild(meta);
    }
    // width=device-width is critical; viewport-fit helps fold/notch safe areas
    const content = meta.getAttribute('content') || '';
    const needed = 'width=device-width, initial-scale=1, viewport-fit=cover';
    if (!content.includes('width=device-width')) {
      meta.setAttribute('content', needed);
    }
  }

  function init() {
    try { ensureViewportMeta(); } catch (e) {}
    setVars();
    hardenOverflow();
  }

  window.addEventListener('resize', setVars, { passive: true });
  window.addEventListener('orientationchange', setVars, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setVars, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
