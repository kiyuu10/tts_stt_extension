/**
 * background.js — Service Worker
 *
 * Responsibilities:
 *  - Receive messages from popup / content scripts
 *  - Retrieve API keys and settings securely from chrome.storage.local
 *  - Call Google APIs directly (TTS via Gemini, STT via Google Speech-to-Text)
 *  - Return normalized responses to the caller
 *
 * Message actions:
 *  - TTS_SPEAK       → calls Gemini TTS API, returns { success, audioBase64, mimeType }
 *  - STT_TRANSCRIBE  → calls Google STT API, returns { success, transcript }
 *  - GET_SETTINGS    → reads and returns chrome.storage.local settings
 *  - PING            → health check
 */

import { buildResponse, buildErrorResponse } from './utils.js';
import { ttsSpeak } from './services/tts_service.js';
import { sttTranscribe } from './services/stt_service.js';

// ─── Message Listener ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(err => {
      console.error('[Background] unhandled error:', err);
      sendResponse(buildErrorResponse(err.message || 'Unknown error'));
    });

  // Return true so the message channel stays open for async responses
  return true;
});

// ─── Message Router ────────────────────────────────────────────────
async function handleMessage(message, sender) {
  const { action, payload } = message;

  switch (action) {
    case 'PING':
      return buildResponse({ pong: true });

    case 'GET_SETTINGS': {
      const data = await chrome.storage.local.get('settings');
      return buildResponse(data.settings || {});
    }

    case 'TTS_SPEAK': {
      const settings = await getSettings();
      validateApiKey(settings);
      return await ttsSpeak(payload, settings);
    }

    case 'STT_TRANSCRIBE': {
      const settings = await getSettings();
      validateApiKey(settings);
      return await sttTranscribe(payload, settings);
    }

    default:
      return buildErrorResponse(`Unknown action: ${action}`);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Retrieve settings from chrome.storage.local */
async function getSettings() {
  const data = await chrome.storage.local.get('settings');
  return data.settings || {};
}

/** Throw if the API key is missing */
function validateApiKey(settings) {
  if (!settings.apiKey) {
    throw new Error('No API key configured. Please open the Settings page and add your Google API key.');
  }
}
