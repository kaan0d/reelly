(function () {
  const PREFIX = '[IG]';
  let injectedButtonCount = 0; // Phase 5 will increment this on each injectButton() call

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === Messages.TYPES.GET_BUTTON_COUNT) {
      sendResponse({ type: Messages.TYPES.BUTTON_COUNT, count: injectedButtonCount });
    }
  });

  Storage.getSettings().then((settings) => {
    if (!settings.sites.instagram) {
      Logger.log(PREFIX, 'site disabled in settings, skipping');
      return;
    }

    Logger.log(PREFIX, 'content script loaded');

    chrome.runtime.sendMessage(
      { type: Messages.TYPES.CONTENT_READY, site: 'instagram' },
      (response) => {
        Logger.log(PREFIX, 'background response', response);
      }
    );

    // Extraction strategies (DOM read -> network sniff fallback -> embed page)
    // land here in Phase 3. Not implemented yet.
  });
})();
