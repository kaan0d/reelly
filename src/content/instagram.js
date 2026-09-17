(function () {
  const PREFIX = '[IG]';
  let injectedButtonCount = 0;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === Messages.TYPES.GET_BUTTON_COUNT) {
      sendResponse({ type: Messages.TYPES.BUTTON_COUNT, count: injectedButtonCount });
    }
  });

  Storage.getSettings().then((settings) => {
    if (!settings.sites.instagram) {
      Logger.log(PREFIX, 'site disabled in settings, skipping');
      return;
    }

    Logger.log(PREFIX, 'content script loaded');

    chrome.runtime.sendMessage(
      { type: Messages.TYPES.CONTENT_READY, site: 'instagram' },
      (response) => {
        Logger.log(PREFIX, 'background response', response);
      }
    );

    const seen = new WeakSet();

    // Extraction runs on click, not on injection, so we don't spin up a
    // network watcher for every video that merely scrolls into view.
    function onDownloadClick(videoEl, btn) {
      btn.classList.add('reelly-loading');
      IGExtract.extractVideoUrl(videoEl)
        .then((url) => {
          if (!url) throw new Error('all extraction strategies failed');
          const postId = IGExtract.getPostId() || Date.now();
          return Download.requestDownload(url, `instagram-${postId}.mp4`);
        })
        .then((result) => {
          if (!result.ok) throw new Error(result.error || 'download failed');
          Logger.log(PREFIX, 'download complete');
        })
        .catch((err) => {
          Logger.error(PREFIX, 'download flow failed', err);
          Toast.show('Download failed. Try again.');
        })
        .finally(() => btn.classList.remove('reelly-loading'));
    }

    // Three distinct layouts get three distinct placements:
    // - Story viewer: single active video, top bar has a mute toggle —
    //   place just to its left. Checked first since stories have no rail.
    // - Reel (vertical rail, flex-direction:column): above the like button.
    // - Post (horizontal action bar, flex-direction:row): right after the
    //   send/paylaş button (last child of that row), left of the separate
    //   save icon.
    // Both reel/post cases climb from the like icon to the real action-list
    // container: the reels feed has no per-reel <article>/<section> boundary
    // (all virtualized videos share one outer <section>), so first climb to
    // the smallest ancestor containing exactly this one video AND a like
    // icon (this reel/post's own wrapper) — then, within that, climb from
    // the like icon past its own internal icon+count wrapper (2 children) up
    // to the actual rail/row (5+ children). Inserting into the icon+count
    // wrapper instead broke that wrapper's own 2-child layout (buttons
    // crammed together, like button jumping on hover).
    const RAIL_MIN_SIBLINGS = 5;

    function findStoryMuteItem() {
      const muteSvg = document.querySelector(Selectors.instagram.muteIcon);
      if (!muteSvg) return null;
      const muteItem = muteSvg.closest('div[role="slider"], div[role="button"]');
      if (!muteItem || !muteItem.parentElement) return null;
      return { kind: 'story', item: muteItem, stack: muteItem.parentElement };
    }

    function findReelOrPostContext(videoEl) {
      let reelScope = videoEl.parentElement;
      while (reelScope && reelScope !== document.body) {
        if (reelScope.querySelectorAll('video').length === 1) {
          const likeSvg = reelScope.querySelector(Selectors.instagram.likeIcon);
          if (likeSvg) {
            let item = likeSvg;
            while (
              item.parentElement &&
              item.parentElement !== reelScope &&
              item.parentElement.children.length < RAIL_MIN_SIBLINGS
            ) {
              item = item.parentElement;
            }
            const stack = item.parentElement;
            if (stack && stack.children.length >= RAIL_MIN_SIBLINGS) {
              if (getComputedStyle(stack).flexDirection === 'column') {
                return { kind: 'reel', item, stack };
              }

              const sendSvg = reelScope.querySelector(Selectors.instagram.sendIcon);
              const sendItem = sendSvg && sendSvg.closest('div[role="button"]');
              if (sendItem && sendItem.parentElement) {
                return { kind: 'post', item: sendItem.nextElementSibling, stack: sendItem.parentElement };
              }
            }
          }
        }
        reelScope = reelScope.parentElement;
      }
      return null;
    }

    const RAIL_CLASS_BY_KIND = {
      reel: 'reelly-download-btn--rail',
      post: 'reelly-download-btn--post-row',
      story: 'reelly-download-btn--story',
    };

    function handleVideo(videoEl) {
      if (seen.has(videoEl)) return;
      seen.add(videoEl);

      // Reel/post check first: reels have their own small mute icon too, and
      // findStoryMuteItem() would wrongly win priority over the rail if
      // checked first — reaching the story case is by elimination (no rail
      // found at all is what actually distinguishes a story).
      const ctx = findReelOrPostContext(videoEl) || findStoryMuteItem();
      if (ctx) {
        injectButton(ctx.stack, {
          extraClass: RAIL_CLASS_BY_KIND[ctx.kind],
          before: ctx.item, // null (post's send is last child) -> appendChild
          onClick: (btn) => onDownloadClick(videoEl, btn),
        });
        injectedButtonCount += 1;
        Logger.log(PREFIX, `button injected (${ctx.kind}), total`, injectedButtonCount);
        return;
      }

      // Fallback: no known layout matched, overlay top-right corner instead.
      const container = videoEl.closest('article') || videoEl.parentElement;
      if (!container) return;

      injectButton(container, {
        extraClass: 'reelly-download-btn--corner',
        onClick: (btn) => onDownloadClick(videoEl, btn),
      });
      injectedButtonCount += 1;
      Logger.log(PREFIX, 'button injected (corner fallback), total', injectedButtonCount);
    }

    document.querySelectorAll(Selectors.instagram.video).forEach(handleVideo);

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.(Selectors.instagram.video)) handleVideo(node);
          node.querySelectorAll?.(Selectors.instagram.video).forEach(handleVideo);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
