// chrome.storage.sync schema: { sites: { instagram: bool }, debugMode: bool }
(function (global) {
  const DEFAULTS = {
    sites: { instagram: true },
    debugMode: false,
  };

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, resolve);
    });
  }

  global.Storage = { DEFAULTS, getSettings };
})(typeof window !== 'undefined' ? window : self);
