# TTS & STT Assistant — Chrome Extension

A **fully client-side** Chrome Extension (Manifest V3) for Text-to-Speech and Speech-to-Text using Google APIs.

- 🔊 **TTS** — Type or grab selected text, then speak it using Google Gemini TTS
- 🎙️ **STT** — Record your microphone and get a transcript via Google Speech-to-Text (or Gemini multimodal)
- 🔑 **Your keys, your data** — API keys are stored locally in `chrome.storage.local`, never on any server
- ⚡ **No backend required** — API calls go directly from your browser to Google

---

## Folder Structure

```text
tts_stt_extension/
├── manifest.json          # Manifest V3 config
├── popup.html             # Main extension popup
├── popup.js               # Popup controller
├── popup.css              # Popup styles
├── background.js          # Service worker (API calls, message routing)
├── content.js             # Content script (selected text, insert transcript)
├── options.html           # Settings page
├── options.js             # Settings page controller
├── options.css            # Settings styles
├── utils.js               # Shared utilities (response helpers, UI helpers)
├── services/
│   ├── tts_service.js     # Google Gemini TTS API integration
│   └── stt_service.js     # Google STT / Gemini multimodal STT integration
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Prerequisites

- Google Chrome (v114+) or any Chromium-based browser
- A **Google API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey) for TTS (Gemini)
- *(Optional)* A **Google Cloud API Key** with the Speech-to-Text API enabled, from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

---

## Setup & Installation

### 1. Load the Extension in Developer Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the project folder (the directory containing `manifest.json`)

### 2. Configure Your API Key

1. Click the extension icon in the Chrome toolbar
2. Click the **⚙ Settings** icon (top-right of popup) **or** right-click the extension icon → *Options*
3. Enter your **Google API Key** in the API Keys section
4. *(Optional)* Enter a **Google Cloud API Key** if you want higher-accuracy STT
5. Click **Save Settings**

---

## Usage

### Text-to-Speech

1. Click the extension icon to open the popup
2. Open the **Text to Speech** tab
3. Either:
   - Type text directly in the text area, **or**
   - Select text on any web page, then click **Grab Selected Text**
4. Choose a **Voice** and **Model**
5. Click **Speak** — audio will play in the popup

### Speech-to-Text

1. Click the extension icon to open the popup
2. Open the **Speech to Text** tab
3. Select your **Language**
4. Click **Start Recording** — allow microphone access if prompted
5. Speak, then click **Stop**
6. The transcript appears in the Transcript area
7. Use **Copy** to copy it, or **Insert to Page** to paste it into the focused input on the current page

---

## API Details

### TTS — Google Gemini API

| Setting | Value |
|---|---|
| Endpoint | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| Default Model | `gemini-2.5-flash-preview-tts` |
| Auth | `?key=YOUR_API_KEY` query param |
| Response | Base64-encoded audio in `candidates[0].content.parts[0].inlineData.data` |

Available voices: `Kore`, `Puck`, `Charon`, `Fenrir`, `Aoede`

### STT — Google Cloud Speech-to-Text v1

| Setting | Value |
|---|---|
| Endpoint | `https://speech.googleapis.com/v1/speech:recognize` |
| Encoding | `WEBM_OPUS` (recorded via `MediaRecorder`) |
| Auth | `?key=YOUR_CLOUD_API_KEY` query param |

### STT — Gemini Multimodal (alternative)

If you only have a Gemini API key, the extension uses `gemini-2.0-flash` with audio inline data. This is configurable in **Settings → Speech to Text → STT Engine**.

---

## Security & Privacy

- ✅ API keys are stored in `chrome.storage.local` — they never leave your browser except to go to Google APIs
- ✅ No backend server, no telemetry, no analytics
- ✅ Keys are never hardcoded in source
- ✅ The extension uses `host_permissions` to allow direct API calls — this is Chrome's approved pattern for such extensions
- ⚠️ **Do not use `chrome.storage.sync`** for API keys — that would upload them to Google servers

---

## Known Limitations & TODOs

- [ ] Audio format (`WEBM_OPUS`) may need server-side conversion for some STT API plans
- [ ] Gemini TTS schema is preview and may change — update `services/tts_service.js` when stable
- [ ] Popup recording stops if popup closes — consider using an [Offscreen Document](https://developer.chrome.com/docs/extensions/reference/offscreen/) for long recordings
- [ ] Rate limiting is not implemented on the client — rely on Google API quotas
- [ ] Add keyboard shortcuts (`chrome.commands`) for TTS/STT (Phase v1.2)

---

## Development

No build step required. The extension uses plain ES modules (`type="module"`).

To make changes:
1. Edit files in the project directory
2. Go to `chrome://extensions/` and click the **Refresh** icon on the extension card
3. Test in the popup or options page


