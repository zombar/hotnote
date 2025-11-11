# URL Parameter Management Feature Guide

## Overview

Hotnote uses URL parameters to enable deep linking to workspaces and files. This allows users to bookmark specific files, share links, and have their workspace state persist across page reloads.

## URL Parameter Schema

### Parameters

- **`workdir`** (string): Full path to the workspace directory
  - Example: `?workdir=/Users/jane/projects/my-app`
  - Required for any URL param functionality

- **`file`** (string): Relative path to a file within the workspace
  - Example: `?file=src/components/Button.tsx`
  - Must be used with `workdir` parameter
  - Invalid if used alone (will be cleared)

### Valid URL Patterns

```
# No workspace open
https://hotnote.io

# Workspace prompt (before folder is opened)
https://hotnote.io?workdir=/Users/jane/projects/my-app

# Workspace open, no specific file
https://hotnote.io?workdir=/Users/jane/projects/my-app

# Workspace + specific file open
https://hotnote.io?workdir=/Users/jane/projects/my-app&file=README.md
https://hotnote.io?workdir=/Users/jane/projects/my-app&file=src/index.js
```

### Invalid URL Patterns (Auto-cleared)

```
# File without workdir - INVALID
https://hotnote.io?file=README.md
→ Cleared to: https://hotnote.io

# Malformed parameters - INVALID
https://hotnote.io?workdir=
→ Cleared to: https://hotnote.io
```

### URL Encoding

**Forward slashes are NOT encoded** for better readability:

```
# Good (forward slashes preserved)
?workdir=/Users/jane/projects/my-app&file=src/components/Button.tsx

# Not used (forward slashes would be harder to read)
?workdir=%2FUsers%2Fjane%2Fprojects%2Fmy-app&file=src%2Fcomponents%2FButton.tsx
```

Other special characters (spaces, etc.) are properly URL-encoded:
```
?workdir=/Users/jane/my project&file=src/my component.tsx
```

## URL State Transitions

### State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  (1) No Params                                               │
│  URL: hotnote.io                                             │
│  UI:  Welcome prompt or Resume prompt                        │
│                                                               │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    │ User clicks "Open Folder" OR
                    │ Page loads with ?workdir param
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  (2) Workdir Prompt                                          │
│  URL: hotnote.io?workdir=/path/to/folder                     │
│  UI:  "Open workspace: /path/to/folder" prompt               │
│                                                               │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    │ User selects folder in native picker
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  (3) Workspace Open, No File                                 │
│  URL: hotnote.io?workdir=/path/to/folder                     │
│  UI:  File picker showing directory contents                 │
│                                                               │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    │ User opens a file
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  (4) File Open                                               │
│  URL: hotnote.io?workdir=/path/to/folder&file=test.md       │
│  UI:  Editor showing file content                            │
│                                                               │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    │ User closes file (clicks breadcrumb)
                    ↓
                (Back to State 3)
                    │
                    │ User closes workspace
                    ↓
                (Back to State 1)
```

## Behavior Specifications

### 1. Page Load Behavior

When the page loads, URL parameters are validated:

```javascript
// Valid: workdir only
?workdir=/path/to/folder
→ Show workspace prompt, keep URL

// Valid: workdir + file
?workdir=/path/to/folder&file=test.md
→ Show workspace prompt, after folder opened, open file

// Invalid: file without workdir
?file=test.md
→ Clear URL params, show welcome/resume prompt

// Invalid: empty params
?workdir=
→ Clear URL params, show welcome/resume prompt

