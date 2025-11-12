/* global KeyboardEvent */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initKeyboardManager,
  cleanupKeyboardManager,
  updateEditorBlurState,
} from '../../src/ui/keyboard-manager.js';
import { appState } from '../../src/state/app-state.js';

describe('Keyboard Manager', () => {
  let focusManagerMock;
  let editorElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="editor"></div>';
    editorElement = document.getElementById('editor');

    // Mock focus manager
    focusManagerMock = {
      hasEditorFocus: vi.fn(() => false),
      focusEditor: vi.fn(),
      restoreFocus: vi.fn(),
    };

    // Setup app state
    appState.focusManager = focusManagerMock;
    appState.currentDirHandle = { kind: 'directory' };
    appState.currentFileHandle = null;

    // Mock functions that will be called - make them available globally
    globalThis.quickFileCreate = vi.fn();
    globalThis.showFilePicker = vi.fn();
  });

  afterEach(() => {
    cleanupKeyboardManager();
    document.body.innerHTML = '';
    vi.clearAllMocks();
    // Clean up global functions
    delete globalThis.quickFileCreate;
    delete globalThis.showFilePicker;
  });

  describe('initKeyboardManager', () => {
    it('should initialize keyboard event listeners', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      initKeyboardManager();

      // Should register keydown listeners and focusin/focusout
      const keydownCalls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'keydown');
      expect(keydownCalls.length).toBeGreaterThan(0);
    });

    it('should not trigger on special keys', async () => {
      initKeyboardManager();

      const event = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(event);

      expect(globalThis.quickFileCreate).not.toHaveBeenCalled();
    });
  });

  describe('Quick file creation (alphanumeric keys)', () => {
    beforeEach(() => {
      initKeyboardManager();
    });

    it('should trigger quick file creation on alphanumeric key', async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(globalThis.quickFileCreate).toHaveBeenCalledWith('a');
    });

    it('should trigger on forward slash', async () => {
      const event = new KeyboardEvent('keydown', {
        key: '/',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(globalThis.quickFileCreate).toHaveBeenCalledWith('/');
    });

    it('should trigger on period', async () => {
      const event = new KeyboardEvent('keydown', {
        key: '.',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(globalThis.quickFileCreate).toHaveBeenCalledWith('.');
    });

    it('should not trigger when typing in input field', async () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
      });

      input.dispatchEvent(event);

      expect(globalThis.quickFileCreate).not.toHaveBeenCalled();
    });

    it('should not trigger when typing in textarea', async () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
      });

      textarea.dispatchEvent(event);

      expect(globalThis.quickFileCreate).not.toHaveBeenCalled();
    });

    it('should not trigger when editor has focus', async () => {
      const cmContent = document.createElement('div');
      cmContent.className = 'cm-content';
      document.body.appendChild(cmContent);
      cmContent.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
      });

      cmContent.dispatchEvent(event);

      expect(globalThis.quickFileCreate).not.toHaveBeenCalled();
    });

    it('should not trigger when no directory context', async () => {
      appState.currentDirHandle = null;

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(globalThis.quickFileCreate).not.toHaveBeenCalled();
    });

    it('should not trigger when breadcrumb input is showing', async () => {
      const input = document.createElement('input');
      input.className = 'breadcrumb-input';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(globalThis.quickFileCreate).not.toHaveBeenCalled();
    });
  });

  describe('Enter key listener', () => {
    beforeEach(() => {
      initKeyboardManager();
    });

    it('should focus editor on Enter key', () => {
      focusManagerMock.hasEditorFocus.mockReturnValue(false);

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(focusManagerMock.focusEditor).toHaveBeenCalledWith({
        reason: 'enter-key',
      });
    });

    it('should not focus if editor already has focus', () => {
      focusManagerMock.hasEditorFocus.mockReturnValue(true);

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });

      document.dispatchEvent(event);

      expect(focusManagerMock.focusEditor).not.toHaveBeenCalled();
    });

    it('should not trigger when breadcrumb input is showing', () => {
      const input = document.createElement('input');
      input.className = 'breadcrumb-input';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });

      document.dispatchEvent(event);

      expect(focusManagerMock.focusEditor).not.toHaveBeenCalled();
    });

    it('should not trigger when typing in input field', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });

      input.dispatchEvent(event);

      expect(focusManagerMock.focusEditor).not.toHaveBeenCalled();
    });
  });

  describe('Escape key listener', () => {
    beforeEach(() => {
      initKeyboardManager();
    });

    it('should blur editor and show file picker on Escape', async () => {
      focusManagerMock.hasEditorFocus.mockReturnValue(true);

      const blurSpy = vi.fn();
      const mockActiveElement = {
        blur: blurSpy,
      };
      Object.defineProperty(document, 'activeElement', {
        value: mockActiveElement,
        configurable: true,
      });

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      // Wait for async operations (dynamic import + showFilePicker)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(blurSpy).toHaveBeenCalled();
      expect(globalThis.showFilePicker).toHaveBeenCalled();
    });

    it('should not trigger if editor does not have focus', async () => {
      focusManagerMock.hasEditorFocus.mockReturnValue(false);

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });

      await document.dispatchEvent(event);

      expect(globalThis.showFilePicker).not.toHaveBeenCalled();
    });

    it('should not trigger when breadcrumb input is showing', async () => {
      focusManagerMock.hasEditorFocus.mockReturnValue(true);

      const input = document.createElement('input');
      input.className = 'breadcrumb-input';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });

      await document.dispatchEvent(event);

      expect(globalThis.showFilePicker).not.toHaveBeenCalled();
    });
  });

  describe('updateEditorBlurState', () => {
    it('should remove blur class when editor has focus', () => {
      focusManagerMock.hasEditorFocus.mockReturnValue(true);
      editorElement.classList.add('blurred');

      updateEditorBlurState();

      expect(editorElement.classList.contains('blurred')).toBe(false);
    });

    it('should add blur class when focus is on real element', () => {
      focusManagerMock.hasEditorFocus.mockReturnValue(false);

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      updateEditorBlurState();

      expect(editorElement.classList.contains('blurred')).toBe(true);
    });

    it('should not add blur when focus is on nothing', () => {
      focusManagerMock.hasEditorFocus.mockReturnValue(false);

      // Simulate focus on body (nothing)
      Object.defineProperty(document, 'activeElement', {
        value: document.body,
        configurable: true,
      });

      updateEditorBlurState();

      expect(editorElement.classList.contains('blurred')).toBe(false);
    });

    it('should handle missing editor element', () => {
      document.body.innerHTML = '';

      expect(() => {
        updateEditorBlurState();
      }).not.toThrow();
    });
  });

  describe('Focus monitoring', () => {
    it('should update blur state on focusin', () => {
      initKeyboardManager();
      focusManagerMock.hasEditorFocus.mockReturnValue(true);

      const focusinEvent = new Event('focusin', { bubbles: true });
      document.dispatchEvent(focusinEvent);

      expect(editorElement.classList.contains('blurred')).toBe(false);
    });

    it('should update blur state on focusout with delay', async () => {
      initKeyboardManager();

      // Mock editor not having focus
      focusManagerMock.hasEditorFocus.mockReturnValue(false);

      const input = document.createElement('input');
      document.body.appendChild(input);

      // Mock activeElement to be the input
      Object.defineProperty(document, 'activeElement', {
        value: input,
        configurable: true,
        writable: true,
      });

      const focusoutEvent = new Event('focusout', { bubbles: true });
      document.dispatchEvent(focusoutEvent);

      // Wait for timeout in focusout handler (10ms) plus a bit more
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(editorElement.classList.contains('blurred')).toBe(true);
    });
  });

  describe('cleanupKeyboardManager', () => {
    it('should remove event listeners', () => {
      initKeyboardManager();
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      cleanupKeyboardManager();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('should allow reinitialization after cleanup', () => {
      initKeyboardManager();
      cleanupKeyboardManager();

      expect(() => {
        initKeyboardManager();
      }).not.toThrow();
    });
  });
});
