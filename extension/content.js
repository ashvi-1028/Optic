const OPTIC_ID = 'optic-privacy-guard-banner';
const OPTIC_BLUR_MODAL_ID = 'optic-blur-modal';
const defaultSettings = { scanContent: true, scanComments: true, scanMessages: true };
let opticSettings = { ...defaultSettings };
let seenContainers = new WeakSet();

// ===== IMAGE BLURRING UTILITIES =====
function blurImageRegion(canvas, x, y, width, height, blurRadius = 15) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  
  try {
    // Try to get image data - will fail if canvas is tainted (CORS)
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;
  
  // Apply Gaussian-like blur
  const pixelArray = [];
  for (let i = 0; i < data.length; i += 4) {
    pixelArray.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      a: data[i + 3]
    });
  }
  
  // Simple box blur
  for (let i = 0; i < blurRadius; i++) {
    for (let j = 0; j < pixelArray.length; j++) {
      const neighbors = [];
      const cols = width;
      const row = Math.floor(j / cols);
      const col = j % cols;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = row + dy;
          const nx = col + dx;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < (height)) {
            const idx = ny * cols + nx;
            if (idx < pixelArray.length) neighbors.push(pixelArray[idx]);
          }
        }
      }
      
      if (neighbors.length > 0) {
        const avgR = Math.round(neighbors.reduce((s, p) => s + p.r, 0) / neighbors.length);
        const avgG = Math.round(neighbors.reduce((s, p) => s + p.g, 0) / neighbors.length);
        const avgB = Math.round(neighbors.reduce((s, p) => s + p.b, 0) / neighbors.length);
        pixelArray[j] = { r: avgR, g: avgG, b: avgB, a: pixelArray[j].a };
      }
    }
  }
  
  // Write blurred pixels back
  for (let i = 0; i < pixelArray.length; i++) {
    data[i * 4] = pixelArray[i].r;
    data[i * 4 + 1] = pixelArray[i].g;
    data[i * 4 + 2] = pixelArray[i].b;
    data[i * 4 + 3] = pixelArray[i].a;
  }
  
  ctx.putImageData(imageData, x, y);
  return true;
  } catch (e) {
    console.warn('Cannot blur image due to CORS restrictions:', e);
    alert('⚠️ This image cannot be blurred due to Instagram security restrictions. Consider using your device\'s built-in photo editor to blur sensitive areas before uploading.');
    return false;
  }
}

