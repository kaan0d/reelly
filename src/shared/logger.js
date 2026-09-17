// Central logger. Prints only when debugMode is on in chrome.storage.sync.
// Usage: Logger.log('[IG]', 'button injected', el)
(function (global) {
  let debugMode = false;

  chrome.storage.sync.get({ debugMode: false }, (data) => {
    debugMode = data.debugMode;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.debugMode) {
      debugMode = changes.debugMode.newValue;
    }
  });

  function log(prefix, ...args) {
    if (debugMode) console.log(prefix, ...args);
  }
  function warn(prefix, ...args) {
    if (debugMode) console.warn(prefix, ...args);
  }
  function error(prefix, ...args) {
    if (debugMode) console.error(prefix, ...args);
  }

  global.Logger = { log, warn, error };
})(typeof window !== 'undefined' ? window : self);
