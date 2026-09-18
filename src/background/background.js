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

  if (message && message.type === Messages.TYPES.RESET_MEDIA_CACHE && sender.tab) {
    lastMediaByTab.delete(sender.tab.id);
    Logger.log(PREFIX, 'media cache reset for tab', sender.tab.id);
  }

  if (message && message.type === Messages.TYPES.DOWNLOAD_REQUEST) {
    handleDownload(message.url, message.filename).then(sendResponse);
  }

  if (message && message.type === Messages.TYPES.EXTRACT_ISOLATED) {
    extractViaIsolatedTab(message.postId).then((url) => sendResponse({ url }));
  }

  return true; // keep channel open for async sendResponse
});

// MV3 service workers have no URL.createObjectURL (no document to register
// a blob: url against), so chrome.downloads.download can't take a blob: url
// from here — encode as a data: url instead, which needs no such registry.
// Chunked to avoid blowing the call-stack limit of String.fromCharCode on a
// multi-MB array.
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// chrome.downloads.download() resolves once the download is QUEUED, not
// once it finishes — a signed CDN url that's expired by click time (IG's
// oe=/oh= params are short-lived) still resolves here, then fails silently
// server-side, leaving a 0-byte file while we'd already reported success.
// Wait for the real outcome via onChanged instead of trusting the resolve.
function waitForDownloadComplete(downloadId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      chrome.downloads.onChanged.removeListener(onChanged);
      clearTimeout(timer);
      err ? reject(err) : resolve();
    };
    function onChanged(delta) {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete') finish();
      if (delta.state?.current === 'interrupted') {
        finish(new Error(delta.error?.current || 'download interrupted'));
      }
    }
    chrome.downloads.onChanged.addListener(onChanged);
    const timer = setTimeout(() => finish(new Error('download timed out')), timeoutMs);
  });
}

// Download mechanism (Phase 6): try a direct browser download first; if the
// URL needs headers/referer the download manager won't send, fetch it as a
// blob in this extension context (has host_permissions, so no CORS) instead.
async function handleDownload(url, filename) {
  try {
    const downloadId = await chrome.downloads.download({ url, filename });
    await waitForDownloadComplete(downloadId);
    Logger.log(PREFIX, 'download complete', filename);
    return { ok: true };
  } catch (err) {
    Logger.warn(PREFIX, 'direct download failed, falling back to fetch+blob', err);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) throw new Error('fetched 0 bytes');
    const mimeType = res.headers.get('content-type') || 'video/mp4';
    const dataUrl = `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
    const downloadId = await chrome.downloads.download({ url: dataUrl, filename });
    await waitForDownloadComplete(downloadId);
    Logger.log(PREFIX, 'download complete via blob fallback', filename);
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
const MEDIA_CACHE_STALE_MS = 5000;
// Requests more than this far apart belong to different reels (the feed
// preloads many at once, and IG's CDN URLs carry no reel/post id to tell
// them apart), so a new burst always replaces the cache outright instead of
// only when bigger — otherwise a big reel scrolled past minutes ago could
// keep "winning" against a small reel actually on screen, downloading the
// wrong (and much larger) video. Within one burst still prefer the bigger
// response, since a reel's video/audio tracks arrive close together and the
// video track is reliably the larger of the two.
const BURST_GAP_MS = 1500;

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

// Each captured request is one HTTP byte-range slice of a larger resource
// (confirmed live: the raw url returned 62KB; the same url with these two
// params removed returned the full 2.2MB file, status 200, valid ftyp/mp4
// header — same technique used by the open-source insta-loader extension).
// Downloading the raw captured url gave corrupt/truncated files.
function stripByteRange(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('bytestart');
    u.searchParams.delete('byteend');
    return u.toString();
  } catch {
    return url;
  }
}

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const isVideoUrl = details.url.includes('.mp4') || details.url.includes('.m3u8');
    if (!isVideoUrl) return;

    const prev = lastMediaByTab.get(details.tabId);
    const now = Date.now();
    const isNewBurst = !prev || now - prev.ts > BURST_GAP_MS;
    const size = rangeSizeOf(details.url);
    if (isNewBurst || size >= prev.rangeSize) {
      lastMediaByTab.set(details.tabId, {
        url: stripByteRange(details.url),
        rangeSize: size,
        ts: now,
      });
    }

    if (mp4Watchers.has(details.tabId)) {
      mp4Watchers.delete(details.tabId);
      Logger.log(PREFIX, 'video response caught for tab', details.tabId, details.url);
      chrome.tabs.sendMessage(details.tabId, {
        type: Messages.TYPES.MP4_CAUGHT,
        url: stripByteRange(details.url),
      });
    }
  },
  {
    urls: ['*://*.cdninstagram.com/*', '*://*.fbcdn.net/*'],
  }
);

// Isolated extraction: the reels feed keeps many videos preloaded at once
// with no reel/post id in their CDN urls, so a click can grab a completely
// different (and often much larger) reel's traffic than the one on screen —
// no amount of timing heuristics in the shared cache above can fully fix
// that within a noisy multi-video tab. /p/<id>/ (classic single-post view,
// the same trick the open-source insta-loader extension uses) renders just
// one video, so opening it in its own hidden tab and scoping capture to
// that tab's id by construction rules out cross-reel contamination.
// A single chunk this size can only be the video track (audio chunks are a
// few hundred bytes, per rangeSizeOf's comment below) — finish the instant
// one arrives instead of waiting out the settle window, since that window
// was the main source of latency (IG keeps preloading unrelated chunks
// while the tab boots, so it kept getting reset).
const EARLY_EXIT_BYTES = 50000;
const ISOLATED_TAB_SETTLE_MS = 600; // resolve once quiet this long, if nothing hit early-exit
const ISOLATED_TAB_MAX_MS = 6000; // hard cap in case nothing ever arrives

function extractViaIsolatedTab(postId) {
  if (!postId) return Promise.resolve(null);

  return chrome.tabs
    .create({ url: `https://www.instagram.com/p/${postId}/`, active: false })
    .then(
      (tab) =>
        new Promise((resolve) => {
          let settled = false;
          let best = null;
          let settleTimer = null;

          const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(settleTimer);
            clearTimeout(hardCap);
            chrome.webRequest.onCompleted.removeListener(onRequest);
            chrome.tabs.remove(tab.id).catch(() => {});
            Logger.log(PREFIX, 'isolated extraction finished for', postId, !!best);
            resolve(best ? best.url : null);
          };

          function onRequest(details) {
            if (details.tabId !== tab.id) return;
            if (!details.url.includes('.mp4') && !details.url.includes('.m3u8')) return;
            const size = rangeSizeOf(details.url);
            if (!best || size > best.rangeSize) {
              best = { url: stripByteRange(details.url), rangeSize: size };
            }
            if (size >= EARLY_EXIT_BYTES) {
              finish();
              return;
            }
            clearTimeout(settleTimer);
            settleTimer = setTimeout(finish, ISOLATED_TAB_SETTLE_MS);
          }

          chrome.webRequest.onCompleted.addListener(onRequest, {
            urls: ['*://*.cdninstagram.com/*', '*://*.fbcdn.net/*'],
          });
          const hardCap = setTimeout(finish, ISOLATED_TAB_MAX_MS);
        })
    )
    .catch((err) => {
      Logger.warn(PREFIX, 'isolated tab extraction failed', err);
      return null;
    });
}
