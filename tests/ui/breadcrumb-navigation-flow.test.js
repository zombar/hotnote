import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { updateBreadcrumb, navigateToPathIndex } from '../../src/ui/breadcrumb.js';
import { hideFilePicker } from '../../src/ui/file-picker.js';
import { appState } from '../../src/state/app-state.js';
import { createMockFileHandle, createMockDirectoryHandle } from '../mocks/filesystem.js';
import { FileSystemAdapter } from '../../src/fs/filesystem-adapter.js';

/**
 * Comprehensive tests for breadcrumb navigation flow
 *
 * Tests the complete interaction cycle:
 * 1. Click breadcrumb → UI updates immediately
 * 2. File picker shown/updated
 * 3. Close picker → everything restored
 */
describe('Breadcrumb Navigation Flow', () => {
  let breadcrumbElement;
  let filePickerElement;
  let mockCallbacks;

  beforeEach(() => {
    // Setup DOM
    breadcrumbElement = document.createElement('div');
    breadcrumbElement.id = 'breadcrumb';
    document.body.appendChild(breadcrumbElement);

    filePickerElement = document.createElement('div');
    filePickerElement.id = 'file-picker';
    filePickerElement.classList.add('hidden');
    document.body.appendChild(filePickerElement);

    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'file-picker-resize-handle';
    resizeHandle.classList.add('hidden');
    document.body.appendChild(resizeHandle);

    // Reset app state
    appState.currentPath = [];
    appState.currentFilename = '';
    appState.currentFileHandle = null;
    appState.currentDirHandle = null;
    appState.isDirty = false;
    appState.previousPath = null;
    appState.previousFileHandle = null;
    appState.previousFilename = '';
    appState.isNavigatingBreadcrumbs = false;

    // Mock callbacks - showFilePicker simulates real behavior with restoration flag
    mockCallbacks = {
      openFolder: vi.fn(),
      showFilePicker: vi.fn(async () => {
        // Simulate real showFilePicker behavior: save file and set restoration flag
        if (appState.currentFileHandle) {
          appState.previousFileHandle = appState.currentFileHandle;
          appState.previousFilename = appState.currentFilename;
          appState.isNavigatingBreadcrumbs = true; // Enable restoration on cancel
          appState.currentFileHandle = null;
          appState.currentFilename = '';
        }
        filePickerElement.classList.remove('hidden');

        // Simulate quickFileCreate rebuilding breadcrumb with search input
        breadcrumbElement.innerHTML = '';
        // Rebuild path
        if (appState.currentPath.length > 0) {
          appState.currentPath.forEach((segment) => {
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = segment.name;
            breadcrumbElement.appendChild(item);
          });
        }
        // Add search input
        const input = document.createElement('input');
        input.className = 'breadcrumb-input';
        input.placeholder = 'filename (/ for search)';
        breadcrumbElement.appendChild(input);
      }),
      saveFocusState: vi.fn(),
      saveTempChanges: vi.fn(),
    };

    // Mock focus manager
    appState.focusManager = {
      focusEditor: vi.fn(),
      saveFocusState: vi.fn(),
    };

    // Mock window.updateBreadcrumb for navigateToPathIndex
    window.updateBreadcrumb = vi.fn(() => {
      updateBreadcrumb(mockCallbacks);
    });

    // Mock FileSystemAdapter
    vi.spyOn(FileSystemAdapter, 'listDirectory').mockResolvedValue([]);
  });

  afterEach(() => {
    if (document.body.contains(breadcrumbElement)) {
      document.body.removeChild(breadcrumbElement);
    }
    if (document.body.contains(filePickerElement)) {
      document.body.removeChild(filePickerElement);
    }
    const resizeHandle = document.getElementById('file-picker-resize-handle');
    if (resizeHandle && document.body.contains(resizeHandle)) {
      document.body.removeChild(resizeHandle);
    }
    delete window.updateBreadcrumb;
    vi.restoreAllMocks();
  });

  describe('Breadcrumb Visual Update', () => {
    it('should update breadcrumb display immediately when clicking', async () => {
      // Setup: deep path with file open
      appState.currentPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
        { name: 'components', handle: createMockDirectoryHandle('components', {}) },
      ];
      appState.currentFileHandle = createMockFileHandle('Button.js', 'content');
      appState.currentFilename = 'Button.js';
      appState.currentDirHandle = appState.currentPath[2].handle;

      // Render initial breadcrumb
      updateBreadcrumb(mockCallbacks);

      // Count breadcrumb items before navigation
      const itemsBefore = breadcrumbElement.querySelectorAll('.breadcrumb-item').length;
      expect(itemsBefore).toBe(4); // 3 folders + 1 file

      // Navigate to first breadcrumb (root)
      await navigateToPathIndex(0, mockCallbacks);

      // Breadcrumb should update after navigation
      const itemsAfter = breadcrumbElement.querySelectorAll('.breadcrumb-item').length;

      // Should show: root (1 item) after truncation
      expect(itemsAfter).toBeLessThan(itemsBefore);

      // Should have search input since file was cleared
      const input = breadcrumbElement.querySelector('.breadcrumb-input');
      expect(input).toBeTruthy();
      expect(input.placeholder).toContain('filename');
    });

    it('should show search input after clearing filename', async () => {
      appState.currentPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
      ];
      appState.currentFileHandle = createMockFileHandle('test.js', 'content');
      appState.currentFilename = 'test.js';
      appState.currentDirHandle = appState.currentPath[1].handle;

      updateBreadcrumb(mockCallbacks);

      // Before navigation: should show filename
      const fileItem = breadcrumbElement.querySelector('.breadcrumb-item:last-child');
      expect(fileItem.textContent).toBe('test.js');

      // Navigate to breadcrumb
      await navigateToPathIndex(0, mockCallbacks);

      // After navigation: should show search input with hint
      const input = breadcrumbElement.querySelector('.breadcrumb-input');
      expect(input).toBeTruthy();
      expect(input.placeholder).toContain('filename');
      expect(input.placeholder).toContain('/'); // Shows search hint
    });
  });

  describe('File Picker Show/Update Behavior', () => {
    it('should show file picker after breadcrumb click when closed', async () => {
      appState.currentPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
      ];
      appState.currentDirHandle = appState.currentPath[1].handle;

      // File picker initially closed
      expect(filePickerElement.classList.contains('hidden')).toBe(true);

      // Click breadcrumb
      await navigateToPathIndex(0, mockCallbacks);

      // File picker should be shown
      expect(mockCallbacks.showFilePicker).toHaveBeenCalled();
      expect(filePickerElement.classList.contains('hidden')).toBe(false);
    });

    it('should update file picker location when already open', async () => {
      appState.currentPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
        { name: 'components', handle: createMockDirectoryHandle('components', {}) },
      ];
      appState.currentDirHandle = appState.currentPath[2].handle;

      // File picker already open
      filePickerElement.classList.remove('hidden');

      // Navigate to shallower breadcrumb
      await navigateToPathIndex(0, mockCallbacks);

      // Should call showFilePicker with new directory
      expect(mockCallbacks.showFilePicker).toHaveBeenCalledWith(appState.currentPath[0].handle);
    });
  });

  describe('State Preservation and Restoration', () => {
    it('should save original state before navigation', async () => {
      const originalPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
        { name: 'components', handle: createMockDirectoryHandle('components', {}) },
      ];
      appState.currentPath = [...originalPath];
      appState.currentFileHandle = createMockFileHandle('Button.js', 'content');
      appState.currentFilename = 'Button.js';
      appState.currentDirHandle = originalPath[2].handle;

      // Navigate to breadcrumb
      await navigateToPathIndex(0, mockCallbacks);

      // Should save previous state
      expect(appState.previousPath).toHaveLength(3);
      expect(appState.previousPath[0].name).toBe('root');
      expect(appState.previousPath[1].name).toBe('src');
      expect(appState.previousPath[2].name).toBe('components');
      expect(appState.previousFileHandle).toBeTruthy();
      expect(appState.previousFilename).toBe('Button.js');

      // Should truncate current path
      expect(appState.currentPath).toHaveLength(1);
      expect(appState.currentPath[0].name).toBe('root');

      // Should clear current file
      expect(appState.currentFileHandle).toBeNull();
      expect(appState.currentFilename).toBe('');
    });

    it('should restore everything when picker closed without selection', async () => {
      // Setup original state
      const originalPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
      ];
      const originalFile = createMockFileHandle('test.js', 'content');

      appState.currentPath = [...originalPath];
      appState.currentFileHandle = originalFile;
      appState.currentFilename = 'test.js';
      appState.currentDirHandle = originalPath[1].handle;

      // Update breadcrumb to show original state
      updateBreadcrumb(mockCallbacks);
      const itemsBeforeNav = breadcrumbElement.querySelectorAll('.breadcrumb-item').length;

      // Navigate to breadcrumb (truncates path, clears file, shows picker)
      await navigateToPathIndex(0, mockCallbacks);

      // Verify state changed
      expect(appState.currentPath).toHaveLength(1);
      expect(appState.currentFileHandle).toBeNull();
      expect(appState.currentFilename).toBe('');

      // Close picker without selection
      hideFilePicker();

      // Everything should be restored
      expect(appState.currentPath).toHaveLength(2);
      expect(appState.currentPath[0].name).toBe('root');
      expect(appState.currentPath[1].name).toBe('src');
      expect(appState.currentFileHandle).toBe(originalFile);
      expect(appState.currentFilename).toBe('test.js');

      // Update breadcrumb to show restored state
      updateBreadcrumb(mockCallbacks);
      const itemsAfterRestore = breadcrumbElement.querySelectorAll('.breadcrumb-item').length;

      // Should match original breadcrumb
      expect(itemsAfterRestore).toBe(itemsBeforeNav);
    });

    it('should show restored state as if nothing changed', async () => {
      // Setup: user is working on file in deep path
      appState.currentPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
        { name: 'components', handle: createMockDirectoryHandle('components', {}) },
      ];
      appState.currentFileHandle = createMockFileHandle('Button.js', 'content');
      appState.currentFilename = 'Button.js';
      appState.currentDirHandle = appState.currentPath[2].handle;

      // Render initial breadcrumb
      updateBreadcrumb(mockCallbacks);
      const initialHTML = breadcrumbElement.innerHTML;

      // User clicks breadcrumb to navigate
      await navigateToPathIndex(0, mockCallbacks);

      // Breadcrumb should be different (truncated)
      updateBreadcrumb(mockCallbacks);
      const duringNavHTML = breadcrumbElement.innerHTML;
      expect(duringNavHTML).not.toBe(initialHTML);

      // User closes picker without selecting
      hideFilePicker();

      // Breadcrumb should be restored to original
      updateBreadcrumb(mockCallbacks);
      const restoredHTML = breadcrumbElement.innerHTML;
      expect(restoredHTML).toBe(initialHTML);
    });
  });

  describe('Multiple Navigation Cycles', () => {
    it('should handle repeated breadcrumb clicks and cancels', async () => {
      const originalPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
        { name: 'components', handle: createMockDirectoryHandle('components', {}) },
      ];
      const originalFile = createMockFileHandle('Button.js', 'content');

      appState.currentPath = [...originalPath];
      appState.currentFileHandle = originalFile;
      appState.currentFilename = 'Button.js';
      appState.currentDirHandle = originalPath[2].handle;

      // First navigation cycle
      await navigateToPathIndex(0, mockCallbacks);
      hideFilePicker();

      // State should be restored
      expect(appState.currentPath).toHaveLength(3);
      expect(appState.currentFilename).toBe('Button.js');

      // Second navigation cycle (to different index)
      await navigateToPathIndex(1, mockCallbacks);
      hideFilePicker();

      // State should be restored again
      expect(appState.currentPath).toHaveLength(3);
      expect(appState.currentFilename).toBe('Button.js');
    });

    it('should handle navigation while picker is already open', async () => {
      appState.currentPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
        { name: 'components', handle: createMockDirectoryHandle('components', {}) },
      ];
      appState.currentFileHandle = createMockFileHandle('Button.js', 'content');
      appState.currentFilename = 'Button.js';
      appState.currentDirHandle = appState.currentPath[2].handle;

      // Open picker (first navigation)
      await navigateToPathIndex(1, mockCallbacks);
      expect(filePickerElement.classList.contains('hidden')).toBe(false);

      // Navigate again while picker is open
      await navigateToPathIndex(0, mockCallbacks);

      // Picker should still be showing (updated location)
      expect(filePickerElement.classList.contains('hidden')).toBe(false);
      expect(mockCallbacks.showFilePicker).toHaveBeenCalledTimes(2);

      // Close picker
      hideFilePicker();

      // Should restore to ORIGINAL state (before any navigation)
      expect(appState.currentPath).toHaveLength(3);
      expect(appState.currentFilename).toBe('Button.js');
    });
  });

  describe('File Selection During Navigation', () => {
    it('should NOT restore state when user selects a file', async () => {
      appState.currentPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
      ];
      appState.currentFileHandle = createMockFileHandle('old.js', 'content');
      appState.currentFilename = 'old.js';
      appState.currentDirHandle = appState.currentPath[1].handle;

      // Navigate to breadcrumb
      await navigateToPathIndex(0, mockCallbacks);

      // User selects a new file
      const newFile = createMockFileHandle('new.js', 'new content');
      appState.currentFileHandle = newFile;
      appState.currentFilename = 'new.js';
      appState.previousFileHandle = null;
      appState.previousFilename = '';
      appState.previousPath = null;

      // Close picker
      hideFilePicker();

      // Should NOT restore - user selected new file
      expect(appState.currentFileHandle).toBe(newFile);
      expect(appState.currentFilename).toBe('new.js');
      expect(appState.currentPath).toHaveLength(1); // Stay at new location
    });
  });

  describe('Breadcrumb Click Behavior (Like Pressing Escape)', () => {
    it('should behave like Escape: navigate + show picker + restore on cancel', async () => {
      // Setup: user working on file deep in path
      appState.currentPath = [
        { name: 'root', handle: createMockDirectoryHandle('root', {}) },
        { name: 'src', handle: createMockDirectoryHandle('src', {}) },
        { name: 'components', handle: createMockDirectoryHandle('components', {}) },
      ];
      const originalFile = createMockFileHandle('Button.js', 'content');
      appState.currentFileHandle = originalFile;
      appState.currentFilename = 'Button.js';
      appState.currentDirHandle = appState.currentPath[2].handle;

      // Click on subordinate breadcrumb (parent folder)
      await navigateToPathIndex(0, mockCallbacks);

      // Should navigate (truncate path)
      expect(appState.currentPath).toHaveLength(1);
      expect(appState.currentPath[0].name).toBe('root');

      // Should clear file (gain navbar context)
      expect(appState.currentFileHandle).toBeNull();
      expect(appState.currentFilename).toBe('');

      // Should show file picker
      expect(mockCallbacks.showFilePicker).toHaveBeenCalled();

      // Should allow restoration (saved previous state)
      expect(appState.previousFileHandle).toBe(originalFile);
      expect(appState.previousFilename).toBe('Button.js');
      expect(appState.isNavigatingBreadcrumbs).toBe(true);

      // Click away or press Esc (like Escape behavior)
      hideFilePicker();

      // Should restore everything (file AND path)
      expect(appState.currentFileHandle).toBe(originalFile);
      expect(appState.currentFilename).toBe('Button.js');
      expect(appState.currentPath).toHaveLength(3);
      expect(appState.currentPath[0].name).toBe('root');
      expect(appState.currentPath[1].name).toBe('src');
      expect(appState.currentPath[2].name).toBe('components');
    });

    it('should work for clicking current filename (no path change)', async () => {
      // Setup: file is open
      appState.currentPath = [{ name: 'src', handle: createMockDirectoryHandle('src', {}) }];
      const originalFile = createMockFileHandle('test.js', 'content');
      appState.currentFileHandle = originalFile;
      appState.currentFilename = 'test.js';
      appState.currentDirHandle = appState.currentPath[0].handle;

      // Mock showFilePicker behavior (clicking filename calls this directly)
      await mockCallbacks.showFilePicker(appState.currentDirHandle);

      // Should clear file (gain navbar context)
      expect(appState.currentFileHandle).toBeNull();
      expect(appState.currentFilename).toBe('');

      // Should save file for restoration
      expect(appState.previousFileHandle).toBe(originalFile);
      expect(appState.previousFilename).toBe('test.js');
      expect(appState.isNavigatingBreadcrumbs).toBe(true);

      // Click away or press Esc
      hideFilePicker();

      // Should restore file (like Escape behavior)
      expect(appState.currentFileHandle).toBe(originalFile);
      expect(appState.currentFilename).toBe('test.js');
      expect(appState.currentPath).toHaveLength(1); // Path unchanged
    });
  });
});
