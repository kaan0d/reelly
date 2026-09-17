// X video URL extraction. Per NOTES.md, X streams via MSE/blob almost
// always, so DOM read rarely succeeds — network sniff carries most cases.
(function (global) {
  const PREFIX = '[X]';
  const NETWORK_SNIFF_TIMEOUT_MS = 6000;

  function getTweetId(tweetEl) {
    const link = tweetEl.querySelector('a[href*="/status/"]');
    const match = link && link.href.match(Selectors.x.tweetIdFromHref);
    return match ? match[1] : null;
  }

  async function extractVideoUrl(videoEl) {
    try {
      const domUrl = VideoStrategies.tryDomRead(videoEl);
      if (domUrl) {
        Logger.log(PREFIX, 'dom read succeeded', domUrl);
        return domUrl;
      }
      Logger.log(PREFIX, 'dom read skipped: src is blob or empty');
    } catch (err) {
      Logger.error(PREFIX, 'dom read threw', err);
    }

    try {
      const sniffedUrl = await VideoStrategies.tryNetworkSniff(NETWORK_SNIFF_TIMEOUT_MS);
      if (sniffedUrl) {
        Logger.log(PREFIX, 'network sniff succeeded', sniffedUrl);
        return sniffedUrl;
      }
      Logger.log(PREFIX, 'network sniff timed out');
    } catch (err) {
      Logger.error(PREFIX, 'network sniff threw', err);
    }

    return null;
  }

  global.XExtract = { getTweetId, extractVideoUrl };
})(typeof window !== 'undefined' ? window : self);
