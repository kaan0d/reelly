# Reelly

Chrome extension (Manifest V3) that adds a download button to Instagram Reels, so you can save the video file straight from the page, no third-party site or pasted link required.

## What it does

A small download button (⬇) is injected into the Reels action rail, above the Like button. Click it and the video downloads to your default Downloads folder as `instagram-<post-id>.mp4`.

## How extraction works

Instagram doesn't expose a stable "give me the video URL" API, so the extension layers a few strategies and falls through to the next one on failure:

1. **Isolated-tab capture (primary).** The Reels feed keeps many videos preloaded at once, and their CDN URLs carry no reel ID — sniffing traffic in the visible tab risks grabbing a completely different (often much larger) reel than the one you clicked. To rule that out, the extension opens the reel's own `/p/<id>/` page in a background tab, which renders exactly one video, and watches only that tab's network traffic. The moment a large-enough response arrives (video, not the tiny audio track) it grabs the URL and closes the tab — this is usually the fastest path.
2. **Direct DOM read.** If the `<video>` element already has a plain CDN URL in `src` (not a `blob:` URL), use it directly.
3. **Network sniffing.** Watches `chrome.webRequest` for `.mp4`/`.m3u8` responses in the current tab and caches the most recent one per tab.
4. **Embed page fallback.** Fetches `instagram.com/reel/<id>/embed/` and reads the `og:video:secure_url` meta tag.

Every strategy is wrapped in try/catch and logged (see Debug Mode below), so a broken selector or a changed Instagram layout degrades gracefully instead of crashing the page.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this repository's folder.
4. Visit instagram.com — download buttons appear automatically.

## Popup settings

Click the extension icon to:
- Toggle Instagram support on/off.
- Toggle **Debug Mode** — when on, every strategy attempt, button injection, and error is logged to the console (prefixed `[IG]`/`[BG]`) for troubleshooting.
- See how many download buttons are currently injected on the active tab.

## Project layout

```
manifest.json
src/
  background/background.js    service worker: downloads, network sniffing, isolated-tab extraction
  content/
    instagram.js               button injection + click handling
    instagram-extract.js       extraction strategy pipeline
    reelly-ui.css               button/toast styling
  shared/                      logger, storage, messages, selectors, download, toast, etc.
  popup/                       toolbar popup UI
```

Selectors for Instagram's DOM (icon labels, class hooks) are centralized in `src/shared/selectors.js` — that's the one place to update when Instagram changes its markup.

## Limitations

- Instagram Reels only.
- Requires an active login session.
- Relies on Instagram's current DOM structure and aria-labels (English + Turkish UI matched); a redesign on their end may require updating `selectors.js`.
