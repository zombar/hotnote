/**
 * Theme Manager
 *
 * Manages light/dark theme switching with:
 * - Manual toggle via UI button
 * - System preference detection
 * - Theme persistence in localStorage
 * - Editor reinitialization on theme change
 */

import { appState } from '../state/app-state.js';

// Store system theme listener for cleanup
let systemThemeListener = null;
let systemThemeMediaQuery = null;

/**
 * Initialize theme manager
 * Sets up initial theme from localStorage or system preferences
 * and sets up system theme change listener
 */
export function initThemeManager() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldUseDark = savedTheme === 'dark' || (savedTheme === null && prefersDark);

  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const icon = darkModeToggle?.querySelector('.material-symbols-outlined');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (shouldUseDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (icon) icon.textContent = 'light_mode';
    if (darkModeToggle) darkModeToggle.title = 'Switch to light mode';
    if (themeColorMeta) themeColorMeta.setAttribute('content', '#ff2d96');
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (icon) icon.textContent = 'dark_mode';
    if (darkModeToggle) darkModeToggle.title = 'Switch to dark mode';
    if (themeColorMeta) themeColorMeta.setAttribute('content', '#e91e8c');
  }

  // Remove preload class to enable transitions after initial theme is set
  setTimeout(() => {
    document.body.classList.remove('preload');
  }, 100);

  // Setup system theme change listener
  setupSystemThemeListener();
}

/**
 * Toggle between light and dark themes
 * Reinitializes editor if active to apply new theme colors
 */
export async function toggleTheme() {
  const html = document.documentElement;
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const icon = darkModeToggle?.querySelector('.material-symbols-outlined');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const isDark = html.getAttribute('data-theme') === 'dark';

  if (isDark) {
    html.removeAttribute('data-theme');
    if (icon) icon.textContent = 'dark_mode';
    if (darkModeToggle) darkModeToggle.title = 'Switch to dark mode';
    if (themeColorMeta) themeColorMeta.setAttribute('content', '#e91e8c');
    localStorage.setItem('theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    if (icon) icon.textContent = 'light_mode';
    if (darkModeToggle) darkModeToggle.title = 'Switch to light mode';
    if (themeColorMeta) themeColorMeta.setAttribute('content', '#ff2d96');
    localStorage.setItem('theme', 'dark');
  }

  // Reinitialize editor with new theme colors (skip in GitHub reader mode)
  await reinitializeEditorWithTheme();
}

/**
 * Get current theme (light or dark)
 * @returns {string} 'light' or 'dark'
 */
export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * Cleanup theme manager by removing event listeners
 */
export function cleanupThemeManager() {
  if (systemThemeMediaQuery && systemThemeListener) {
    systemThemeMediaQuery.removeEventListener('change', systemThemeListener);
    systemThemeListener = null;
    systemThemeMediaQuery = null;
  }
}

/**
 * Setup listener for system theme changes
 * Only applies changes if user hasn't explicitly set a preference
 */
function setupSystemThemeListener() {
  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  systemThemeListener = async (e) => {
    const savedTheme = localStorage.getItem('theme');

    // Only apply system theme change if user hasn't explicitly set a preference
    if (savedTheme === null) {
      const isDark = e.matches;
      const darkModeToggle = document.getElementById('dark-mode-toggle');
      const icon = darkModeToggle?.querySelector('.material-symbols-outlined');
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');

      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (icon) icon.textContent = 'light_mode';
        if (darkModeToggle) darkModeToggle.title = 'Switch to light mode';
        if (themeColorMeta) themeColorMeta.setAttribute('content', '#ff2d96');
      } else {
        document.documentElement.removeAttribute('data-theme');
        if (icon) icon.textContent = 'dark_mode';
        if (darkModeToggle) darkModeToggle.title = 'Switch to dark mode';
        if (themeColorMeta) themeColorMeta.setAttribute('content', '#e91e8c');
      }

      // Re-initialize editor with new theme colors
      await reinitializeEditorWithTheme();
    }
  };

  systemThemeMediaQuery.addEventListener('change', systemThemeListener);
}

/**
 * Reinitialize editor with current theme
 * Preserves scroll position and editor mode
 */
async function reinitializeEditorWithTheme() {
  if (appState.isGitHubMode) {
    return; // Skip in GitHub reader mode
  }

  if (!appState.editorView && !appState.editorManager) {
    return; // No editor to reinitialize
  }

  // Get current editor content

  const currentContent =
    typeof getEditorContent !== 'undefined'
      ? // eslint-disable-next-line no-undef
        getEditorContent()
      : '';

  // Save editor state before destroying
  let scrollTop = 0;
  let scrollLeft = 0;
  let currentMode = null;

  if (appState.editorView) {
    const scroller = appState.editorView.scrollDOM;
    scrollTop = scroller.scrollTop;
    scrollLeft = scroller.scrollLeft;
  } else if (appState.editorManager) {
    scrollTop = appState.editorManager.getScrollPosition();
    currentMode = appState.editorManager.getMode(); // Preserve current mode for markdown
  }

  // Temporarily set appState.isRestoringSession to preserve the mode
  const wasRestoringSession = appState.isRestoringSession;
  if (currentMode) {
    appState.isRestoringSession = true;
    localStorage.setItem(`mode_${appState.currentFilename}`, currentMode);
  }

  // Reinitialize editor with new theme

  if (typeof initEditor !== 'undefined') {
    // eslint-disable-next-line no-undef
    await initEditor(currentContent, appState.currentFilename);
  }

  // Restore previous session state
  appState.isRestoringSession = wasRestoringSession;

  // Restore scroll position
  setTimeout(() => {
    if (appState.editorView) {
      appState.editorView.scrollDOM.scrollTop = scrollTop;
      appState.editorView.scrollDOM.scrollLeft = scrollLeft;
    } else if (appState.editorManager) {
      appState.editorManager.setScrollPosition(scrollTop);
    }

    // Restore focus after editor reinit
    if (appState.focusManager) {
      appState.focusManager.focusEditor({ reason: 'theme-toggle' });
    }
  }, 0);
}
