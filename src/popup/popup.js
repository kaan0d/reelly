const TOGGLES = document.querySelectorAll('[data-toggle]');
const statusEl = document.getElementById('status');

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o[k], obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

function applySettings(settings) {
  TOGGLES.forEach((input) => {
    input.checked = Boolean(getPath(settings, input.dataset.toggle));
  });
}

chrome.storage.sync.get(
  { sites: { instagram: true, x: true }, debugMode: false },
  applySettings
);

TOGGLES.forEach((input) => {
  input.addEventListener('change', () => {
    chrome.storage.sync.get(
      { sites: { instagram: true, x: true }, debugMode: false },
      (settings) => {
        setPath(settings, input.dataset.toggle, input.checked);
        chrome.storage.sync.set(settings);
      }
    );
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  chrome.storage.sync.get(
    { sites: { instagram: true, x: true }, debugMode: false },
    applySettings
  );
});

// Status line: ask the active tab's content script how many buttons it injected.
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;

  chrome.tabs.sendMessage(
    tab.id,
    { type: Messages.TYPES.GET_BUTTON_COUNT },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        statusEl.textContent = 'No active site on this tab.';
        return;
      }
      statusEl.textContent = `${response.count} button(s) injected on this tab.`;
    }
  );
});
