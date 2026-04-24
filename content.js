/**
 * content.js — Content Script
 *
 * Responsibilities:
 *  - Read selected text from the current page
 *  - Find the currently focused input / textarea / contenteditable
 *  - Insert text into the focused element on request from the popup
 *
 * Communication:
 *  This script listens for messages from the popup and returns responses.
 *  It also broadcasts DOM events to help popup track focus changes.
 */

// ─── Message listener ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'GET_SELECTED_TEXT': {
      const text = window.getSelection()?.toString() || '';
      sendResponse({ success: true, text });
      break;
    }

    case 'INSERT_TEXT': {
      const result = insertTextAtFocus(message.payload?.text || '');
      sendResponse({ success: result });
      break;
    }

    case 'PING_CONTENT':
      sendResponse({ success: true, alive: true });
      break;

    default:
      // Unhandled — don't block
      break;
  }
  // Returning true keeps the channel open
  return true;
});

// ─── Insert text into the focused element ─────────────────────────
/**
 * Inserts `text` at the cursor position in the currently focused element:
 *   - <input> / <textarea>: sets value directly and dispatches 'input' event
 *   - contenteditable: uses document.execCommand for wide compatibility
 *
 * @param {string} text  The text to insert
 * @returns {boolean}    true if insertion succeeded, false otherwise
 */
function insertTextAtFocus(text) {
  if (!text) return false;

  const el = document.activeElement;
  if (!el) return false;

  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    el.value = before + text + after;
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (el.isContentEditable) {
    // execCommand is deprecated but remains the most broadly supported way
    // to insert into rich-text editors without breaking undo history.
    document.execCommand('insertText', false, text);
    return true;
  }

  return false;
}

// ─── Broadcast focused-element information to the popup ───────────
// This lets the popup know what kind of element is focused, enabling
// smarter "Insert to Page" behavior in the future.
let lastFocused = null;

document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el === lastFocused) return;
  lastFocused = el;

  const isEditable =
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable;

  if (isEditable) {
    chrome.runtime.sendMessage({
      action: 'FOCUS_CHANGED',
      payload: {
        tagName: el.tagName,
        isContentEditable: el.isContentEditable ?? false,
        placeholder: el.placeholder ?? '',
      },
    }).catch(() => {
      // Popup may not be open — silently ignore
    });
  }
}, true);
