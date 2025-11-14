# Implementation Guide: Comment Position Validation & Cleanup

## Problem Statement

The current comment system has a critical flaw: when the exact text of a comment is deleted, the comment becomes "orphaned" but:
- No visual indicator is shown
- The comment remains in the session file
- No automatic cleanup occurs
- User has no way to know the comment is lost

## Solution Overview

This guide covers implementing:
1. **Detection**: Identify when comments lose their anchor text
2. **Snapping**: Optionally snap to nearest word boundary
3. **Cleanup**: Auto-delete orphaned comments or warn the user

## Implementation Steps

### Step 1: Add Validation to `text-anchor.js`

**File**: `/Users/jamartin/work/claude/hotnote/src/utils/text-anchor.js`

Add these functions to the existing file:

```javascript
/**
 * Try to snap to the nearest word boundary after the prefix
 * Used when the exact text is deleted but context still exists
 * 
 * @param {string} doc - The document text
 * @param {string} prefix - Text before the deleted selection
 * @param {string} suffix - Text after the deleted selection
 * @returns {{from: number, to: number}|null} Position of nearest word or null
 */
export function snapToNearestWord(doc, prefix, suffix) {
  // Find where the prefix ends in the document
  const prefixIndex = doc.lastIndexOf(prefix);
  if (prefixIndex === -1) {
    return null; // Prefix also deleted
  }

  // Start searching after the prefix
  const searchStart = prefixIndex + prefix.length;
  const contextEnd = Math.min(searchStart + 100, doc.length);
  const context = doc.substring(searchStart, contextEnd);

  // Try to find the start of the suffix first (best case)
  if (suffix && suffix.length > 5) {
    const suffixIndex = context.indexOf(suffix);
    if (suffixIndex !== -1) {
      // Found suffix, snap to word before it
      const beforeSuffix = context.substring(0, suffixIndex).trimEnd();
      const lastWordMatch = beforeSuffix.match(/\b\w+\b(?!.*\b\w+\b)/);
      if (lastWordMatch) {
        const wordStart = searchStart + beforeSuffix.lastIndexOf(lastWordMatch[0]);
        return {
          from: wordStart,
          to: wordStart + lastWordMatch[0].length,
        };
      }
    }
  }

  // Otherwise, find the first word after the prefix
  const wordMatch = context.match(/\b\w+\b/);
  if (wordMatch) {
    return {
      from: searchStart + wordMatch.index,
      to: searchStart + wordMatch.index + wordMatch[0].length,
    };
  }

  return null;
}

/**
 * Extended version of findAnchorPosition that also attempts snapping
 * 
 * @param {string} doc - The document text
 * @param {object} anchor - The anchor object {prefix, exact, suffix}
 * @param {object} options - Configuration options
 * @param {boolean} options.allowSnap - Allow snapping to nearest word (default: false)
 * @param {boolean} options.warnOnSnap - Log warning when snapping (default: true)
 * @returns {{from: number, to: number, status: 'exact'|'snapped'|'orphaned'}} Position and status
 */
export function findAnchorPositionWithStatus(doc, anchor, options = {}) {
  const { allowSnap = false, warnOnSnap = true } = options;
  const { prefix, exact, suffix } = anchor;

  if (!doc || doc.length === 0) {
    return { from: null, to: null, status: 'orphaned' };
  }

  // First, try to find the exact text
  const exactPosition = findAnchorPosition(doc, anchor);
  if (exactPosition) {
    return { ...exactPosition, status: 'exact' };
  }

  // Exact text not found - try snapping if allowed
  if (allowSnap) {
    const snappedPos = snapToNearestWord(doc, prefix, suffix);
    if (snappedPos) {
      if (warnOnSnap) {
        console.warn(
          '[Comments] Comment snapped to new position: was looking for "' +
            exact +
            '"'
        );
      }
      return { ...snappedPos, status: 'snapped' };
    }
  }

  // Could not find or snap
  return { from: null, to: null, status: 'orphaned' };
}
```

### Step 2: Create `CommentValidator` Class

**File**: `/Users/jamartin/work/claude/hotnote/src/comments/comment-validator.js` (NEW FILE)

