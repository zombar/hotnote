import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  updateBreadcrumb,
  updateBrowserTitle,
  navigateToPathIndex,
} from '../../src/ui/breadcrumb.js';
import { appState } from '../../src/state/app-state.js';
import { createMockFileHandle, createMockDirectoryHandle } from '../mocks/filesystem.js';

describe('Breadcrumb', () => {
  let breadcrumbElement;
  let mockCallbacks;

  beforeEach(() => {
    // Setup DOM
    breadcrumbElement = document.createElement('div');
    breadcrumbElement.id = 'breadcrumb';
    document.body.appendChild(breadcrumbElement);

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

    // Mock callbacks
    mockCallbacks = {
      openFolder: vi.fn(),
      showFilePicker: vi.fn(),
      saveFocusState: vi.fn(),
      saveTempChanges: vi.fn(),
    };

    // Mock window.updateBreadcrumb for navigateToPathIndex
    window.updateBreadcrumb = vi.fn(() => {
      updateBreadcrumb(mockCallbacks);
    });
  });

  afterEach(() => {
    if (document.body.contains(breadcrumbElement)) {
      document.body.removeChild(breadcrumbElement);
    }
    delete window.updateBreadcrumb;
  });

  describe('updateBreadcrumb', () => {
    it('should show untitled when no folder opened and no file', () => {
      appState.currentPath = [];
      appState.currentFilename = '';

      updateBreadcrumb(mockCallbacks);

      const items = breadcrumbElement.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toBe('untitled');
    });

    it('should show filename when no folder opened but file exists', () => {
      appState.currentPath = [];
      appState.currentFilename = 'test.js';

      updateBreadcrumb(mockCallbacks);

      const items = breadcrumbElement.querySelectorAll('.breadcrumb-item');
      expect(items[0].textContent).toBe('test.js');
    });

    it('should show has-changes class when file is dirty', () => {
      appState.currentFilename = 'test.js';
      appState.isDirty = true;

      updateBreadcrumb(mockCallbacks);

      const item = breadcrumbElement.querySelector('.breadcrumb-item');
      expect(item.classList.contains('has-changes')).toBe(true);
    });

    it('should show full path when path length is within limit', () => {
      appState.currentPath = [{ name: 'src' }, { name: 'components' }, { name: 'ui' }];

      updateBreadcrumb(mockCallbacks);

      const items = breadcrumbElement.querySelectorAll(
        '.breadcrumb-item:not(.breadcrumb-placeholder)'
      );
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it('should abbreviate long paths with ellipsis', () => {
      appState.currentPath = [];
      for (let i = 0; i < 10; i++) {
        appState.currentPath.push({ name: `folder${i}` });
      }

      updateBreadcrumb(mockCallbacks);

      const ellipsis = breadcrumbElement.querySelector('.breadcrumb-ellipsis');
      expect(ellipsis).toBeDefined();
      expect(ellipsis.textContent).toBe('...');
    });

    it('should show placeholder when no file is selected', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFileHandle = null;

      updateBreadcrumb(mockCallbacks);

      const placeholder = breadcrumbElement.querySelector('.breadcrumb-placeholder');
      expect(placeholder).toBeDefined();
      expect(placeholder.textContent).toContain('filename');
    });

    it('should show filename when file is opened', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFileHandle = createMockFileHandle('app.js');
      appState.currentFilename = 'app.js';

      updateBreadcrumb(mockCallbacks);

      const items = breadcrumbElement.querySelectorAll('.breadcrumb-item');
      const lastItem = items[items.length - 1];
      expect(lastItem.textContent).toBe('app.js');
    });

    it('should make breadcrumb items clickable', () => {
      appState.currentPath = [{ name: 'src' }, { name: 'components' }];

      updateBreadcrumb(mockCallbacks);

      const items = breadcrumbElement.querySelectorAll('.breadcrumb-item');
      expect(items.length).toBeGreaterThan(0);
      // Items should have click event listeners (we can't easily check this in tests)
      // So we just verify that items were created
    });

    it('should handle missing breadcrumb element gracefully', () => {
      document.body.removeChild(breadcrumbElement);

      expect(() => updateBreadcrumb(mockCallbacks)).not.toThrow();
    });

    it('should update browser title after rendering', () => {
      appState.currentFilename = 'test.js';
      appState.currentFileHandle = createMockFileHandle('test.js');
      const originalTitle = document.title;

      updateBreadcrumb(mockCallbacks);

      expect(document.title).not.toBe(originalTitle);
      expect(document.title).toContain('test.js');
    });
  });

  describe('updateBrowserTitle', () => {
    it('should set title to hotnote when no file or folder', () => {
      appState.currentPath = [];
      appState.currentFileHandle = null;

      updateBrowserTitle();

      expect(document.title).toBe('hotnote');
    });

    it('should include filename in title', () => {
      appState.currentFileHandle = createMockFileHandle('app.js');
      appState.currentFilename = 'app.js';

      updateBrowserTitle();

      expect(document.title).toContain('app.js');
    });

    it('should include folder path in title', () => {
      appState.currentPath = [{ name: 'src' }, { name: 'components' }];
      appState.currentFileHandle = createMockFileHandle('Button.js');
      appState.currentFilename = 'Button.js';

      updateBrowserTitle();

      expect(document.title).toContain('src/components');
      expect(document.title).toContain('Button.js');
    });

    it('should show dirty indicator in title', () => {
      appState.currentFileHandle = createMockFileHandle('test.js');
      appState.currentFilename = 'test.js';
      appState.isDirty = true;

      updateBrowserTitle();

      expect(document.title).toContain('•');
    });

    it('should show folder path without file when only folder open', () => {
      appState.currentPath = [{ name: 'docs' }];
      appState.currentFileHandle = null;

      updateBrowserTitle();

      expect(document.title).toContain('docs');
    });
  });

  describe('navigateToPathIndex', () => {
    it('should truncate path to clicked index', async () => {
      appState.currentPath = [{ name: 'src' }, { name: 'components' }, { name: 'ui' }];

      await navigateToPathIndex(1, mockCallbacks);

      expect(appState.currentPath).toHaveLength(2);
      expect(appState.currentPath[1].name).toBe('components');
    });

    it('should call saveFocusState before navigation', async () => {
      appState.currentPath = [{ name: 'src' }, { name: 'components' }];

      await navigateToPathIndex(0, mockCallbacks);

      expect(mockCallbacks.saveFocusState).toHaveBeenCalled();
    });

    it('should save temp changes if file is dirty', async () => {
      appState.currentPath = [{ name: 'src' }, { name: 'components' }];
      appState.isDirty = true;
      appState.currentFileHandle = createMockFileHandle('test.js');

      await navigateToPathIndex(0, mockCallbacks);

      expect(mockCallbacks.saveTempChanges).toHaveBeenCalled();
    });

    it('should call showFilePicker after navigation', async () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentDirHandle = createMockDirectoryHandle('src', {});

      await navigateToPathIndex(0, mockCallbacks);

      expect(mockCallbacks.showFilePicker).toHaveBeenCalled();
    });

    it('should do nothing if index is out of bounds', async () => {
      appState.currentPath = [{ name: 'src' }];
      const originalPath = [...appState.currentPath];

      await navigateToPathIndex(10, mockCallbacks);

      expect(appState.currentPath).toEqual(originalPath);
    });

    it('should do nothing if index is negative', async () => {
      appState.currentPath = [{ name: 'src' }];
      const originalPath = [...appState.currentPath];

      await navigateToPathIndex(-1, mockCallbacks);

      expect(appState.currentPath).toEqual(originalPath);
    });

    it('should save current path when navigating to breadcrumb', async () => {
      appState.currentPath = [{ name: 'root' }, { name: 'src' }, { name: 'components' }];
      appState.currentDirHandle = createMockDirectoryHandle('components', {});

      await navigateToPathIndex(0, mockCallbacks);

      // Previous path should be saved for restoration if user cancels
      expect(appState.previousPath).toBeDefined();
      expect(appState.previousPath).toHaveLength(3);
      expect(appState.previousPath[0].name).toBe('root');
      expect(appState.previousPath[1].name).toBe('src');
      expect(appState.previousPath[2].name).toBe('components');
    });

    it('should truncate path when navigating to breadcrumb index', async () => {
      appState.currentPath = [{ name: 'root' }, { name: 'src' }, { name: 'components' }];
      appState.currentDirHandle = createMockDirectoryHandle('components', {});

      await navigateToPathIndex(1, mockCallbacks);

      // Path should be truncated to clicked index
      expect(appState.currentPath).toHaveLength(2);
      expect(appState.currentPath[0].name).toBe('root');
      expect(appState.currentPath[1].name).toBe('src');
    });
  });

  describe('Direct showFilePicker Restoration', () => {
    it('should restore file when clicking filename and canceling picker', async () => {
      // Setup DOM for file picker (needed by hideFilePicker)
      const filePickerElement = document.createElement('div');
      filePickerElement.id = 'file-picker';
      document.body.appendChild(filePickerElement);

      const resizeHandle = document.createElement('div');
      resizeHandle.id = 'file-picker-resize-handle';
      document.body.appendChild(resizeHandle);

      // Setup: file is open
      const originalFile = createMockFileHandle('test.js', 'content');
      appState.currentPath = [{ name: 'src', handle: createMockDirectoryHandle('src', {}) }];
      appState.currentFileHandle = originalFile;
      appState.currentFilename = 'test.js';
      appState.currentDirHandle = appState.currentPath[0].handle;

      // Mock focusManager
      appState.focusManager = { focusEditor: vi.fn() };

      // Mock showFilePicker to simulate opening picker
      mockCallbacks.showFilePicker = vi.fn(async () => {
        // Simulate what real showFilePicker does:
        // 1. Save current file
        if (appState.currentFileHandle) {
          appState.previousFileHandle = appState.currentFileHandle;
          appState.previousFilename = appState.currentFilename;
          appState.isNavigatingBreadcrumbs = true;
        }
        // 2. Clear current file
        appState.currentFileHandle = null;
        appState.currentFilename = '';
      });

      updateBreadcrumb(mockCallbacks);

      // Click filename (not placeholder, not from breadcrumb navigation)
      const fileItem = breadcrumbElement.querySelector('.breadcrumb-item:last-child');
      await fileItem.click();

      // Verify file was cleared
      expect(appState.currentFileHandle).toBeNull();
      expect(appState.currentFilename).toBe('');

      // Verify flag was set
      expect(appState.isNavigatingBreadcrumbs).toBe(true);

      // User cancels picker (closes without selection)
      const { hideFilePicker } = await import('../../src/ui/file-picker.js');
      hideFilePicker();

      // File should be restored
      expect(appState.currentFileHandle).toBe(originalFile);
      expect(appState.currentFilename).toBe('test.js');

      // Cleanup
      document.body.removeChild(filePickerElement);
      document.body.removeChild(resizeHandle);
    });
  });

  describe('Callback Requirements', () => {
    it('should not throw when callbacks are missing', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFilename = 'test.js';
      appState.currentFileHandle = createMockFileHandle('test.js', '');
      appState.currentDirHandle = createMockDirectoryHandle('src', {});

      // Should not throw even without callbacks
      expect(() => {
        updateBreadcrumb();
      }).not.toThrow();
    });

    it('should call showFilePicker when clicking filename with callback provided', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFilename = 'test.js';
      appState.currentFileHandle = createMockFileHandle('test.js', '');
      appState.currentDirHandle = createMockDirectoryHandle('src', {});

      updateBreadcrumb(mockCallbacks);

      const fileItem = breadcrumbElement.querySelector(
        '.breadcrumb-item:last-child:not(.breadcrumb-placeholder)'
      );
      expect(fileItem).toBeTruthy();

      // Click the filename
      fileItem.click();

      expect(mockCallbacks.showFilePicker).toHaveBeenCalledWith(appState.currentDirHandle);
    });

    it('should not crash when clicking filename without showFilePicker callback', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFilename = 'test.js';
      appState.currentFileHandle = createMockFileHandle('test.js', '');
      appState.currentDirHandle = createMockDirectoryHandle('src', {});

      // Update with no callbacks
      updateBreadcrumb();

      const fileItem = breadcrumbElement.querySelector(
        '.breadcrumb-item:last-child:not(.breadcrumb-placeholder)'
      );

      // Should not throw even without callback
      expect(() => {
        fileItem.click();
      }).not.toThrow();
    });

    it('should call showFilePicker when clicking placeholder with callback provided', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFileHandle = null; // No file open
      appState.currentDirHandle = createMockDirectoryHandle('src', {});

      updateBreadcrumb(mockCallbacks);

      const placeholder = breadcrumbElement.querySelector('.breadcrumb-placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder.textContent).toBe('filename (/ for search)');

      // Click the placeholder
      placeholder.click();

      expect(mockCallbacks.showFilePicker).toHaveBeenCalledWith(appState.currentDirHandle);
    });

    it('should not crash when clicking placeholder without showFilePicker callback', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFileHandle = null;
      appState.currentDirHandle = createMockDirectoryHandle('src', {});

      // Update with no callbacks
      updateBreadcrumb();

      const placeholder = breadcrumbElement.querySelector('.breadcrumb-placeholder');

      // Should not throw
      expect(() => {
        placeholder.click();
      }).not.toThrow();
    });

    it('should call saveFocusState before showFilePicker', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFilename = 'test.js';
      appState.currentFileHandle = createMockFileHandle('test.js', '');
      appState.currentDirHandle = createMockDirectoryHandle('src', {});

      const callOrder = [];
      mockCallbacks.saveFocusState = vi.fn(() => callOrder.push('saveFocus'));
      mockCallbacks.showFilePicker = vi.fn(() => callOrder.push('showPicker'));

      updateBreadcrumb(mockCallbacks);

      const fileItem = breadcrumbElement.querySelector(
        '.breadcrumb-item:last-child:not(.breadcrumb-placeholder)'
      );
      fileItem.click();

      expect(callOrder).toEqual(['saveFocus', 'showPicker']);
    });

    it('should call openFolder when clicking untitled without folder', () => {
      appState.currentPath = [];
      appState.currentFilename = '';

      updateBreadcrumb(mockCallbacks);

      const item = breadcrumbElement.querySelector('.breadcrumb-item');
      expect(item.textContent).toBe('untitled');

      item.click();

      expect(mockCallbacks.openFolder).toHaveBeenCalled();
    });

    it('should handle missing currentDirHandle gracefully', () => {
      appState.currentPath = [{ name: 'src' }];
      appState.currentFilename = 'test.js';
      appState.currentFileHandle = createMockFileHandle('test.js', '');
      appState.currentDirHandle = null; // Missing!

      updateBreadcrumb(mockCallbacks);

      const fileItem = breadcrumbElement.querySelector(
        '.breadcrumb-item:last-child:not(.breadcrumb-placeholder)'
      );

      // Should not crash or call showFilePicker
      expect(() => {
        fileItem.click();
      }).not.toThrow();

      expect(mockCallbacks.showFilePicker).not.toHaveBeenCalled();
    });
  });
});
