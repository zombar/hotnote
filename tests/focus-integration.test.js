import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FocusManager } from '../src/focus-manager.js';

describe('FocusManager Integration Tests', () => {
  let focusManager;
  let mockEditorManager;
  let mockEditorView;
  let mockDOM;

  beforeEach(() => {
    focusManager = new FocusManager();

    // Create mock editors
    mockEditorManager = {
      focus: vi.fn(),
      destroy: vi.fn(),
    };

    mockEditorView = {
      focus: vi.fn(),
      destroy: vi.fn(),
      state: {
        doc: { length: 0 },
      },
    };

    // Mock DOM elements
    mockDOM = {
      picker: {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
      },
      editor: document.createElement('div'),
    };
    mockDOM.editor.id = 'editor';

    // Add editor to document for focus checks
    const cmContent = document.createElement('div');
    cmContent.className = 'cm-content';
    mockDOM.editor.appendChild(cmContent);
    document.body.appendChild(mockDOM.editor);
  });

  afterEach(() => {
    focusManager.destroy();
    if (mockDOM.editor.parentNode) {
      mockDOM.editor.parentNode.removeChild(mockDOM.editor);
    }
    vi.clearAllTimers();
  });

  describe('File Opening Workflow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should focus editor after file is opened', () => {
      // Simulate file opening workflow
      focusManager.setEditors(null, mockEditorView);

      // User clicks file in picker
      // ... file loading happens ...
      // File picker is hidden
      mockDOM.picker.classList.add('hidden');

      // Focus should be restored with delay
      focusManager.focusEditor({ delay: 100, reason: 'file-opened' });

      expect(mockEditorView.focus).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockEditorView.focus).toHaveBeenCalledOnce();
    });

    it('should handle rapid file switching', () => {
      focusManager.setEditors(null, mockEditorView);

      // User clicks multiple files rapidly
      focusManager.focusEditor({ delay: 100, reason: 'file1-opened' });
      vi.advanceTimersByTime(50);

      focusManager.focusEditor({ delay: 100, reason: 'file2-opened' });
      vi.advanceTimersByTime(50);

      focusManager.focusEditor({ delay: 100, reason: 'file3-opened' });
      vi.advanceTimersByTime(100);

      // Should only focus once (last file)
      expect(mockEditorView.focus).toHaveBeenCalledOnce();
    });
  });

  describe('File Picker Hide/Show Workflow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should focus editor when picker is hidden with open file', () => {
      focusManager.setEditors(mockEditorManager, null);
      const hasOpenFile = true;

      // Simulate hideFilePicker() behavior
      mockDOM.picker.classList.add('hidden');
      if (hasOpenFile) {
        focusManager.focusEditor({ delay: 50, reason: 'picker-hidden' });
      }

      vi.advanceTimersByTime(50);
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });

    it('should not focus when picker hidden without open file', () => {
      focusManager.setEditors(mockEditorManager, null);
      const hasOpenFile = false;

      // Simulate hideFilePicker() behavior
      mockDOM.picker.classList.add('hidden');
      if (hasOpenFile) {
        focusManager.focusEditor({ delay: 50, reason: 'picker-hidden' });
      }

      vi.advanceTimersByTime(50);
      expect(mockEditorManager.focus).not.toHaveBeenCalled();
    });
  });

  describe('New File Creation Workflow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should focus editor after new file is created', () => {
      focusManager.setEditors(mockEditorManager, null);

      // Simulate newFile() workflow
      // ... file creation logic ...
      // Editor initialized
      // Picker hidden

      focusManager.focusEditor({ delay: 100, reason: 'new-file' });

      expect(mockEditorManager.focus).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });
  });

  describe('Editor Mode Switching', () => {
    it('should maintain focus capability after switching editors', () => {
      // Start with CodeMirror
      focusManager.setEditors(null, mockEditorView);
      focusManager.focusEditor({ reason: 'initial' });
      expect(mockEditorView.focus).toHaveBeenCalledOnce();

      // Switch to Markdown (EditorManager)
      mockEditorView.focus.mockClear();
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor({ reason: 'after-switch' });
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
      expect(mockEditorView.focus).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation (Enter Key)', () => {
    it('should focus editor when Enter is pressed and editor lacks focus', () => {
      focusManager.setEditors(mockEditorManager, null);

      // Mock document.activeElement as non-editor element
      const mockButton = document.createElement('button');
      document.body.appendChild(mockButton);
      mockButton.focus();

      // Simulate Enter key handler
      if (!focusManager.hasEditorFocus()) {
        focusManager.focusEditor({ reason: 'enter-key' });
      }

      expect(mockEditorManager.focus).toHaveBeenCalledOnce();

      document.body.removeChild(mockButton);
    });

    it('should not focus when editor already has focus', () => {
      focusManager.setEditors(mockEditorManager, null);

      // Mock document.activeElement as editor element
      const cmContent = mockDOM.editor.querySelector('.cm-content');
      if (cmContent) {
        Object.defineProperty(document, 'activeElement', {
          writable: true,
          value: cmContent,
        });
      }

      // Simulate Enter key handler
      if (!focusManager.hasEditorFocus()) {
        focusManager.focusEditor({ reason: 'enter-key' });
      }

      expect(mockEditorManager.focus).not.toHaveBeenCalled();
    });
  });

  describe('Focus State Detection', () => {
    it('should detect CodeMirror focus', () => {
      const cmContent = mockDOM.editor.querySelector('.cm-content');
      if (cmContent) {
        Object.defineProperty(document, 'activeElement', {
          writable: true,
          value: cmContent,
        });
      }

      expect(focusManager.hasEditorFocus()).toBe(true);
    });

    it('should detect ProseMirror focus', () => {
      // Add ProseMirror element
      const proseMirror = document.createElement('div');
      proseMirror.className = 'ProseMirror';
      mockDOM.editor.appendChild(proseMirror);

      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: proseMirror,
      });

      expect(focusManager.hasEditorFocus()).toBe(true);
    });

    it('should detect non-editor focus', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);

      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: button,
      });

      expect(focusManager.hasEditorFocus()).toBe(false);

      document.body.removeChild(button);
    });
  });

  describe('Error Recovery', () => {
    it('should handle focus errors without breaking the app', () => {
      mockEditorManager.focus = vi.fn(() => {
        throw new Error('Editor destroyed');
      });
      focusManager.setEditors(mockEditorManager, null);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      expect(() => {
        focusManager.focusEditor({ reason: 'error-test' });
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle missing editors gracefully', () => {
      focusManager.setEditors(null, null);

      // Should not throw
      expect(() => {
        focusManager.focusEditor({ reason: 'no-editor' });
      }).not.toThrow();
    });
  });

  describe('Cleanup and Memory Management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clean up pending operations on destroy', () => {
      focusManager.setEditors(mockEditorManager, null);

      // Create pending focus operation
      focusManager.focusEditor({ delay: 100, reason: 'pending' });

      // Destroy before focus happens
      focusManager.destroy();

      vi.advanceTimersByTime(200);
      expect(mockEditorManager.focus).not.toHaveBeenCalled();
    });

    it('should allow reuse after destroy', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor({ reason: 'before-destroy' });
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();

      focusManager.destroy();

      // Set new editors and focus again
      mockEditorManager.focus.mockClear();
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor({ reason: 'after-destroy' });
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });
  });

  describe('Timing and RAF Integration', () => {
    it('should focus after animation frame', async () => {
      focusManager.setEditors(mockEditorManager, null);

      await new Promise((resolve) => {
        global.requestAnimationFrame = (callback) => {
          // Execute callback immediately in test
          setTimeout(() => {
            callback();
            resolve();
          }, 0);
          return 1;
        };

        focusManager.focusAfterFrame('raf-test');
      });

      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });
  });

  describe('Debug Mode', () => {
    it('should log focus operations in debug mode', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.setDebugMode(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      focusManager.focusEditor({ reason: 'debug-test' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[FocusManager]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('debug-test'));

      consoleSpy.mockRestore();
    });

    it('should warn when no editor available in debug mode', () => {
      focusManager.setEditors(null, null);
      focusManager.setDebugMode(true);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      focusManager.focusEditor({ reason: 'no-editor-debug' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No editor available'));

      consoleSpy.mockRestore();
    });
  });

  describe('State Preservation Integration', () => {
    let originalRAF;

    beforeEach(() => {
      // Mock document.activeElement for focus detection
      // Don't replace global.document, just set activeElement
      document.activeElement = {
        classList: {
          contains: (className) => className === 'ProseMirror',
        },
        closest: vi.fn(),
      };

      // Save original requestAnimationFrame
      originalRAF = global.requestAnimationFrame;

      // Mock requestAnimationFrame to call immediately by default
      global.requestAnimationFrame = vi.fn((callback) => {
        callback();
        return 1;
      });
    });

    afterEach(() => {
      // Restore original requestAnimationFrame
      if (originalRAF) {
        global.requestAnimationFrame = originalRAF;
      }
    });

    it('should preserve cursor position through focus cycle with EditorManager', () => {
      const originalCursor = { line: 10, column: 25 };
      const originalScroll = 500;

      mockEditorManager.getCursor = vi.fn(() => originalCursor);
      mockEditorManager.getScrollPosition = vi.fn(() => originalScroll);
      mockEditorManager.setCursor = vi.fn();
      mockEditorManager.setScrollPosition = vi.fn();

      focusManager.setEditors(mockEditorManager, null);

      // Step 1: Save state before UI operation
      focusManager.saveFocusState();

      // Verify state was captured
      expect(focusManager._savedState).toEqual({
        cursor: originalCursor,
        scroll: originalScroll,
      });

      // Step 2: Focus returns (simulating UI operation completing)
      focusManager.focusEditor({ reason: 'after-button-click' });

      // Verify cursor and scroll were restored
      expect(mockEditorManager.setCursor).toHaveBeenCalledWith(10, 25);
      expect(mockEditorManager.setScrollPosition).toHaveBeenCalledWith(500);

      // Verify state was cleared after restoration
      expect(focusManager._savedState).toBeNull();
    });

    it('should preserve cursor position through focus cycle with CodeMirror', () => {
      const mockDispatch = vi.fn();
      const mockDoc = {
        lineAt: (_pos) => ({
          number: 5,
          from: 100,
        }),
        line: (_lineNum) => ({
          from: 100,
          length: 50,
        }),
      };

      const mockView = {
        state: {
          selection: { main: { head: 120 } },
          doc: mockDoc,
        },
        dispatch: mockDispatch,
        scrollDOM: { scrollTop: 300 },
        focus: vi.fn(),
      };

      focusManager.setEditors(null, mockView);

      // Step 1: Save state before UI operation
      focusManager.saveFocusState();

      // Verify state was captured
      expect(focusManager._savedState).toEqual({
        cursor: { line: 4, column: 20 }, // line 5-1, pos 120-100
        scroll: 300,
      });

      // Step 2: Simulate scroll change during UI operation
      mockView.scrollDOM.scrollTop = 0;

      // Step 3: Focus returns
      focusManager.focusEditor({ reason: 'after-navigation' });

      // Verify cursor was restored
      expect(mockDispatch).toHaveBeenCalledWith({
        selection: { anchor: 120, head: 120 }, // from 100 + column 20
      });

      // Verify scroll was restored
      expect(mockView.scrollDOM.scrollTop).toBe(300);
    });

    it('should handle multiple save/restore cycles', () => {
      const cursor1 = { line: 1, column: 5 };
      const cursor2 = { line: 10, column: 20 };

      mockEditorManager.getCursor = vi.fn(() => cursor1);
      mockEditorManager.getScrollPosition = vi.fn(() => 100);
      mockEditorManager.setCursor = vi.fn();
      mockEditorManager.setScrollPosition = vi.fn();

      focusManager.setEditors(mockEditorManager, null);

      // First cycle
      focusManager.saveFocusState();
      focusManager.focusEditor();

      expect(mockEditorManager.setCursor).toHaveBeenCalledWith(1, 5);

      // Change cursor position
      mockEditorManager.getCursor = vi.fn(() => cursor2);
      mockEditorManager.getScrollPosition = vi.fn(() => 200);

      // Second cycle
      focusManager.saveFocusState();
      focusManager.focusEditor();

      expect(mockEditorManager.setCursor).toHaveBeenCalledWith(10, 20);
      expect(mockEditorManager.setScrollPosition).toHaveBeenCalledWith(200);
    });

    it('should not save state when editor does not have focus', () => {
      // Mock non-editor element having focus
      document.activeElement = {
        classList: {
          contains: () => false,
        },
        closest: () => null,
      };

      mockEditorManager.getCursor = vi.fn();
      mockEditorManager.getScrollPosition = vi.fn();

      focusManager.setEditors(mockEditorManager, null);
      focusManager.saveFocusState();

      // State should not be captured
      expect(focusManager._savedState).toBeNull();
      expect(mockEditorManager.getCursor).not.toHaveBeenCalled();
    });

    it('should preserve state when focusing immediately', () => {
      const cursor = { line: 5, column: 10 };
      const scroll = 200;

      mockEditorManager.getCursor = vi.fn(() => cursor);
      mockEditorManager.getScrollPosition = vi.fn(() => scroll);
      mockEditorManager.setCursor = vi.fn();
      mockEditorManager.setScrollPosition = vi.fn();

      focusManager.setEditors(mockEditorManager, null);

      // Save state
      focusManager.saveFocusState();

      // Verify state was saved
      expect(focusManager._savedState).toEqual({
        cursor,
        scroll,
      });

      // Focus immediately (no delay)
      focusManager.focusEditor({ reason: 'immediate-restore' });

      // State should be restored
      expect(mockEditorManager.setCursor).toHaveBeenCalledWith(5, 10);
      expect(mockEditorManager.setScrollPosition).toHaveBeenCalledWith(200);

      // State should be cleared after restoration
      expect(focusManager._savedState).toBeNull();
    });

    it('should handle state restoration errors gracefully', () => {
      const cursor = { line: 5, column: 10 };
      const scroll = 200;

      mockEditorManager.getCursor = vi.fn(() => cursor);
      mockEditorManager.getScrollPosition = vi.fn(() => scroll);
      mockEditorManager.setCursor = vi.fn(() => {
        throw new Error('Cursor restore failed');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      focusManager.setEditors(mockEditorManager, null);

      // Save and restore
      focusManager.saveFocusState();
      expect(() => focusManager.focusEditor()).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should preserve state across editor switches', () => {
      const cursor = { line: 3, column: 8 };
      const scroll = 150;

      mockEditorManager.getCursor = vi.fn(() => cursor);
      mockEditorManager.getScrollPosition = vi.fn(() => scroll);
      mockEditorManager.setCursor = vi.fn();
      mockEditorManager.setScrollPosition = vi.fn();

      // Start with EditorManager
      focusManager.setEditors(mockEditorManager, null);
      focusManager.saveFocusState();

      expect(focusManager._savedState).toEqual({
        cursor,
        scroll,
      });

      // Switch to CodeMirror (simulating mode change)
      const mockDispatch = vi.fn();
      const mockDoc = {
        line: (_lineNum) => ({
          from: 50,
          length: 20,
        }),
      };

      const mockView = {
        state: { doc: mockDoc },
        dispatch: mockDispatch,
        scrollDOM: { scrollTop: 0 },
        focus: vi.fn(),
      };

      focusManager.setEditors(null, mockView);

      // State should still exist but won't restore to different editor type
      // This documents the current behavior - state is editor-type specific
      focusManager.focusEditor();

      // CodeMirror restoration will fail because saved state has EditorManager format
      // but the error should be caught
      expect(() => focusManager.focusEditor()).not.toThrow();
    });

    it('should clear saved state on destroy even if not restored', () => {
      const cursor = { line: 1, column: 0 };
      const scroll = 0;

      mockEditorManager.getCursor = vi.fn(() => cursor);
      mockEditorManager.getScrollPosition = vi.fn(() => scroll);

      focusManager.setEditors(mockEditorManager, null);
      focusManager.saveFocusState();

      expect(focusManager._savedState).not.toBeNull();

      focusManager.destroy();

      expect(focusManager._savedState).toBeNull();
    });
  });
});
