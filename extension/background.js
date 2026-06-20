chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'optic_show_notification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: message.title || 'Optic Privacy Alert',
      message: message.message || 'Potential information leak detected.',
      priority: 2
    });
  }
});