```javascript
import { findAnchorPositionWithStatus, snapToNearestWord } from '../utils/text-anchor.js';

/**
 * Comment Validator
 * Handles validation, snapping, and cleanup of comment anchors
 */
export class CommentValidator {
  /**
   * Validate a single comment's anchor
   * 
   * @param {string} doc - Document text
   * @param {object} comment - Comment object
   * @param {object} options - Validation options
   * @param {boolean} options.allowSnap - Allow snapping to word boundaries
   * @returns {object} Validation result {comment, status, position}
   */
  static validateComment(doc, comment, options = {}) {
    const result = findAnchorPositionWithStatus(doc, comment.anchor, {
      allowSnap: options.allowSnap || false,
      warnOnSnap: options.warnOnSnap !== false,
    });

    return {
      id: comment.id,
      originalAnchor: comment.anchor,
      status: result.status, // 'exact' | 'snapped' | 'orphaned'
      position: result.from !== null ? { from: result.from, to: result.to } : null,
      isValid: result.status !== 'orphaned',
    };
  }

  /**
   * Validate all comments for a file
   * 
   * @param {string} doc - Document text
   * @param {Array} comments - Array of comment objects
   * @param {object} options - Validation options
   * @returns {object} Validation results {valid, orphaned, snapped}
   */
  static validateComments(doc, comments, options = {}) {
    const valid = [];
    const orphaned = [];
    const snapped = [];

    for (const comment of comments) {
      const validation = this.validateComment(doc, comment, options);

      if (validation.status === 'exact') {
        valid.push(validation);
      } else if (validation.status === 'snapped') {
        snapped.push(validation);
      } else {
        orphaned.push(validation);
      }
    }

    return {
      valid,
      snapped,
      orphaned,
      total: comments.length,
      validCount: valid.length,
      snappedCount: snapped.length,
      orphanedCount: orphaned.length,
    };
  }

  /**
   * Get comments to delete (orphaned comments)
   * 
   * @param {string} doc - Document text
   * @param {Array} comments - Array of comment objects
   * @returns {Array} IDs of orphaned comments
   */
  static getOrphanedCommentIds(doc, comments) {
    const results = this.validateComments(doc, comments, { allowSnap: false });
    return results.orphaned.map((v) => v.id);
  }

  /**
   * Generate a report of comment validation
   * 
   * @param {string} filePath - File path for display
   * @param {string} doc - Document text
   * @param {Array} comments - Array of comment objects
   * @returns {string} Formatted report
   */
  static generateReport(filePath, doc, comments) {
    const results = this.validateComments(doc, comments);

    let report = `Comment Validation Report for: ${filePath}\n`;
    report += `Total: ${results.total}, Valid: ${results.validCount}, Snapped: ${results.snappedCount}, Orphaned: ${results.orphanedCount}\n`;

    if (results.snapped.length > 0) {
      report += `\nSnapped Comments (${results.snappedCount}):\n`;
      results.snapped.forEach((v) => {
        report += `  - ${v.id}: "${v.originalAnchor.exact}" → position ${v.position.from}-${v.position.to}\n`;
      });
    }

    if (results.orphaned.length > 0) {
      report += `\nOrphaned Comments (${results.orphanedCount}):\n`;
      results.orphaned.forEach((v) => {
        report += `  - ${v.id}: "${v.originalAnchor.exact}"\n`;
      });
    }

    return report;
  }
}
```

### Step 3: Modify `refreshCommentDecorations()` in app.js

**File**: `/Users/jamartin/work/claude/hotnote/app.js` (lines 1492-1522)

Replace the function with:

```javascript
// Import at top of file
import { CommentValidator } from './src/comments/comment-validator.js';
import { findAnchorPositionWithStatus } from './src/utils/text-anchor.js';

// Refresh comment decorations in editor
function refreshCommentDecorations(options = {}) {
  const editor = appState.editorManager?.currentEditor || appState.editorView;
  if (!editor) return;

  const currentFile = appState.currentFilename;
  const fileComments = appState.getCommentsForFile(currentFile);
  const doc = editor.getDocumentText ? editor.getDocumentText() : editor.state.doc.toString();

  // Validate all comments
  const allowSnap = options.allowSnap !== false; // Default: allow snapping
  const validation = CommentValidator.validateComments(fileComments, { allowSnap });

  // Build list of valid and snapped comments with their positions
  const commentsWithPositions = [];

  for (const validComment of validation.valid) {
    commentsWithPositions.push({
      id: validComment.id,
      position: validComment.position,
      resolved: fileComments.find((c) => c.id === validComment.id)?.resolved || false,
      status: 'exact',
    });
  }

  for (const snappedComment of validation.snapped) {
    commentsWithPositions.push({
      id: snappedComment.id,
      position: snappedComment.position,
      resolved: fileComments.find((c) => c.id === snappedComment.id)?.resolved || false,
      status: 'snapped',
    });
  }

  // Apply decorations
  const activeCommentId = appState.getActiveCommentId();
  if (editor.applyCommentDecorations) {
    editor.applyCommentDecorations(commentsWithPositions, activeCommentId, handleCommentClick);
  }

  // Handle orphaned comments
  if (validation.orphanedCount > 0) {
    if (options.autoCleanup) {
      // Auto-delete orphaned comments
      validation.orphaned.forEach((v) => {
        appState.deleteComment(v.id);
        console.log(`[Comments] Deleted orphaned comment: ${v.id}`);
      });

      // Save to session
      saveOrphanedCommentsCleanup(validation.orphaned);
    } else if (options.warnOnOrphan !== false) {
      // Log warning
      console.warn(
        `[Comments] Found ${validation.orphanedCount} orphaned comments in ${currentFile}:`,
        validation.orphaned.map((v) => v.originalAnchor.exact)
      );
    }
  }

  console.log(
    `[Comments] Applied ${commentsWithPositions.length} decorations for ${currentFile} ` +
      `(${validation.validCount} exact, ${validation.snappedCount} snapped, ${validation.orphanedCount} orphaned)`
  );
}

// Helper to save cleanup to session
async function saveOrphanedCommentsCleanup(orphanedComments) {
  if (!appState.rootDirHandle || orphanedComments.length === 0) return;

  try {
    const sessionData = await loadSessionFile(appState.rootDirHandle);
    if (sessionData && sessionData.comments) {
      sessionData.comments = sessionData.comments.filter(
        (c) => !orphanedComments.find((o) => o.id === c.id)
      );
      await saveSessionFile(appState.rootDirHandle, sessionData);
    }
  } catch (err) {
    console.error('[Comments] Error cleaning up orphaned comments:', err);
  }
}
```

