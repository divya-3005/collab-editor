/**
 * Tiptap extension integrating ProseMirror's collab plugin.
 * Tracks local steps and forwards them to the socket server.
 */

import { Extension } from '@tiptap/core'
import { collab, sendableSteps, getVersion } from 'prosemirror-collab'

export const Collaboration = Extension.create({
  name: 'collaboration',

  addOptions() {
    return {
      version:          0,
      onSendSteps:      null, // (steps, clientID, version) => void
      isApplyingRemote: null, // MutableRefObject<boolean>
      clientID:         null, // stable string identifying this client
    }
  },

  addProseMirrorPlugins() {
    return [
      collab({ version: this.options.version })
    ]
  },

  // After every transaction, check if there are new sendable steps.
  // If we're currently applying remote steps, skip — those steps should not be
  // echoed back to the server.
  onTransaction({ transaction }) {
    const { onSendSteps, isApplyingRemote, clientID } = this.options

    if (!onSendSteps) return
    if (isApplyingRemote?.current) return
    if (!transaction.docChanged) return

    const state    = this.editor.state
    const sendable = sendableSteps(state)
    if (!sendable) return

    onSendSteps(
      sendable.steps.map(s => s.toJSON()),
      clientID || sendable.clientID,
      sendable.version
    )
  }
})

/**
 * Re-export helpers so callers don't need to import @tiptap/pm/collab directly.
 */
export { sendableSteps, getVersion }
