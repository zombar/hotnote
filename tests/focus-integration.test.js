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
});
