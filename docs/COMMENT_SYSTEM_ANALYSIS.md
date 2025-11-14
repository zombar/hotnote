# Comment System Architecture Analysis

## Overview
The HotNote comment system stores text selections using **content-based anchoring** (not character offsets) to survive edits. Comments are displayed with decorations in the editor and managed through a toolbar + panel UI.

---

## 1. Comment Data Structure

### Where Comments Are Stored
**File**: `/Users/jamartin/work/claude/hotnote/src/state/app-state.js` (lines 55-308)

```javascript
// In AppState class:
this.comments = [];                    // All comments for current directory
this.activeCommentId = null;          // Currently selected/open comment
this.commentPanelVisible = false;     // Whether the comment panel is open
```

### Comment Object Schema
**File**: `/Users/jamartin/work/claude/hotnote/app.js` (lines 1525-1545)

```javascript
const comment = {
  id: crypto.randomUUID(),                    // Unique identifier
  fileRelativePath: getRelativeFilePath(),    // e.g., "folder/file.md"
  userId: getUserId(),                        // User who created it
  anchor: {                                   // CONTENT-BASED ANCHOR
    prefix: "text before",                    // Up to 32 chars before selection
    exact: "selected text",                   // The exact selected text
    suffix: "text after"                      // Up to 32 chars after selection
  },
  fallbackPosition: {                         // Legacy fallback (rarely used)
    from: { line: 0, col: 0 },
    to: { line: 0, col: 100 }
  },
  timestamp: Date.now(),                      // Creation time
  resolved: false,                            // Resolution status
  thread: [                                   // Comment thread (replies)
    {
      userId: "user-id",
      userName: "Display Name",
      text: "Comment text",
      timestamp: Date.now()
    }
  ]
};
```

### How Selection is Stored
**File**: `/Users/jamartin/work/claude/hotnote/src/utils/text-anchor.js`

The selection is NOT stored as character offsets. Instead, it uses **context-based anchoring**:

```javascript
// createAnchor(doc, from, to) - lines 27-44
export function createAnchor(doc, from, to) {
  const exact = doc.substring(from, to);        // The selected text itself
  const prefixStart = Math.max(0, from - 32);
  const prefix = doc.substring(prefixStart, from);  // 32 chars before
  const suffixEnd = Math.min(doc.length, to + 32);
  const suffix = doc.substring(to, suffixEnd);      // 32 chars after
  
  return { prefix, exact, suffix };
}
```

**Why this design?** 
- Comments survive text edits because we match content, not character positions
- If "const x = 5" is deleted, the comment can still find its text even if line numbers change
- Context (prefix/suffix) helps disambiguate when the exact text appears multiple times

---

## 2. Comment Decorations/Highlights in Editor

### Where Decorations Are Applied

#### For Markdown (WYSIWYG/Source Mode)
**File**: `/Users/jamartin/work/claude/hotnote/src/editors/source-view.js` (lines 76-118)

```javascript
// StateField manages comment decorations
const commentDecorationField = StateField.define({
  create() {
    return { 
      decorations: Decoration.none, 
      activeCommentId: null, 
      onCommentClick: null 
    };
  },
  update(state, tr) {
    // Handle effects for add/remove/clear/setActive
    let { decorations, activeCommentId, onCommentClick } = state;
    decorations = decorations.map(tr.changes);
    
    for (const effect of tr.effects) {
      if (effect.is(addCommentDecoration)) {
        const { commentId, from, to, isActive } = effect.value;
        const className = isActive ? 'comment-highlight active' : 'comment-highlight';
        const deco = Decoration.mark({
          class: className,
          attributes: { 'data-comment-id': commentId },
        }).range(from, to);
        decorations = decorations.update({ add: [deco] });
      }
      // ... removeCommentDecoration, clearCommentDecorations, setActiveComment
    }
    return { decorations, activeCommentId, onCommentClick };
  },
  provide: (f) => EditorView.decorations.from(f, (state) => state.decorations),
});
```

**Methods** (lines 369-446):
- `addCommentDecoration(commentId, from, to, isActive)` - Adds a single comment highlight
- `removeCommentDecoration(commentId)` - Removes a comment's highlight
- `clearCommentDecorations()` - Clears all comment highlights
- `applyCommentDecorations(comments, activeCommentId, onCommentClick)` - Batch apply

