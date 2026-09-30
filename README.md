# Reelly

Chrome extension (Manifest V3) that adds a download button to Instagram Reels. The video is saved as `instagram-<post-id>.mp4`, with no third-party site involved.

## Extraction

Instagram has no stable video URL API, so the extension tries these strategies in order:

1. **Isolated tab (primary):** the Reels feed preloads many videos, and their CDN URLs carry no reel ID. The extension opens the reel's `/p/<id>/` page in a background tab, watches only that tab's network traffic, and takes the first video-sized response.
2. **DOM:** uses `<video src>` if it is a plain CDN URL and not a `blob:` URL.
3. **Network sniffing:** reads `.mp4`/`.m3u8` responses in the current tab through `chrome.webRequest`.
4. **Embed page:** reads `og:video:secure_url` from `/reel/<id>/embed/`.

Each strategy fails independently and is logged in Debug Mode (`[IG]`/`[BG]` prefixes, toggled in the popup).

## Install

1. Open `chrome://extensions` and enable Developer mode.
2. Click **Load unpacked** and select this folder.

## Layout

```
src/background/   service worker: downloads, sniffing, isolated-tab extraction
src/content/      button injection and extraction pipeline
src/shared/       logger, storage, messages, selectors
src/popup/        toolbar popup
```

Instagram DOM selectors are all in `src/shared/selectors.js`. Update that file when Instagram changes its markup.

## Limits

Reels only, requires a logged-in session, and matches English and Turkish UI labels only.
