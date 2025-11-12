/**
 * Keyboard Manager
 *
 * Manages global keyboard event handlers and shortcuts for the application.
 * Handles:
 * - Quick file creation/search (alphanumeric keys, /, .)
 * - Editor focus (Enter key)
 * - Editor blur and file picker (Escape key)
 * - Visual blur state management
 */

import { appState } from '../state/app-state.js';

// Store event listeners for cleanup
let keydownListeners = [];
let focusinListener = null;
let focusoutListener = null;

/**
 * Initialize keyboard manager with global event listeners
 */
export function initKeyboardManager() {
  setupQuickFileCreationListener();
  setupEnterKeyListener();
  setupEscapeKeyListener();
  setupFocusMonitoring();
}

/**
 * Cleanup keyboard manager by removing all event listeners
 */
export function cleanupKeyboardManager() {
  // Remove all keydown listeners
  keydownListeners.forEach((listener) => {
    document.removeEventListener('keydown', listener);
  });
  keydownListeners = [];

  // Remove focus listeners
  if (focusinListener) {
    document.removeEventListener('focusin', focusinListener);
    focusinListener = null;
  }
  if (focusoutListener) {
    document.removeEventListener('focusout', focusoutListener);
    focusoutListener = null;
  }
}

/**
 * Setup global keyboard listener for quick file creation/search
 * Triggers on alphanumeric keys, forward slash, or period
 */
function setupQuickFileCreationListener() {
  const listener = async (e) => {
    // Trigger on alphanumeric keys, forward slash, or period
    if (!/^[a-zA-Z0-9\/\.]$/.test(e.key)) {
      return;
    }

    // Don't trigger if user is typing in an input field or the editor
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.classList.contains('cm-content') ||
        activeElement.classList.contains('ProseMirror'))
    ) {
      return;
    }

    // Don't trigger if there's no directory context
    if (!appState.currentDirHandle) {
      return;
    }

    // Don't trigger if autocomplete is already showing
    if (document.querySelector('.breadcrumb-input')) {
      return;
    }

    // Trigger quick file creation/search with the typed character
    e.preventDefault();

    // Call quickFileCreate - it should be available globally in app context

    if (typeof quickFileCreate !== 'undefined') {
      // eslint-disable-next-line no-undef
      await quickFileCreate(e.key);
    }
  };

  document.addEventListener('keydown', listener);
  keydownListeners.push(listener);
}

/**
 * Setup global Enter key listener to focus editor
 */
function setupEnterKeyListener() {
  const listener = (e) => {
    if (e.key !== 'Enter') {
      return;
    }

    // Don't trigger if navbar input is showing
    if (document.querySelector('.breadcrumb-input')) {
      return;
    }

    // Don't trigger if user is typing in an input field or textarea
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }

    // Check if editor already has focus
    if (appState.focusManager?.hasEditorFocus()) {
      return;
    }

    // Focus the appropriate editor
    e.preventDefault();
    appState.focusManager?.focusEditor({ reason: 'enter-key' });
  };

  document.addEventListener('keydown', listener);
  keydownListeners.push(listener);
}

/**
 * Setup global Escape key listener to blur editor and show file picker
 */
function setupEscapeKeyListener() {
  const listener = async (e) => {
    if (e.key !== 'Escape') {
      return;
    }

    // Don't trigger if navbar input is showing
    if (document.querySelector('.breadcrumb-input')) {
      return;
    }

    // Check if editor has focus
    if (appState.focusManager?.hasEditorFocus()) {
      // Blur the active element (editor) and show file picker
      e.preventDefault();
      document.activeElement?.blur();

      // Show file picker if we have a directory context
      // This saves current file, shows picker with file list, and focuses search input
      if (appState.currentDirHandle) {
        // Call showFilePicker - it should be available globally in app context

        if (typeof showFilePicker !== 'undefined') {
          // eslint-disable-next-line no-undef
          await showFilePicker(appState.currentDirHandle);

          // Select all text in the search input (quickFileCreate is called by showFilePicker)
          const input = document.querySelector('.breadcrumb-input');
          if (input) {
            input.select();
          }
        }
      }
    }
  };

  document.addEventListener('keydown', listener);
  keydownListeners.push(listener);
}

/**
 * Setup focus monitoring to update editor blur state
 */
function setupFocusMonitoring() {
  // Monitor focus changes to update blur state
  focusinListener = () => {
    updateEditorBlurState();
  };
  document.addEventListener('focusin', focusinListener);

  focusoutListener = () => {
    // Use setTimeout to allow focus to shift to new element
    setTimeout(() => {
      updateEditorBlurState();
    }, 10);
  };
  document.addEventListener('focusout', focusoutListener);
}

/**
 * Visual blur effect management - toggle blur class on editor based on focus
 * Exported for testing and manual calls
 */
export function updateEditorBlurState() {
  const editorElement = document.getElementById('editor');
  if (!editorElement) return;

  const hasEditorFocus = appState.focusManager?.hasEditorFocus();
  console.log(
    '[Focus] updateEditorBlurState - hasEditorFocus:',
    hasEditorFocus,
    'activeElement:',
    document.activeElement
  );

  if (hasEditorFocus) {
    editorElement.classList.remove('blurred');
  } else {
    // Only add blur if focus went to something meaningful (not null/body)
    const activeElement = document.activeElement;
    const isFocusOnNothing =
      !activeElement || activeElement === document.body || activeElement.tagName === 'BODY';

    if (isFocusOnNothing) {
      // Focus went nowhere - don't blur, but also DON'T restore focus
      // Restoring focus can trigger scroll resets during TOC navigation
      // Note: NOT calling editor.focus() here to avoid scroll interference
    } else {
      // Focus went to a real element (like search box, button, etc) - blur is OK
      editorElement.classList.add('blurred');
    }
  }
}
