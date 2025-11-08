import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Session File Management', () => {
  let mockRootDir;
  let mockSubDir;
  let mockFile;
  let appState;
  let sessionFiles;

  beforeEach(() => {
    // Track which directories have session files
    sessionFiles = new Map();

    // Mock root directory
    mockRootDir = {
      name: 'project-root',
      kind: 'directory',
      getFileHandle: vi.fn(async (name, options) => {
        if (name === '.session_properties.HN') {
          if (!sessionFiles.has('root') && !options?.create) {
            throw new Error('File not found');
          }
          sessionFiles.set('root', true);
          return {
            kind: 'file',
            name: '.session_properties.HN',
            getFile: async () => ({
              text: async () => JSON.stringify({ session: { lastOpenFile: null } }),
            }),
          };
        }
        throw new Error('File not found');
      }),
      entries: async function* () {
        yield ['subdir', mockSubDir];
        yield ['file.txt', mockFile];
      },
    };

    // Mock subdirectory
    mockSubDir = {
      name: 'subdir',
      kind: 'directory',
      getFileHandle: vi.fn(async (name, _options) => {
        if (name === '.session_properties.HN') {
          // This should NOT be called for session files
          throw new Error('Session file should not be created in subdirectory');
        }
        throw new Error('File not found');
      }),
      entries: async function* () {
        yield ['nested.txt', mockFile];
      },
    };

    // Mock file
    mockFile = {
      kind: 'file',
      name: 'file.txt',
      getFile: async () => ({
        text: async () => 'test content',
      }),
    };

    // Mock app state
    appState = {
      currentDirHandle: null,
      rootDirHandle: null,
      currentPath: [],
      currentFileHandle: null,
      currentFilename: '',
    };
  });

  describe('Root Directory Session File', () => {
    it('should create session file in root directory only', async () => {
      // Simulate opening root directory
      appState.currentDirHandle = mockRootDir;
      appState.rootDirHandle = mockRootDir;
      appState.currentPath = [{ name: 'project-root', handle: mockRootDir }];

      // Create session file
      await mockRootDir.getFileHandle('.session_properties.HN', { create: true });

      expect(sessionFiles.has('root')).toBe(true);
      expect(sessionFiles.has('subdir')).toBe(false);
    });

    it('should load session file from root directory', async () => {
      appState.rootDirHandle = mockRootDir;
      sessionFiles.set('root', true);

      const handle = await mockRootDir.getFileHandle('.session_properties.HN', { create: false });
      const file = await handle.getFile();
      const content = await file.text();
      const sessionData = JSON.parse(content);

      expect(sessionData).toHaveProperty('session');
      expect(mockRootDir.getFileHandle).toHaveBeenCalledWith('.session_properties.HN', {
        create: false,
      });
    });

    it('should use rootDirHandle for session operations even when in subdirectory', async () => {
      // Start in root
      appState.currentDirHandle = mockRootDir;
      appState.rootDirHandle = mockRootDir;
      appState.currentPath = [{ name: 'project-root', handle: mockRootDir }];

      // Create session file in root first
      sessionFiles.set('root', true);

      // Navigate to subdirectory
      appState.currentDirHandle = mockSubDir;
      appState.currentPath.push({ name: 'subdir', handle: mockSubDir });

      // Session file operations should still use rootDirHandle
      expect(appState.rootDirHandle).toBe(mockRootDir);
      expect(appState.currentDirHandle).toBe(mockSubDir);

      // Session file should only exist in root
      await expect(
        appState.rootDirHandle.getFileHandle('.session_properties.HN', { create: false })
      ).resolves.toBeDefined();
    });
  });

  describe('Subdirectory Navigation', () => {
    it('should NOT create session file in subdirectories', async () => {
      appState.currentDirHandle = mockSubDir;
      appState.rootDirHandle = mockRootDir;
      appState.currentPath = [
        { name: 'project-root', handle: mockRootDir },
        { name: 'subdir', handle: mockSubDir },
      ];

      // Attempting to create session file in subdir should fail
      await expect(
        mockSubDir.getFileHandle('.session_properties.HN', { create: true })
      ).rejects.toThrow();

      expect(sessionFiles.has('subdir')).toBe(false);
    });

    it('should maintain rootDirHandle reference during navigation', async () => {
      const originalRoot = mockRootDir;

      appState.rootDirHandle = originalRoot;
      appState.currentDirHandle = mockRootDir;
      appState.currentPath = [{ name: 'project-root', handle: mockRootDir }];

      // Navigate to subdirectory
      appState.currentDirHandle = mockSubDir;
      appState.currentPath.push({ name: 'subdir', handle: mockSubDir });

      // rootDirHandle should remain unchanged
      expect(appState.rootDirHandle).toBe(originalRoot);
      expect(appState.currentDirHandle).not.toBe(appState.rootDirHandle);
    });

    it('should navigate back to parent and still reference same root', async () => {
      appState.rootDirHandle = mockRootDir;
      appState.currentDirHandle = mockRootDir;
      appState.currentPath = [{ name: 'project-root', handle: mockRootDir }];

      // Navigate down
      appState.currentDirHandle = mockSubDir;
      appState.currentPath.push({ name: 'subdir', handle: mockSubDir });

      // Navigate up
      appState.currentPath.pop();
      appState.currentDirHandle = appState.currentPath[appState.currentPath.length - 1].handle;

      expect(appState.rootDirHandle).toBe(mockRootDir);
      expect(appState.currentDirHandle).toBe(mockRootDir);
    });
  });

  describe('Session File Persistence', () => {
    it('should persist rootDirHandle across file operations', async () => {
      const root = mockRootDir;
      appState.rootDirHandle = root;
      appState.currentDirHandle = mockSubDir;

      // Simulate opening a file in subdirectory
      appState.currentFileHandle = mockFile;
      appState.currentFilename = 'nested.txt';

      // Root should still be the original
      expect(appState.rootDirHandle).toBe(root);
    });

    it('should save session data to root when file is in subdirectory', async () => {
      sessionFiles.set('root', true);

      appState.rootDirHandle = mockRootDir;
      appState.currentDirHandle = mockSubDir;
      appState.currentPath = [
        { name: 'project-root', handle: mockRootDir },
        { name: 'subdir', handle: mockSubDir },
      ];

      // Session file operations use rootDirHandle
      const sessionHandle = await appState.rootDirHandle.getFileHandle('.session_properties.HN', {
        create: false,
      });

      expect(sessionHandle).toBeDefined();
      expect(mockRootDir.getFileHandle).toHaveBeenCalledWith('.session_properties.HN', {
        create: false,
      });
      expect(mockSubDir.getFileHandle).not.toHaveBeenCalledWith(
        '.session_properties.HN',
        expect.anything()
      );
    });
  });

  describe('Multiple Directory Levels', () => {
    let mockDeepSubDir;

    beforeEach(() => {
      mockDeepSubDir = {
        name: 'deep',
        kind: 'directory',
        getFileHandle: vi.fn(async (name, _options) => {
          if (name === '.session_properties.HN') {
            throw new Error('Session file should not be created in deep subdirectory');
          }
          throw new Error('File not found');
        }),
        entries: async function* () {},
      };
    });

    it('should use root session file even in deeply nested directories', async () => {
      appState.rootDirHandle = mockRootDir;
      appState.currentDirHandle = mockDeepSubDir;
      appState.currentPath = [
        { name: 'project-root', handle: mockRootDir },
        { name: 'subdir', handle: mockSubDir },
        { name: 'deep', handle: mockDeepSubDir },
      ];

      expect(appState.rootDirHandle).toBe(mockRootDir);
      expect(sessionFiles.has('deep')).toBe(false);

      // Verify root is still accessible for session operations
      sessionFiles.set('root', true);
      await expect(
        appState.rootDirHandle.getFileHandle('.session_properties.HN', { create: false })
      ).resolves.toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rootDirHandle being null initially', () => {
      expect(appState.rootDirHandle).toBeNull();
      expect(appState.currentDirHandle).toBeNull();
    });

    it('should set rootDirHandle when opening first directory', async () => {
      expect(appState.rootDirHandle).toBeNull();

      // Simulate opening directory
      appState.currentDirHandle = mockRootDir;
      appState.rootDirHandle = mockRootDir;

      expect(appState.rootDirHandle).toBe(mockRootDir);
    });

    it('should not change rootDirHandle when opening different directory', async () => {
      const firstRoot = mockRootDir;
      const secondRoot = {
        name: 'different-project',
        kind: 'directory',
        getFileHandle: vi.fn(),
      };

      // Open first directory
      appState.rootDirHandle = firstRoot;
      appState.currentDirHandle = firstRoot;

      // Open second directory (like opening a new folder)
      appState.rootDirHandle = secondRoot;
      appState.currentDirHandle = secondRoot;
      appState.currentPath = [{ name: 'different-project', handle: secondRoot }];

      // Should now reference the new root
      expect(appState.rootDirHandle).toBe(secondRoot);
      expect(appState.rootDirHandle).not.toBe(firstRoot);
    });
  });
});