function createBlurModal(imageElement, risks) {
  // Remove existing modal if any
  const existing = document.getElementById(OPTIC_BLUR_MODAL_ID);
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = OPTIC_BLUR_MODAL_ID;
  modal.className = 'optic-blur-modal-overlay';
  
  const risksList = risks.map(r => `<li>${r.category}: ${r.description}</li>`).join('');
  
  modal.innerHTML = `
    <div class="optic-blur-modal">
      <div class="optic-modal-header">
        <h3>🎨 Blur Sensitive Information</h3>
        <button class="optic-modal-close" aria-label="Close">✕</button>
      </div>
      
      <div class="optic-modal-content">
        <p><strong>Detected privacy risks:</strong></p>
        <ul style="font-size: 12px; color: #d1d5db;">${risksList}</ul>
        
        <div class="optic-canvas-container">
          <canvas id="optic-blur-canvas" style="max-width: 100%; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 8px; cursor: crosshair;"></canvas>
          <div class="optic-canvas-guide">Click and drag to draw blur regions. Double-click to finish.</div>
        </div>
      </div>
      
      <div class="optic-modal-actions">
        <button class="optic-btn-blur-all">Blur All Detected Areas</button>
        <button class="optic-btn-download">⬇️ Download Blurred Image</button>
        <button class="optic-btn-cancel">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Setup canvas and drawing
  const canvas = document.getElementById('optic-blur-canvas');
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let startX, startY;
  
  // Load image onto canvas
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onerror = () => {
    // CORS error - Instagram images often have CORS restrictions
    canvas.style.display = 'none';
    const corsWarning = document.createElement('div');
    corsWarning.style.cssText = 'background: rgba(243, 156, 18, 0.15); border: 1px solid #f39c12; padding: 12px; border-radius: 6px; margin: 12px 0; font-size: 12px; color: #fcd34d;';
    corsWarning.innerHTML = '<strong>⚠️ Image CORS Restriction:</strong> This image is protected by Instagram\'s security policy. You can still view the detected risks below, but manual blur editing is unavailable for this image. Consider using your device\'s photo editor to blur sensitive areas.';
    canvas.parentElement.insertBefore(corsWarning, canvas);
  };
  img.onload = () => {
    canvas.width = img.width > 600 ? 600 : img.width;
    canvas.height = (img.height / img.width) * canvas.width;
    const scaleX = canvas.width / img.width;
    const scaleY = canvas.height / img.height;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Store scaling for blur operations
    canvas.dataset.scaleX = scaleX;
    canvas.dataset.scaleY = scaleY;
    canvas.style.display = 'block';
  };
  
  img.src = imageElement.src || imageElement.currentSrc;
  
  // Canvas drawing
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    startX = (e.clientX - rect.left) / parseFloat(canvas.dataset.scaleX || 1);
    startY = (e.clientY - rect.top) / parseFloat(canvas.dataset.scaleY || 1);
    isDrawing = true;
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / parseFloat(canvas.dataset.scaleX || 1);
    const currentY = (e.clientY - rect.top) / parseFloat(canvas.dataset.scaleY || 1);
    
    // Redraw image
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw preview rectangle
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    };
    img.src = imageElement.src || imageElement.currentSrc;
  });
  
  canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const endX = (e.clientX - rect.left) / parseFloat(canvas.dataset.scaleX || 1);
    const endY = (e.clientY - rect.top) / parseFloat(canvas.dataset.scaleY || 1);
    
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    if (width > 10 && height > 10) {
      blurImageRegion(canvas, x, y, width, height);
    }
    isDrawing = false;
  });
  
  // Modal buttons
  modal.querySelector('.optic-modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('.optic-btn-cancel').addEventListener('click', () => modal.remove());
  
  modal.querySelector('.optic-btn-blur-all').addEventListener('click', () => {
    // Blur entire image with lower intensity as safeguard
    blurImageRegion(canvas, 0, 0, canvas.width, canvas.height, 5);
  });
  
  modal.querySelector('.optic-btn-download').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'optic-blurred-image.png';
    link.click();
  });
  
  return modal;
}

// ===== PRE-PUBLISH DETECTION =====
function detectComposeArea() {
  // Instagram: look for compose button or modal
  const instagramCompose = document.querySelector('[aria-label*="Create"]');
  
  // Generic: watch for file inputs in modals/forms
  const genericFileInputs = document.querySelectorAll('input[type="file"]');
  
  return { instagram: !!instagramCompose, fileInputs: genericFileInputs };
}

function setupPrePublishScanner() {
  // Monitor for file uploads
  document.addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'file') {
      const files = e.target.files;
      if (files && files.length > 0) {
        // Scan file after upload and show warning if needed
        setTimeout(() => scanUploadedContent(e.target), 500);
      }
    }
  });
  
  // Monitor post submit buttons
  const observer = new MutationObserver(() => {
    document.querySelectorAll('button').forEach(btn => {
      if ((btn.textContent.includes('Post') || btn.textContent.includes('Share') || btn.textContent.includes('Tweet')) && 
          !btn.dataset.opticListening) {
        btn.dataset.opticListening = 'true';
        btn.addEventListener('click', (e) => {
          handlePrePublish(e);
        });
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

function scanUploadedContent(fileInput) {
  // Get caption/text from nearby text inputs or contenteditable divs
  const captionElements = document.querySelectorAll('textarea, [contenteditable="true"]');
  let captionText = '';
  
  captionElements.forEach(el => {
    if (el.offsetParent !== null) { // Check if visible
      captionText += ' ' + (el.value || el.textContent);
    }
  });
  
  // Instagram preview images can be:
  // - img[src*="blob:"] (blob URLs)
  // - img with class containing "preview" or "image"
  // - imgs in modal/dialog
  const modal = document.querySelector('[role="dialog"]');
  let imageElements = [];
  
  if (modal) {
    imageElements = Array.from(modal.querySelectorAll('img')).filter(img => 
      img.offsetParent !== null && // visible
      !img.src.includes('profile') &&
      !img.src.includes('icon') &&
      img.width > 150 && img.height > 150 // large enough to be post image
    );
  } else {
    imageElements = Array.from(document.querySelectorAll('img[src*="blob:"], img[class*="preview"]'));
  }
  
  if (imageElements.length > 0) {
    showPrePublishWarning(imageElements[0], captionText);
  }
}

function showPrePublishWarning(imageElement, captionText) {
  // Analyze caption and image for risks
  const risks = [];
  analyzeTextForRisks(captionText, risks);
  
  if (risks.length > 0) {
    // Show the blur modal
    createBlurModal(imageElement, risks);
  }
}

function handlePrePublish(event) {
  // Check if form contains images and text
  const form = event.target.closest('form');
  
  // Instagram uses modals, not forms - check dialog/modal for images
  const modal = event.target.closest('[role="dialog"]') || event.target.closest('[role="presentation"]');
  
  let images = [];
  let textElements = [];
  
  if (form) {
    images = Array.from(form.querySelectorAll('img'));
    textElements = Array.from(form.querySelectorAll('textarea, [contenteditable="true"]'));
  } else if (modal) {
    // Instagram: look for image and caption in modal
    images = Array.from(modal.querySelectorAll('img')).filter(img => 
      img.offsetParent !== null && // visible
      !img.src.includes('profile') && // not profile pic
      !img.src.includes('icon') && // not icon
      img.width > 100 && img.height > 100 // reasonable size
    );
    textElements = Array.from(modal.querySelectorAll('[contenteditable="true"]'));
  }
  
  let text = '';
  textElements.forEach(el => {
    text += ' ' + (el.value || el.textContent);
  });
  
  if (images.length > 0 && text.length > 0) {
    // Analyze the content
    analyzeForPublish(images[0], text, event);
  }
}

function analyzeForPublish(imageElement, captionText, originalEvent) {
  const risks = [];
  
  // Run text detection
  analyzeTextForRisks(captionText, risks);
  
  if (risks.length > 0) {
    originalEvent.preventDefault();
    originalEvent.stopPropagation();
    
    // Show blur modal
    createBlurModal(imageElement, risks);
  }
}

function analyzeTextForRisks(text, risksArray) {
  // Reuse detection logic
  const tempItems = [];
  
  detectCaptionLeaks(text, tempItems);
  detectCommentLeaks(text, tempItems);
  
  if (detectSuspiciousMessage(text)) {
    tempItems.push(detectSuspiciousMessage(text));
  }
  
  risksArray.push(...tempItems);
}

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
  
  // Activate pre-publish detection
  setupPrePublishScanner();
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
  // Use platform selectors if available from platform-selectors.js
  const host = window.location.hostname || '';
  let selectors = null;
  try {
    if (window.OPTIC_PLATFORM_SELECTORS) {
      if (host.includes('instagram.com')) selectors = window.OPTIC_PLATFORM_SELECTORS.instagram;
      else if (host.includes('twitter.com') || host.includes('x.com')) selectors = window.OPTIC_PLATFORM_SELECTORS.twitter;
      else selectors = window.OPTIC_PLATFORM_SELECTORS.generic;
    }
  } catch (e) {
    selectors = null;
  }

  if (!selectors || !Array.isArray(selectors)) {
    selectors = ['article', '[role="article"]', 'section[data-testid="post"]', 'div[class*="post"]', 'div[class*="feed-item"]'];
  }

  const seen = new Set();
  selectors.forEach((selector) => {
    try {
      document.querySelectorAll(selector).forEach((element) => {
        if (element && element.offsetParent !== null && !seen.has(element)) {
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
    const combined = mediaItem.alt + ' ' + textContent;
    
    // Beverage routines
    if (/matcha|coffee|latte|boba|tea|cappuccino/i.test(combined)) {
      items.push({
        category: 'Routine / Habit',
        description: 'Your post suggests a daily beverage routine. This can reveal a repeated location or habit.',
        example: 'Caption or alt text mentions coffee, matcha, or daily coffee time.',
        blurrable: true
      });
    }
    
    // Specific locations and landmarks
    if (/nyc|new york|manhattan|brooklyn|times square|empire state|statue of liberty|central park/i.test(combined)) {
      items.push({
        category: 'Location leak',
        description: 'This post indicates a specific city or landmark, which can be used to track where you live or visit frequently.',
        example: 'Text mentions NYC, landmarks, or specific city names.',
        blurrable: true
      });
    }
    
    // Business chains and restaurants
    if (/(starbucks|dunkin|mcdonald|mcd|burger king|taco bell|chipotle|subway|pizza hut|whole foods|trader joe|target|walmart|costco|apple store|best buy)/i.test(combined)) {
      items.push({
        category: 'Local business leak',
        description: 'A visible store brand or logo reveals the exact business you visited, which can be cross-referenced with location data.',
        example: 'A branded cup, sign, or storefront is visible in the image.',
        blurrable: true
      });
    }
    
    // Educational institutions
    if (/(school|high school|middle school|elementary|university|college|harvard|yale|stanford|mit|campus)/i.test(combined)) {
      items.push({
        category: 'Educational institution leak',
        description: 'Identifying your school or university can reveal your age, location, and daily routine.',
        example: 'School name, uniform, or campus building visible.',
        blurrable: true
      });
    }
    
    // Time indicators
    if (/clock|time|watch|timestamp|13:|14:|15:|morning|afternoon|evening/i.test(combined)) {
      items.push({
        category: 'Time leak',
        description: 'A visible clock or time indicator in the background reveals what time you posted, which can help predict your daily schedule.',
        example: 'A clock, watch, or timestamp is visible in the image.',
        blurrable: true
      });
    }
    
    // Home/residence indicators
    if (/(house number|street sign|address|mailbox|front door|doorway|house|apartment|dorm|dorm room)/i.test(combined)) {
      items.push({
        category: 'Home location leak',
        description: 'Visible house numbers, street signs, or unique home features can reveal your residential address.',
        example: 'House number, street sign, or distinctive home feature visible.',
        blurrable: true
      });
    }
    
    // Vehicle/license plate
    if (/(license plate|car|vehicle|registration|automobile)/i.test(combined)) {
      items.push({
        category: 'Vehicle leak',
        description: 'License plates or vehicle details can be used to track your location and identify your vehicle.',
        example: 'License plate or vehicle registration visible.',
        blurrable: true
      });
    }
  });
}

function detectCaptionLeaks(textContent, items) {
  if (/(daily|every day|everyday|always|routine|morning)/i.test(textContent) && /coffee|matcha|latte|tea/i.test(textContent)) {
    items.push({
      category: 'Routine leak',
      description: 'The caption implies a repeated daily activity, which can be used to infer your routine.',
      example: 'Caption says "daily coffee time" or similar.',
      blurrable: true
    });
  }
  if (/first day of the month|1st day|monthly|every month/i.test(textContent)) {
    items.push({
      category: 'Schedule leak',
      description: 'A recurring schedule is visible, which reveals when you do certain activities.',
      example: 'Comments or captions mention dates or a regular monthly pattern.',
      blurrable: true
    });
  }
  if (/(brand|bag|nails|phone case|jacket)/i.test(textContent)) {
    items.push({
      category: 'Personal style leak',
      description: 'Visible belongings like bags, nails, or clothing brands can help identify you or your habits.',
      example: 'Image details mention a bag brand or a fresh manicure.',
      blurrable: true
    });
  }
  
  // Location-specific captions
  if (/(at|visiting|just arrived|here at|in|spotted at)\s+(starbucks|dunkin|mcdonald|burger king|chipotle|whole foods|trader joe|target|walmart|coffee shop)/i.test(textContent)) {
    items.push({
      category: 'Location tag leak',
      description: 'Explicitly mentioning a specific business location reveals where you spend time.',
      example: 'Caption says "just arrived at Dunkin in Manhattan".',
      blurrable: true
    });
  }
  
  // Institution mentions
  if (/(go to|attend|study at|school at|university|college)\s+([\w\s]+\s*(?:high school|elementary|middle school|university|college))/i.test(textContent)) {
    items.push({
      category: 'Institution leak',
      description: 'Mentioning your school or university reveals your location and daily routine.',
      example: 'Caption mentions school, college, or university name.',
      blurrable: true
    });
  }
}

function detectCommentLeaks(commentText) {
  const issues = [];
  if (/(moved to|in nyc|in new york|miss you already|miss you)/i.test(commentText)) {
    issues.push({
      category: 'Social context leak',
      description: 'A comment reveals your recent move or change of city, which is useful information for someone building a profile on you.',
      example: `Comment says "${commentText}".`,
      blurrable: true
    });
  }
  if (/(can’t believe you moved|welcome to|love having you here|hope the move is going well)/i.test(commentText)) {
    issues.push({
      category: 'Location / life change leak',
      description: 'The comment references a move, suggesting that you may be in a new area and still adjusting.',
      example: `Comment says "${commentText}".`,
      blurrable: true
    });
  }
  if (/(repair|rent|help out with my rent|need money|click the link|pay this|fund my)/i.test(commentText)) {
    issues.push({
      category: 'Phishing / scam signal',
      description: 'This message matches common scam patterns and may have been generated from details scraped from your profile.',
      example: `Suspicious text: "${commentText}".`,
      blurrable: false
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
  
  // Check if any items can be blurred
  const hasBlurrableItems = outcome.items.some(item => item.blurrable);
  const blurButtonHTML = hasBlurrableItems ? '<button class="optic-blur">🎨 Blur Sensitive Areas</button>' : '';
  
  banner.innerHTML = `
    <strong>Optic Privacy Guard</strong>
    <div class="optic-reason">Potential leaks detected: ${outcome.items.map((item) => item.category).filter(Boolean).join(', ') || 'Details found'}.</div>
    <div class="optic-summary">${outcome.items.slice(0, 2).map((item) => item.description).join(' ')}</div>
    <div class="optic-advice">${outcome.reason}</div>
    <div class="optic-buttons">
      ${blurButtonHTML}
      <button class="optic-close">Dismiss</button>
    </div>
  `;
  
  banner.querySelector('.optic-close').addEventListener('click', () => banner.remove());
  
  // Add blur button handler if available
  const blurBtn = banner.querySelector('.optic-blur');
  if (blurBtn) {
    blurBtn.addEventListener('click', () => {
      // Show an interactive UI or guide for blurring
      const guide = document.createElement('div');
      guide.className = 'optic-blur-guide';
      guide.innerHTML = `
        <div style="background: #fff3cd; padding: 12px; border-radius: 8px; margin-top: 10px; font-size: 13px;">
          <strong>📸 How to blur sensitive areas:</strong>
          <ol style="margin: 8px 0; padding-left: 20px;">
            <li>Use your device's built-in editor or an app like Snapseed</li>
            <li>Blur: faces, license plates, store names, address details</li>
            <li>Avoid: background clues that identify locations</li>
            <li>Re-upload the edited version to replace this post</li>
          </ol>
        </div>
      `;
      banner.appendChild(guide);
      blurBtn.style.display = 'none';
    });
  }
  banner.addEventListener('click', (event) => {
    if (event.target !== banner && !event.target.closest('.optic-close')) return;
  });
  container.prepend(banner);
}

function sendNotification(outcome) {
  if (!chrome.runtime || !chrome.runtime.sendMessage) return;
  
  // Check if items can be blurred
  const hasBlurrableItems = outcome.items.some(item => item.blurrable);
  const actionText = hasBlurrableItems ? ' Would you like to blur them out?' : '';
  
  chrome.runtime.sendMessage({
    type: 'optic_show_notification',
    title: 'Optic Privacy Guard: Possible Information Leak',
    message: `This picture might include personal info or details like a specific location, or routine clues.${actionText}`
  });
}

// Listen for test banner messages from popup (used to trigger a sample banner)
try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'optic_test_banner' && msg.sample) {
      const containers = getPostContainers();
      const target = containers && containers.length ? containers[0] : document.body;
      try {
        renderBanner(target, msg.sample);
        sendResponse && sendResponse({ ok: true });
      } catch (e) {
        console.error('Failed to render test banner', e);
        sendResponse && sendResponse({ ok: false, error: String(e) });
      }
    }
  });
} catch (e) {
  console.warn('Runtime messaging not available in content script', e);
}

initializeOptic();
