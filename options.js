/**
 * options.js — Settings page controller
 *
 * Responsibilities:
 *  - Load saved settings from chrome.storage.local on page open
 *  - Save all settings on "Save Settings" click
 *  - Toggle API key visibility
 *  - Sidebar navigation between sections
 *  - Reset all settings
 */

// ─── DOM References ────────────────────────────────────────────────
const apiKeyInput        = document.getElementById('api-key');
const cloudApiKeyInput   = document.getElementById('cloud-api-key');
const btnToggleKey       = document.getElementById('btn-toggle-key');
const btnToggleCloudKey  = document.getElementById('btn-toggle-cloud-key');

const defaultVoice       = document.getElementById('default-voice');
const defaultTtsModel    = document.getElementById('default-tts-model');
const maxTtsChars        = document.getElementById('max-tts-chars');

const defaultSttLanguage = document.getElementById('default-stt-language');
const sttEngineGemini    = document.getElementById('stt-engine-gemini');
const sttEngineCloud     = document.getElementById('stt-engine-cloud');

const btnSave            = document.getElementById('btn-save');
const btnCancel          = document.getElementById('btn-cancel');
const btnResetAll        = document.getElementById('btn-reset-all');
const saveBanner         = document.getElementById('save-banner');

const navLinks           = document.querySelectorAll('.nav-link');
const sections           = document.querySelectorAll('.options-section');

// ─── Defaults ──────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  apiKey: '',
  cloudApiKey: '',
  ttsVoice: 'Kore',
  ttsModel: 'gemini-2.5-flash-preview-tts',
  maxTtsChars: 5000,
  sttLanguage: 'en-US',
  useGeminiSTT: true,
};

// ─── Init ──────────────────────────────────────────────────────────
(async function init() {
  await loadSettings();
  if (typeof updateMicUI === 'function') {
    updateMicUI();
  }
})();

// ─── Load Settings ─────────────────────────────────────────────────
async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };

  apiKeyInput.value        = settings.apiKey       || '';
  cloudApiKeyInput.value   = settings.cloudApiKey  || '';
  defaultVoice.value       = settings.ttsVoice     || DEFAULT_SETTINGS.ttsVoice;
  defaultTtsModel.value    = settings.ttsModel     || DEFAULT_SETTINGS.ttsModel;
  maxTtsChars.value        = settings.maxTtsChars  ?? DEFAULT_SETTINGS.maxTtsChars;
  defaultSttLanguage.value = settings.sttLanguage  || DEFAULT_SETTINGS.sttLanguage;

  if (settings.useGeminiSTT === false) {
    sttEngineCloud.checked = true;
  } else {
    sttEngineGemini.checked = true;
  }
}

// ─── Save Settings ─────────────────────────────────────────────────
btnSave.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showBanner('error', 'Please enter your Google API key before saving.');
    apiKeyInput.focus();
    return;
  }

  const settings = {
    apiKey,
    cloudApiKey   : cloudApiKeyInput.value.trim(),
    ttsVoice      : defaultVoice.value,
    ttsModel      : defaultTtsModel.value,
    maxTtsChars   : parseInt(maxTtsChars.value, 10) || DEFAULT_SETTINGS.maxTtsChars,
    sttLanguage   : defaultSttLanguage.value,
    useGeminiSTT  : sttEngineGemini.checked,
  };

  try {
    await chrome.storage.local.set({ settings });
    showBanner('success', '✓ Settings saved successfully!');
  } catch (err) {
    console.error('[Options] save error:', err);
    showBanner('error', 'Failed to save settings. Please try again.');
  }
});

// ─── Cancel ────────────────────────────────────────────────────────
btnCancel.addEventListener('click', async () => {
  await loadSettings();
  hideBanner();
});

