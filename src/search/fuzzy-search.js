import { FileSystemAdapter } from '../fs/filesystem-adapter.js';

/**
 * Fuzzy match algorithm - handles case-insensitive, substring, and space-as-wildcard matching
 * @param {string} text - Text to search in
 * @param {string} query - Search query
 * @returns {boolean} True if query matches text
 */
export const fuzzyMatch = (text, query) => {
  if (!query) return true;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Normalize: replace spaces in query with a regex pattern that matches '', '-', or '_'
  const queryPattern = queryLower
    .split(' ')
    .map((part) =>
      part
        .split('')
        .map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('')
    )
    .join('[\\s\\-_]*');

  const regex = new RegExp(queryPattern);
  return regex.test(textLower);
};

/**
 * Calculate relevance score for search result
 * @param {string} filename - Filename being scored
 * @param {string} query - Search query
 * @param {number} depth - Directory depth (affects scoring)
 * @returns {number} Relevance score (higher = more relevant)
 */
export const calculateRelevance = (filename, query, depth = 0) => {
  if (!query) return 1000;

  const filenameLower = filename.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match (highest priority)
  if (filenameLower === queryLower) {
    return 1000 - depth;
  }

  // Prefix match
  if (filenameLower.startsWith(queryLower)) {
    return 500 - depth;
  }

  // Substring match
  if (filenameLower.includes(queryLower)) {
    return 100 - depth;
  }

  // Fuzzy match (lowest priority)
  return 10 - depth;
};

/**
 * Recursive file search with async generator and result limits
 * @param {FileSystemDirectoryHandle} dirHandle - Directory to search
 * @param {string} query - Search query
 * @param {number} maxDepth - Maximum recursion depth
 * @param {number} maxResults - Maximum number of results to return
 * @yields {Object} Search results with name, path, handle, relevance
 */
export const recursiveSearchFiles = async function* (
  dirHandle,
  query,
  maxDepth = 10,
  maxResults = 100
) {
  const visited = new Set(); // Prevent infinite loops
  let resultCount = 0;

  const traverse = async function* (currentDir, currentPath = '', depth = 0) {
    // Stop if we've hit depth limit or result limit
    if (depth > maxDepth || resultCount >= maxResults) {
      return;
    }

    try {
      const entries = await FileSystemAdapter.listDirectory(currentDir);

      for (const entry of entries) {
        // Stop if we've reached result limit
        if (resultCount >= maxResults) {
          return;
        }

        // Skip hidden files and folders (starting with .)
        if (entry.name.startsWith('.')) {
          continue;
        }

        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        // Check if we've already visited this entry (avoid cycles)
        const entryKey = `${depth}:${entryPath}`;
        if (visited.has(entryKey)) {
          continue;
        }
        visited.add(entryKey);

        // Check if entry matches query
        if (fuzzyMatch(entry.name, query)) {
          const relevance = calculateRelevance(entry.name, query, depth);
          yield {
            name: entry.name,
            path: currentPath,
            fullPath: entryPath,
            kind: entry.kind,
            handle: entry,
            depth: depth,
            relevance: relevance,
          };
          resultCount++;
        }

        // Recursively search subdirectories
        if (entry.kind === 'directory' && resultCount < maxResults) {
          yield* traverse(entry, entryPath, depth + 1);
        }
      }
    } catch (err) {
      // Skip directories we can't access
      console.warn(`Cannot access directory: ${currentPath}`, err);
    }
  };

  yield* traverse(dirHandle);
};
