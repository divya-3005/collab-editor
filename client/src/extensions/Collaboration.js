/**
 * Collaboration.js — Tiptap extension that wires the ProseMirror collab plugin
 * into the editor and emits steps to the server on every local transaction.
 *
 * Why a custom extension instead of @tiptap/extension-collaboration:
 *   @tiptap/extension-collaboration is Yjs-based and cannot be used without a
 *   Yjs provider. We use the lower-level @tiptap/pm/collab utilities directly
 *   to implement a step-based protocol that works with our Socket.io server.
 *
 * What this extension does:
 *  1. Registers the ProseMirror `collab({ version })` plugin so ProseMirror
 *     tracks the local version and accumulates sendable steps.
 *  2. On every editor transaction (via `onTransaction`), checks if there are
 *     new steps to send and emits them to the server via the callback.
 *
 * The `isApplyingRemote` ref from useCollabSocket is passed in via storage to
 * suppress step emission when the transaction originates from applying remote
 * steps (which would otherwise cause an echo loop).
 *
 * Step deserialisation for received steps is handled in useCollabSocket using
 * Step.fromJSON from @tiptap/pm/transform.
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
