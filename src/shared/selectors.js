// Centralized DOM/URL selectors. IG/X change markup often — this is the one
// place to update when a strategy starts failing.
(function (global) {
  const Selectors = {
    instagram: {
      video: 'video',
      carouselItem: 'ul._acay li[role="button"], div._aatk',
      postImage: 'article img[srcset], img[alt$="profile picture"]',
      // /reel/<id>/, /reels/<id>/ (feed uses the plural), /p/<id>/, /stories/<user>/<id>/
      idFromUrl: /\/(?:reels?|p|stories\/[^/]+)\/([^/?]+)/,
      // Like icon, either state, English + Turkish UI.
      likeIcon:
        'svg[aria-label="Like"], svg[aria-label="Unlike"], ' +
        'svg[aria-label="Beğen"], svg[aria-label="Beğenmekten Vazgeç"]',
      // Send/DM (paper-plane) icon on posts and reels. Exact match only —
      // "Yeniden paylaş" (repost) contains the same word as a substring.
      sendIcon: 'svg[aria-label="Share"], svg[aria-label="Paylaş"]',
      // Mute toggle in the story viewer's top bar. Label text differs by
      // muted/unmuted state and language, so match loosely by substring.
      muteIcon: 'svg[aria-label*="Ses" i], svg[aria-label*="udio" i], svg[aria-label*="ute" i]',
    },
    x: {
      tweetArticle: 'article[data-testid="tweet"]',
      video: 'video',
      actionBar: 'div[role="group"]',
      tweetIdFromHref: /\/status\/(\d+)/,
    },
  };

  global.Selectors = Selectors;
})(typeof window !== 'undefined' ? window : self);
