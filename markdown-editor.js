import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { gfm } from '@milkdown/preset-gfm';
import { TextSelection } from '@milkdown/prose/state';

let milkdownEditor = null;
let onChangeCallback = null;
let currentMarkdown = '';

// Initialize Milkdown editor
export const initMarkdownEditor = async (container, initialContent = '', onChange = null) => {
  if (milkdownEditor) {
    destroyMarkdownEditor();
  }

  onChangeCallback = onChange;
  currentMarkdown = initialContent;

  try {
    milkdownEditor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, initialContent);

        // Set up change listener
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          currentMarkdown = markdown;
          if (onChangeCallback) {
            onChangeCallback(markdown);
          }
        });
      })
      .use(nord)
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
      .create();

    return milkdownEditor;
  } catch (error) {
    console.error('Failed to initialize Milkdown:', error);
    throw error;
  }
};

// Destroy Milkdown editor
export const destroyMarkdownEditor = () => {
  if (milkdownEditor) {
    try {
      milkdownEditor.destroy();
    } catch (error) {
      console.error('Error destroying Milkdown:', error);
    }
    milkdownEditor = null;
    onChangeCallback = null;
    currentMarkdown = '';
  }
};

// Get current markdown content
export const getMarkdownContent = () => {
  return currentMarkdown;
};

// Set markdown content
export const setMarkdownContent = (content) => {
  if (!milkdownEditor) {
    return;
  }

  try {
    milkdownEditor.action((ctx) => {
      ctx.set(defaultValueCtx, content);
    });
  } catch (error) {
    console.error('Error setting markdown content:', error);
  }
};

// Check if Milkdown is initialized
export const isMarkdownEditorActive = () => {
  return milkdownEditor !== null;
};

// Focus the markdown editor
export const focusMarkdownEditor = () => {
  if (!milkdownEditor) {
    return;
  }

  try {
    // Find the ProseMirror editor element and focus it
    const editorElement = document.querySelector('.milkdown .ProseMirror');
    if (editorElement) {
      editorElement.focus();
    }
  } catch (error) {
    console.error('Error focusing markdown editor:', error);
  }
};

// Get cursor position
export const getCursorPosition = () => {
  if (!milkdownEditor) {
    console.log('[Milkdown] getCursorPosition: editor not initialized');
    return 0;
  }

  try {
    let position = 0;
    milkdownEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      position = view.state.selection.from;
    });
    console.log('[Milkdown] getCursorPosition returning:', position);
    return position;
  } catch (error) {
    console.error('[Milkdown] Error getting cursor position:', error);
    return 0;
  }
};

// Get cursor position as line and column in the markdown text
export const getCursorLineColumn = () => {
  if (!milkdownEditor) {
    return { line: 0, column: 0 };
  }

  try {
    let line = 0;
    let column = 0;
    milkdownEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state } = view;
      const { from } = state.selection;

      // Get the text from start of document to cursor
      const textBefore = state.doc.textBetween(0, from, '\n', '\n');
      const lines = textBefore.split('\n');
      line = lines.length - 1;
      column = lines[lines.length - 1].length;
    });
    console.log('[Milkdown] getCursorLineColumn returning:', { line, column });
    return { line, column };
  } catch (error) {
    console.error('[Milkdown] Error getting cursor line/column:', error);
    return { line: 0, column: 0 };
  }
};

// Set cursor position
export const setCursorPosition = (position) => {
  if (!milkdownEditor) {
    console.log('[Milkdown] setCursorPosition: editor not initialized');
    return;
  }

  console.log('[Milkdown] setCursorPosition called with position:', position);

  try {
    milkdownEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      const { doc } = state;

      // Position 0 is the document node itself - start from 1 (first content position)
      // Ensure position is within document bounds (min 1, max doc.content.size)
      const safePosition = Math.min(Math.max(1, position), doc.content.size);
      console.log(
        '[Milkdown] Setting cursor to position:',
        safePosition,
        '(requested:',
        position,
        'doc size:',
        doc.content.size,
        ')'
      );

      // Create a text selection at the position
      const selection = TextSelection.create(doc, safePosition);

      // Dispatch the transaction to update the selection
      dispatch(state.tr.setSelection(selection));
      console.log('[Milkdown] Cursor position set successfully');
    });
  } catch (error) {
    console.error('[Milkdown] Error setting cursor position:', error);
  }
};

// Set cursor by line and column (for editor mode switching)
export const setCursorByLineColumn = (targetLine, targetColumn) => {
  if (!milkdownEditor) {
    console.log('[Milkdown] setCursorByLineColumn: editor not initialized');
    return;
  }

  console.log('[Milkdown] setCursorByLineColumn:', { targetLine, targetColumn });

  try {
    milkdownEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      const { doc } = state;

      // Get text content and find the position
      const fullText = state.doc.textBetween(0, state.doc.content.size, '\n', '\n');
      const lines = fullText.split('\n');

      // Calculate text offset
      let textOffset = 0;
      for (let i = 0; i < targetLine && i < lines.length; i++) {
        textOffset += lines[i].length + 1;
      }
      textOffset += Math.min(targetColumn, lines[targetLine]?.length || 0);

      // Find ProseMirror position by walking the document
      let currentTextOffset = 0;
      let targetPos = 1;
      let found = false;

      doc.descendants((node, pos) => {
        if (found) return false;

        if (node.isText) {
          if (currentTextOffset + node.text.length >= textOffset) {
            targetPos = pos + (textOffset - currentTextOffset);
            found = true;
            return false;
          }
          currentTextOffset += node.text.length;
        } else if (node.type.name === 'hardBreak') {
          currentTextOffset += 1;
        } else if (node.isBlock && node.content.size === 0) {
          currentTextOffset += 1;
        }
      });

      const selection = TextSelection.create(doc, Math.min(targetPos, doc.content.size));
      dispatch(state.tr.setSelection(selection));
      console.log(
        '[Milkdown] Cursor set by line/column. TextOffset:',
        textOffset,
        'ProseMirror pos:',
        targetPos
      );
    });
  } catch (error) {
    console.error('[Milkdown] Error setting cursor by line/column:', error);
  }
};
