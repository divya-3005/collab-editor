/**
 * useVersionHistory.js — Version history management (snapshots + restore).
 *
 * Responsibilities:
 *  - Fetch version list from the API when the history panel is opened.
 *  - Save snapshots, ensuring the DB is up-to-date first.
 *  - Preview a version in read-only mode.
 *  - Exit preview and reload the live document.
 *  - Restore a version (atomic on the server via $transaction).
 *
 * Reliability fix: saveSnapshot now passes `throwOnSaveFailure: true` so that
 * if the preceding saveDocument fails (e.g. network error), the snapshot is
 * not created from stale database content. The error is surfaced to the user.
 *
 * Does NOT own: editor state, socket connections, autosave interval.
 */

import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import socket from '../socket/socket.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * @param {string}   id           — Document ID
 * @param {object}   headers      — Auth headers from useAuthHeaders
 * @param {object}   editor       — Tiptap editor instance
 * @param {Function} saveDocument — From useAutoSave; throws on failure
 * @param {Function} setTitle     — From useDocumentData
 */
export function useVersionHistory(id, headers, editor, saveDocument, setTitle) {
  const [showHistoryPanel,   setShowHistoryPanel]   = useState(false)
  const [versions,           setVersions]           = useState([])
  const [previewingVersion,  setPreviewingVersion]  = useState(null)
  const [loadingVersions,    setLoadingVersions]    = useState(false)

  const fetchVersions = useCallback(async () => {
    setLoadingVersions(true)
    try {
      const res = await axios.get(`${API}/documents/${id}/versions`, { headers })
      setVersions(res.data)
    } catch {
      toast.error('Failed to load version history')
    } finally {
      setLoadingVersions(false)
    }
  }, [id, headers])

  useEffect(() => {
    if (showHistoryPanel) fetchVersions()
  }, [showHistoryPanel, fetchVersions])

  /**
   * Save the current editor state as a named snapshot.
   * Aborts (with user-visible error) if the preceding save fails —
   * preventing a stale database snapshot from being created.
   */
  const saveSnapshot = async () => {
    try {
      // Ensure the latest content is in the DB before the snapshot reads it.
      // saveDocument throws on network/server failure — we let that propagate.
      await saveDocument({ silent: false })
      await axios.post(`${API}/documents/${id}/snapshot`, {}, { headers })
      toast.success('Version saved!')
      fetchVersions()
    } catch {
      toast.error('Failed to save version — document could not be synced first')
    }
  }

  /** Load a version's content into the editor in read-only preview mode */
  const previewVersion = async (version) => {
    try {
      const res = await axios.get(
        `${API}/documents/${id}/versions/${version.id}`,
        { headers }
      )
      editor.commands.setContent(res.data.content, false)
      setTitle(res.data.title)
      editor.setEditable(false)
      setPreviewingVersion(res.data)
    } catch {
      toast.error('Failed to load version preview')
    }
  }

  /** Exit preview mode and reload the live document content */
  const exitPreview = async () => {
    try {
      const res = await axios.get(`${API}/documents/${id}`, { headers })
      editor.commands.setContent(res.data.content, false)
      setTitle(res.data.title)
      editor.setEditable(true)
      setPreviewingVersion(null)
    } catch {
      toast.error('Failed to exit preview')
    }
  }

  /** Restore the document to the currently previewed version */
  const restoreVersion = async () => {
    if (!previewingVersion) return
    try {
      const res = await axios.post(
        `${API}/documents/${id}/versions/${previewingVersion.id}/restore`,
        {},
        { headers }
      )
      editor.commands.setContent(res.data.content, false)
      setTitle(res.data.title)
      editor.setEditable(true)
      setPreviewingVersion(null)

      // Broadcast the restored content to all connected peers via socket
      socket.emit('collab-restore', {
        documentId: id,
        content:    res.data.content
      })

      toast.success('Version restored!')
      fetchVersions()
    } catch {
      toast.error('Failed to restore version')
    }
  }

  return {
    showHistoryPanel, setShowHistoryPanel,
    versions,
    previewingVersion,
    loadingVersions,
    saveSnapshot,
    previewVersion,
    exitPreview,
    restoreVersion,
    fetchVersions
  }
}
