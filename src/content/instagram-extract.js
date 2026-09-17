// Instagram video/image URL extraction. Strategy order (NOTES.md):
// 1. DOM read  2. network sniff (background)  3. embed page fallback.
// Each strategy isolated with try/catch; failure falls through to the next.
(function (global) {
  const PREFIX = '[IG]';
  const NETWORK_SNIFF_TIMEOUT_MS = 6000;

  function getPostId() {
    const match = location.pathname.match(Selectors.instagram.idFromUrl);
    return match ? match[1] : null;
  }

  // Strategy 3: fetch the embed page and read the og:video:secure_url meta tag.
  async function tryEmbedPage(postId) {
    if (!postId) return null;
    try {
      const res = await fetch(`/reel/${postId}/embed/`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const url = doc
        .querySelector('meta[property="og:video:secure_url"]')
        ?.getAttribute('content');
      if (url) {
        Logger.log(PREFIX, 'strategy 3 (embed) succeeded', url);
        return url;
      }
      Logger.log(PREFIX, 'strategy 3 (embed) found no og:video meta tag');
      return null;
    } catch (err) {
      Logger.error(PREFIX, 'strategy 3 (embed) failed', err);
      return null;
    }
  }

  // Runs all 3 strategies in order for a single <video> element (reel/story).
  async function extractVideoUrl(videoEl) {
    try {
      const domUrl = VideoStrategies.tryDomRead(videoEl);
      if (domUrl) {
        Logger.log(PREFIX, 'strategy 1 (dom) succeeded', domUrl);
        return domUrl;
      }
      Logger.log(PREFIX, 'strategy 1 (dom) skipped: src is blob or empty');
    } catch (err) {
      Logger.error(PREFIX, 'strategy 1 (dom) threw', err);
    }

    try {
      const sniffedUrl = await VideoStrategies.tryNetworkSniff(NETWORK_SNIFF_TIMEOUT_MS);
      if (sniffedUrl) {
        Logger.log(PREFIX, 'strategy 2 (network sniff) succeeded', sniffedUrl);
        return sniffedUrl;
      }
      Logger.log(PREFIX, 'strategy 2 (network sniff) timed out');
    } catch (err) {
      Logger.error(PREFIX, 'strategy 2 (network sniff) threw', err);
    }

    return tryEmbedPage(getPostId());
  }

  // Carousel: multiple <video>/<img> elements, extract each independently.
  async function extractCarousel(containerEl) {
    const items = containerEl.querySelectorAll('video, img');
    const urls = [];
    for (const el of items) {
      if (el.tagName === 'VIDEO') {
        urls.push(await extractVideoUrl(el));
      } else if (el.src) {
        urls.push(el.src);
      }
    }
    return urls.filter(Boolean);
  }

  // Post/profile picture: direct <img> src is enough, no strategy fallthrough needed.
  function extractImage(imgEl) {
    return imgEl.src || imgEl.currentSrc || null;
  }

  global.IGExtract = { getPostId, extractVideoUrl, extractCarousel, extractImage };
})(typeof window !== 'undefined' ? window : self);
