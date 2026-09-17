// Shared download-button injection. Consistent icon/style everywhere it's used.
(function (global) {
  const ICON_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>';

  function injectButton(parentEl, { extraClass = '', onClick, before } = {}) {
    // Absolute-overlay variants need a positioned ancestor; in-flow stack
    // insertion (before a sibling) stays in normal layout, no positioning.
    if (!before && getComputedStyle(parentEl).position === 'static') {
      parentEl.style.position = 'relative';
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `reelly-download-btn ${extraClass}`.trim();
    btn.setAttribute('aria-label', 'Download');
    btn.innerHTML = ICON_SVG;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick?.(btn);
    });

    if (before) {
      parentEl.insertBefore(btn, before);
    } else {
      parentEl.appendChild(btn);
    }
    return btn;
  }

  global.injectButton = injectButton;
})(typeof window !== 'undefined' ? window : self);
