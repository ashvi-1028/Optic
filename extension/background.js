chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'optic_show_notification') {
    const title = message.title || 'Optic Privacy Alert';
    const msg = message.message || 'Potential information leak detected.';
    const iconUrl = chrome.runtime.getURL('icons/icon48.svg');
    
    // Create a notification with the required icon and text properties.
    if (chrome.notifications && typeof chrome.notifications.create === 'function') {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl,
          title,
          message: msg,
          priority: 2
        });
        return;
      } catch (error) {
        console.error('Failed to create chrome.notification:', error);
      }
    }

    // Fallback: use badge as a lightweight indicator
    try {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#f39c12' });
      // Clear badge after 6 seconds
      setTimeout(() => {
        try { chrome.action.setBadgeText({ text: '' }); } catch (e) {}
      }, 6000);
      console.log('Optic notification via badge:', msg);
    } catch (e) {
      console.warn('Notifications unavailable. Message:', msg, e);
    }
  }
});

// Background fetch helper so content scripts can request external analysis (avoids mixed-content)
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message?.type === 'optic_fetch') {
    const { url, method = 'GET', body } = message;
    try {
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await resp.json();
      sendResponse({ ok: true, json });
    } catch (err) {
      console.error('Background fetch failed', err);
      sendResponse({ ok: false, error: String(err) });
    }
    // Keep the message channel open for async response
    return true;
  }
});
