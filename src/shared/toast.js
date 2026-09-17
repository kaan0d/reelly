// Error/status toast. Must stay visible even with debugMode off — this is
// user-facing UI feedback, not a debug log.
(function (global) {
  let toastEl = null;

  function ensureToast() {
    if (toastEl && document.body.contains(toastEl)) return toastEl;
    toastEl = document.createElement('div');
    toastEl.className = 'reelly-toast';
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function show(message, durationMs = 4000) {
    const el = ensureToast();
    el.textContent = message;
    el.classList.add('reelly-toast--visible');
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => el.classList.remove('reelly-toast--visible'), durationMs);
  }

  global.Toast = { show };
})(typeof window !== 'undefined' ? window : self);
