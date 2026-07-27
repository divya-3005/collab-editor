/**
 * useCollabSocket.js — Manages the Socket.io connection lifecycle and implements
 * the ProseMirror step-based collaboration protocol.
 *
 * Why this replaces content-update broadcasts:
 *   The previous architecture emitted full HTML on every keystroke via
 *   socket.emit('content-update', ...). This is last-write-wins: simultaneous
 *   edits silently overwrite each other. editor.setContent() also destroys
 *   cursor positions and undo history.
 *
 * New protocol:
 *   - sendableSteps(state) → serialise pending ProseMirror steps.
 *   - receiveTransaction(state, steps, clientIDs) → apply remote steps and
 *     rebase pending local steps using ProseMirror's Mapping system.
 *   - getVersion(state) → local step count, must match the server.
 *
 *   The server acts as a pure step sequencer; conflict resolution happens on
 *   the client using ProseMirror's own OT machinery, which correctly handles
 *   all step types (AddMarkStep, ReplaceAroundStep, etc.).
 *
 * The `isApplyingRemote` ref is shared with the Collaboration extension to
 * prevent remote steps from being echoed back to the server.
 */

import { useEffect, useRef } from 'react'
import { Step }               from '@tiptap/pm/transform'
import { sendableSteps, receiveTransaction, getVersion } from 'prosemirror-collab'
import socket from '../socket/socket.js'

/**
 * @param {string}      id             — Document ID from URL params
 * @param {object|null} editor         — Tiptap editor instance (null while initialising)
 * @param {object|null} localUser      — { name, color } — null until auth resolves
 * @param {Function}    setIsConnected — callback to update connection indicator
 */
export function useCollabSocket(id, editor, localUser, setIsConnected) {
  // Keep a ref to the latest editor without putting it in the effect dep array.
  // Listing `editor` as a dependency would reconnect the socket on every Tiptap
  // re-initialisation (which happens during React 18 StrictMode double-mount).
  const editorRef = useRef(editor)
  useEffect(() => { editorRef.current = editor }, [editor])

  // ── Send pending steps to the server ──────────────────────────────────────
  const sendPendingSteps = () => {
    const ed = editorRef.current
    if (!ed) return
    const sendable = sendableSteps(ed.state)
    if (!sendable) return

    socket.emit('collab-steps', {
      documentId: id,
      version:    sendable.version,
      steps:      sendable.steps.map(s => s.toJSON()),
      clientID:   sendable.clientID
    })
  }

  // ── Apply a batch of serialised steps from the server ─────────────────────
  const applyRemoteSteps = (steps, clientIDs, isApplyingRemoteRef) => {
    const ed = editorRef.current
    if (!ed || !Array.isArray(steps) || steps.length === 0) return

    let parsedSteps
    try {
      parsedSteps = steps.map(s => Step.fromJSON(ed.state.schema, s))
    } catch (err) {
      console.warn('[collab] Could not parse remote steps, skipping batch:', err.message)
      return
    }

    if (isApplyingRemoteRef) isApplyingRemoteRef.current = true
    try {
      const remoteTr = receiveTransaction(
        ed.state,
        parsedSteps,
        clientIDs
      )
      ed.view.dispatch(remoteTr)
    } catch (err) {
      console.warn('[collab] Failed to apply remote steps:', err.message)
    } finally {
      if (isApplyingRemoteRef) isApplyingRemoteRef.current = false
    }
  }

  // ── Socket lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!localUser) return

    socket.connect()
    socket.emit('join-document', { documentId: id, user: localUser })
    socket.emit('get-presence', id)

    // isApplyingRemote is owned by Document.jsx and passed to the Collaboration
    // extension. We read it from the editor's extension storage so we can set it
    // here when applying remote steps, preventing the onTransaction callback
    // from re-emitting those steps.
    const getApplyingRef = () =>
      editorRef.current?.extensionManager.extensions
        .find(e => e.name === 'collaboration')
        ?.options?.isApplyingRemote ?? null

    // ── Server sends current version when client joins ─────────────────────
    const onCollabInit = ({ version: serverVersion }) => {
      const ed = editorRef.current
      if (!ed) return
      const localVersion = getVersion(ed.state)
      if (localVersion < serverVersion) {
        socket.emit('collab-catch-up', { documentId: id, version: localVersion })
      }
    }

    // ── Remote steps broadcast from a peer ────────────────────────────────
    const onCollabSteps = ({ steps, clientIDs }) => {
      applyRemoteSteps(steps, clientIDs, getApplyingRef())
      // After applying remote steps, flush any steps we buffered while waiting
      sendPendingSteps()
    }

    // ── Catch-up batch after reconnect / version mismatch ─────────────────
    const onCollabSync = ({ steps, clientIDs, needsFullSync }) => {
      if (needsFullSync) {
        // Steps buffer pruned — reload content from REST API
        // (Document.jsx's useDocumentData will handle this on reconnect)
        window.location.reload()
        return
      }
      applyRemoteSteps(steps, clientIDs, getApplyingRef())
      sendPendingSteps()
    }

    // ── Server confirmed our steps ────────────────────────────────────────
    const onCollabAck = () => sendPendingSteps()

    // ── A peer restored a previous version ────────────────────────────────
    // Full content replacement — reload so the collab version state resets cleanly.
    // This is the safest approach because setContent() without resetting the collab
    // plugin's version counter causes step version mismatches for all subsequent edits.
    const onCollabReset = () => {
      window.location.reload()
    }

    // ── Connection status ─────────────────────────────────────────────────
    const onConnect    = () => setIsConnected(true)
    const onDisconnect = () => {
      setIsConnected(false)
      // Automatically attempt catch-up when reconnected
    }
    const onReconnect = () => {
      const ed = editorRef.current
      if (!ed) return
      const localVersion = getVersion(ed.state)
      socket.emit('collab-catch-up', { documentId: id, version: localVersion })
    }

    if (socket.connected) setIsConnected(true)

    socket.on('collab-init',   onCollabInit)
    socket.on('collab-steps',  onCollabSteps)
    socket.on('collab-sync',   onCollabSync)
    socket.on('collab-ack',    onCollabAck)
    socket.on('collab-reset',  onCollabReset)
    socket.on('connect',       onConnect)
    socket.on('disconnect',    onDisconnect)
    socket.on('reconnect',     onReconnect)

    return () => {
      socket.off('collab-init',   onCollabInit)
      socket.off('collab-steps',  onCollabSteps)
      socket.off('collab-sync',   onCollabSync)
      socket.off('collab-ack',    onCollabAck)
      socket.off('collab-reset',  onCollabReset)
      socket.off('connect',       onConnect)
      socket.off('disconnect',    onDisconnect)
      socket.off('reconnect',     onReconnect)
      socket.disconnect()
    }
  }, [id, localUser]) // `editor` is intentionally NOT listed — we use editorRef
}
