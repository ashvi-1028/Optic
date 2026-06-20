// Exposes platform-specific selectors to the content script via window.OPTIC_PLATFORM_SELECTORS
window.OPTIC_PLATFORM_SELECTORS = {
  instagram: [
    'article[role="presentation"]',
    'div[role="presentation"] > div > div > div',
    'div[class*="_aabd"]',
    'div[class*="_aagw"]'
  ],
  twitter: [
    'article[data-testid="tweet"]',
    'div[data-testid="tweet"]'
  ],
  generic: [
    'article',
    '[role="article"]',
    'section[data-testid="post"]',
    'div[class*="post"]',
    'div[class*="feed-item"]'
  ]
};
