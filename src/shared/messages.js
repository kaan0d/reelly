// Message contract between content scripts and background service worker.
(function (global) {
  const TYPES = {
    CONTENT_READY: 'CONTENT_READY', // content -> background, on load
    ACK: 'ACK', // background -> content, reply to CONTENT_READY
    GET_BUTTON_COUNT: 'GET_BUTTON_COUNT', // popup -> content, ask injected count
    BUTTON_COUNT: 'BUTTON_COUNT', // content -> popup, reply with count
  };

  global.Messages = { TYPES };
})(typeof window !== 'undefined' ? window : self);
