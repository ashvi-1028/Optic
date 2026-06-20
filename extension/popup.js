const scanContent = document.getElementById('scan-content');
const scanComments = document.getElementById('scan-comments');
const scanMessages = document.getElementById('scan-messages');
const requestPermission = document.getElementById('request-permission');

const defaultSettings = {
  scanContent: true,
  scanComments: true,
  scanMessages: true
};

function saveSettings() {
  chrome.storage.local.set({ opticSettings: {
    scanContent: scanContent.checked,
    scanComments: scanComments.checked,
    scanMessages: scanMessages.checked
  }});
}

function loadSettings() {
  chrome.storage.local.get(['opticSettings'], (result) => {
    const settings = result.opticSettings || defaultSettings;
    scanContent.checked = settings.scanContent;
    scanComments.checked = settings.scanComments;
    scanMessages.checked = settings.scanMessages;
  });
}

scanContent.addEventListener('change', saveSettings);
scanComments.addEventListener('change', saveSettings);
scanMessages.addEventListener('change', saveSettings);

requestPermission.addEventListener('click', async () => {
  if (!chrome.permissions) {
    alert('Your browser does not support extension permissions API.');
    return;
  }
  chrome.permissions.request({ origins: ['<all_urls>'] }, (granted) => {
    if (granted) {
      alert('Page access enabled. Optic can scan pages now.');
    } else {
      alert('Permission denied. Optic will not scan pages without access.');
    }
  });
});

loadSettings();
