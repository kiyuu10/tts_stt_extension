/**
 * services/tts_service.js — Text-to-Speech via Google Gemini API
 *
 * API used:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *
 * Gemini TTS models support audio output via responseModalities: ["AUDIO"].
 * The API returns audio as an inline base64-encoded part.
 *
 * Docs:
 *   https://ai.google.dev/api/generate-content
 *   https://ai.google.dev/gemini-api/docs/speech-generation
 *
 * TODO: Update API endpoint / request schema when the stable TTS endpoint is released.
 */

import { buildResponse, buildErrorResponse } from '../utils.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Convert text to speech using the Google Gemini TTS API.
 *
 * @param {{ text: string, voice: string, model: string }} payload
 * @param {{ apiKey: string }} settings
 * @returns {Promise<{ success: boolean, audioBase64?: string, mimeType?: string, error?: string }>}
 */
export async function ttsSpeak(payload, settings) {
  const { text, voice = 'Kore', model = 'gemini-2.5-flash-preview-tts' } = payload;
  const { apiKey } = settings;

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  // TODO: Adjust request body when Gemini TTS API schema is finalized.
  const requestBody = {
    contents: [
      {
        parts: [{ text }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
    },
  };

  let rawResponse;
  try {
    rawResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    console.error('[TTS] Network error:', networkErr);
    return buildErrorResponse('Network error — check your internet connection.');
  }

  if (!rawResponse.ok) {
    const errBody = await rawResponse.json().catch(() => ({}));
    const apiMsg  = errBody?.error?.message || `HTTP ${rawResponse.status}`;
    console.error('[TTS] API error:', apiMsg);
    return buildErrorResponse(`TTS API error: ${apiMsg}`);
  }

  const json = await rawResponse.json();

  // Extract audio from response
  // Response shape: { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
  const inlineData = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    console.error('[TTS] Unexpected response shape:', JSON.stringify(json).slice(0, 500));
    return buildErrorResponse('TTS API returned no audio data. Check the model name and try again.');
  }

  let audioBase64 = inlineData.data;
  let mimeType = inlineData.mimeType || 'audio/mp3';

  // If Gemini returns raw PCM, wrap it in a WAV file so the browser <audio> tag can play it natively
  if (mimeType.startsWith('audio/pcm') || mimeType.startsWith('audio/L16')) {
    const match = mimeType.match(/rate=(\d+)/);
    const sampleRate = match ? parseInt(match[1], 10) : 24000;
    
    try {
      const pcmBytes = base64ToUint8Array(audioBase64);
      const wavBytes = wrapPcmInWav(pcmBytes, sampleRate);
      audioBase64 = uint8ArrayToBase64(wavBytes);
      mimeType = 'audio/wav';
    } catch (e) {
      console.error('[TTS] Failed to wrap PCM in WAV:', e);
    }
  }

  return buildResponse({
    audioBase64: audioBase64,
    mimeType: mimeType,
  });
}

// --- Audio Helper Functions ---

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function wrapPcmInWav(pcmData, sampleRate = 24000) {
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true); // little-endian
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true);

  // Write PCM data
  const outputArray = new Uint8Array(buffer);
  outputArray.set(pcmData, 44);

  return outputArray;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

