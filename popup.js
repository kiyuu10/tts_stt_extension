/**
 * popup.js — Main popup controller
 *
 * Responsibilities:
 *  - Tab navigation (TTS / STT panels)
 *  - TTS: grab selected text, speak button, audio playback
 *  - STT: microphone recording, display transcript, copy/insert to page
 *  - API key presence check on load
 *  - All heavy lifting (API calls) is delegated to background.js via chrome.runtime.sendMessage
 */

import { showStatus, hideStatus, setButtonLoading, resetButton, formatTime } from './utils.js';

// ─── DOM References ────────────────────────────────────────────────
const btnOpenOptions = document.getElementById('btn-open-options');
const btnGoToOptions = document.getElementById('btn-go-to-options');
const apiKeyWarning = document.getElementById('api-key-warning');
const statusBanner = document.getElementById('status-banner');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// TTS
const ttsText = document.getElementById('tts-text');
const ttsCharCount = document.getElementById('tts-char-count');
const ttsVoice = document.getElementById('tts-voice');
const ttsModel = document.getElementById('tts-model');
const btnGrabSelected = document.getElementById('btn-grab-selected');
const btnImportText = document.getElementById('btn-import-text');
const fileImportText = document.getElementById('file-import-text');
const btnSpeak = document.getElementById('btn-speak');
const btnSpeakLabel = document.getElementById('btn-speak-label');
const btnStopTts = document.getElementById('btn-stop-tts');
const audioPlayerContainer = document.getElementById('audio-player-container');
const audioEl = document.getElementById('tts-audio');
const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const audioDuration = document.getElementById('audio-duration');
const audioCurrentTime = document.getElementById('audio-current-time');
const audioSeek = document.getElementById('audio-seek');

// STT
const btnRecord = document.getElementById('btn-record');
const btnStopRecord = document.getElementById('btn-stop-record');
const btnImportAudio = document.getElementById('btn-import-audio');
const fileImportAudio = document.getElementById('file-import-audio');
const recordVisual = document.getElementById('record-visual');
const recordStatusText = document.getElementById('record-status-text');
const recordTimer = document.getElementById('record-timer');
const sttLanguage = document.getElementById('stt-language');
const transcriptOutput = document.getElementById('transcript-output');
const btnCopyTranscript = document.getElementById('btn-copy-transcript');
const btnClearTranscript = document.getElementById('btn-clear-transcript');
const btnInsertTranscript = document.getElementById('btn-insert-transcript');

// ─── State ─────────────────────────────────────────────────────────
let mediaRecorder = null;
let audioChunks = [];
let recordInterval = null;
let recordSeconds = 0;
let currentTranscript = '';
let isSpeaking = false;
let maxTtsChars = 5000;

// ─── Init ──────────────────────────────────────────────────────────
(async function init() {
  await checkApiKey();
  await loadSavedPreferences();
})();

// ─── API Key Check ─────────────────────────────────────────────────
async function checkApiKey() {
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || {};
  if (!settings.apiKey) {
    apiKeyWarning.classList.remove('hidden');
  } else {
    apiKeyWarning.classList.add('hidden');
  }
}

// ─── Load Preferences ──────────────────────────────────────────────
async function loadSavedPreferences() {
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || {};
  if (settings.ttsVoice) ttsVoice.value = settings.ttsVoice;
  if (settings.ttsModel) ttsModel.value = settings.ttsModel;
  if (settings.sttLanguage) sttLanguage.value = settings.sttLanguage;
  if (settings.maxTtsChars) {
    maxTtsChars = parseInt(settings.maxTtsChars, 10) || 5000;
    ttsText.maxLength = maxTtsChars;
    ttsCharCount.nextSibling.textContent = ` / ${maxTtsChars}`;
  }
}

// ─── Options Navigation ────────────────────────────────────────────
btnOpenOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

