const OPTIC_ID = 'optic-privacy-guard-banner';
const defaultSettings = { scanContent: true, scanComments: true, scanMessages: true };
let opticSettings = { ...defaultSettings };
let seenContainers = new WeakSet();

function initializeOptic() {
  if (window.__OpticPrivacyGuardInitialized) return;
  window.__OpticPrivacyGuardInitialized = true;
  
  // Check if on Instagram
  const isInstagram = window.location.hostname.includes('instagram.com');
  console.log('[Optic] Initialized on:', window.location.hostname, '| Instagram:', isInstagram);
  
  chrome.storage.local.get(['opticSettings'], (result) => {
    opticSettings = result.opticSettings || defaultSettings;
  });
  // Keep settings in sync when popup or other contexts update storage
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.opticSettings) {
        opticSettings = changes.opticSettings.newValue || defaultSettings;
      }
    });
  } catch (e) {
    // Some environments may not expose storage events; fall back to messaging
    console.warn('storage.onChanged not available in this context', e);
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsUpdated') {
      opticSettings = message.settings || defaultSettings;
    }
  });
  setInterval(scanPageForLeaks, 4500);
}

function scanPageForLeaks() {
  if (!opticSettings.scanContent && !opticSettings.scanComments && !opticSettings.scanMessages) return;
  const containers = getPostContainers();
  containers.forEach((container) => {
    if (seenContainers.has(container)) return;
    seenContainers.add(container);
    const outcome = analyzeContainer(container);
    if (outcome && outcome.items.length > 0) {
      renderBanner(container, outcome);
      sendNotification(outcome);
    }
  });
}

function getPostContainers() {
  const candidates = [];
  // Instagram-specific, Twitter/X, Facebook, TikTok, and generic selectors
  const selectors = [
    // Instagram
    'article[role="presentation"]',
    'div[role="presentation"] > div > div > div',
    'div[data-testid="post_container"]',
    // Twitter/X
    'article[data-testid="tweet"]',
    'div[data-testid="tweet"]',
    // Generic social media
    'article',
    '[role="article"]',
    'section[data-testid="post"]',
    'div[class*="post"]',
    'div[class*="feed-item"]'
  ];
  
  const seen = new Set();
  selectors.forEach((selector) => {
    try {
      document.querySelectorAll(selector).forEach((element) => {
        if (element.offsetParent !== null && !seen.has(element)) {
          seen.add(element);
          candidates.push(element);
        }
      });
    } catch (e) {
      console.warn('Selector error:', selector, e);
    }
  });
  return candidates;
}

function analyzeContainer(container) {
  const textContent = collectText(container);
  const comments = opticSettings.scanComments ? collectCommentText(container) : [];
  const media = collectMediaTags(container);
  const items = [];

  if (opticSettings.scanContent && media.length > 0) {
    detectVisualLeaks(media, textContent, items);
    detectCaptionLeaks(textContent, items);
  }

  if (opticSettings.scanComments) {
    comments.forEach((commentText) => {
      const commentIssues = detectCommentLeaks(commentText);
      items.push(...commentIssues);
    });
  }

  if (opticSettings.scanMessages) {
    const suspicious = detectSuspiciousMessage(textContent);
    if (suspicious) {
      items.push(suspicious);
    }
  }

  return { items, reason: generateAdvice(items) };
}

function collectText(container) {
  const textParts = [];
  const selectors = ['[data-testid="tweetText"]', '[data-testid="post-caption"]', '.caption', 'figcaption', 'p', 'span', 'div'];
  try {
    selectors.forEach((selector) => {
      const nodes = container?.querySelectorAll?.(selector);
      if (nodes) {
        nodes.forEach((node) => {
          const text = node?.textContent?.trim?.();
          if (text && text.length > 10) textParts.push(text);
        });
      }
    });
  } catch (error) {
    console.warn('Error collecting text:', error);
  }
  return textParts.join('\n');
}

function collectCommentText(container) {
  const comments = [];
  const selectors = [
    // Instagram
    'span[data-testid="HtmlCommentCaption"]',
    'h1 + div span',
    'div[class*="comment"]',
    // Generic
    '.comment',
    '.comments',
    '[data-testid="comment"]',
    '[data-testid="reply"]',
    '.reply',
    'div[class*="caption"]'
  ];
  
  try {
    selectors.forEach((selector) => {
      const nodes = container?.querySelectorAll?.(selector);
      if (nodes) {
        nodes.forEach((node) => {
          const text = node?.textContent?.trim?.();
          if (text && text.length > 10 && !comments.includes(text)) {
            comments.push(text);
          }
        });
      }
    });
  } catch (error) {
    console.warn('Error collecting comments:', error);
  }
  return comments;
}

function collectMediaTags(container) {
  const sources = [];
  container.querySelectorAll('img, video, picture, svg').forEach((node) => {
    const alt = node.alt || node.getAttribute('aria-label') || '';
    const src = node.currentSrc || node.src || node.dataset?.src || '';
    if (alt || src) {
      sources.push({ alt: alt.trim(), src: src.trim() });
    }
  });
  return sources;
}