#### Clicking Comments
**File**: `/Users/jamartin/work/claude/hotnote/src/editors/source-view.js` (lines 120-137)

```javascript
function commentClickHandler(_view) {
  return EditorView.domEventHandlers({
    click: (event, view) => {
      const target = event.target;
      if (target.classList.contains('comment-highlight')) {
        const commentId = target.getAttribute('data-comment-id');
        const field = view.state.field(commentDecorationField);
        if (commentId && field.onCommentClick) {
          field.onCommentClick(commentId);
          event.preventDefault();
          return true;
        }
      }
      return false;
    },
  });
}
```

### Where Decorations Are Refreshed
**File**: `/Users/jamartin/work/claude/hotnote/app.js` (lines 1492-1522)

```javascript
function refreshCommentDecorations() {
  const editor = appState.editorManager?.currentEditor || appState.editorView;
  if (!editor) return;

  const currentFile = appState.currentFilename;
  const fileComments = appState.getCommentsForFile(currentFile);

  // KEY STEP: Convert anchors to positions
  const doc = editor.getDocumentText ? editor.getDocumentText() : editor.state.doc.toString();
  const commentsWithPositions = fileComments
    .map((comment) => {
      const pos = findAnchorPosition(doc, comment.anchor);  // <-- ANCHOR LOOKUP
      if (pos) {
        return {
          id: comment.id,
          position: pos,  // { from: number, to: number }
          resolved: comment.resolved,
        };
      }
      return null;
    })
    .filter(Boolean);

  // Apply decorations
  const activeCommentId = appState.getActiveCommentId();
  if (editor.applyCommentDecorations) {
    editor.applyCommentDecorations(commentsWithPositions, activeCommentId, handleCommentClick);
  }

  console.log(`[Comments] Applied ${commentsWithPositions.length} decorations for ${currentFile}`);
}
```

---

## 3. Anchor Position Lookup (CRITICAL FOR DELETES)

**File**: `/Users/jamartin/work/claude/hotnote/src/utils/text-anchor.js` (lines 53-140)

### Algorithm
```javascript
export function findAnchorPosition(doc, anchor) {
  const { prefix, exact, suffix } = anchor;

  // Step 1: If exact text is missing, return null
  if (!doc || doc.length === 0) return null;

  // Step 2: Find ALL occurrences of exact text
  const escapedExact = escapeRegex(exact);
  const exactRegex = new RegExp(escapedExact, 'g');
  const matches = [];
  let match;

  while ((match = exactRegex.exec(doc)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + exact.length,
    });
  }

  // Step 3: No matches found
  if (matches.length === 0) {
    return null;  // <-- COMMENT BECOMES "ORPHANED"
  }

  // Step 4: Single match - return it
  if (matches.length === 1) {
    return matches[0];
  }

  // Step 5: Multiple matches - score based on context
  // Score suffix match (100 pts for exact, 1pt per char for partial)
  // Score prefix match (50 pts for exact, 0.5pt per char for partial)
  // Return highest-scoring match
  
  const bestMatch = scoredMatches[0];
  return {
    from: bestMatch.from,
    to: bestMatch.to,
  };
}
```

### What Happens When Text is Deleted?
1. **Exact text is deleted entirely**: `findAnchorPosition()` returns `null`
2. **Comment is orphaned**: Decoration doesn't render (filtered out by `.filter(Boolean)`)
3. **User doesn't know**: No visual indicator that comment lost its anchor
4. **NO automatic cleanup**: Comment remains in session file orphaned

---

## 4. Comment Storage & Persistence

### Session File Format
**File**: `/Users/jamartin/work/claude/hotnote/src/storage/session-manager.js` (lines 69-79, 177-214)

```javascript
// File: .session_properties.HN (JSON)
{
  "version": "1.0",
  "folderName": "my-workspace",
  "lastModified": 1699999999999,
  "session": {
    "lastOpenFile": {
      "path": "documents/notes.md",
      "cursorLine": 5,
      "cursorColumn": 12,
      "scrollTop": 250,
      "scrollLeft": 0,
      "editorMode": "wysiwyg"
    }
  },
  "comments": [
    {
      "id": "uuid-here",
      "fileRelativePath": "documents/notes.md",
      "userId": "user-id",
      "anchor": {
        "prefix": "was discussing ",
        "exact": "important issue",
        "suffix": " yesterday"
      },
      "fallbackPosition": { "from": {...}, "to": {...} },
      "timestamp": 1699999999999,
      "resolved": false,
      "thread": [
        { "userId": "...", "userName": "...", "text": "...", "timestamp": ... }
      ]
    }
  ]
}
```

