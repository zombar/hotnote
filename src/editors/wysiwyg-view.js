import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { gfm } from '@milkdown/preset-gfm';
import { TextSelection } from '@milkdown/prose/state';

/**
 * WYSIWYG Editor View using Milkdown (ProseMirror wrapper)
 * Provides a consistent interface for the editor manager
 */
export class WYSIWYGView {
  constructor(container, markdown = '', onChange = null) {
    this.container = container;
    this.editor = null;
    this.currentMarkdown = markdown;
    this.onChangeCallback = onChange;
    this.initPromise = this.init(markdown);
  }

  async init(initialContent) {
    try {
      this.editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, this.container);
          ctx.set(defaultValueCtx, initialContent);

          // Set up change listener
          ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
            this.currentMarkdown = markdown;
            if (this.onChangeCallback) {
              this.onChangeCallback(markdown);
            }
          });
        })
        .use(nord)
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(history)
        .create();

      return this.editor;
    } catch (error) {
      console.error('[WYSIWYGView] Failed to initialize Milkdown:', error);
      throw error;
    }
  }

  /**
   * Wait for editor to be fully initialized
   */
  async ready() {
    await this.initPromise;
  }

  /**
   * Get current markdown content
   */
  getContent() {
    return this.currentMarkdown;
  }

  /**
   * Get cursor position as {line, column}
   */
  getCursor() {
    if (!this.editor) {
      return { line: 0, column: 0 };
    }

    try {
      let line = 0;
      let column = 0;
      this.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { from } = state.selection;

        // Get the text from start of document to cursor
        // Use '\n' as block separator to match how markdown works
        const textBefore = state.doc.textBetween(0, from, '\n');
        const lines = textBefore.split('\n');
        line = lines.length - 1;
        column = lines[lines.length - 1].length;
      });
      return { line, column };
    } catch (error) {
      console.error('[WYSIWYGView] Error getting cursor:', error);
      return { line: 0, column: 0 };
    }
  }

  /**
   * Set cursor position by line and column
   */
  setCursor(targetLine, targetColumn) {
    if (!this.editor) {
      return;
    }

    try {
      this.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state, dispatch } = view;
        const { doc } = state;

        // Get text content and find the position (use '\n' as separator like in getCursor)
        const fullText = state.doc.textBetween(0, state.doc.content.size, '\n');
        const lines = fullText.split('\n');

        // Calculate text offset
        let textOffset = 0;
        for (let i = 0; i < targetLine && i < lines.length; i++) {
          textOffset += lines[i].length + 1; // +1 for newline
        }
        textOffset += Math.min(targetColumn, lines[targetLine]?.length || 0);

        // Find ProseMirror position by walking the document
        let currentTextOffset = 0;
        let targetPos = 1;
        let found = false;

        doc.descendants((node, pos) => {
          if (found) return false;

          if (node.isText) {
            const endOffset = currentTextOffset + node.text.length;
            if (endOffset >= textOffset) {
              targetPos = pos + (textOffset - currentTextOffset);
              found = true;
              return false;
            }
            currentTextOffset = endOffset;
          } else if (node.type.name === 'hardBreak') {
            currentTextOffset += 1;
            if (currentTextOffset >= textOffset) {
              targetPos = pos + 1;
              found = true;
              return false;
            }
          } else if (node.isBlock) {
            // Count block boundaries as newlines (except at document start)
            if (pos > 0 && currentTextOffset > 0) {
              currentTextOffset += 1;
              if (currentTextOffset >= textOffset) {
                targetPos = pos;
                found = true;
                return false;
              }
            }
          }
        });

        // Ensure position is valid
        const safePos = Math.max(1, Math.min(targetPos, doc.content.size));
        const selection = TextSelection.create(doc, safePos);
        dispatch(state.tr.setSelection(selection).scrollIntoView());
      });
    } catch (error) {
      console.error('[WYSIWYGView] Error setting cursor:', error);
    }
  }

  /**
   * Get scroll position
   */
  getScrollPosition() {
    const scroller = this.container.querySelector('.milkdown');
    return scroller ? scroller.scrollTop : 0;
  }

  /**
   * Set scroll position
   */
  setScrollPosition(scrollTop) {
    const scroller = this.container.querySelector('.milkdown');
    if (scroller) {
      scroller.scrollTop = scrollTop;
    }
  }

  /**
   * Focus the editor
   */
  focus() {
    if (!this.editor) return;

    try {
      const editorElement = this.container.querySelector('.milkdown .ProseMirror');
      if (editorElement) {
        editorElement.focus();
      }
    } catch (error) {
      console.error('[WYSIWYGView] Error focusing editor:', error);
    }
  }

  /**
   * Destroy the editor and clean up
   */
  destroy() {
    if (this.editor) {
      try {
        this.editor.destroy();
      } catch (error) {
        console.error('[WYSIWYGView] Error destroying editor:', error);
      }
      this.editor = null;
      this.onChangeCallback = null;
      this.currentMarkdown = '';
    }
  }

  /**
   * Check if editor is initialized
   */
  isActive() {
    return this.editor !== null;
  }
}