btnGoToOptions?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ─── Tab Navigation ────────────────────────────────────────────────
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.dataset.tab;
    tabBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.tab === targetTab);
      b.setAttribute('aria-selected', b.dataset.tab === targetTab ? 'true' : 'false');
    });
    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${targetTab}`);
    });
    hideStatus(statusBanner);
  });
});

// ─── Character Counter ─────────────────────────────────────────────
ttsText.addEventListener('input', () => {
  ttsCharCount.textContent = ttsText.value.length;
});

// ─── Grab Selected Text ────────────────────────────────────────────
btnGrabSelected.addEventListener('click', async () => {
  setButtonLoading(btnGrabSelected, true, 'Grabbing…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || '',
    });
    const selectedText = results?.[0]?.result || '';
    if (selectedText) {
      ttsText.value = selectedText;
      ttsCharCount.textContent = selectedText.length;
      showStatus(statusBanner, 'success', 'Selected text grabbed!');
    } else {
      showStatus(statusBanner, 'info', 'No text selected on the page.');
    }
  } catch (err) {
    showStatus(statusBanner, 'error', 'Could not access the current tab.');
    console.error('[TTS] grab selected:', err);
  } finally {
    setButtonLoading(btnGrabSelected, false, '');
    resetButton(btnGrabSelected, [
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      'Grab Selected Text',
    ]);
  }
});

// ─── Import Text File ──────────────────────────────────────────────
btnImportText.addEventListener('click', () => {
  fileImportText.click();
});

fileImportText.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    ttsText.value = e.target.result.slice(0, maxTtsChars); // Max chars based on settings
    ttsCharCount.textContent = ttsText.value.length;
    showStatus(statusBanner, 'success', 'Text file imported!');
  };
  reader.onerror = () => {
    showStatus(statusBanner, 'error', 'Failed to read file.');
  };
  reader.readAsText(file);
  fileImportText.value = ''; // Reset input
});

// ─── TTS: Speak ────────────────────────────────────────────────────
btnSpeak.addEventListener('click', async () => {
  const text = ttsText.value.trim();
  if (!text) {
    showStatus(statusBanner, 'error', 'Please enter some text to speak.');
    return;
  }
  if (text.length > maxTtsChars) {
    showStatus(statusBanner, 'error', `Text too long. Keep it under ${maxTtsChars} characters.`);
    return;
  }

  isSpeaking = true;
  btnSpeak.disabled = true;
  btnSpeakLabel.textContent = 'Generating…';
  btnStopTts.classList.remove('hidden');
  hideStatus(statusBanner);
  showStatus(statusBanner, 'loading', 'Calling TTS API…');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'TTS_SPEAK',
      payload: {
        text,
        voice: ttsVoice.value,
        model: ttsModel.value,
      },
    });

    if (!response.success) {
      throw new Error(response.error || 'TTS failed.');
    }

    // response.audioBase64 is a base64-encoded audio/pcm or audio/mp3 string
    const audioSrc = `data:${response.mimeType || 'audio/mp3'};base64,${response.audioBase64}`;
    audioEl.src = audioSrc;
    audioPlayerContainer.classList.remove('hidden');
    audioEl.play();
    showStatus(statusBanner, 'success', 'Playing audio!');
  } catch (err) {
    showStatus(statusBanner, 'error', err.message || 'TTS error. Check your API key.');
    console.error('[TTS] speak error:', err);
  } finally {
    isSpeaking = false;
    btnSpeak.disabled = false;
    btnSpeakLabel.textContent = 'Speak';
    btnStopTts.classList.add('hidden');
  }
});

btnStopTts.addEventListener('click', () => {
  audioEl.pause();
  audioEl.currentTime = 0;
  btnStopTts.classList.add('hidden');
  showStatus(statusBanner, 'info', 'Stopped.');
});

// ─── Audio Player Controls ─────────────────────────────────────────
audioEl.addEventListener('loadedmetadata', () => {
  audioDuration.textContent = formatTime(audioEl.duration);
  audioSeek.value = 0;
});

audioEl.addEventListener('timeupdate', () => {
  audioCurrentTime.textContent = formatTime(audioEl.currentTime);
  if (audioEl.duration) {
    audioSeek.value = (audioEl.currentTime / audioEl.duration) * 100;
  }
});

audioEl.addEventListener('play', () => {
  iconPlay.classList.add('hidden');
  iconPause.classList.remove('hidden');
});

audioEl.addEventListener('pause', () => {
  iconPlay.classList.remove('hidden');
  iconPause.classList.add('hidden');
});

audioEl.addEventListener('ended', () => {
  iconPlay.classList.remove('hidden');
  iconPause.classList.add('hidden');
});

btnPlayPause.addEventListener('click', () => {
  if (audioEl.paused) {
    audioEl.play();
  } else {
    audioEl.pause();
  }
});

audioSeek.addEventListener('input', () => {
  if (audioEl.duration) {
    audioEl.currentTime = (audioSeek.value / 100) * audioEl.duration;
  }
});

// ─── STT: Recording ────────────────────────────────────────────────
btnRecord.addEventListener('click', async () => {
  hideStatus(statusBanner);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    startRecording(stream);
  } catch (err) {
    console.error('[STT] mic error:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message.toLowerCase().includes('denied')) {
      showStatus(statusBanner, 'error', 'Microphone access denied. Opening options to grant permission...');
      setTimeout(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html?requestMic=true') });
      }, 1500);
    } else {
      showStatus(statusBanner, 'error', 'Microphone error: ' + err.message);
    }
  }
});

function startRecording(stream) {
  audioChunks = [];
  recordSeconds = 0;

  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

  mediaRecorder.addEventListener('dataavailable', e => {
    if (e.data.size > 0) audioChunks.push(e.data);
  });

  mediaRecorder.addEventListener('stop', async () => {
    stream.getTracks().forEach(t => t.stop());
    await processRecording();
  });

  mediaRecorder.start(250);

  // UI updates
  btnRecord.classList.add('hidden');
  btnStopRecord.classList.remove('hidden');
  recordVisual.classList.add('recording');
  recordStatusText.textContent = 'Recording…';
  recordTimer.classList.remove('hidden');
  recordTimer.textContent = '00:00';

  recordInterval = setInterval(() => {
    recordSeconds++;
    const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
    const s = String(recordSeconds % 60).padStart(2, '0');
    recordTimer.textContent = `${m}:${s}`;
  }, 1000);
}

btnStopRecord.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  clearInterval(recordInterval);
  btnRecord.classList.remove('hidden');
  btnStopRecord.classList.add('hidden');
  recordVisual.classList.remove('recording');
  recordStatusText.textContent = 'Processing…';
  recordTimer.classList.add('hidden');
});

async function processRecording() {
  if (audioChunks.length === 0) {
    recordStatusText.textContent = 'Ready to record';
    return;
  }
  const blob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
  await performTranscription(blob);
}

async function performTranscription(blob) {
  showStatus(statusBanner, 'loading', 'Transcribing audio…');
  recordStatusText.textContent = 'Transcribing…';

  try {
    const base64Audio = await blobToBase64(blob);

    const response = await chrome.runtime.sendMessage({
      action: 'STT_TRANSCRIBE',
      payload: {
        audioBase64: base64Audio,
        mimeType: blob.type || 'audio/webm;codecs=opus',
        language: sttLanguage.value,
      },
    });

    if (!response.success) {
      throw new Error(response.error || 'Transcription failed.');
    }

    currentTranscript = response.transcript || '';
    if (currentTranscript) {
      transcriptOutput.innerHTML = '';
      transcriptOutput.textContent = currentTranscript;
      showStatus(statusBanner, 'success', 'Transcription complete!');
    } else {
      transcriptOutput.innerHTML = '<span class="placeholder-text">No speech detected.</span>';
      showStatus(statusBanner, 'info', 'No speech detected in recording.');
    }
  } catch (err) {
    let friendlyMsg = '';
    switch (err.status) {
      case 'PERMISSION_DENIED':
        friendlyMsg = 'Permission denied: Please ensure the Cloud Speech-to-Text API is enabled for your project.';
        break;
      case 'UNAUTHENTICATED':
        friendlyMsg = 'Authentication error: Your Google Cloud API key or credentials are invalid.';
        break;
      case 'INVALID_ARGUMENT':
        friendlyMsg = 'Invalid request: Check your audio settings (needs mono, 16-bit) and ensure audio is under 1 minute.';
        if (err.message.toLowerCase().includes('sync input too long')) {
          friendlyMsg = 'Audio too long: Speech-to-Text only supports up to 1 minute of audio.';
        }
        break;
      case "RESOURCE_EXHAUSTED":
        friendlyMsg = 'Quota/Limit exceeded: You have reached your API usage limit or the file is too large.';
        break;
      case "DEADLINE_EXCEEDED":
      case "UNAVAILABLE":
        friendlyMsg = 'Service unavailable: The Google Cloud STT service is currently unavailable or timed out.';
        break;
      default:
        if (err.message.toLowerCase().includes('quota exceeded')) {
          friendlyMsg = 'Quota exceeded: You have reached your Google Cloud Speech-to-Text API usage limit.';
        }
        break;
    }

    showStatus(statusBanner, 'error', friendlyMsg || 'STT error. Check your API key.');
    console.error('[STT] transcribe error:', err);
  } finally {
    recordStatusText.textContent = 'Ready to record';
  }
}

// ─── Import Audio File ─────────────────────────────────────────────
btnImportAudio.addEventListener('click', () => {
  fileImportAudio.click();
});

fileImportAudio.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Clear input so the same file can be selected again
  fileImportAudio.value = '';

  // Max 50MB (arbitrary check)
  if (file.size > 50 * 1024 * 1024) {
    showStatus(statusBanner, 'error', 'File is too large. Max 50MB.');
    return;
  }

  await performTranscription(file);
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Strip data URL prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Transcript Actions ────────────────────────────────────────────
btnCopyTranscript.addEventListener('click', async () => {
  const text = transcriptOutput.textContent.trim();
  if (!text || text === 'Transcript will appear here after recording…') {
    showStatus(statusBanner, 'info', 'Nothing to copy yet.');
    return;
  }
  await navigator.clipboard.writeText(text);
  showStatus(statusBanner, 'success', 'Copied to clipboard!');
});

btnClearTranscript.addEventListener('click', () => {
  currentTranscript = '';
  transcriptOutput.innerHTML = '<span class="placeholder-text">Transcript will appear here after recording…</span>';
  showStatus(statusBanner, 'info', 'Transcript cleared.');
});

btnInsertTranscript.addEventListener('click', async () => {
  const text = transcriptOutput.textContent.trim();
  if (!text || text === 'Transcript will appear here after recording…') {
    showStatus(statusBanner, 'info', 'No transcript to insert.');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertTextIntoPage,
      args: [text],
    });
    showStatus(statusBanner, 'success', 'Transcript inserted into page!');
  } catch (err) {
    showStatus(statusBanner, 'error', 'Could not insert transcript into the page.');
    console.error('[STT] insert error:', err);
  }
});

// Injected function (serialized by executeScript)
function insertTextIntoPage(text) {
  const el = document.activeElement;
  if (!el) return false;

  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  if (el.isContentEditable) {
    document.execCommand('insertText', false, text);
    return true;
  }

  return false;
}
