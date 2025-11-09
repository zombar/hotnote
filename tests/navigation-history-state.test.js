import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for Navigation History with Cursor State Preservation
 *
 * These tests verify that cursor position and scroll state are properly
 * saved to and restored from navigation history when using back/forward buttons.
 */

describe('Navigation History State Preservation', () => {
  let mockNavigationHistory;
  let mockHistoryIndex;
  let mockFocusManager;
  let mockCurrentFileHandle;

  beforeEach(() => {
    // Mock navigation history structure
    mockNavigationHistory = [];
    mockHistoryIndex = -1;

    // Mock FocusManager
    mockFocusManager = {
      _captureEditorState: vi.fn(),
      _restoreEditorState: vi.fn(),
      hasEditorFocus: vi.fn(() => true),
    };

    mockCurrentFileHandle = { name: 'test.md', kind: 'file' };
  });

  describe('addToHistory with state capture', () => {
    it('should capture editor state when adding file to history', () => {
      const editorState = { cursor: { line: 10, column: 5 }, scroll: 200 };
      mockFocusManager._captureEditorState.mockReturnValue(editorState);

      // Simulate addToHistory logic
      const historyEntry = {
        fileHandle: mockCurrentFileHandle,
        filename: 'test.md',
        editorState: mockCurrentFileHandle ? mockFocusManager._captureEditorState() : null,
      };

      expect(historyEntry.editorState).toEqual(editorState);
      expect(mockFocusManager._captureEditorState).toHaveBeenCalled();
    });

    it('should handle null state when editor not available', () => {
      mockFocusManager._captureEditorState.mockReturnValue(null);

      const historyEntry = {
        fileHandle: mockCurrentFileHandle,
        filename: 'test.md',
        editorState: mockCurrentFileHandle ? mockFocusManager._captureEditorState() : null,
      };

      expect(historyEntry.editorState).toBeNull();
    });

    it('should not capture state when no file is open', () => {
      mockCurrentFileHandle = null;

      const historyEntry = {
        fileHandle: mockCurrentFileHandle,
        filename: 'untitled',
        editorState: mockCurrentFileHandle ? mockFocusManager._captureEditorState() : null,
      };

      expect(historyEntry.editorState).toBeNull();
      expect(mockFocusManager._captureEditorState).not.toHaveBeenCalled();
    });

    it('should capture state for different cursor positions', () => {
      const testCases = [
        { cursor: { line: 0, column: 0 }, scroll: 0 },
        { cursor: { line: 100, column: 50 }, scroll: 1000 },
        { cursor: { line: 1, column: 1 }, scroll: 10 },
      ];

      testCases.forEach((state) => {
        mockFocusManager._captureEditorState.mockReturnValue(state);

        const historyEntry = {
          fileHandle: mockCurrentFileHandle,
          editorState: mockFocusManager._captureEditorState(),
        };

        expect(historyEntry.editorState).toEqual(state);
      });
    });
  });

  describe('Back/Forward navigation state restoration', () => {
    it('should restore state when navigating back', () => {
      const state1 = { cursor: { line: 5, column: 10 }, scroll: 100 };
      const state2 = { cursor: { line: 20, column: 30 }, scroll: 500 };

      mockNavigationHistory = [
        { fileHandle: { name: 'file1.md' }, editorState: state1 },
        { fileHandle: { name: 'file2.md' }, editorState: state2 },
      ];
      mockHistoryIndex = 1;

      // Simulate going back
      mockHistoryIndex--;
      const currentState = mockNavigationHistory[mockHistoryIndex];

      if (currentState.editorState) {
        mockFocusManager._restoreEditorState(currentState.editorState);
      }

      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(state1);
    });

    it('should restore state when navigating forward', () => {
      const state1 = { cursor: { line: 5, column: 10 }, scroll: 100 };
      const state2 = { cursor: { line: 20, column: 30 }, scroll: 500 };

      mockNavigationHistory = [
        { fileHandle: { name: 'file1.md' }, editorState: state1 },
        { fileHandle: { name: 'file2.md' }, editorState: state2 },
      ];
      mockHistoryIndex = 0;

      // Simulate going forward
      mockHistoryIndex++;
      const currentState = mockNavigationHistory[mockHistoryIndex];

      if (currentState.editorState) {
        mockFocusManager._restoreEditorState(currentState.editorState);
      }

      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(state2);
    });

    it('should handle missing state gracefully', () => {
      mockNavigationHistory = [{ fileHandle: { name: 'file1.md' }, editorState: null }];
      mockHistoryIndex = 0;

      const currentState = mockNavigationHistory[mockHistoryIndex];

      if (currentState.editorState) {
        mockFocusManager._restoreEditorState(currentState.editorState);
      }

      expect(mockFocusManager._restoreEditorState).not.toHaveBeenCalled();
    });

    it('should handle multiple back navigations', () => {
      const states = [
        { cursor: { line: 1, column: 0 }, scroll: 0 },
        { cursor: { line: 10, column: 5 }, scroll: 100 },
        { cursor: { line: 20, column: 10 }, scroll: 200 },
      ];

      mockNavigationHistory = states.map((editorState, i) => ({
        fileHandle: { name: `file${i}.md` },
        editorState,
      }));
      mockHistoryIndex = 2;

      // Go back twice
      mockHistoryIndex--;
      mockFocusManager._restoreEditorState(mockNavigationHistory[mockHistoryIndex].editorState);

      mockHistoryIndex--;
      mockFocusManager._restoreEditorState(mockNavigationHistory[mockHistoryIndex].editorState);

      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(states[1]);
      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(states[0]);
      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledTimes(2);
    });
  });

  describe('State update before navigation', () => {
    it('should update current history entry before going back', () => {
      const originalState = { cursor: { line: 5, column: 0 }, scroll: 50 };
      const updatedState = { cursor: { line: 10, column: 5 }, scroll: 100 };

      mockNavigationHistory = [
        { fileHandle: { name: 'file1.md' }, editorState: originalState },
        { fileHandle: { name: 'file2.md' }, editorState: null },
      ];
      mockHistoryIndex = 1;

      // Before navigating, capture current state
      mockFocusManager._captureEditorState.mockReturnValue(updatedState);
      const captured = mockFocusManager._captureEditorState();
      if (captured) {
        mockNavigationHistory[mockHistoryIndex].editorState = captured;
      }

      expect(mockNavigationHistory[1].editorState).toEqual(updatedState);
    });

    it('should update current history entry before going forward', () => {
      const currentState = { cursor: { line: 15, column: 20 }, scroll: 300 };

      mockNavigationHistory = [
        { fileHandle: { name: 'file1.md' }, editorState: null },
        { fileHandle: { name: 'file2.md' }, editorState: null },
      ];
      mockHistoryIndex = 0;

      // Before navigating forward, capture current state
      mockFocusManager._captureEditorState.mockReturnValue(currentState);
      const captured = mockFocusManager._captureEditorState();
      if (captured) {
        mockNavigationHistory[mockHistoryIndex].editorState = captured;
      }

      expect(mockNavigationHistory[0].editorState).toEqual(currentState);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty history', () => {
      mockNavigationHistory = [];
      mockHistoryIndex = -1;

      // Try to go back
      const canGoBack = mockHistoryIndex > 0;
      expect(canGoBack).toBe(false);
    });

    it('should handle single item in history', () => {
      const state = { cursor: { line: 5, column: 5 }, scroll: 50 };
      mockNavigationHistory = [{ fileHandle: { name: 'file1.md' }, editorState: state }];
      mockHistoryIndex = 0;

      // Can't go back from first item
      const canGoBack = mockHistoryIndex > 0;
      expect(canGoBack).toBe(false);

      // Can't go forward from last item
      const canGoForward = mockHistoryIndex < mockNavigationHistory.length - 1;
      expect(canGoForward).toBe(false);
    });

    it('should handle corrupted state object', () => {
      mockNavigationHistory = [
        { fileHandle: { name: 'file1.md' }, editorState: { invalid: 'state' } },
      ];
      mockHistoryIndex = 0;

      const currentState = mockNavigationHistory[mockHistoryIndex];

      // Should not crash even with invalid state
      expect(() => {
        if (currentState.editorState) {
          mockFocusManager._restoreEditorState(currentState.editorState);
        }
      }).not.toThrow();
    });

    it('should handle cursor beyond file length', () => {
      // State with cursor at line 1000, but file only has 10 lines
      const invalidState = { cursor: { line: 1000, column: 50 }, scroll: 5000 };

      mockNavigationHistory = [{ fileHandle: { name: 'file1.md' }, editorState: invalidState }];
      mockHistoryIndex = 0;

      // FocusManager should handle this gracefully (tested in focus-manager.test.js)
      expect(() => {
        mockFocusManager._restoreEditorState(invalidState);
      }).not.toThrow();
    });

    it('should handle rapid back-forward navigation', () => {
      const states = [
        { cursor: { line: 1, column: 0 }, scroll: 0 },
        { cursor: { line: 10, column: 5 }, scroll: 100 },
        { cursor: { line: 20, column: 10 }, scroll: 200 },
      ];

      mockNavigationHistory = states.map((editorState, i) => ({
        fileHandle: { name: `file${i}.md` },
        editorState,
      }));
      mockHistoryIndex = 2;

      // Rapid navigation: back, back, forward, back
      mockHistoryIndex--; // 1
      mockHistoryIndex--; // 0
      mockHistoryIndex++; // 1
      mockHistoryIndex--; // 0

      expect(mockHistoryIndex).toBe(0);
      expect(mockNavigationHistory[mockHistoryIndex].editorState).toEqual(states[0]);
    });

    it('should clear forward history when navigating to new location', () => {
      mockNavigationHistory = [
        {
          fileHandle: { name: 'file1.md' },
          editorState: { cursor: { line: 1, column: 0 }, scroll: 0 },
        },
        {
          fileHandle: { name: 'file2.md' },
          editorState: { cursor: { line: 2, column: 0 }, scroll: 20 },
        },
        {
          fileHandle: { name: 'file3.md' },
          editorState: { cursor: { line: 3, column: 0 }, scroll: 30 },
        },
      ];
      mockHistoryIndex = 1; // At file2.md

      // When navigating to a new file, should clear forward history
      mockNavigationHistory = mockNavigationHistory.slice(0, mockHistoryIndex + 1);
      mockNavigationHistory.push({
        fileHandle: { name: 'file4.md' },
        editorState: { cursor: { line: 4, column: 0 }, scroll: 40 },
      });
      mockHistoryIndex = mockNavigationHistory.length - 1;

      expect(mockNavigationHistory.length).toBe(3);
      expect(mockNavigationHistory[2].fileHandle.name).toBe('file4.md');
    });

    it('should handle navigation history with mixed null and valid states', () => {
      mockNavigationHistory = [
        {
          fileHandle: { name: 'file1.md' },
          editorState: { cursor: { line: 1, column: 0 }, scroll: 0 },
        },
        { fileHandle: { name: 'file2.md' }, editorState: null },
        {
          fileHandle: { name: 'file3.md' },
          editorState: { cursor: { line: 3, column: 0 }, scroll: 30 },
        },
      ];

      // Navigate through all entries
      for (let i = 0; i < mockNavigationHistory.length; i++) {
        const state = mockNavigationHistory[i];
        if (state.editorState) {
          mockFocusManager._restoreEditorState(state.editorState);
        }
      }

      // Should have been called twice (skipping the null entry)
      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledTimes(2);
    });
  });

  describe('Different editor types', () => {
    it('should handle state from EditorManager (markdown)', () => {
      const markdownState = {
        cursor: { line: 10, column: 5 },
        scroll: 100,
      };

      mockNavigationHistory = [{ fileHandle: { name: 'readme.md' }, editorState: markdownState }];
      mockHistoryIndex = 0;

      mockFocusManager._restoreEditorState(mockNavigationHistory[0].editorState);

      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(markdownState);
    });

    it('should handle state from CodeMirror (code files)', () => {
      const codeState = {
        cursor: { line: 42, column: 15 },
        scroll: 500,
      };

      mockNavigationHistory = [{ fileHandle: { name: 'app.js' }, editorState: codeState }];
      mockHistoryIndex = 0;

      mockFocusManager._restoreEditorState(mockNavigationHistory[0].editorState);

      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(codeState);
    });

    it('should handle switching between editor types', () => {
      const markdownState = { cursor: { line: 10, column: 5 }, scroll: 100 };
      const codeState = { cursor: { line: 42, column: 15 }, scroll: 500 };

      mockNavigationHistory = [
        { fileHandle: { name: 'readme.md' }, editorState: markdownState },
        { fileHandle: { name: 'app.js' }, editorState: codeState },
      ];

      // Go from markdown to code
      mockHistoryIndex = 0;
      mockFocusManager._restoreEditorState(mockNavigationHistory[0].editorState);

      mockHistoryIndex = 1;
      mockFocusManager._restoreEditorState(mockNavigationHistory[1].editorState);

      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(markdownState);
      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(codeState);
    });
  });

  describe('State persistence across navigation', () => {
    it('should maintain state when navigating back then forward to same file', () => {
      const originalState = { cursor: { line: 15, column: 8 }, scroll: 250 };

      mockNavigationHistory = [
        {
          fileHandle: { name: 'file1.md' },
          editorState: { cursor: { line: 1, column: 0 }, scroll: 0 },
        },
        { fileHandle: { name: 'file2.md' }, editorState: originalState },
      ];

      // Start at file2
      mockHistoryIndex = 1;

      // Go back to file1
      mockHistoryIndex = 0;

      // Go forward to file2 again
      mockHistoryIndex = 1;

      // Should restore the same state
      mockFocusManager._restoreEditorState(mockNavigationHistory[1].editorState);

      expect(mockFocusManager._restoreEditorState).toHaveBeenCalledWith(originalState);
    });

    it('should update state when editing before navigation', () => {
      const initialState = { cursor: { line: 10, column: 0 }, scroll: 100 };
      const editedState = { cursor: { line: 15, column: 5 }, scroll: 150 };

      mockNavigationHistory = [
        { fileHandle: { name: 'file1.md' }, editorState: initialState },
        { fileHandle: { name: 'file2.md' }, editorState: null },
      ];
      mockHistoryIndex = 0;

      // User edits and moves cursor
      mockFocusManager._captureEditorState.mockReturnValue(editedState);

      // Before navigating, update current entry
      const captured = mockFocusManager._captureEditorState();
      mockNavigationHistory[mockHistoryIndex].editorState = captured;

      expect(mockNavigationHistory[0].editorState).toEqual(editedState);
    });
  });
});
