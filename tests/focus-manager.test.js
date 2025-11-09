import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FocusManager } from '../src/focus-manager.js';

describe('FocusManager', () => {
  let focusManager;
  let mockEditorManager;
  let mockEditorView;

  beforeEach(() => {
    focusManager = new FocusManager();

    // Create mock editors with focus methods
    mockEditorManager = {
      focus: vi.fn(),
    };

    mockEditorView = {
      focus: vi.fn(),
    };

    // Clear any timers
    vi.clearAllTimers();
  });

  afterEach(() => {
    focusManager.destroy();
    vi.clearAllTimers();
  });

  describe('setEditors()', () => {
    it('should register editorManager', () => {
      focusManager.setEditors(mockEditorManager, null);
      expect(focusManager.editorManager).toBe(mockEditorManager);
    });

    it('should register editorView', () => {
      focusManager.setEditors(null, mockEditorView);
      expect(focusManager.editorView).toBe(mockEditorView);
    });

    it('should register both editors', () => {
      focusManager.setEditors(mockEditorManager, mockEditorView);
      expect(focusManager.editorManager).toBe(mockEditorManager);
      expect(focusManager.editorView).toBe(mockEditorView);
    });

    it('should allow clearing editors', () => {
      focusManager.setEditors(mockEditorManager, mockEditorView);
      focusManager.setEditors(null, null);
      expect(focusManager.editorManager).toBeNull();
      expect(focusManager.editorView).toBeNull();
    });
  });

  describe('focusEditor()', () => {
    it('should focus editorManager when available', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor();
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });

    it('should focus editorView when editorManager is not available', () => {
      focusManager.setEditors(null, mockEditorView);
      focusManager.focusEditor();
      expect(mockEditorView.focus).toHaveBeenCalledOnce();
    });

    it('should prioritize editorManager over editorView', () => {
      focusManager.setEditors(mockEditorManager, mockEditorView);
      focusManager.focusEditor();
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
      expect(mockEditorView.focus).not.toHaveBeenCalled();
    });

    it('should not throw when no editors are registered', () => {
      focusManager.setEditors(null, null);
      expect(() => focusManager.focusEditor()).not.toThrow();
    });

    it('should update lastFocusTime when focusing', () => {
      focusManager.setEditors(mockEditorManager, null);
      const before = Date.now();
      focusManager.focusEditor();
      const after = Date.now();

      expect(focusManager.getLastFocusTime()).toBeGreaterThanOrEqual(before);
      expect(focusManager.getLastFocusTime()).toBeLessThanOrEqual(after);
    });

    it('should handle focus errors gracefully', () => {
      mockEditorManager.focus = vi.fn(() => {
        throw new Error('Focus failed');
      });
      focusManager.setEditors(mockEditorManager, null);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => focusManager.focusEditor()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('focusEditor() with delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay focus when delay option is provided', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor({ delay: 100 });

      expect(mockEditorManager.focus).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });

    it('should cancel pending focus when new focus with delay is called', () => {
      focusManager.setEditors(mockEditorManager, null);

      focusManager.focusEditor({ delay: 100 });
      vi.advanceTimersByTime(50);

      // Call again with new delay - should cancel previous
      focusManager.focusEditor({ delay: 100 });
      vi.advanceTimersByTime(100);

      // Should only be called once (from second call)
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });

    it('should focus immediately when delay is 0', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor({ delay: 0 });
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });
  });

  describe('focusEditor() with reason', () => {
    it('should accept a reason parameter', () => {
      focusManager.setEditors(mockEditorManager, null);
      expect(() => {
        focusManager.focusEditor({ reason: 'test-reason' });
      }).not.toThrow();
    });

    it('should log reason in debug mode', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.setDebugMode(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      focusManager.focusEditor({ reason: 'test-reason' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-reason'));
      consoleSpy.mockRestore();
    });

    it('should not log in normal mode', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.setDebugMode(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      focusManager.focusEditor({ reason: 'test-reason' });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('hasEditorFocus()', () => {
    beforeEach(() => {
      // Mock document.activeElement
      global.document = {
        activeElement: null,
      };
    });

    it('should return true when CodeMirror editor has focus', () => {
      const mockElement = {
        classList: {
          contains: (className) => className === 'cm-content',
        },
        closest: vi.fn(),
      };
      global.document.activeElement = mockElement;

      expect(focusManager.hasEditorFocus()).toBe(true);
    });

    it('should return true when ProseMirror editor has focus', () => {
      const mockElement = {
        classList: {
          contains: (className) => className === 'ProseMirror',
        },
        closest: vi.fn(),
      };
      global.document.activeElement = mockElement;

      expect(focusManager.hasEditorFocus()).toBe(true);
    });

    it('should return false when no element has focus', () => {
      global.document.activeElement = null;
      expect(focusManager.hasEditorFocus()).toBe(false);
    });

    it('should return false when non-editor element has focus', () => {
      const mockElement = {
        classList: {
          contains: () => false,
        },
        closest: () => null,
      };
      global.document.activeElement = mockElement;

      expect(focusManager.hasEditorFocus()).toBe(false);
    });

    it('should check editor container when direct check fails', () => {
      const mockEditorContainer = {
        querySelector: vi.fn((selector) => {
          if (selector === '.cm-content') {
            return { mock: 'cm-element' };
          }
          return null;
        }),
      };

      const mockElement = {
        classList: {
          contains: () => false,
        },
        closest: (selector) => {
          if (selector === '#editor') {
            return mockEditorContainer;
          }
          return null;
        },
      };
      global.document.activeElement = mockElement;

      // Should check if active element is within editor container
      focusManager.hasEditorFocus();
      expect(mockEditorContainer.querySelector).toHaveBeenCalled();
    });
  });

  describe('cancelPendingFocus()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should cancel pending focus operation', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor({ delay: 100 });

      focusManager.cancelPendingFocus();
      vi.advanceTimersByTime(200);

      expect(mockEditorManager.focus).not.toHaveBeenCalled();
    });

    it('should not throw when no pending focus exists', () => {
      expect(() => focusManager.cancelPendingFocus()).not.toThrow();
    });
  });

  describe('focusAfterFrame()', () => {
    it('should focus on next animation frame', () => {
      focusManager.setEditors(mockEditorManager, null);

      let rafCallback;
      global.requestAnimationFrame = vi.fn((callback) => {
        rafCallback = callback;
        return 1;
      });

      focusManager.focusAfterFrame('test-reason');
      expect(mockEditorManager.focus).not.toHaveBeenCalled();

      // Execute the RAF callback
      rafCallback();
      expect(mockEditorManager.focus).toHaveBeenCalledOnce();
    });
  });

  describe('setDebugMode()', () => {
    it('should enable debug mode', () => {
      focusManager.setDebugMode(true);
      expect(focusManager.debugMode).toBe(true);
    });

    it('should disable debug mode', () => {
      focusManager.setDebugMode(true);
      focusManager.setDebugMode(false);
      expect(focusManager.debugMode).toBe(false);
    });
  });

  describe('getLastFocusTime()', () => {
    it('should return 0 initially', () => {
      expect(focusManager.getLastFocusTime()).toBe(0);
    });

    it('should return timestamp after focus', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor();
      expect(focusManager.getLastFocusTime()).toBeGreaterThan(0);
    });
  });

  describe('destroy()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should cancel pending focus operations', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor({ delay: 100 });

      focusManager.destroy();
      vi.advanceTimersByTime(200);

      expect(mockEditorManager.focus).not.toHaveBeenCalled();
    });

    it('should clear editor references', () => {
      focusManager.setEditors(mockEditorManager, mockEditorView);
      focusManager.destroy();

      expect(focusManager.editorManager).toBeNull();
      expect(focusManager.editorView).toBeNull();
    });

    it('should reset lastFocusTime', () => {
      focusManager.setEditors(mockEditorManager, null);
      focusManager.focusEditor();

      focusManager.destroy();
      expect(focusManager.getLastFocusTime()).toBe(0);
    });

    it('should clear saved state', () => {
      // Set up editor with focus detection
      global.document.activeElement = {
        classList: {
          contains: (className) => className === 'ProseMirror',
        },
        closest: vi.fn(),
      };

      // Add methods needed for state capture
      mockEditorManager.getCursor = vi.fn(() => ({ line: 1, column: 0 }));
      mockEditorManager.getScrollPosition = vi.fn(() => 0);

      focusManager.setEditors(mockEditorManager, null);
      focusManager.saveFocusState();
      expect(focusManager._savedState).not.toBeNull();

      focusManager.destroy();
      expect(focusManager._savedState).toBeNull();
    });
  });

  describe('State Preservation', () => {
    describe('_captureEditorState()', () => {
      it('should capture state from EditorManager', () => {
        const mockCursor = { line: 5, column: 10 };
        const mockScroll = 200;

        mockEditorManager.getCursor = vi.fn(() => mockCursor);
        mockEditorManager.getScrollPosition = vi.fn(() => mockScroll);

        focusManager.setEditors(mockEditorManager, null);
        const state = focusManager._captureEditorState();

        expect(state).toEqual({
          cursor: mockCursor,
          scroll: mockScroll,
        });
        expect(mockEditorManager.getCursor).toHaveBeenCalledOnce();
        expect(mockEditorManager.getScrollPosition).toHaveBeenCalledOnce();
      });

      it('should capture state from CodeMirror editorView', () => {
        const mockState = {
          selection: { main: { head: 50 } },
          doc: {
            lineAt: (_pos) => ({
              number: 3,
              from: 40,
            }),
          },
        };

        const mockView = {
          state: mockState,
          scrollDOM: { scrollTop: 150 },
        };

        focusManager.setEditors(null, mockView);
        const state = focusManager._captureEditorState();

        expect(state).toEqual({
          cursor: { line: 2, column: 10 }, // line 3 - 1, pos 50 - from 40
          scroll: 150,
        });
      });

      it('should return null when no editor is available', () => {
        focusManager.setEditors(null, null);
        const state = focusManager._captureEditorState();
        expect(state).toBeNull();
      });

      it('should handle errors gracefully', () => {
        mockEditorManager.getCursor = vi.fn(() => {
          throw new Error('Cursor error');
        });

        focusManager.setEditors(mockEditorManager, null);
        const state = focusManager._captureEditorState();
        expect(state).toBeNull();
      });

      it('should return null in debug mode when error occurs', () => {
        focusManager.setDebugMode(true);
        mockEditorManager.getCursor = vi.fn(() => {
          throw new Error('Cursor error');
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        focusManager.setEditors(mockEditorManager, null);
        const state = focusManager._captureEditorState();

        expect(state).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('_restoreEditorState()', () => {
      beforeEach(() => {
        global.requestAnimationFrame = vi.fn((callback) => {
          callback();
          return 1;
        });
      });

      it('should restore state to EditorManager', () => {
        const state = {
          cursor: { line: 5, column: 10 },
          scroll: 200,
        };

        mockEditorManager.setCursor = vi.fn();
        mockEditorManager.setScrollPosition = vi.fn();

        focusManager.setEditors(mockEditorManager, null);
        focusManager._restoreEditorState(state);

        expect(mockEditorManager.setCursor).toHaveBeenCalledWith(5, 10);
        expect(mockEditorManager.setScrollPosition).toHaveBeenCalledWith(200);
      });

      it('should restore state to CodeMirror editorView', () => {
        const state = {
          cursor: { line: 2, column: 10 },
          scroll: 150,
        };

        const mockDispatch = vi.fn();
        const mockDoc = {
          line: (_lineNum) => ({
            from: 40,
            length: 50,
          }),
        };

        const mockView = {
          state: { doc: mockDoc },
          dispatch: mockDispatch,
          scrollDOM: { scrollTop: 0 },
        };

        focusManager.setEditors(null, mockView);
        focusManager._restoreEditorState(state);

        expect(mockDispatch).toHaveBeenCalledWith({
          selection: { anchor: 50, head: 50 }, // from 40 + column 10
        });
        expect(mockView.scrollDOM.scrollTop).toBe(150);
      });

      it('should not throw when state is null', () => {
        focusManager.setEditors(mockEditorManager, null);
        expect(() => focusManager._restoreEditorState(null)).not.toThrow();
      });

      it('should handle errors in EditorManager restoration', () => {
        const state = {
          cursor: { line: 5, column: 10 },
          scroll: 200,
        };

        mockEditorManager.setCursor = vi.fn(() => {
          throw new Error('Restore error');
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        focusManager.setEditors(mockEditorManager, null);

        expect(() => focusManager._restoreEditorState(state)).not.toThrow();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should clamp column to line length in CodeMirror', () => {
        const state = {
          cursor: { line: 2, column: 100 }, // Beyond line length
          scroll: 150,
        };

        const mockDispatch = vi.fn();
        const mockDoc = {
          line: (_lineNum) => ({
            from: 40,
            length: 20, // Line is only 20 chars
          }),
        };

        const mockView = {
          state: { doc: mockDoc },
          dispatch: mockDispatch,
          scrollDOM: { scrollTop: 0 },
        };

        focusManager.setEditors(null, mockView);
        focusManager._restoreEditorState(state);

        // Should use Math.min(100, 20) = 20
        expect(mockDispatch).toHaveBeenCalledWith({
          selection: { anchor: 60, head: 60 }, // from 40 + length 20
        });
      });
    });

    describe('saveFocusState()', () => {
      beforeEach(() => {
        // Mock document.activeElement
        global.document = {
          activeElement: null,
        };
      });

      it('should save state when editor has focus', () => {
        const mockCursor = { line: 3, column: 5 };
        const mockScroll = 100;

        mockEditorManager.getCursor = vi.fn(() => mockCursor);
        mockEditorManager.getScrollPosition = vi.fn(() => mockScroll);

        // Mock editor having focus
        global.document.activeElement = {
          classList: {
            contains: (className) => className === 'ProseMirror',
          },
          closest: vi.fn(),
        };

        focusManager.setEditors(mockEditorManager, null);
        focusManager.saveFocusState();

        expect(focusManager._savedState).toEqual({
          cursor: mockCursor,
          scroll: mockScroll,
        });
      });

      it('should not save state when editor does not have focus', () => {
        mockEditorManager.getCursor = vi.fn();
        mockEditorManager.getScrollPosition = vi.fn();

        // Mock non-editor element having focus
        global.document.activeElement = {
          classList: {
            contains: () => false,
          },
          closest: () => null,
        };

        focusManager.setEditors(mockEditorManager, null);
        focusManager.saveFocusState();

        expect(focusManager._savedState).toBeNull();
        expect(mockEditorManager.getCursor).not.toHaveBeenCalled();
      });

      it('should log in debug mode when state is saved', () => {
        const mockCursor = { line: 3, column: 5 };
        const mockScroll = 100;

        mockEditorManager.getCursor = vi.fn(() => mockCursor);
        mockEditorManager.getScrollPosition = vi.fn(() => mockScroll);

        global.document.activeElement = {
          classList: {
            contains: (className) => className === 'ProseMirror',
          },
          closest: vi.fn(),
        };

        focusManager.setDebugMode(true);
        focusManager.setEditors(mockEditorManager, null);

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        focusManager.saveFocusState();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Saved focus state'),
          expect.any(Object)
        );
        consoleSpy.mockRestore();
      });
    });

    describe('State restoration on focus', () => {
      beforeEach(() => {
        global.requestAnimationFrame = vi.fn((callback) => {
          callback();
          return 1;
        });
      });

      it('should restore saved state when focusing', () => {
        const savedState = {
          cursor: { line: 5, column: 10 },
          scroll: 200,
        };

        mockEditorManager.focus = vi.fn();
        mockEditorManager.setCursor = vi.fn();
        mockEditorManager.setScrollPosition = vi.fn();

        focusManager.setEditors(mockEditorManager, null);
        focusManager._savedState = savedState;

        focusManager.focusEditor();

        expect(mockEditorManager.focus).toHaveBeenCalled();
        expect(mockEditorManager.setCursor).toHaveBeenCalledWith(5, 10);
        expect(mockEditorManager.setScrollPosition).toHaveBeenCalledWith(200);
      });

      it('should clear saved state after restoring', () => {
        const savedState = {
          cursor: { line: 5, column: 10 },
          scroll: 200,
        };

        mockEditorManager.focus = vi.fn();
        mockEditorManager.setCursor = vi.fn();
        mockEditorManager.setScrollPosition = vi.fn();

        focusManager.setEditors(mockEditorManager, null);
        focusManager._savedState = savedState;

        focusManager.focusEditor();

        expect(focusManager._savedState).toBeNull();
      });

      it('should focus without restoring if no saved state', () => {
        mockEditorManager.focus = vi.fn();
        mockEditorManager.setCursor = vi.fn();

        focusManager.setEditors(mockEditorManager, null);
        focusManager.focusEditor();

        expect(mockEditorManager.focus).toHaveBeenCalled();
        expect(mockEditorManager.setCursor).not.toHaveBeenCalled();
      });
    });
  });
});
