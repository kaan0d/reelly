(function () {
  const PREFIX = '[X]';
  let injectedButtonCount = 0; // Phase 5 will increment this on each injectButton() call

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === Messages.TYPES.GET_BUTTON_COUNT) {
      sendResponse({ type: Messages.TYPES.BUTTON_COUNT, count: injectedButtonCount });
    }
  });

  Storage.getSettings().then((settings) => {
    if (!settings.sites.x) {
      Logger.log(PREFIX, 'site disabled in settings, skipping');
      return;
    }

    Logger.log(PREFIX, 'content script loaded');

    chrome.runtime.sendMessage(
      { type: Messages.TYPES.CONTENT_READY, site: 'x' },
      (response) => {
        Logger.log(PREFIX, 'background response', response);
      }
    );

    // Video extraction via webRequest network sniffing (Phase 4) lands here.
    // Not implemented yet.
  });
})();