function detectVisualLeaks(media, textContent, items) {
  media.forEach((mediaItem) => {
    if (/matcha|coffee|latte|boba/i.test(mediaItem.alt + ' ' + textContent)) {
      items.push({
        category: 'Routine / Habit',
        description: 'Your post suggests a daily beverage routine. This can reveal a repeated location or habit.',
        example: 'Caption or alt text mentions coffee, matcha, or daily coffee time.'
      });
    }
    if (/nyc|new york|manhattan|brooklyn/i.test(mediaItem.alt + ' ' + textContent)) {
      items.push({
        category: 'Location leak',
        description: 'This post indicates you are in New York City, which can be used to track where you live or visit frequently.',
        example: 'Text mentions NYC or New York.'
      });
    }
    if (/(starbucks|dunkin|local cafe|coffee shop|matcha shop)/i.test(mediaItem.alt + ' ' + textContent)) {
      items.push({
        category: 'Local business leak',
        description: 'A visible store brand or cup design reveals the exact coffee shop or local business you visited.',
        example: 'A branded cup or storefront is visible in the image.'
      });
    }
    if (/clock|time|watch|timestamp|13:|14:|15:/i.test(mediaItem.alt + ' ' + textContent)) {
      items.push({
        category: 'Time leak',
        description: 'A visible clock or time indicator in the background reveals what time you posted, which can help predict your daily schedule.',
        example: 'A clock, watch, or timestamp is visible in the image.'
      });
    }
  });
}

function detectCaptionLeaks(textContent, items) {
  if (/(daily|every day|everyday|always|routine|morning)/i.test(textContent) && /coffee|matcha|latte|tea/i.test(textContent)) {
    items.push({
      category: 'Routine leak',
      description: 'The caption implies a repeated daily activity, which can be used to infer your routine.',
      example: 'Caption says “daily coffee time” or similar.'
    });
  }
  if (/first day of the month|1st day|monthly|every month/i.test(textContent)) {
    items.push({
      category: 'Schedule leak',
      description: 'A recurring schedule is visible, which reveals when you do certain activities.',
      example: 'Comments or captions mention dates or a regular monthly pattern.'
    });
  }
  if (/(brand|bag|nails|phone case|jacket)/i.test(textContent)) {
    items.push({
      category: 'Personal style leak',
      description: 'Visible belongings like bags, nails, or clothing brands can help identify you or your habits.',
      example: 'Image details mention a bag brand or a fresh manicure.'
    });
  }
}

function detectCommentLeaks(commentText) {
  const issues = [];
  if (/(moved to|in nyc|in new york|miss you already|miss you)/i.test(commentText)) {
    issues.push({
      category: 'Social context leak',
      description: 'A comment reveals your recent move or change of city, which is useful information for someone building a profile on you.',
      example: `Comment says “${commentText}”.`
    });
  }
  if (/(can’t believe you moved|welcome to|love having you here|hope the move is going well)/i.test(commentText)) {
    issues.push({
      category: 'Location / life change leak',
      description: 'The comment references a move, suggesting that you may be in a new area and still adjusting.',
      example: `Comment says “${commentText}”.`
    });
  }
  if (/(repair|rent|help out with my rent|need money|click the link|pay this|fund my)/i.test(commentText)) {
    issues.push({
      category: 'Phishing / scam signal',
      description: 'This message matches common scam patterns and may have been generated from details scraped from your profile.',
      example: `Suspicious text: “${commentText}”.`
    });
  }
  return issues;
}

function detectSuspiciousMessage(textContent) {
  if (!textContent) return null;
  const phishingPattern = /(hey|hi|hello).*\b(?:saw you|saw that you|noticed you).*\b(nyc|new york|brooklyn|manhattan|city)\b.*\b(help.*rent|help.*money|pay.*rent|click the link|link)/i;
  if (phishingPattern.test(textContent)) {
    return {
      category: 'Phishing risk',
      description: 'This message contains information that could be extracted from your posts. This is a chance that it could be AI-generated. A scammer or bot used details about your location and activities to personalize this phishing attempt.',
      example: `Suspicious message: "${textContent}".`
    };
  }
  return null;
}

function generateAdvice(items) {
  const categories = new Set(items.map((item) => item.category));
  const advice = [];
  if (categories.has('Location leak')) {
    advice.push('Avoid sharing exact city or venue names in future posts if you want to keep your location private.');
  }
  if (categories.has('Routine leak')) {
    advice.push('Try not to post repeatable details about your daily schedule or exact time.');
  }
  if (categories.has('Local business leak')) {
    advice.push('Blurring or removing recognizable cups, signs, or storefronts can reduce location exposure.');
  }
  if (categories.has('Social context leak')) {
    advice.push('Comments can reveal personal transitions like a move; review comment privacy settings and remove overly revealing replies.');
  }
  if (categories.has('Time leak')) {
    advice.push('Avoid posting photos with visible clocks or timestamps that reveal your daily schedule.');
  }
  if (categories.has('Phishing / scam signal') || categories.has('Phishing risk')) {
    advice.push('Do not click unsolicited links and verify the sender; this could be an AI-personalized scam.');
  }
  return advice.join(' ');
}

function renderBanner(container, outcome) {
  const existing = container.querySelector(`#${OPTIC_ID}`);
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = OPTIC_ID;
  banner.className = 'optic-banner';
  banner.innerHTML = `
    <strong>Optic Privacy Guard</strong>
    <div class="optic-reason">Potential leaks detected: ${outcome.items.map((item) => item.category).filter(Boolean).join(', ') || 'Details found'}.</div>
    <div class="optic-summary">${outcome.items.slice(0, 2).map((item) => item.description).join(' ')}</div>
    <div class="optic-advice">${outcome.reason}</div>
    <button class="optic-close">Dismiss</button>
  `;
  banner.querySelector('.optic-close').addEventListener('click', () => banner.remove());
  banner.addEventListener('click', (event) => {
    if (event.target !== banner && !event.target.closest('.optic-close')) return;
  });
  container.prepend(banner);
}

function sendNotification(outcome) {
  if (!chrome.runtime || !chrome.runtime.sendMessage) return;
  chrome.runtime.sendMessage({
    type: 'optic_show_notification',
    title: 'Optic Privacy Guard: possible leak',
    message: outcome.items.slice(0, 2).map((item) => item.description).join(' ') || 'A privacy issue was detected in the current post.'
  });
}

initializeOptic();
