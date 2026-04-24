/**
 * utils.js — Shared utility functions
 *
 * Used by: popup.js, background.js, services
 *
 * Exports:
 *  - buildResponse(data)          → standard success response
 *  - buildErrorResponse(msg)      → standard error response
 *  - showStatus(banner, type, msg)
 *  - hideStatus(banner)
 *  - setButtonLoading(btn, state, label)
 *  - resetButton(btn, contentParts)
 *  - formatTime(seconds)
 *  - base64ToUint8Array(base64)
 */

// ─── Response Builders ─────────────────────────────────────────────

/**
 * Wrap a successful payload in a normalized response shape.
 * @param {object} data
 * @returns {{ success: true } & object}
 */
export function buildResponse(data) {
  return { success: true, ...data };
}

/**
 * Return a normalized error response.
 * @param {string} error
 * @returns {{ success: false, error: string }}
 */
export function buildErrorResponse(error) {
  return { success: false, error };
}

// ─── Status Banner ─────────────────────────────────────────────────

const STATUS_TYPES = ['success', 'error', 'info', 'loading'];
let _statusTimer = null;

/**
 * Show a status message in the banner element.
 *
 * @param {HTMLElement} banner  The banner DOM element
 * @param {'success'|'error'|'info'|'loading'} type
 * @param {string} message
 * @param {number} [autohideMs=3500]  Set to 0 to disable autohide
 */
export function showStatus(banner, type, message, autohideMs = 3500) {
  if (!banner) return;
  clearTimeout(_statusTimer);

  STATUS_TYPES.forEach(t => banner.classList.remove(t));
  banner.classList.add(type);
  banner.textContent = message;
  banner.classList.remove('hidden');

  if (autohideMs > 0 && type !== 'loading') {
    _statusTimer = setTimeout(() => hideStatus(banner), autohideMs);
  }
}

/**
 * Hide the status banner.
 * @param {HTMLElement} banner
 */
export function hideStatus(banner) {
  if (!banner) return;
  banner.classList.add('hidden');
  STATUS_TYPES.forEach(t => banner.classList.remove(t));
}

// ─── Button State ──────────────────────────────────────────────────

/**
 * Put a button into a loading state (adds spinner, disables it).
 *
 * @param {HTMLButtonElement} btn
 * @param {boolean} isLoading
 * @param {string} [loadingLabel]
 */
export function setButtonLoading(btn, isLoading, loadingLabel = 'Loading…') {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>${loadingLabel}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  }
}

/**
 * Re-set button content with arbitrary HTML parts (icon + label).
 *
 * @param {HTMLButtonElement} btn
 * @param {string[]} contentParts  Array of HTML strings to join
 */
export function resetButton(btn, contentParts) {
  if (!btn) return;
  btn.innerHTML = contentParts.join('');
  btn.disabled = false;
}

// ─── Time Formatting ───────────────────────────────────────────────

/**
 * Format seconds into M:SS display string.
 * @param {number} seconds
 * @returns {string}  e.g. "1:04"
 */
export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Base64 Helpers ────────────────────────────────────────────────

/**
 * Decode a base64 string into a Uint8Array.
 * Useful for creating audio Blobs from API responses.
 *
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