### Step 4: Optional - Add Visual Indicator for Snapped Comments

In your CSS, add styling for snapped comments:

```css
.comment-highlight.snapped {
  background-color: rgba(255, 200, 0, 0.2); /* Lighter yellow/orange */
  border-bottom: 2px dashed orange;
  opacity: 0.7;
}

.comment-highlight.exact {
  background-color: rgba(100, 200, 255, 0.2); /* Bright blue */
  border-bottom: 2px solid #64c8ff;
  opacity: 1;
}

.comment-highlight.active {
  background-color: rgba(255, 100, 100, 0.3); /* Brighter red */
  border-bottom: 2px solid #ff6464;
  font-weight: 500;
}
```

Then in `source-view.js`, use the status to set class name:

```javascript
// In applyCommentDecorations, line ~429:
for (const comment of comments) {
  const isActive = comment.id === activeCommentId;
  const statusClass = comment.status === 'snapped' ? ' snapped' : ' exact';
  const className = isActive 
    ? `comment-highlight active${statusClass}` 
    : `comment-highlight${statusClass}`;
  
  effects.push(
    addCommentDecoration.of({
      commentId: comment.id,
      from: comment.position.from,
      to: comment.position.to,
      isActive,
      className, // Pass className to effect
    })
  );
}
```

## Testing Checklist

- [ ] Create test file with some text
- [ ] Add comments to multiple parts
- [ ] Delete exact text → check console for orphaned warning
- [ ] Modify text slightly → verify comment still finds it
- [ ] Test with `allowSnap: true` → verify snap to nearest word
- [ ] Test with `autoCleanup: true` → verify orphaned comments deleted
- [ ] Reload file → verify comments persist correctly
- [ ] Check session file format → ensure comments saved correctly

## Integration Points

### Where `refreshCommentDecorations()` is called:
1. `app.js` line 298 - After editor initialization
2. `app.js` line 557 - After mode toggle (WYSIWYG/Source)
3. `app.js` line 1484 - After loading comments from session
4. `app.js` line 1569 - After creating new comment
5. `app.js` line 1595 - After clicking on comment
6. `app.js` line 1640 - After replying to comment
7. `app.js` line 1668 - After resolving comment
8. `app.js` line 1689 - After deleting comment

## Configuration Options

When calling `refreshCommentDecorations()`, use:

```javascript
// Exact only, warn on orphans (default)
refreshCommentDecorations();

// Allow snapping to words
refreshCommentDecorations({ allowSnap: true });

// Auto-delete orphaned comments
refreshCommentDecorations({ autoCleanup: true, allowSnap: false });

// Silent mode
refreshCommentDecorations({ warnOnOrphan: false, allowSnap: false });
```

## Performance Considerations

- `CommentValidator.validateComments()` iterates all comments once
- `snapToNearestWord()` searches within 100 char window (reasonable)
- No caching - validation happens on each refresh
- For large documents with many comments, consider caching positions

## Future Enhancements

1. **Caching**: Store validation results, invalidate on document changes
2. **Conflict Resolution**: Handle comments pointing to similar text
3. **Merge Suggestions**: If two comments point to overlapping text
4. **Statistics**: Track how many comments snap vs orphan over time
5. **UI Notifications**: Toast showing "2 comments snapped to new positions"
6. **Recovery**: Option to restore orphaned comments if text is re-added
7. **Batch Operations**: Clean up all orphaned comments at once

