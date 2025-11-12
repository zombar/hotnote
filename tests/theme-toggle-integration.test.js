/**
 * Integration tests for theme toggle functionality
 * Tests the complete flow of theme toggling with cursor/scroll preservation
 * and file picker focus preservation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appState } from '../src/state/app-state.js';
import { initThemeManager, toggleTheme, cleanupThemeManager } from '../src/ui/theme-manager.js';

describe('Theme Toggle Integration', () => {
  let originalInitEditor;
  let originalGetEditorContent;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="editor"></div>
      <div id="file-picker" class="hidden"></div>
      <div id="file-picker-resize-handle" class="hidden"></div>
      <button id="dark-mode-toggle"></button>
    `;

    // Reset appState
    appState.editorView = null;
    appState.editorManager = null;
    appState.currentFilename = 'test.md';
    appState.pendingCursorRestore = null;
    appState.needsEditorReinit = false;
    appState.isGitHubMode = false;

    // Save original global functions
    originalInitEditor = globalThis.initEditor;
    originalGetEditorContent = globalThis.getEditorContent;

    // Mock global functions
    globalThis.getEditorContent = vi.fn(() => 'test content');
    globalThis.initEditor = vi.fn();

    // Mock fileSyncManager
    globalThis.fileSyncManager = {
      resume: vi.fn(),
      updateUserActivity: vi.fn(),
      updateLastModifiedLocal: vi.fn(),
    };

    // Setup focusManager
    appState.focusManager = {
      focusEditor: vi.fn(),
      setEditors: vi.fn(),
      saveFocusState: vi.fn(),
    };

    // Initialize theme manager
    initThemeManager();

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    cleanupThemeManager();
    globalThis.initEditor = originalInitEditor;
    globalThis.getEditorContent = originalGetEditorContent;
    globalThis.fileSyncManager = undefined;
    appState.focusManager = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  describe('CodeMirror Editor (non-markdown files)', () => {
    it('should preserve cursor position and scroll when toggling theme', async () => {
      // Setup: Create a mock CodeMirror editor with cursor at line 3, column 5
      const mockDoc = {
        line: (_num) => {
          // Mock 5 lines of text
          const lines = [
            { from: 0, length: 20 }, // Line 1: chars 0-19
            { from: 20, length: 25 }, // Line 2: chars 20-44
            { from: 45, length: 30 }, // Line 3: chars 45-74
            { from: 75, length: 15 }, // Line 4: chars 75-89
            { from: 90, length: 10 }, // Line 5: chars 90-99
          ];
          if (_num < 1 || _num > 5) throw new Error('Line out of range');
          return lines[_num - 1];
        },
        lineAt: (_pos) => {
          if (_pos < 20) return { number: 1, from: 0 };
          if (_pos < 45) return { number: 2, from: 20 };
          if (_pos < 75) return { number: 3, from: 45 };
          if (_pos < 90) return { number: 4, from: 75 };
          return { number: 5, from: 90 };
        },
      };

      // Cursor at line 3, column 5 = position 50 (45 + 5)
      const cursorPos = 50;

      appState.editorView = {
        scrollDOM: {
          scrollTop: 200,
          scrollLeft: 30,
        },
        state: {
          doc: mockDoc,
          selection: {
            main: {
              head: cursorPos,
              anchor: cursorPos,
            },
          },
        },
        dispatch: vi.fn(),
        focus: vi.fn(),
      };

      // Act: Toggle theme
      await toggleTheme();

      // Assert: Cursor and scroll state should be saved
      expect(appState.pendingCursorRestore).toBeTruthy();
      expect(appState.pendingCursorRestore.cursorPosition).toEqual({
        line: 2, // 0-based (line 3)
        column: 5,
      });
      expect(appState.pendingCursorRestore.scrollTop).toBe(200);
      expect(appState.pendingCursorRestore.scrollLeft).toBe(30);

      // Simulate initEditor() restoring the cursor
      // In real code, this happens in app.js after initEditor() completes
      const { cursorPosition, scrollTop, scrollLeft } = appState.pendingCursorRestore;

      // Create new editor after reinit (simulating what app.js does)
      appState.editorView = {
        scrollDOM: {
          scrollTop: 0,
          scrollLeft: 0,
        },
        state: {
          doc: mockDoc,
          selection: {
            main: { head: 0, anchor: 0 },
          },
        },
        dispatch: vi.fn(),
        focus: vi.fn(),
      };

      // Restore scroll
      appState.editorView.scrollDOM.scrollTop = scrollTop;
      appState.editorView.scrollDOM.scrollLeft = scrollLeft;

      // Restore cursor
      const doc = appState.editorView.state.doc;
      const line = doc.line(cursorPosition.line + 1); // Convert to 1-based
      const pos = line.from + Math.min(cursorPosition.column, line.length);
      appState.editorView.dispatch({
        selection: { anchor: pos, head: pos },
      });
      appState.editorView.focus();

      // Verify restoration
      expect(appState.editorView.scrollDOM.scrollTop).toBe(200);
      expect(appState.editorView.scrollDOM.scrollLeft).toBe(30);
      expect(appState.editorView.dispatch).toHaveBeenCalledWith({
        selection: { anchor: 50, head: 50 },
      });
      expect(appState.editorView.focus).toHaveBeenCalled();
    });

    it('should preserve cursor at start of line', async () => {
      const mockDoc = {
        line: (_num) => ({ from: (_num - 1) * 20, length: 20 }),
        lineAt: (_pos) => {
          const lineNum = Math.floor(_pos / 20) + 1;
          return { number: lineNum, from: (lineNum - 1) * 20 };
        },
      };

      // Cursor at line 2, column 0 = position 20
      appState.editorView = {
        scrollDOM: { scrollTop: 0, scrollLeft: 0 },
        state: {
          doc: mockDoc,
          selection: { main: { head: 20, anchor: 20 } },
        },
        dispatch: vi.fn(),
      };

      await toggleTheme();

      expect(appState.pendingCursorRestore.cursorPosition).toEqual({
        line: 1, // 0-based
        column: 0,
      });
    });

    it('should preserve cursor at end of line', async () => {
      const mockDoc = {
        line: (_num) => ({ from: (_num - 1) * 20, length: 20 }),
        lineAt: (_pos) => {
          const lineNum = Math.floor(_pos / 20) + 1;
          return { number: lineNum, from: (lineNum - 1) * 20 };
        },
      };

      // Cursor at line 1, column 19 (end of line) = position 19
      appState.editorView = {
        scrollDOM: { scrollTop: 0, scrollLeft: 0 },
        state: {
          doc: mockDoc,
          selection: { main: { head: 19, anchor: 19 } },
        },
        dispatch: vi.fn(),
      };

      await toggleTheme();

      expect(appState.pendingCursorRestore.cursorPosition).toEqual({
        line: 0,
        column: 19,
      });
    });
  });

  describe('EditorManager (markdown files)', () => {
    it('should preserve cursor position and scroll for WYSIWYG mode', async () => {
      appState.editorManager = {
        getScrollPosition: vi.fn(() => 350),
        setScrollPosition: vi.fn(),
        getMode: vi.fn(() => 'wysiwyg'),
        getCursor: vi.fn(() => ({ line: 10, column: 15 })),
        setCursor: vi.fn(),
        focus: vi.fn(),
      };

      await toggleTheme();

      // Assert: Cursor and scroll state should be saved
      expect(appState.pendingCursorRestore).toBeTruthy();
      expect(appState.pendingCursorRestore.cursorPosition).toEqual({
        line: 10,
        column: 15,
      });
      expect(appState.pendingCursorRestore.scrollTop).toBe(350);

      // Verify mode is preserved
      expect(localStorage.getItem('mode_test.md')).toBe('wysiwyg');
    });

    it('should preserve cursor position and scroll for source mode', async () => {
      appState.editorManager = {
        getScrollPosition: vi.fn(() => 150),
        setScrollPosition: vi.fn(),
        getMode: vi.fn(() => 'source'),
        getCursor: vi.fn(() => ({ line: 5, column: 3 })),
        setCursor: vi.fn(),
        focus: vi.fn(),
      };

      await toggleTheme();

      expect(appState.pendingCursorRestore).toBeTruthy();
      expect(appState.pendingCursorRestore.cursorPosition).toEqual({
        line: 5,
        column: 3,
      });
      expect(appState.pendingCursorRestore.scrollTop).toBe(150);
      expect(localStorage.getItem('mode_test.md')).toBe('source');
    });

    it('should handle cursor at first line', async () => {
      appState.editorManager = {
        getScrollPosition: vi.fn(() => 0),
        setScrollPosition: vi.fn(),
        getMode: vi.fn(() => 'wysiwyg'),
        getCursor: vi.fn(() => ({ line: 0, column: 0 })),
        setCursor: vi.fn(),
      };

      await toggleTheme();

      expect(appState.pendingCursorRestore.cursorPosition).toEqual({
        line: 0,
        column: 0,
      });
    });

    it('should handle large scroll positions', async () => {
      appState.editorManager = {
        getScrollPosition: vi.fn(() => 9999),
        setScrollPosition: vi.fn(),
        getMode: vi.fn(() => 'wysiwyg'),
        getCursor: vi.fn(() => ({ line: 500, column: 50 })),
        setCursor: vi.fn(),
      };

      await toggleTheme();

      expect(appState.pendingCursorRestore.scrollTop).toBe(9999);
      expect(appState.pendingCursorRestore.cursorPosition).toEqual({
        line: 500,
        column: 50,
      });
    });
  });

  describe('File picker focus preservation', () => {
    it('should defer editor reinit when file picker is open', async () => {
      // Setup editor
      appState.editorView = {
        scrollDOM: { scrollTop: 50, scrollLeft: 10 },
        state: {
          doc: {
            line: (_num) => ({ from: 0, length: 10 }),
            lineAt: (_pos) => ({ number: 1, from: 0 }),
          },
          selection: { main: { head: 5, anchor: 5 } },
        },
      };

      // Setup file picker as open
      const filePicker = document.getElementById('file-picker');
      filePicker.classList.remove('hidden');
      filePicker.innerHTML = '<input class="breadcrumb-input" type="text" />';
      const input = document.querySelector('.breadcrumb-input');
      input.focus();

      expect(document.activeElement).toBe(input);

      // Act: Toggle theme while file picker is open
      await toggleTheme();

      // Assert: Editor reinit should be deferred
      expect(globalThis.initEditor).not.toHaveBeenCalled();
      expect(appState.needsEditorReinit).toBe(true);
      expect(appState.pendingCursorRestore).toBeNull(); // Cursor not saved because reinit deferred

      // Focus should remain on file picker input
      expect(document.activeElement).toBe(input);
    });

    it('should reinit editor when file picker closes after theme toggle', async () => {
      // Setup: Theme was toggled while picker was open
      appState.needsEditorReinit = true;
      appState.editorView = {
        scrollDOM: { scrollTop: 0, scrollLeft: 0 },
      };
      appState.currentFilename = 'test.md';
      appState.currentFileHandle = {}; // Mock file handle

      globalThis.initEditor = vi.fn(async (_content, _filename) => {
        // Simulate what real initEditor does - creates new editor
        appState.editorView = {
          scrollDOM: { scrollTop: 0, scrollLeft: 0 },
          state: {
            doc: {
              line: (_num) => ({ from: 0, length: 10 }),
              lineAt: (_pos) => ({ number: 1, from: 0 }),
            },
            selection: { main: { head: 0, anchor: 0 } },
          },
          dispatch: vi.fn(),
          focus: vi.fn(),
        };
      });

      // Import hideFilePicker and simulate closing the picker
      const { hideFilePicker } = await import('../src/ui/file-picker.js');

      // Setup file picker as open
      const filePicker = document.getElementById('file-picker');
      filePicker.classList.remove('hidden');

      // Close the picker
      await hideFilePicker();

      // Assert: Editor should have been reinitialized
      expect(globalThis.initEditor).toHaveBeenCalled();
      expect(appState.needsEditorReinit).toBe(false);
    });

    it('should not affect editor when file picker closes normally', async () => {
      // Setup: No pending theme change
      appState.needsEditorReinit = false;
      appState.editorView = {
        scrollDOM: { scrollTop: 0, scrollLeft: 0 },
      };
      appState.currentFileHandle = {}; // Mock file handle

      const { hideFilePicker } = await import('../src/ui/file-picker.js');

      // Setup file picker as open
      const filePicker = document.getElementById('file-picker');
      filePicker.classList.remove('hidden');

      // Close the picker
      await hideFilePicker();

      // Assert: Editor should NOT have been reinitialized
      expect(globalThis.initEditor).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle theme toggle with no editor', async () => {
      appState.editorView = null;
      appState.editorManager = null;

      await expect(toggleTheme()).resolves.not.toThrow();
      expect(appState.pendingCursorRestore).toBeNull();
    });

    it('should handle theme toggle with incomplete editor state', async () => {
      // Editor missing cursor/scroll info
      appState.editorView = {
        scrollDOM: null,
        state: null,
      };

      await expect(toggleTheme()).resolves.not.toThrow();
    });

    it('should clear previous pending restore when toggling theme twice', async () => {
      const mockDoc = {
        line: (_num) => ({ from: 0, length: 10 }),
        lineAt: (_pos) => ({ number: 1, from: 0 }),
      };

      appState.editorView = {
        scrollDOM: { scrollTop: 100, scrollLeft: 0 },
        state: {
          doc: mockDoc,
          selection: { main: { head: 5, anchor: 5 } },
        },
      };

      // First toggle
      await toggleTheme();
      const firstRestore = appState.pendingCursorRestore;
      expect(firstRestore).toBeTruthy();
      expect(firstRestore.cursorPosition.column).toBe(5);

      // Second toggle with different cursor position
      appState.editorView.state.selection.main.head = 8;
      await toggleTheme();
      const secondRestore = appState.pendingCursorRestore;
      expect(secondRestore).toBeTruthy();
      expect(secondRestore.cursorPosition.column).toBe(8);
      expect(secondRestore).not.toBe(firstRestore);
    });

    it('should handle horizontal scroll preservation', async () => {
      const mockDoc = {
        line: (_num) => ({ from: 0, length: 200 }), // Long line
        lineAt: (_pos) => ({ number: 1, from: 0 }),
      };

      appState.editorView = {
        scrollDOM: {
          scrollTop: 0,
          scrollLeft: 500, // Scrolled horizontally
        },
        state: {
          doc: mockDoc,
          selection: { main: { head: 150, anchor: 150 } },
        },
      };

      await toggleTheme();

      expect(appState.pendingCursorRestore.scrollLeft).toBe(500);
      expect(appState.pendingCursorRestore.scrollTop).toBe(0);
    });

    it('should handle zero scroll position', async () => {
      const mockDoc = {
        line: (_num) => ({ from: 0, length: 10 }),
        lineAt: (_pos) => ({ number: 1, from: 0 }),
      };

      appState.editorView = {
        scrollDOM: {
          scrollTop: 0,
          scrollLeft: 0,
        },
        state: {
          doc: mockDoc,
          selection: { main: { head: 0, anchor: 0 } },
        },
      };

      await toggleTheme();

      expect(appState.pendingCursorRestore.scrollTop).toBe(0);
      expect(appState.pendingCursorRestore.scrollLeft).toBe(0);
    });
  });

  describe('Theme state persistence', () => {
    it('should persist dark theme to localStorage', async () => {
      appState.editorView = { scrollDOM: { scrollTop: 0, scrollLeft: 0 } };

      // Start in light mode
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();

      await toggleTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('should persist light theme to localStorage', async () => {
      appState.editorView = { scrollDOM: { scrollTop: 0, scrollLeft: 0 } };

      // Set to dark first
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');

      await toggleTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      expect(localStorage.getItem('theme')).toBe('light');
    });
  });
});
