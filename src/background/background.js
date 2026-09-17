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

  if (message && message.type === Messages.TYPES.WATCH_MP4 && sender.tab) {
    watchTabForMp4(sender.tab.id);
    sendResponse({ ack: true });
  }

  if (message && message.type === Messages.TYPES.GET_LAST_MEDIA_URL && sender.tab) {
    const cached = lastMediaByTab.get(sender.tab.id);
    const isStale = !cached || Date.now() - cached.ts > MEDIA_CACHE_STALE_MS;
    sendResponse({ url: isStale ? null : cached.url });
  }

  if (message && message.type === Messages.TYPES.DOWNLOAD_REQUEST) {
    handleDownload(message.url, message.filename).then(sendResponse);
  }

  return true; // keep channel open for async sendResponse
});

// Download mechanism (Phase 6): try a direct browser download first; if the
// URL needs headers/referer the download manager won't send, fetch it as a
// blob in this extension context (has host_permissions, so no CORS) instead.
async function handleDownload(url, filename) {
  try {
    await chrome.downloads.download({ url, filename });
    Logger.log(PREFIX, 'download started', filename);
    return { ok: true };
  } catch (err) {
    Logger.warn(PREFIX, 'direct download failed, falling back to fetch+blob', err);
  }

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    await chrome.downloads.download({ url: blobUrl, filename });
    Logger.log(PREFIX, 'download started via blob fallback', filename);
    return { ok: true };
  } catch (err) {
    Logger.error(PREFIX, 'fetch+blob fallback failed', err);
    return { ok: false, error: String(err) };
  }
}

// Network-sniff fallback (Phase 3, strategy 2). Two paths:
// - Live watch: a video not loaded yet — next matching response wins.
// - Passive cache: the common case — by the time the user clicks download,
//   IG already finished buffering (via byte-range requests) minutes ago and
//   fires nothing new, so the live watch alone always timed out. We now
//   record every matching response per tab as it happens, so a click can
//   read back what already loaded instead of waiting for new traffic.
// ponytail: matches by tabId + timing, not by post/reel id (IG doesn't expose
// that in the request URL). Breaks if two videos load on the same tab within
// the watch window; add real id matching if that proves to happen in practice.
const mp4Watchers = new Set(); // tabIds currently live-watching
const MP4_WATCH_TIMEOUT_MS = 8000;
const lastMediaByTab = new Map(); // tabId -> { url, rangeSize, ts }
const MEDIA_CACHE_STALE_MS = 20000;

function watchTabForMp4(tabId) {
  mp4Watchers.add(tabId);
  setTimeout(() => mp4Watchers.delete(tabId), MP4_WATCH_TIMEOUT_MS);
}

// IG reels serve the video and audio as separate DASH tracks, both matching
// '.mp4'. Whichever completes last would otherwise win the cache, risking a
// silent (audio-only) download. Their byte-range params (bytestart/byteend)
// proxy for file size — audio chunks are a few hundred bytes, video chunks
// are hundreds of KB — so prefer the larger one within the same reel.
function rangeSizeOf(url) {
  try {
    const params = new URL(url).searchParams;
    const start = Number(params.get('bytestart'));
    const end = Number(params.get('byteend'));
    return Number.isFinite(start) && Number.isFinite(end) ? end - start : 0;
  } catch {
    return 0;
  }
}

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const isVideoUrl = details.url.includes('.mp4') || details.url.includes('.m3u8');
    if (!isVideoUrl) return;

    const prev = lastMediaByTab.get(details.tabId);
    const isStale = !prev || Date.now() - prev.ts > MEDIA_CACHE_STALE_MS;
    const size = rangeSizeOf(details.url);
    if (isStale || size >= prev.rangeSize) {
      lastMediaByTab.set(details.tabId, { url: details.url, rangeSize: size, ts: Date.now() });
    }

    if (mp4Watchers.has(details.tabId)) {
      mp4Watchers.delete(details.tabId);
      Logger.log(PREFIX, 'video response caught for tab', details.tabId, details.url);
      chrome.tabs.sendMessage(details.tabId, {
        type: Messages.TYPES.MP4_CAUGHT,
        url: details.url,
      });
    }
  },
  {
    urls: [
      '*://*.cdninstagram.com/*',
      '*://*.fbcdn.net/*',
      '*://*.video.twimg.com/*',
    ],
  }
);
