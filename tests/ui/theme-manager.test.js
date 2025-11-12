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
    appState.focusManager = null;
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

    it('should save cursor and scroll state for restoration after reinit', async () => {
      // Mock a document with 3 lines
      const mockDoc = {
        line: (num) => {
          if (num === 1) return { from: 0, length: 10 };
          if (num === 2) return { from: 11, length: 15 };
          if (num === 3) return { from: 27, length: 20 };
          throw new Error('Line out of range');
        },
        lineAt: (pos) => {
          if (pos < 11) return { number: 1, from: 0 };
          if (pos < 27) return { number: 2, from: 11 };
          return { number: 3, from: 27 };
        },
      };

      appState.editorView = {
        scrollDOM: {
          scrollTop: 100,
          scrollLeft: 50,
        },
        state: {
          doc: mockDoc,
          selection: {
            main: {
              head: 15, // Position in line 2, column 4
            },
          },
        },
        dispatch: vi.fn(),
      };

      await toggleTheme();

      expect(globalThis.getEditorContent).toHaveBeenCalled();
      expect(globalThis.initEditor).toHaveBeenCalledWith('test content', 'test.md');

      // Verify that cursor and scroll state were saved for restoration
      // In real usage, initEditor in app.js will check appState.pendingCursorRestore and restore it
      expect(appState.pendingCursorRestore).toBeTruthy();
      expect(appState.pendingCursorRestore.cursorPosition).toEqual({ line: 1, column: 4 });
      expect(appState.pendingCursorRestore.scrollTop).toBe(100);
      expect(appState.pendingCursorRestore.scrollLeft).toBe(50);
    });

    it('should save WYSIWYG cursor and scroll state for restoration', async () => {
      appState.editorManager = {
        getScrollPosition: vi.fn(() => 150),
        setScrollPosition: vi.fn(),
        getMode: vi.fn(() => 'wysiwyg'),
        getCursor: vi.fn(() => ({ line: 5, column: 10 })),
        setCursor: vi.fn(),
      };
      appState.focusManager = {
        focusEditor: vi.fn(),
      };

      await toggleTheme();

      expect(globalThis.getEditorContent).toHaveBeenCalled();
      expect(globalThis.initEditor).toHaveBeenCalledWith('test content', 'test.md');
      expect(localStorage.getItem('mode_test.md')).toBe('wysiwyg');

      // Verify that cursor and scroll state were saved for restoration
      // In real usage, initEditor in app.js will check appState.pendingCursorRestore and restore it
      expect(appState.pendingCursorRestore).toBeTruthy();
      expect(appState.pendingCursorRestore.cursorPosition).toEqual({ line: 5, column: 10 });
      expect(appState.pendingCursorRestore.scrollTop).toBe(150);
    });

    it('should handle missing editor gracefully', async () => {
      appState.editorView = null;
      appState.editorManager = null;

      await expect(toggleTheme()).resolves.not.toThrow();
    });

    it('should preserve editor content when switching theme - REGRESSION TEST', async () => {
      const originalContent = 'This is my important document content!';
      globalThis.getEditorContent = vi.fn(() => originalContent);
      appState.editorView = {
        scrollDOM: { scrollTop: 0, scrollLeft: 0 },
      };

      await toggleTheme();

      expect(globalThis.getEditorContent).toHaveBeenCalled();
      expect(globalThis.initEditor).toHaveBeenCalledWith(originalContent, 'test.md');
    });

    it('should not clear editor content if getEditorContent returns undefined', async () => {
      globalThis.getEditorContent = vi.fn(() => undefined);
      appState.editorView = {
        scrollDOM: { scrollTop: 0, scrollLeft: 0 },
      };

      await toggleTheme();

      // Should pass empty string as fallback, not undefined
      expect(globalThis.initEditor).toHaveBeenCalledWith('', 'test.md');
    });

    it('should handle multi-line content correctly', async () => {
      const multiLineContent = `# Title

This is a paragraph.

- List item 1
- List item 2

\`\`\`javascript
console.log('code');
\`\`\``;
      globalThis.getEditorContent = vi.fn(() => multiLineContent);
      appState.editorView = {
        scrollDOM: { scrollTop: 0, scrollLeft: 0 },
      };

      await toggleTheme();

      expect(globalThis.initEditor).toHaveBeenCalledWith(multiLineContent, 'test.md');
    });

    it('should preserve WYSIWYG content when switching theme', async () => {
      const wysiwygContent = '<h1>Title</h1><p>Content in WYSIWYG mode</p>';
      globalThis.getEditorContent = vi.fn(() => wysiwygContent);
      appState.editorManager = {
        getScrollPosition: vi.fn(() => 0),
        setScrollPosition: vi.fn(),
        getMode: vi.fn(() => 'wysiwyg'),
      };
      appState.focusManager = {
        focusEditor: vi.fn(),
      };

      await toggleTheme();

      expect(globalThis.getEditorContent).toHaveBeenCalled();
      expect(globalThis.initEditor).toHaveBeenCalledWith(wysiwygContent, 'test.md');
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

  describe('File picker focus preservation', () => {
    it('should defer editor reinit when file picker is open - REGRESSION TEST', async () => {
      // Initialize theme first
      initThemeManager();

      // Setup editor first
      appState.editorView = {
        scrollDOM: { scrollTop: 0, scrollLeft: 0 },
      };
      appState.focusManager = {
        focusEditor: vi.fn(),
      };

      // Setup: File picker is open (not hidden)
      document.body.innerHTML += `
        <div id="file-picker" class="file-picker">
          <input type="text" class="breadcrumb-input" />
        </div>
      `;
      const filePickerInput = document.querySelector('.breadcrumb-input');

      // Focus the file picker input (simulating user typing in file picker)
      filePickerInput.focus();
      expect(document.activeElement).toBe(filePickerInput);

      // Act: Toggle theme while file picker is open
      await toggleTheme();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Editor should NOT have been reinitialized
      // Instead, a flag should be set to reinit when picker closes
      expect(globalThis.initEditor).not.toHaveBeenCalled();
      expect(appState.needsEditorReinit).toBe(true);

      // Focus should remain on the file picker input
      expect(document.activeElement).toBe(filePickerInput);
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
