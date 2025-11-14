# Comment System Quick Reference

## Core Concepts

**Comments use CONTENT-BASED ANCHORING, not character offsets:**
- Comments are stored with `prefix`, `exact`, `suffix` text context
- When displayed, `findAnchorPosition()` searches for the exact text in the document
- If text is deleted, the comment becomes orphaned with no visual indicator

## Key Data Structures

### Comment Object
```javascript
{
  id: "uuid",
  fileRelativePath: "path/to/file.md",
  userId: "user-id",
  anchor: { prefix, exact, suffix },
  timestamp: Date.now(),
  resolved: false,
  thread: [{ userId, userName, text, timestamp }, ...]
}
```

### Selection Object
```javascript
{ 
  from: 123,        // Character offset where selection starts
  to: 456,          // Character offset where selection ends
  text: "selected text"
}
```

## File Locations

| Task | File | Lines |
|------|------|-------|
| State management | `src/state/app-state.js` | 55-308 |
| Comment creation | `app.js` | 1525-1572 |
| Anchor creation | `src/utils/text-anchor.js` | 27-44 |
| Anchor lookup | `src/utils/text-anchor.js` | 53-140 |
| Decorations (CodeMirror) | `src/editors/source-view.js` | 76-446 |
| Refresh decorations | `app.js` | 1492-1522 |
| Comment replies | `app.js` | 1600-1644 |
| Comment resolve | `app.js` | 1646-1671 |
| Comment delete | `app.js` | 1673-1692 |
| Toolbar UI | `src/ui/comment-toolbar.js` | - |
| Panel UI | `src/ui/comment-panel.js` | - |

## Flow: Creating a Comment

```
User selects text
  ↓
editor.getSelection() → {from, to, text}
  ↓
handleAddComment(selection)
  ↓
createAnchor(doc, from, to) → {prefix, exact, suffix}
  ↓
appState.addComment(comment)
  ↓
commentPanel.show(comment, x, y)
  ↓
User replies + first reply saves comment to session file
```

## Flow: Displaying Comments

```
refreshCommentDecorations()
  ↓
FOR EACH comment:
  findAnchorPosition(doc, comment.anchor) → {from, to} or null
  ↓
  IF found:
    applyCommentDecorations(position)
  ELSE:
    Comment is ORPHANED (silently filtered out)
```

## Critical Problem: Orphaned Comments

When the exact selected text is deleted:
1. `findAnchorPosition()` returns `null`
2. Comment is filtered out: `.filter(Boolean)`
3. **No decoration is rendered** - user has no idea the comment is gone
4. **Comment remains in session file** - not cleaned up
5. **No way to recover** - if text is re-added, comment won't reappear

## Where to Add Validation Logic

### Option 1: In `findAnchorPosition()` (text-anchor.js)
- Pros: Centralized, handles all position lookups
- Cons: Changes return signature

### Option 2: In `refreshCommentDecorations()` (app.js)
- Pros: Can warn user or auto-cleanup
- Cons: Mixes rendering with data logic

### Option 3: New `CommentValidator` class (RECOMMENDED)
- Pros: Separation of concerns, testable, reusable
- Cons: New file to maintain

## Implementation Checklist

- [ ] Add `validateAnchor(doc, anchor)` method
- [ ] Detect orphaned comments (anchor.exact not found)
- [ ] Add `snapToNearestWord(prefix, suffix, doc)` method
- [ ] Return status: 'exact' | 'snapped' | 'orphaned'
- [ ] Update `refreshCommentDecorations()` to handle non-exact positions
- [ ] Show visual indicator for snapped comments (lighter color?)
- [ ] Add cleanup method to auto-delete orphaned comments
- [ ] Test with deleted text, moved text, similar text patterns

## Testing Scenarios

1. **Delete exact text** → Comment should snap or orphan
2. **Modify text slightly** → Comment should still find it (context matching)
3. **Duplicate text** → Comment should pick best match (context scoring)
4. **Delete and re-add** → What happens to the orphaned comment?
5. **Mode switch** (WYSIWYG ↔ Source) → Comments should persist
6. **Multiple files** → Each file has separate comments

## Anchor Context Scoring

When multiple matches for exact text exist:
- Suffix match score: 100 for exact, 1pt per character for partial
- Prefix match score: 50 for exact, 0.5pt per character for partial
- Selects highest-scoring match

Example:
```javascript
doc = "foo bar baz | foo bar qux"
anchor = { prefix: "| ", exact: "foo bar", suffix: " qux" }

Matches:
- Position 0: score = 1 (partial prefix only)
- Position 12: score = 150 (exact prefix + suffix)

Result: Uses position 12
```

## Performance Notes

- `findAnchorPosition()` uses RegExp.exec() with global flag
- Searches entire document for matches
- Context scoring is O(matches * context_length)
- No caching - recalculated every `refreshCommentDecorations()` call
- Consider caching if performance becomes issue

## Edge Cases

- **Empty selection**: Toolbar hidden (text.trim().length === 0)
- **Empty document**: findAnchorPosition returns null
- **Very long context**: Anchor stores up to 32 chars prefix/suffix
- **Special characters**: Escaped for regex matching
- **Multi-line selections**: Full text stored in anchor.exact
- **Case sensitivity**: Match is case-sensitive

