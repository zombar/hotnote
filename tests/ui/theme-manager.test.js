import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initThemeManager,
  toggleTheme,
  getCurrentTheme,
  cleanupThemeManager,
} from '../../src/ui/theme-manager.js';
import { appState } from '../../src/state/app-state.js';

describe('Theme Manager', () => {
  let darkModeToggle;
  let themeColorMeta;
  let icon;

  beforeEach(() => {
    // Setup DOM
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = `
      <button id="dark-mode-toggle">
        <span class="material-symbols-outlined">dark_mode</span>
      </button>
      <meta name="theme-color" content="#e91e8c">
    `;
    document.body.classList.add('preload');

    darkModeToggle = document.getElementById('dark-mode-toggle');
    icon = darkModeToggle.querySelector('.material-symbols-outlined');
    themeColorMeta = document.querySelector('meta[name="theme-color"]');

    // Clear localStorage
    localStorage.clear();

    // Mock appState
    appState.editorView = null;
    appState.editorManager = null;
    appState.isGitHubMode = false;
    appState.currentFilename = 'test.md';

    // Mock functions
    globalThis.getEditorContent = vi.fn(() => 'test content');
    globalThis.initEditor = vi.fn();
  });

  afterEach(() => {
    cleanupThemeManager();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    delete globalThis.getEditorContent;
    delete globalThis.initEditor;
    vi.clearAllMocks();
  });

  describe('initThemeManager', () => {
    it('should initialize with light theme by default', () => {
      initThemeManager();

      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      expect(icon.textContent).toBe('dark_mode');
      expect(darkModeToggle.title).toBe('Switch to dark mode');
      expect(themeColorMeta.getAttribute('content')).toBe('#e91e8c');
    });

    it('should initialize with dark theme from localStorage', () => {
      localStorage.setItem('theme', 'dark');

      initThemeManager();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(icon.textContent).toBe('light_mode');
      expect(darkModeToggle.title).toBe('Switch to light mode');
      expect(themeColorMeta.getAttribute('content')).toBe('#ff2d96');
    });

    it('should initialize with light theme from localStorage', () => {
      localStorage.setItem('theme', 'light');

      initThemeManager();

      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      expect(icon.textContent).toBe('dark_mode');
    });

    it('should use system preference when no saved theme', () => {
      // Mock system prefers dark
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });

      initThemeManager();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(icon.textContent).toBe('light_mode');
    });

    it('should remove preload class after initialization', async () => {
      initThemeManager();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(document.body.classList.contains('preload')).toBe(false);
    });

    it('should setup system theme listener', () => {
      const addEventListenerSpy = vi.fn();
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          addEventListener: addEventListenerSpy,
          removeEventListener: vi.fn(),
        })),
      });

      initThemeManager();

      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('toggleTheme', () => {
    beforeEach(() => {
      initThemeManager();
    });

    it('should toggle from light to dark', async () => {
      await toggleTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(icon.textContent).toBe('light_mode');
      expect(darkModeToggle.title).toBe('Switch to light mode');
      expect(themeColorMeta.getAttribute('content')).toBe('#ff2d96');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('should toggle from dark to light', async () => {
      // First set to dark
      await toggleTheme();

      // Then toggle back to light
      await toggleTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      expect(icon.textContent).toBe('dark_mode');
      expect(darkModeToggle.title).toBe('Switch to dark mode');
      expect(themeColorMeta.getAttribute('content')).toBe('#e91e8c');
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('should not reinitialize editor in GitHub mode', async () => {
      appState.isGitHubMode = true;
      appState.editorView = { scrollDOM: { scrollTop: 0, scrollLeft: 0 } };

      await toggleTheme();

      expect(globalThis.initEditor).not.toHaveBeenCalled();
    });

    it('should reinitialize CodeMirror editor with preserved scroll', async () => {
      appState.editorView = {
        scrollDOM: {
          scrollTop: 100,
          scrollLeft: 50,
        },
      };

      await toggleTheme();

      expect(globalThis.getEditorContent).toHaveBeenCalled();
      expect(globalThis.initEditor).toHaveBeenCalledWith('test content', 'test.md');

      // Wait for scroll restoration
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(appState.editorView.scrollDOM.scrollTop).toBe(100);
      expect(appState.editorView.scrollDOM.scrollLeft).toBe(50);
    });

    it('should reinitialize WYSIWYG editor with preserved scroll and mode', async () => {
      appState.editorManager = {
        getScrollPosition: vi.fn(() => 150),
        setScrollPosition: vi.fn(),
        getMode: vi.fn(() => 'wysiwyg'),
      };
      appState.focusManager = {
        focusEditor: vi.fn(),
      };

      await toggleTheme();

      expect(globalThis.getEditorContent).toHaveBeenCalled();
      expect(globalThis.initEditor).toHaveBeenCalledWith('test content', 'test.md');
      expect(localStorage.getItem('mode_test.md')).toBe('wysiwyg');

      // Wait for scroll restoration
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(appState.editorManager.setScrollPosition).toHaveBeenCalledWith(150);
      expect(appState.focusManager.focusEditor).toHaveBeenCalledWith({ reason: 'theme-toggle' });
    });

    it('should handle missing editor gracefully', async () => {
      appState.editorView = null;
      appState.editorManager = null;

      await expect(toggleTheme()).resolves.not.toThrow();
    });
  });

  describe('getCurrentTheme', () => {
    it('should return light when no theme attribute', () => {
      expect(getCurrentTheme()).toBe('light');
    });

    it('should return dark when theme attribute is dark', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(getCurrentTheme()).toBe('dark');
    });
  });

  describe('System theme change listener', () => {
    it('should apply system theme change when no user preference', async () => {
      let changeHandler;
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          addEventListener: (event, handler) => {
            if (event === 'change') {
              changeHandler = handler;
            }
          },
          removeEventListener: vi.fn(),
        })),
      });

      initThemeManager();

      // Simulate system theme change to dark
      await changeHandler({ matches: true });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(icon.textContent).toBe('light_mode');
    });

    it('should not apply system theme change when user has preference', async () => {
      localStorage.setItem('theme', 'light');

      let changeHandler;
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          addEventListener: (event, handler) => {
            if (event === 'change') {
              changeHandler = handler;
            }
          },
          removeEventListener: vi.fn(),
        })),
      });

      initThemeManager();

      // Simulate system theme change to dark
      await changeHandler({ matches: true });

      // Should remain light because user has explicit preference
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    it('should reinitialize editor on system theme change', async () => {
      appState.editorView = {
        scrollDOM: {
          scrollTop: 200,
          scrollLeft: 100,
        },
      };

      let changeHandler;
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          addEventListener: (event, handler) => {
            if (event === 'change') {
              changeHandler = handler;
            }
          },
          removeEventListener: vi.fn(),
        })),
      });

      initThemeManager();

      // Simulate system theme change
      await changeHandler({ matches: true });

      expect(globalThis.initEditor).toHaveBeenCalled();
    });
  });

  describe('cleanupThemeManager', () => {
    it('should remove event listeners', () => {
      const removeEventListenerSpy = vi.fn();
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: removeEventListenerSpy,
        })),
      });

      initThemeManager();
      cleanupThemeManager();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('should allow reinitialization after cleanup', () => {
      initThemeManager();
      cleanupThemeManager();

      expect(() => {
        initThemeManager();
      }).not.toThrow();
    });
  });
});
