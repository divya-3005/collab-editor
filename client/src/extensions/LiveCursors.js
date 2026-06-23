import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const cursorPluginKey = new PluginKey('liveCursors')

export const LiveCursors = Extension.create({
  name: 'liveCursors',

  addStorage() {
    return {
      cursors: new Map(), // Map<socketId, { position, name, color, showLabel }>
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: cursorPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, oldSet) => {
            // Map existing decorations through document changes (typing/deletions)
            let set = oldSet.map(tr.mapping, tr.doc)

            // Look for custom metadata instructing a redraw of cursors
            const action = tr.getMeta(cursorPluginKey)
            if (action && action.cursors) {
              const decorations = []

              action.cursors.forEach((user, socketId) => {
                // Skip if position is invalid
                if (user.position === null || user.position === undefined) return
                
                // Constrain position within valid document bounds
                const pos = Math.max(0, Math.min(user.position, tr.doc.content.size))

                // Create the DOM nodes for the cursor bar
                const cursorWidget = document.createElement('span')
                cursorWidget.classList.add('collaboration-cursor__caret')
                cursorWidget.style.borderLeftColor = user.color
                
                // Create the DOM node for the name label
                const label = document.createElement('div')
                label.classList.add('collaboration-cursor__label')
                label.style.backgroundColor = user.color
                label.textContent = user.name
                
                // Hide label based on showLabel flag
                if (!user.showLabel) {
                  label.classList.add('collaboration-cursor__label--hidden')
                }
                
                cursorWidget.appendChild(label)

                decorations.push(
                  Decoration.widget(pos, cursorWidget, {
                    key: socketId,
                    side: 1, // Draw right after the content at this position
                    marks: [] // Don't inherit text styling like bold/italic
                  })
                )
              })

              set = DecorationSet.create(tr.doc, decorations)
            }
            
            return set
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})