### Comment Lifecycle
**File**: `/Users/jamartin/work/claude/hotnote/app.js`

```javascript
// CREATE (lines 1525-1572)
async function handleAddComment(selection) {
  const doc = editor.getDocumentText();
  const anchor = createAnchor(doc, selection.from, selection.to);
  const comment = { id, fileRelativePath, userId, anchor, timestamp, resolved: false, thread: [] };
  
  appState.addComment(comment);
  // Comment is NOT saved until first reply is added
}

// SAVE (lines 1600-1644)
async function handleReply(commentId, text) {
  const comment = appState.getComments().find(...);
  comment.thread.push(reply);
  
  const sessionData = await loadSessionFile(appState.rootDirHandle);
  if (isFirstMessage) {
    addCommentToSession(sessionData, comment);  // Add entire comment
  } else {
    updateCommentInSession(sessionData, commentId, { thread: comment.thread });  // Update thread
  }
  await saveSessionFile(appState.rootDirHandle, sessionData);
}

// UPDATE RESOLUTION (lines 1646-1671)
async function handleResolve(commentId) {
  const comment = appState.getComments().find(...);
  comment.resolved = true;
  const sessionData = await loadSessionFile(appState.rootDirHandle);
  updateCommentInSession(sessionData, commentId, { resolved: true });
  await saveSessionFile(appState.rootDirHandle, sessionData);
}

// DELETE (lines 1673-1692)
async function handleDelete(commentId) {
  appState.deleteComment(commentId);
  const sessionData = await loadSessionFile(appState.rootDirHandle);
  deleteCommentFromSession(sessionData, commentId);
  await saveSessionFile(appState.rootDirHandle, sessionData);
}
```

---

## 5. Comment Position Validation (MISSING!)

### Current State
- **No validation**: Comments are never checked to see if their anchor still matches
- **No cleanup**: Orphaned comments (where exact text is deleted) are never removed
- **No warnings**: User has no way to know a comment lost its anchor

### When Should Validation Happen?
1. **On file load**: Check all comments when document loads
2. **After significant edits**: Re-validate when user makes large changes
3. **On decoration refresh**: Warn if an anchor can't be found
4. **Before save**: Clean up orphaned comments

### What's Missing?
There is **NO existing logic** for:
- Validating anchor positions
- Detecting when text is deleted
- Cleaning up orphaned comments
- Snapping to nearest word boundaries
- Auto-deleting comments when text is fully removed

---

## 6. Comment UI Components

### Comment Toolbar
**File**: `/Users/jamartin/work/claude/hotnote/src/ui/comment-toolbar.js`

```javascript
export class CommentToolbar {
  constructor(container, onAddComment)
  show(x, y, selection)              // Show at coordinates with selection {from, to, text}
  hide()
  isVisible()
  handleAddComment()
  destroy()
}
```

**Lifecycle**:
1. User selects text → `handleSelectionChange()` fires
2. If selection.text.trim().length > 0 → `commentToolbar.show(x, y, selection)`
3. User clicks "Comment" button → `onAddComment(selection)` → `handleAddComment(selection)`
4. Creates comment and shows panel

### Comment Panel
**File**: `/Users/jamartin/work/claude/hotnote/src/ui/comment-panel.js`

```javascript
export class CommentPanel {
  constructor(container, onReply, onResolve, onDelete)
  show(comment, x, y)                // Show panel with comment thread
  hide(skipFocusRestore, force)
  renderThread()                     // Display all messages in thread
  handleReply()                      // Add reply to thread
  handleResolve()                    // Mark as resolved
  handleDelete()                     // Delete entire comment
  update(comment)                    // Update display with new data
}
```

**Thread Format**:
```javascript
comment.thread = [
  {
    userId: "user-id",
    userName: "User Name",
    text: "First message",
    timestamp: 1234567890
  },
  {
    userId: "different-user",
    userName: "Another User",
    text: "Reply message",
    timestamp: 1234567999
  }
]
```

---

## 7. Selection Handler

**File**: `/Users/jamartin/work/claude/hotnote/app.js` (lines 1413-1473)

