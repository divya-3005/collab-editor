/**
 * LiveCursors — Tiptap extension for rendering remote users' cursor positions.
 *
 * Technique: ProseMirror Decorations
 *   ProseMirror has a Decoration API that lets plugins paint arbitrary DOM nodes
 *   at specific positions in the document without modifying the document itself.
 *   We use `Decoration.widget` to insert a coloured cursor caret and name label
 *   at each remote user's last-known selection position.
 *
 * Data flow:
 *   1. Server relays "cursor-move" events with { socketId, position, name, color }
 *   2. Document.jsx updates a `remoteUsers` Map and syncs it into this extension's
 *      storage via `editor.storage.liveCursors.cursors = remoteUsers`
 *   3. Document.jsx then dispatches a transaction with this plugin's key as metadata.
 *   4. The plugin's `apply` handler receives the metadata, rebuilds the DecorationSet,
 *      and ProseMirror re-renders the cursor widgets in the correct positions.
 *
 * CSS classes used: .collaboration-cursor__caret, .collaboration-cursor__label
 * (defined in index.css)
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// A stable plugin key used to attach/read metadata on transactions
export const cursorPluginKey = new PluginKey('liveCursors');

export const LiveCursors = Extension.create({
  name: 'liveCursors',

  // `storage` is Tiptap's per-extension state. Document.jsx writes to this
  // so the plugin can access the latest cursor map during re-renders.
  addStorage() {
    return {
      cursors: new Map(), // Map<socketId, { position, name, color, showLabel }>
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: cursorPluginKey,

        state: {
          // Start with no decorations
          init: () => DecorationSet.empty,

          apply: (tr, oldSet) => {
            // Step 1: Map existing decorations through any document changes
            // (e.g. if a character was inserted before a cursor, shift it right).
            let set = oldSet.map(tr.mapping, tr.doc);

            // Step 2: Check if this transaction carries new cursor data
            const action = tr.getMeta(cursorPluginKey);
            if (action && action.cursors) {
              const decorations = [];

              action.cursors.forEach((user, socketId) => {
                // Skip users whose position isn't known yet
                if (user.position === null || user.position === undefined) return;

                // Clamp position to valid document bounds to avoid ProseMirror errors
                const pos = Math.max(0, Math.min(user.position, tr.doc.content.size));

                // ── Cursor caret (the vertical bar) ──────────────────────────
                const cursorWidget = document.createElement('span');
                cursorWidget.classList.add('collaboration-cursor__caret');
                cursorWidget.style.borderLeftColor = user.color;

                // ── Name label (shown for 3s after movement, then fades out) ─
                const label = document.createElement('div');
                label.classList.add('collaboration-cursor__label');
                label.style.backgroundColor = user.color;
                label.textContent = user.name;

                if (!user.showLabel) {
                  label.classList.add('collaboration-cursor__label--hidden');
                }

                cursorWidget.appendChild(label);

                decorations.push(
                  Decoration.widget(pos, cursorWidget, {
                    key: socketId,       // Stable key prevents unnecessary re-mounts
                    side: 1,             // Draw the widget after the character at `pos`
                    marks: []            // Don't inherit bold/italic from surrounding text
                  })
                );
              });

              // Rebuild the full decoration set for this render pass
              set = DecorationSet.create(tr.doc, decorations);
            }

            return set;
          },
        },

        // Tell ProseMirror to read decorations from this plugin's state
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
