// Generic strategies shared by IG and X extractors: DOM src read, and
// network-sniff handshake with the background service worker.
(function (global) {
  function tryDomRead(videoEl) {
    const src = videoEl.currentSrc || videoEl.src;
    if (src && src.startsWith('http') && (src.includes('.mp4') || src.includes('.m3u8'))) {
      return src;
    }
    return null;
  }

  // Most videos already finished loading by the time the user clicks
  // download, so check what background already saw for this tab first;
  // only fall back to a live watch for a video that hasn't loaded yet.
  async function tryNetworkSniff(timeoutMs) {
    const cachedUrl = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: Messages.TYPES.GET_LAST_MEDIA_URL },
        (response) => resolve(response && response.url)
      );
    });
    if (cachedUrl) return cachedUrl;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (url) => {
        if (settled) return;
        settled = true;
        chrome.runtime.onMessage.removeListener(onMessage);
        resolve(url);
      };

      function onMessage(message) {
        if (message && message.type === Messages.TYPES.MP4_CAUGHT) finish(message.url);
      }

      chrome.runtime.onMessage.addListener(onMessage);
      chrome.runtime.sendMessage({ type: Messages.TYPES.WATCH_MP4 });
      setTimeout(() => finish(null), timeoutMs);
    });
  }

  global.VideoStrategies = { tryDomRead, tryNetworkSniff };
})(typeof window !== 'undefined' ? window : self);
