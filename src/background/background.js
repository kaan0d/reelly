importScripts(
  '../shared/logger.js',
  '../shared/storage.js',
  '../shared/messages.js'
);

const PREFIX = '[BG]';

chrome.runtime.onInstalled.addListener(() => {
  Logger.log(PREFIX, 'installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Logger.log(PREFIX, 'message received', message, 'from tab', sender.tab && sender.tab.id);

  if (message && message.type === Messages.TYPES.CONTENT_READY) {
    sendResponse({ type: Messages.TYPES.ACK });
  }

  return true; // keep channel open for async sendResponse
});
