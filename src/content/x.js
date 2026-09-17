(function () {
  const PREFIX = '[X]';
  let injectedButtonCount = 0;

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

    const seen = new WeakSet();

    function onDownloadClick(videoEl, tweetId, btn) {
      btn.classList.add('reelly-loading');
      XExtract.extractVideoUrl(videoEl)
        .then((url) => {
          if (!url) throw new Error('extraction failed');
          const ext = url.includes('.m3u8') ? 'm3u8' : 'mp4';
          return Download.requestDownload(url, `x-${tweetId || Date.now()}.${ext}`);
        })
        .then((result) => {
          if (!result.ok) throw new Error(result.error || 'download failed');
          Logger.log(PREFIX, 'download complete');
        })
        .catch((err) => {
          Logger.error(PREFIX, 'download flow failed', err);
          Toast.show('Download failed. Try again.');
        })
        .finally(() => btn.classList.remove('reelly-loading'));
    }

    function handleTweet(tweetEl) {
      if (seen.has(tweetEl)) return;

      const videoEl = tweetEl.querySelector(Selectors.x.video);
      const actionBar = tweetEl.querySelector(Selectors.x.actionBar);
      if (!videoEl || !actionBar) return; // no video in this tweet, nothing to inject

      seen.add(tweetEl);
      const tweetId = XExtract.getTweetId(tweetEl);

      injectButton(actionBar, {
        extraClass: 'reelly-download-btn--inline',
        onClick: (btn) => onDownloadClick(videoEl, tweetId, btn),
      });
      injectedButtonCount += 1;
      Logger.log(PREFIX, 'button injected, total', injectedButtonCount);
    }

    document.querySelectorAll(Selectors.x.tweetArticle).forEach(handleTweet);

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.(Selectors.x.tweetArticle)) handleTweet(node);
          node.querySelectorAll?.(Selectors.x.tweetArticle).forEach(handleTweet);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
