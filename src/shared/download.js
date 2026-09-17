// Content-script side of the download mechanism (Phase 6). Actual
// downloads.download() call happens in the background — content scripts
// can't call chrome.downloads directly.
(function (global) {
  function requestDownload(url, filename) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: Messages.TYPES.DOWNLOAD_REQUEST, url, filename },
        (response) => resolve(response || { ok: false, error: 'no response from background' })
      );
    });
  }

  global.Download = { requestDownload };
})(typeof window !== 'undefined' ? window : self);
