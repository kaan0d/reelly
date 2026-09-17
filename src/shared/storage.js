// chrome.storage.sync schema: { sites: { instagram: bool, x: bool }, debugMode: bool }
(function (global) {
  const DEFAULTS = {
    sites: { instagram: true, x: true },
    debugMode: false,
  };

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, resolve);
    });
  }

  global.Storage = { DEFAULTS, getSettings };
})(typeof window !== 'undefined' ? window : self);
