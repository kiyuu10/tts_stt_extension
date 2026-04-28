/**
 * services/stt_service.js — Speech-to-Text via Google Cloud Speech API
 *
 * API used:
 *   POST https://speech.googleapis.com/v1/speech:recognize
 *
 * Audio is expected as a base64-encoded WebM/Opus blob recorded in the popup.
 * The API returns a transcript in `results[0].alternatives[0].transcript`.
 *
 * Docs:
 *   https://cloud.google.com/speech-to-text/docs/reference/rest/v1/speech/recognize
 *
 * NOTE: The Google Cloud Speech API requires a Google Cloud API key (not just a Gemini key).
 *       If you only have a Gemini API key, see the alternative using Gemini Flash below.
 *
 * TODO: Wire up the correct API key and confirm audio encoding support.
 */

import { buildResponse, buildErrorResponse } from '../utils.js';

const SPEECH_API_URL = 'https://speech.googleapis.com/v1/speech:recognize';

// Alternative: Use Gemini's multimodal audio understanding for STT

/**
 * Transcribe audio using the Google Cloud Speech-to-Text API.
 *
 * @param {{ audioBase64: string, mimeType: string, language: string }} payload
 * @param {{ apiKey: string, sttModel?: string }} settings
 * @returns {Promise<{ success: boolean, transcript?: string, error?: string }>}
 */
export async function sttTranscribe(payload, settings) {
  const { audioBase64, language = 'en-US' } = payload;
  const { apiKey, cloudApiKey, useGeminiSTT } = settings;

  if (!audioBase64) {
    return buildErrorResponse('No audio data provided.');
  }

  if (cloudApiKey != '' && !useGeminiSTT) {
    return await transcribeWithSpeechAPI(audioBase64, language, cloudApiKey);
  }

  return await transcribeWithGemini(audioBase64, language, apiKey);
}

// ─── Google Cloud Speech-to-Text ───────────────────────────────────
async function transcribeWithSpeechAPI(audioBase64, language, apiKey) {
  const url = `${SPEECH_API_URL}?key=${apiKey}`;


  const requestBody = {
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: language,
      enableAutomaticPunctuation: true,
      model: 'default', // 'latest_long' can process longer audio files.
    },
    audio: {
      content: audioBase64,
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
    console.error('[STT] Network error:', networkErr);
    return buildErrorResponse('Network error — check your internet connection.');
  }

  if (!rawResponse.ok) {
    const errBody = await rawResponse.json().catch(() => ({}));
    const apiMsg = errBody?.error?.message || `HTTP ${rawResponse.status}`;
    const apiStatus = errBody?.error?.status;
    console.error('[STT] Speech API error:', apiStatus, apiMsg);

    return buildErrorResponse(apiMsg + apiKey);
  }

  const json = await rawResponse.json();

  // Extract transcript from response
  // Shape: { results: [{ alternatives: [{ transcript: "..." }] }] }
  const transcript = json?.results
    ?.map(r => r?.alternatives?.[0]?.transcript || '')
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!transcript) {
    console.warn('[STT] No transcript in response:', JSON.stringify(json).slice(0, 500));
    return buildResponse({ transcript: '' });
  }

  return buildResponse({ transcript });
}


// ─── Gemini Multimodal STT (alternative) ───────────────────────────
/**
 * Use Gemini Flash's audio understanding as a fallback STT mechanism.
 * This works with a standard Gemini API key (no Google Cloud needed).
 *
 * TODO: This approach may have higher latency and different accuracy.
 *       Consider making it configurable per user in options.
 */
async function transcribeWithGemini(audioBase64, language, apiKey) {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `Please transcribe the following audio accurately. Language hint: ${language}. Return only the transcript text, no explanations.`,
          },
          {
            inlineData: {
              mimeType: 'audio/webm;codecs=opus',
              data: audioBase64,
            },
          },
        ],
      },
    ],
  };

  let rawResponse;
  try {
    rawResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    return buildErrorResponse('Network error — check your internet connection.');
  }

  if (!rawResponse.ok) {
    const errBody = await rawResponse.json().catch(() => ({}));
    const apiMsg = errBody?.error?.message || `HTTP ${rawResponse.status}`;
    return buildErrorResponse(`Gemini STT error: ${apiMsg}`);
  }

  const json = await rawResponse.json();
  const transcript = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

  return buildResponse({ transcript });
}