// No params
(none)
→ Check localStorage for lastFolderName
```

### 2. URL Update Triggers

URLs are updated (via `history.replaceState`) on these events:

| Event | Old URL | New URL |
|-------|---------|---------|
| Open workspace | `hotnote.io` | `hotnote.io?workdir=/path` |
| Open file | `hotnote.io?workdir=/path` | `hotnote.io?workdir=/path&file=doc.md` |
| Close file | `hotnote.io?workdir=/path&file=doc.md` | `hotnote.io?workdir=/path` |
| Close workspace | `hotnote.io?workdir=/path` | `hotnote.io` |

### 3. Validation Rules

**Rule 1: file requires workdir**
- If `file` parameter exists without `workdir`, clear both parameters
- Never allow `?file=X` alone

**Rule 2: Empty values are invalid**
- `?workdir=` (empty value) → clear params
- `?file=` (empty value) → treat as no file param

**Rule 3: URL params override session**
- If valid URL params exist, ignore session restoration
- URL-specified files take precedence over session lastOpenFile

### 4. Browser Navigation

**Back/Forward buttons:**
- URL params are preserved in browser history
- Navigating back/forward restores workspace and file state
- Uses existing navigation history manager

**Page reload:**
- URL params persist across reload
- Workspace prompt shown if folder not yet selected
- After folder selection, file is opened if `file` param exists

## Security Considerations

### File System Access API Constraints

1. **User gesture required**: Cannot programmatically open folders
   - Solution: Show prompt, user clicks to trigger picker

2. **Permission scoping**: Can only access user-selected directories
   - Solution: Validate selected folder matches workdir hint

3. **No path validation**: Cannot verify paths exist without permission
   - Solution: Show path as hint, user must select correct folder

### XSS Prevention

- URL params are never directly inserted into DOM
- All params are sanitized and validated
- Paths are used for API calls, not rendered HTML

## Edge Cases

### Case 1: Workdir path doesn't exist
```
URL: ?workdir=/nonexistent/path
Behavior: Show prompt, user selects any folder, workdir param updated to actual path
```

### Case 2: File path doesn't exist in workspace
```
URL: ?workdir=/path&file=missing.txt
Behavior: Open workspace, attempt to open file, show error if not found, stay in workspace
```

### Case 3: User selects different folder than workdir
```
URL: ?workdir=/original/path
User selects: /different/path
Behavior: Update URL to ?workdir=/different/path (actual selection wins)
```

### Case 4: Page loaded with invalid combo
```
URL: ?file=test.md (no workdir)
Behavior: Clear URL to no params, show welcome prompt
```

### Case 5: Navigation history with old localdir param
```
URL: ?localdir=./folder/file.txt (old format)
Behavior: Ignore old param, treat as no params
```

## API Reference

### URLParamManager Class

```javascript
class URLParamManager {
  /**
   * Validate current URL params
   * Returns null for both if file exists without workdir
   * @returns {{ workdir: string|null, file: string|null }}
   */
  static validate()

  /**
   * Update URL params using history.replaceState
   * @param {string|null} workdir - Workspace directory path
   * @param {string|null} file - File path relative to workdir
   */
  static update(workdir, file)

  /**
   * Clear all URL parameters
   */
  static clear()

  /**
   * Get workdir parameter value
   * @returns {string|null}
   */
  static getWorkdir()

  /**
   * Get file parameter value
   * @returns {string|null}
   */
  static getFile()

  /**
   * Check if current URL state is invalid (file without workdir)
   * @returns {boolean}
   */
  static isInvalidState()
}
```

## Testing Strategy

### Unit Tests (tests/navigation/url-param-manager.test.js)

- ✅ Validate with no params
- ✅ Validate with workdir only
- ✅ Validate with workdir + file
- ✅ Validate with file only (invalid) → returns null for both
- ✅ Update with workdir only
- ✅ Update with workdir + file
- ✅ Update with neither (clear)
- ✅ Get workdir from URL
- ✅ Get file from URL
- ✅ Detect invalid state (file without workdir)
- ✅ Clear all params

### E2E Tests (tests/e2e/url-params.spec.js)

- ✅ Load page with ?workdir → prompt shown → folder opened → URL preserved
- ✅ Load page with ?workdir&file → workspace opened → file opened
- ✅ Load page with ?file only → params cleared → welcome shown
- ✅ Open file → URL updated with file param
- ✅ Close file → file param removed, workdir kept
- ✅ Close workspace → all params cleared
- ✅ Browser back button → previous file restored
- ✅ Page reload with params → state restored

## Migration from localdir

The old `localdir` parameter format is deprecated:

```
Old: ?localdir=./folder/subfolder/file.txt
New: ?workdir=/full/path/folder&file=subfolder/file.txt
```

Migration is passive - old URLs are ignored, new URLs are used exclusively.

## Implementation Checklist

- [ ] Create URLParamManager class
- [ ] Write unit tests
- [ ] Write e2e tests
- [ ] Create showWorkdirPrompt() UI
- [ ] Integrate with app.js initialization
- [ ] Update history-manager.js
- [ ] Update session-manager.js
- [ ] Remove old localdir functions
- [ ] Test browser navigation
- [ ] Test all edge cases
- [ ] Update user documentation

## Future Enhancements

- **Query params**: Support searching within workspace `?workdir=/path&query=foo`
- **Line numbers**: Deep link to specific lines `?file=test.js&line=42`
- **Multiple files**: Support split views `?file1=a.js&file2=b.js`
- **Workspace aliases**: Short names `?ws=myapp` instead of full paths
