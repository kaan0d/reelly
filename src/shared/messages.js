// Message contract between content scripts and background service worker.
(function (global) {
  const TYPES = {
    CONTENT_READY: 'CONTENT_READY', // content -> background, on load
    ACK: 'ACK', // background -> content, reply to CONTENT_READY
    GET_BUTTON_COUNT: 'GET_BUTTON_COUNT', // popup -> content, ask injected count
    BUTTON_COUNT: 'BUTTON_COUNT', // content -> popup, reply with count
    WATCH_MP4: 'WATCH_MP4', // content -> background, start watching this tab for an mp4 response
    MP4_CAUGHT: 'MP4_CAUGHT', // background -> content, mp4 url caught for the watched tab
    GET_LAST_MEDIA_URL: 'GET_LAST_MEDIA_URL', // content -> background, ask for the last-seen mp4/m3u8 on this tab
    RESET_MEDIA_CACHE: 'RESET_MEDIA_CACHE', // content -> background, active video changed, drop the stale entry
    EXTRACT_ISOLATED: 'EXTRACT_ISOLATED', // content -> background, { postId } -> { url }
    DOWNLOAD_REQUEST: 'DOWNLOAD_REQUEST', // content -> background, { url, filename }
  };

  global.Messages = { TYPES };
})(typeof window !== 'undefined' ? window : self);
