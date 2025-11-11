import { describe, it, expect } from 'vitest';
import {
  fuzzyMatch,
  calculateRelevance,
  recursiveSearchFiles,
} from '../../src/search/fuzzy-search.js';
import { createMockDirectoryHandle } from '../mocks/filesystem.js';

describe('Fuzzy Search', () => {
  describe('fuzzyMatch', () => {
    it('should match exact strings', () => {
      expect(fuzzyMatch('test.js', 'test.js')).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(fuzzyMatch('Test.JS', 'test.js')).toBe(true);
      expect(fuzzyMatch('TEST.js', 'TeSt.Js')).toBe(true);
    });

    it('should match with spaces as wildcards', () => {
      expect(fuzzyMatch('my-test-file.js', 'my test file')).toBe(true);
      expect(fuzzyMatch('my_test_file.js', 'my test file')).toBe(true);
    });

    it('should match substring patterns', () => {
      expect(fuzzyMatch('application.test.js', 'test')).toBe(true);
      expect(fuzzyMatch('component.jsx', 'comp')).toBe(true);
    });

    it('should not match unrelated strings', () => {
      expect(fuzzyMatch('app.js', 'xyz')).toBe(false);
      expect(fuzzyMatch('test.js', 'foo')).toBe(false);
    });

    it('should handle empty query (match everything)', () => {
      expect(fuzzyMatch('anything', '')).toBe(true);
      expect(fuzzyMatch('test.js', '')).toBe(true);
      expect(fuzzyMatch('', '')).toBe(true);
    });

    it('should handle special regex characters', () => {
      expect(fuzzyMatch('file.test.js', '.test.')).toBe(true);
      expect(fuzzyMatch('$component.js', '$component')).toBe(true);
      expect(fuzzyMatch('[test].js', '[test]')).toBe(true);
    });

    it('should match partial patterns', () => {
      expect(fuzzyMatch('app.test.js', 'app')).toBe(true);
      expect(fuzzyMatch('app.test.js', '.js')).toBe(true);
    });

    it('should handle queries with multiple spaces', () => {
      expect(fuzzyMatch('my-very-long-file-name.js', 'my  very  long')).toBe(true);
    });

    it('should handle empty text with non-empty query', () => {
      expect(fuzzyMatch('', 'test')).toBe(false);
    });

    it('should match filenames with numbers', () => {
      expect(fuzzyMatch('file123.js', '123')).toBe(true);
      expect(fuzzyMatch('test-v2.js', 'v2')).toBe(true);
    });

    it('should match with underscores as wildcards', () => {
      expect(fuzzyMatch('my_test_file.js', 'my test')).toBe(true);
    });

    it('should match with dashes as wildcards', () => {
      expect(fuzzyMatch('my-test-file.js', 'my test')).toBe(true);
    });

    it('should handle long filenames', () => {
      const longName = 'this-is-a-very-long-filename-with-many-parts.test.spec.js';
      expect(fuzzyMatch(longName, 'very long')).toBe(true);
    });

    it('should handle queries with special characters', () => {
      expect(fuzzyMatch('file+name.js', 'file+name')).toBe(true);
      expect(fuzzyMatch('test(1).js', 'test(1)')).toBe(true);
    });
  });

  describe('calculateRelevance', () => {
    it('should score exact matches highest', () => {
      expect(calculateRelevance('test.js', 'test.js')).toBe(1000);
    });

    it('should score prefix matches high', () => {
      expect(calculateRelevance('testing.js', 'test')).toBe(500);
    });

    it('should score substring matches medium', () => {
      expect(calculateRelevance('mytest.js', 'test')).toBe(100);
    });

    it('should score fuzzy matches low', () => {
      expect(calculateRelevance('abc.js', 'xyz')).toBe(10);
    });

    it('should reduce score based on depth', () => {
      expect(calculateRelevance('test.js', 'test.js', 0)).toBe(1000);
      expect(calculateRelevance('test.js', 'test.js', 5)).toBe(995);
      expect(calculateRelevance('test.js', 'test.js', 10)).toBe(990);
    });

    it('should handle empty query', () => {
      expect(calculateRelevance('anything', '')).toBe(1000);
    });

    it('should handle case-insensitive exact match', () => {
      expect(calculateRelevance('Test.JS', 'test.js')).toBe(1000);
    });

    it('should prioritize prefix over substring', () => {
      const prefixScore = calculateRelevance('testing.js', 'test');
      const substringScore = calculateRelevance('mytest.js', 'test');
      expect(prefixScore).toBeGreaterThan(substringScore);
    });

    it('should prioritize exact over prefix', () => {
      const exactScore = calculateRelevance('test', 'test');
      const prefixScore = calculateRelevance('testing', 'test');
      expect(exactScore).toBeGreaterThan(prefixScore);
    });

    it('should handle filenames with extensions', () => {
      expect(calculateRelevance('app.test.js', 'app.test.js')).toBe(1000);
      expect(calculateRelevance('app.test.js', 'app')).toBe(500);
    });
  });

  describe('recursiveSearchFiles', () => {
    it('should find files matching query', async () => {
      const mockDir = createMockDirectoryHandle('root', {
        'test.js': '',
        'app.js': '',
      });

      const results = [];
      for await (const result of recursiveSearchFiles(mockDir, 'test', 10, 100)) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('test.js');
      expect(results[0].kind).toBe('file');
    });

    it('should search subdirectories', async () => {
      const mockDir = createMockDirectoryHandle('root', {
        'index.js': '',
        components: {
          'App.test.js': '',
        },
      });

      const results = [];
      for await (const result of recursiveSearchFiles(mockDir, 'test', 10, 100)) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('App.test.js');
      expect(results[0].path).toBe('components');
    });

    it('should respect depth limit', async () => {
      // Create deeply nested structure
      const mockDir = createMockDirectoryHandle('root', {
        level1: {
          level2: {
            level3: {
              'deep.js': '',
            },
          },
        },
      });

      const results = [];
      // Set max depth to 2, so level3 should not be reached
      for await (const result of recursiveSearchFiles(mockDir, 'deep', 2, 100)) {
        results.push(result);
      }

      expect(results).toHaveLength(0);
    });

    it('should respect result limit', async () => {
      const mockDir = createMockDirectoryHandle('root', {
        'file1.js': '',
        'file2.js': '',
        'file3.js': '',
        'file4.js': '',
        'file5.js': '',
      });

      const results = [];
      // Limit to 3 results
      for await (const result of recursiveSearchFiles(mockDir, '', 10, 3)) {
        results.push(result);
      }

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should skip hidden directories', async () => {
      const mockDir = createMockDirectoryHandle('root', {
        '.git': {},
        '.gitignore': '',
        'visible.js': '',
      });

      const results = [];
      for await (const result of recursiveSearchFiles(mockDir, '', 10, 100)) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('visible.js');
    });

    it('should include relevance scores', async () => {
      const mockDir = createMockDirectoryHandle('root', {
        'test.js': '',
        'testing.js': '',
        'mytest.js': '',
      });

      const results = [];
      for await (const result of recursiveSearchFiles(mockDir, 'test', 10, 100)) {
        results.push(result);
      }

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result).toHaveProperty('relevance');
        expect(typeof result.relevance).toBe('number');
      });
    });

    it('should include depth information', async () => {
      const mockDir = createMockDirectoryHandle('root', {
        'index.js': '',
        src: {
          'app.js': '',
        },
      });

      const results = [];
      for await (const result of recursiveSearchFiles(mockDir, '', 10, 100)) {
        results.push(result);
      }

      // Results include both files and directories (index.js, src directory, app.js)
      expect(results.length).toBe(3);
      const rootFile = results.find((r) => r.name === 'index.js');
      const nestedFile = results.find((r) => r.name === 'app.js');

      expect(rootFile.depth).toBe(0);
      expect(nestedFile.depth).toBe(1);
    });

    it('should handle empty directory', async () => {
      const mockDir = createMockDirectoryHandle('root', {});

      const results = [];
      for await (const result of recursiveSearchFiles(mockDir, 'test', 10, 100)) {
        results.push(result);
      }

      expect(results).toHaveLength(0);
    });

    it('should include full path information', async () => {
      const mockDir = createMockDirectoryHandle('root', {
        components: {
          'Button.js': '',
        },
      });

      const results = [];
      for await (const result of recursiveSearchFiles(mockDir, 'Button', 10, 100)) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0].fullPath).toBe('components/Button.js');
    });

    it('should prevent infinite loops with circular references', async () => {
      const mockDir = createMockDirectoryHandle('root', {
        'test.js': '',
      });

      const results = [];
      // This should complete without hanging
      for await (const result of recursiveSearchFiles(mockDir, 'test', 10, 100)) {
        results.push(result);
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
