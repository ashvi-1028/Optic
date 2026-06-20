chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'optic_show_notification') {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.svg'),
        title: message.title || 'Optic Privacy Alert',
        message: message.message || 'Potential information leak detected.',
        priority: 2
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }
});