```javascript
function setupSelectionListener() {
  let selectionTimeout = null;

  const handleSelectionChange = () => {
    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(() => {
      const editor = appState.editorManager || appState.editorView;
      if (!editor) return;
      if (!commentToolbar) return;
      if (!editor.getSelection) return;

      const selection = editor.getSelection();  // Returns { from, to, text }
      
      if (selection && selection.text && selection.text.trim().length > 0) {
        const windowSelection = window.getSelection();
        if (windowSelection && windowSelection.rangeCount > 0) {
          const rect = windowSelection.getRangeAt(0).getBoundingClientRect();
          commentToolbar.show(rect.left, rect.bottom + 5, selection);
        }
      } else {
        commentToolbar.hide();
      }
    }, 100);  // 100ms debounce
  };

  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);
}
```

---

## 8. Where to Add "Snap to Word or Delete" Logic

### Option A: In `findAnchorPosition()` (text-anchor.js)

**Pros**:
- Centralized anchor resolution
- One place to handle all position finding
- Can add snapping logic before returning position

**Cons**:
- Changes signature of return value
- Might need to return `{ position, status: 'exact'|'snapped'|'deleted' }`

```javascript
export function findAnchorPosition(doc, anchor, onFail = null) {
  const { prefix, exact, suffix } = anchor;
  
  if (!doc || doc.length === 0) {
    if (onFail) onFail('empty-document');
    return null;
  }
  
  // Step 1: Try to find exact text
  const matches = findAllMatches(exact);
  
  if (matches.length === 1) {
    return { from: matches[0].from, to: matches[0].to, status: 'exact' };
  }
  
  if (matches.length > 1) {
    const best = scoreMatches(matches, prefix, suffix);
    return { from: best.from, to: best.to, status: 'exact' };
  }
  
  // Step 2: Text is deleted - try snapping to nearest word boundary
  const snappedPos = snapToNearestWord(doc, prefix, suffix);
  if (snappedPos) {
    if (onFail) onFail('snapped');
    return { from: snappedPos.from, to: snappedPos.to, status: 'snapped' };
  }
  
  // Step 3: Can't find anything
  if (onFail) onFail('not-found');
  return null;
}
```

### Option B: In `refreshCommentDecorations()` (app.js)

**Pros**:
- Can mark comments for deletion at refresh time
- Can warn user before deleting

**Cons**:
- Harder to coordinate across multiple files
- Mixes concern of rendering with data cleanup

```javascript
function refreshCommentDecorations() {
  const editor = appState.editorManager?.currentEditor || appState.editorView;
  if (!editor) return;

  const currentFile = appState.currentFilename;
  const fileComments = appState.getCommentsForFile(currentFile);
  const doc = editor.getDocumentText ? editor.getDocumentText() : editor.state.doc.toString();

  const commentsWithPositions = [];
  const orphanedComments = [];

  for (const comment of fileComments) {
    const pos = findAnchorPosition(doc, comment.anchor);
    
    if (pos) {
      commentsWithPositions.push({
        id: comment.id,
        position: pos,
        resolved: comment.resolved,
      });
    } else {
      // Text was deleted - mark for cleanup
      orphanedComments.push({
        id: comment.id,
        anchor: comment.anchor,
        timestamp: comment.timestamp,
      });
    }
  }

  // Apply decorations for valid comments
  if (editor.applyCommentDecorations) {
    editor.applyCommentDecorations(commentsWithPositions, activeCommentId, handleCommentClick);
  }

  // Handle orphaned comments
  if (orphanedComments.length > 0) {
    console.warn('[Comments] Found orphaned comments:', orphanedComments);
    // Option 1: Auto-delete
    // orphanedComments.forEach(c => appState.deleteComment(c.id));
    
    // Option 2: Mark for manual review
    // Could show a UI banner: "3 comments lost their text anchors"
  }
}
```

### Option C: Separate Validation Module (Best Approach)

