const scanContent = document.getElementById('scan-content');
const scanComments = document.getElementById('scan-comments');
const scanMessages = document.getElementById('scan-messages');
const requestPermission = document.getElementById('request-permission');
const instagramHandle = document.getElementById('instagram-handle');
const linkInstagram = document.getElementById('link-instagram');
const accountInfo = document.getElementById('account-info');

const defaultSettings = {
  scanContent: true,
  scanComments: true,
  scanMessages: true,
  instagramHandle: null
};

function saveSettings() {
  const settings = {
    scanContent: scanContent.checked,
    scanComments: scanComments.checked,
    scanMessages: scanMessages.checked,
    instagramHandle: instagramHandle.value || null
  };
  try {
    chrome.storage.local.set({ opticSettings: settings }, () => {
      try {
        chrome.runtime.sendMessage({ type: 'settingsUpdated', settings });
      } catch (e) {
        // ignore
      }
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

function loadSettings() {
  chrome.storage.local.get(['opticSettings'], (result) => {
    const settings = result.opticSettings || defaultSettings;
    scanContent.checked = settings.scanContent;
    scanComments.checked = settings.scanComments;
    scanMessages.checked = settings.scanMessages;
    instagramHandle.value = settings.instagramHandle || '';
    
    if (settings.instagramHandle) {
      displayAccountInfo(settings.instagramHandle);
    }
  });
}

function displayAccountInfo(handle) {
  accountInfo.innerHTML = `<strong>Linked Account:</strong> ${handle}`;
  accountInfo.style.display = 'block';
}

function openInstagramProfile() {
  const handle = instagramHandle.value.trim().replace(/^@/, '');
  if (!handle) {
    alert('Please enter your Instagram handle.');
    return;
  }
  const url = `https://instagram.com/${handle}`;
  chrome.tabs.create({ url: url });
}

scanContent.addEventListener('change', saveSettings);
scanComments.addEventListener('change', saveSettings);
scanMessages.addEventListener('change', saveSettings);
instagramHandle.addEventListener('change', saveSettings);

linkInstagram.addEventListener('click', () => {
  const handle = instagramHandle.value.trim().replace(/^@/, '');
  if (!handle) {
    alert('Please enter your Instagram handle first (e.g., yourname).');
    return;
  }
  saveSettings();
  displayAccountInfo('@' + handle);
  alert(`Instagram account @${handle} linked! Optic will now scan your posts for privacy leaks.`);
  openInstagramProfile();
});

requestPermission.addEventListener('click', async () => {
  try {
    const hasPermission = await chrome.permissions?.request?.({ origins: ['<all_urls>'] });
    if (hasPermission) {
      alert('Page access enabled. Optic can scan pages now.');
    } else {
      alert('Permission denied. Optic will not scan pages without access.');
    }
  } catch (error) {
    console.error('Permission request error:', error);
    alert('Unable to request permissions. Your browser may not support this feature.');
  }
});

loadSettings();
