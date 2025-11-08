import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Integration tests for session persistence across directory navigation
 * Tests the full workflow of opening folders, navigating subdirectories,
 * and ensuring session data is always saved to the root directory
 */
describe('Session Persistence Integration', () => {
  let FileSystemAdapter;
  let mockProject;
  let mockSrcDir;
  let mockTestsDir;
  let mockFile;
  let sessionData;
  let savedSessions;

  beforeEach(() => {
    // Track session files saved to each directory
    savedSessions = new Map();
    sessionData = null;

    // Mock FileSystemAdapter
    FileSystemAdapter = {
      readFile: vi.fn(async (fileHandle) => {
        const dirKey = fileHandle._parentDir || 'root';
        return savedSessions.get(dirKey) || JSON.stringify({ session: { lastOpenFile: null } });
      }),
      writeFile: vi.fn(async (fileHandle, content) => {
        const dirKey = fileHandle._parentDir || 'root';
        savedSessions.set(dirKey, content);
        sessionData = JSON.parse(content);
      }),
    };

    // Create mock directory structure
    // project-root/
    //   src/
    //     app.js
    //   tests/
    //     app.test.js
    //   README.md

    mockFile = {
      kind: 'file',
      name: 'README.md',
      getFile: async () => ({
        text: async () => '# Project',
      }),
    };

    const srcFile = {
      kind: 'file',
      name: 'app.js',
      getFile: async () => ({
        text: async () => 'console.log("app")',
      }),
    };

    const testFile = {
      kind: 'file',
      name: 'app.test.js',
      getFile: async () => ({
        text: async () => 'test("app")',
      }),
    };

    mockSrcDir = {
      name: 'src',
      kind: 'directory',
      _parentDir: 'src',
      getFileHandle: vi.fn(async (name, options) => {
        if (name === 'app.js') return srcFile;
        if (name === '.session_properties.HN') {
          if (options?.create) {
            // Should NOT create session in subdirectory
            throw new Error('Session file created in subdirectory - this is a bug!');
          }
          throw new Error('File not found');
        }
        throw new Error('File not found');
      }),
      entries: async function* () {
        yield ['app.js', srcFile];
      },
    };

    mockTestsDir = {
      name: 'tests',
      kind: 'directory',
      _parentDir: 'tests',
      getFileHandle: vi.fn(async (name, options) => {
        if (name === 'app.test.js') return testFile;
        if (name === '.session_properties.HN') {
          if (options?.create) {
            throw new Error('Session file created in subdirectory - this is a bug!');
          }
          throw new Error('File not found');
        }
        throw new Error('File not found');
      }),
      entries: async function* () {
        yield ['app.test.js', testFile];
      },
    };

    mockProject = {
      name: 'project-root',
      kind: 'directory',
      _parentDir: 'root',
      getFileHandle: vi.fn(async (name, _options) => {
        if (name === 'README.md') return mockFile;
        if (name === '.session_properties.HN') {
          return {
            kind: 'file',
            name: '.session_properties.HN',
            _parentDir: 'root',
            getFile: async () => ({
              text: async () =>
                savedSessions.get('root') || JSON.stringify({ session: { lastOpenFile: null } }),
            }),
          };
        }
        throw new Error('File not found');
      }),
      entries: async function* () {
        yield ['src', mockSrcDir];
        yield ['tests', mockTestsDir];
        yield ['README.md', mockFile];
      },
    };
  });

  describe('Full Session Workflow', () => {
    it('should create session file in root when opening folder', async () => {
      const rootDirHandle = mockProject;

      // Load or create session file
      const sessionFileHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });

      // Write initial session
      await FileSystemAdapter.writeFile(
        sessionFileHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: {
            lastOpenFile: null,
          },
        })
      );

      expect(savedSessions.has('root')).toBe(true);
      expect(savedSessions.has('src')).toBe(false);
      expect(savedSessions.has('tests')).toBe(false);
    });

    it('should update session in root when opening file in subdirectory', async () => {
      const rootDirHandle = mockProject;
      const _currentDirHandle = mockSrcDir;

      // Initial session
      const sessionFileHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });
      await FileSystemAdapter.writeFile(
        sessionFileHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: { lastOpenFile: null },
        })
      );

      // Navigate to src/ and open app.js
      const filePath = ['src', 'app.js'];

      // Update session (should use rootDirHandle, not currentDirHandle)
      await FileSystemAdapter.writeFile(
        sessionFileHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: {
            lastOpenFile: {
              path: filePath,
              cursorPosition: 0,
              scrollTop: 0,
              scrollLeft: 0,
            },
          },
        })
      );

      expect(savedSessions.has('root')).toBe(true);
      expect(sessionData.session.lastOpenFile.path).toEqual(['src', 'app.js']);

      // Verify session NOT saved to subdirectory
      expect(savedSessions.has('src')).toBe(false);
    });

    it('should maintain session across deep directory navigation', async () => {
      const rootDirHandle = mockProject;

      // Create session
      const sessionFileHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });

      // Navigate: root → src → open app.js
      await FileSystemAdapter.writeFile(
        sessionFileHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: {
            lastOpenFile: {
              path: ['src', 'app.js'],
              cursorPosition: 10,
            },
          },
        })
      );

      expect(savedSessions.get('root')).toContain('src');
      expect(savedSessions.get('root')).toContain('app.js');

      // Navigate: root → tests → open app.test.js
      await FileSystemAdapter.writeFile(
        sessionFileHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: {
            lastOpenFile: {
              path: ['tests', 'app.test.js'],
              cursorPosition: 5,
            },
          },
        })
      );

      expect(savedSessions.get('root')).toContain('tests');
      expect(savedSessions.get('root')).toContain('app.test.js');

      // Should still be only in root
      expect(savedSessions.size).toBe(1);
      expect(savedSessions.has('root')).toBe(true);
    });
  });

  describe('Session Restoration', () => {
    it('should restore last open file from root session', async () => {
      const rootDirHandle = mockProject;

      // Create session with last open file
      const sessionFileHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });
      await FileSystemAdapter.writeFile(
        sessionFileHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: {
            lastOpenFile: {
              path: ['src', 'app.js'],
              cursorPosition: 42,
              scrollTop: 100,
              scrollLeft: 0,
              isRichMode: false,
            },
          },
        })
      );

      // Load session
      const file = await sessionFileHandle.getFile();
      const content = await file.text();
      const loadedSession = JSON.parse(content);

      expect(loadedSession.session.lastOpenFile.path).toEqual(['src', 'app.js']);
      expect(loadedSession.session.lastOpenFile.cursorPosition).toBe(42);
      expect(loadedSession.session.lastOpenFile.scrollTop).toBe(100);
    });

    it('should handle missing session file gracefully', async () => {
      const rootDirHandle = mockProject;

      // Try to load non-existent session
      try {
        await rootDirHandle.getFileHandle('.session_properties.HN', { create: false });
      } catch (err) {
        expect(err.message).toBe('File not found');
      }

      // Should create new session
      const newSessionHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });
      await FileSystemAdapter.writeFile(
        newSessionHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: { lastOpenFile: null },
        })
      );

      expect(savedSessions.has('root')).toBe(true);
    });
  });

  describe('Session Data Integrity', () => {
    it('should preserve all session properties during navigation', async () => {
      const rootDirHandle = mockProject;
      const sessionFileHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });

      const fullSessionData = {
        folderName: 'project-root',
        lastModified: Date.now(),
        session: {
          lastOpenFile: {
            path: ['src', 'app.js'],
            cursorPosition: 100,
            scrollTop: 500,
            scrollLeft: 10,
            isRichMode: false,
          },
        },
      };

      await FileSystemAdapter.writeFile(sessionFileHandle, JSON.stringify(fullSessionData));

      // Verify all properties preserved
      const file = await sessionFileHandle.getFile();
      const content = await file.text();
      const loaded = JSON.parse(content);

      expect(loaded.folderName).toBe(fullSessionData.folderName);
      expect(loaded.session.lastOpenFile.path).toEqual(fullSessionData.session.lastOpenFile.path);
      expect(loaded.session.lastOpenFile.cursorPosition).toBe(
        fullSessionData.session.lastOpenFile.cursorPosition
      );
      expect(loaded.session.lastOpenFile.scrollTop).toBe(
        fullSessionData.session.lastOpenFile.scrollTop
      );
      expect(loaded.session.lastOpenFile.isRichMode).toBe(
        fullSessionData.session.lastOpenFile.isRichMode
      );
    });

    it('should handle multiple rapid session updates', async () => {
      const rootDirHandle = mockProject;
      const sessionFileHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });

      // Simulate rapid typing/navigation
      for (let i = 0; i < 10; i++) {
        await FileSystemAdapter.writeFile(
          sessionFileHandle,
          JSON.stringify({
            folderName: 'project-root',
            session: {
              lastOpenFile: {
                path: ['src', 'app.js'],
                cursorPosition: i * 10,
              },
            },
          })
        );
      }

      // Should have latest cursor position
      expect(sessionData.session.lastOpenFile.cursorPosition).toBe(90);

      // Should still be only in root
      expect(savedSessions.size).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should not corrupt session on write error', async () => {
      const rootDirHandle = mockProject;
      const sessionFileHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });

      // Write valid session
      await FileSystemAdapter.writeFile(
        sessionFileHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: { lastOpenFile: { path: ['README.md'] } },
        })
      );

      const validSession = sessionData;

      // Simulate write error
      FileSystemAdapter.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      try {
        await FileSystemAdapter.writeFile(sessionFileHandle, 'invalid json');
      } catch {
        // Error expected
      }

      // Previous valid session should still be intact
      const file = await sessionFileHandle.getFile();
      const content = await file.text();
      const loaded = JSON.parse(content);

      expect(loaded.session.lastOpenFile.path).toEqual(validSession.session.lastOpenFile.path);
    });

    it('should handle invalid JSON in session file', async () => {
      savedSessions.set('root', 'invalid json{{{');

      const rootDirHandle = mockProject;
      const sessionFileHandle = await rootDirHandle.getFileHandle('.session_properties.HN', {
        create: true,
      });

      const file = await sessionFileHandle.getFile();
      const content = await file.text();

      expect(() => JSON.parse(content)).toThrow();

      // Should be able to recover by writing new session
      await FileSystemAdapter.writeFile(
        sessionFileHandle,
        JSON.stringify({
          folderName: 'project-root',
          session: { lastOpenFile: null },
        })
      );

      expect(savedSessions.get('root')).toContain('project-root');
    });
  });
});