```javascript
// New file: src/comments/comment-validator.js
export class CommentValidator {
  static validateAnchor(doc, anchor) {
    const pos = findAnchorPosition(doc, anchor);
    if (pos) return { status: 'valid', position: pos };
    
    const snapped = this.trySnapToWord(doc, anchor);
    if (snapped) return { status: 'snapped', position: snapped };
    
    return { status: 'orphaned', position: null };
  }

  static trySnapToWord(doc, anchor) {
    const { prefix, suffix } = anchor;
    // Find prefix in document
    const prefixPos = doc.lastIndexOf(prefix);
    if (prefixPos === -1) return null;
    
    // Start searching after prefix
    const searchStart = prefixPos + prefix.length;
    const contextEnd = Math.min(searchStart + 100, doc.length);
    const context = doc.substring(searchStart, contextEnd);
    
    // Find first word boundary
    const wordMatch = context.match(/\b\w+\b/);
    if (!wordMatch) return null;
    
    return {
      from: searchStart + wordMatch.index,
      to: searchStart + wordMatch.index + wordMatch[0].length,
      snappedTo: wordMatch[0],
    };
  }

  static cleanupOrphanedComments(appState, filePath, doc) {
    const fileComments = appState.getCommentsForFile(filePath);
    const toDelete = [];
    
    for (const comment of fileComments) {
      const validation = this.validateAnchor(doc, comment.anchor);
      if (validation.status === 'orphaned') {
        toDelete.push(comment.id);
      }
    }
    
    return toDelete;
  }
}
```

---

## 9. Key Files Summary

| File | Purpose | Key Functions |
|------|---------|---|
| `/src/state/app-state.js` | State management | `comments[]`, `addComment()`, `updateComment()`, `deleteComment()` |
| `/src/ui/comment-toolbar.js` | UI for creating comments | `show()`, `hide()`, `handleAddComment()` |
| `/src/ui/comment-panel.js` | UI for viewing/replying to comments | `show()`, `renderThread()`, `handleReply()`, `handleResolve()`, `handleDelete()` |
| `/src/editors/source-view.js` | Comment decorations for markdown | `addCommentDecoration()`, `applyCommentDecorations()`, `commentDecorationField` |
| `/src/utils/text-anchor.js` | Anchor creation & position finding | `createAnchor()`, `findAnchorPosition()` |
| `/src/storage/session-manager.js` | Persistence | `addCommentToSession()`, `updateCommentInSession()`, `deleteCommentFromSession()` |
| `/app.js` | Main app integration | `initCommentSystem()`, `handleAddComment()`, `handleReply()`, `handleResolve()`, `handleDelete()`, `refreshCommentDecorations()` |

---

## 10. Recommended Implementation Plan

### Phase 1: Detection (Non-Breaking)
1. Add `validateAnchor(doc, anchor)` to `text-anchor.js`
2. Modify `refreshCommentDecorations()` to detect orphaned comments
3. Log warnings to console (no UI changes yet)

### Phase 2: Snapping (Optional)
1. Implement `snapToNearestWord(prefix, suffix, doc)`
2. Return snapped position with status indicator
3. Update decorations to show "snapped" comments differently (maybe lighter color)

### Phase 3: Cleanup (Breaking Change)
1. Add method to auto-delete orphaned comments on file save
2. Show confirmation dialog before deletion
3. Update persistence logic to not save orphaned comments

### Phase 4: UI (Polish)
1. Show toast/banner when comments are orphaned
2. Add UI to manually resolve orphaned comments
3. Add stats: "3 comments snapped to new positions"

---

## 11. Data Flow Diagram

```
User selects text
    ↓
handleSelectionChange() fires [DEBOUNCED 100ms]
    ↓
editor.getSelection() → {from, to, text}
    ↓
commentToolbar.show(x, y, selection)
    ↓
User clicks "Comment" button
    ↓
handleAddComment(selection)
    ↓
createAnchor(doc, from, to) → {prefix, exact, suffix}
    ↓
comment = {id, anchor, fileRelativePath, userId, timestamp, resolved: false, thread: []}
    ↓
appState.addComment(comment)
    ↓
commentPanel.show(comment, x, y)
    ↓
User types reply + clicks "Reply"
    ↓
handleReply(commentId, text)
    ↓
comment.thread.push({userId, userName, text, timestamp})
    ↓
addCommentToSession() | updateCommentInSession()
    ↓
saveSessionFile(sessionData)
    ↓
Stored in .session_properties.HN


On File Load:
    ↓
loadSessionFile()
    ↓
appState.setComments(sessionData.comments)
    ↓
refreshCommentDecorations()
    ↓
FOR EACH comment:
  findAnchorPosition(doc, comment.anchor)
  IF found:
    Create decoration at position
  ELSE:
    Comment is orphaned (NO CLEANUP CURRENTLY)
    ↓
renderDecorations()
```