// ─── Reset All ─────────────────────────────────────────────────────
btnResetAll.addEventListener('click', async () => {
  const confirmed = confirm(
    'Are you sure you want to reset all settings? This will remove your saved API keys and preferences.'
  );
  if (!confirmed) return;

  try {
    await chrome.storage.local.remove('settings');
    // Reset form to defaults
    apiKeyInput.value        = '';
    cloudApiKeyInput.value   = '';
    defaultVoice.value       = DEFAULT_SETTINGS.ttsVoice;
    defaultTtsModel.value    = DEFAULT_SETTINGS.ttsModel;
    maxTtsChars.value        = DEFAULT_SETTINGS.maxTtsChars;
    defaultSttLanguage.value = DEFAULT_SETTINGS.sttLanguage;
    sttEngineGemini.checked  = true;
    showBanner('success', 'All settings have been reset.');
  } catch (err) {
    console.error('[Options] reset error:', err);
    showBanner('error', 'Could not reset settings.');
  }
});

// ─── API Key Visibility Toggle ─────────────────────────────────────
function setupToggle(btn, input) {
  btn.addEventListener('click', () => {
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  });
}

setupToggle(btnToggleKey,      apiKeyInput);
setupToggle(btnToggleCloudKey, cloudApiKeyInput);

// ─── Sidebar Navigation ────────────────────────────────────────────
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.dataset.section;

    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    sections.forEach(s => {
      s.classList.toggle('active', s.id === `section-${target}`);
    });

    hideBanner();
  });
});

// ─── Microphone Permission Helper ──────────────────────────────────
const btnRequestMic = document.getElementById('btn-request-mic');
const micStatusBadge = document.getElementById('mic-status-badge');

async function updateMicUI() {
  if (!btnRequestMic || !micStatusBadge) return;
  try {
    const perm = await navigator.permissions.query({ name: 'microphone' });
    
    const updateState = (state) => {
      if (state === 'granted') {
        micStatusBadge.textContent = 'Granted';
        micStatusBadge.className = 'badge';
        micStatusBadge.style.background = 'rgba(54, 214, 138, 0.15)';
        micStatusBadge.style.color = 'var(--accent-success)';
        micStatusBadge.style.border = '1px solid rgba(54, 214, 138, 0.3)';
        btnRequestMic.style.display = 'none';
      } else if (state === 'denied') {
        micStatusBadge.textContent = 'Denied';
        micStatusBadge.className = 'badge required';
        micStatusBadge.style = '';
        btnRequestMic.style.display = 'inline-flex';
      } else {
        micStatusBadge.textContent = 'Not Granted';
        micStatusBadge.className = 'badge optional';
        micStatusBadge.style = '';
        btnRequestMic.style.display = 'inline-flex';
      }
    };
    
    updateState(perm.state);
    perm.onchange = () => updateState(perm.state);
  } catch (err) {
    micStatusBadge.textContent = 'Unknown';
  }
}

if (btnRequestMic) {
  btnRequestMic.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      updateMicUI();
      showBanner('success', 'Microphone permission granted!');
    } catch (err) {
      updateMicUI();
      showBanner('error', 'Microphone permission denied.');
    }
  });
}

// Auto-request mic if opened from popup
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('requestMic') === 'true') {
  const sttLink = document.querySelector('.nav-link[data-section="stt"]');
  if (sttLink) sttLink.click();
  setTimeout(() => {
    if (btnRequestMic && btnRequestMic.style.display !== 'none') {
      btnRequestMic.click();
    }
  }, 500);
}

// ─── Banner Helpers ────────────────────────────────────────────────
let _bannerTimer = null;

function showBanner(type, message, autohideMs = 4000) {
  clearTimeout(_bannerTimer);
  saveBanner.className = `save-banner ${type}`;
  saveBanner.textContent = message;
  saveBanner.classList.remove('hidden');

  if (autohideMs > 0) {
    _bannerTimer = setTimeout(hideBanner, autohideMs);
  }
}

function hideBanner() {
  saveBanner.classList.add('hidden');
}
