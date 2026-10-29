/**
 * useAutoSave.js — Manages periodic document persistence.
 *
 * Responsibilities:
 *  - Auto-saves title + content every 3 seconds via PATCH /api/documents/:id.
 *  - Tracks `isDirty` (unsaved local changes exist) — used by beforeunload.
 *  - Tracks `saveError` — surfaces failed saves to the user.
 *  - Exposes `saveDocument` so the parent can trigger a manual save before
 *    actions that depend on the database reflecting the current editor state
 *    (e.g. saveSnapshot). saveDocument throws on failure so callers can abort.
 *  - Registers the ⌘S / Ctrl+S keyboard shortcut.
 *  - Registers the `beforeunload` warning — but only when isDirty is true.
 *
 * Does NOT own: socket connections, version history, presence.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * @param {object}   editor  — Tiptap editor instance
 * @param {string}   id      — Document ID
 * @param {string}   title   — Current document title (controlled by parent)
 * @param {object}   headers — Auth headers from useAuthHeaders
 */
export function useAutoSave(editor, id, title, headers) {
  const [saving,    setSaving]    = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [saveError, setSaveError] = useState(null)

  // Track whether there are unsaved local changes.
  // A ref (not state) so toggling it does not trigger re-renders.
  const isDirty = useRef(false)

  // Mark as dirty on every editor update. The Collaboration extension calls
  // onUpdate after applying remote steps too — but the autosave is debounced
  // so this causes at most one extra save cycle, which is acceptable.
  useEffect(() => {
    if (!editor) return
    const handler = () => { isDirty.current = true }
    editor.on('update', handler)
    return () => editor.off('update', handler)
  }, [editor])

  /**
   * Persist the current editor content to the database.
   * Throws on network/server error so callers (e.g. saveSnapshot) can abort.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.silent=false] — suppress the error toast (for saveSnapshot)
   */
  const saveDocument = useCallback(async ({ silent = false } = {}) => {
    if (!editor || !title) return
    setSaving(true)
    setSaveError(null)
    try {
      await axios.patch(
        `${API}/documents/${id}`,
        { content: editor.getHTML(), title },
        { headers }
      )
      setLastSaved(new Date())
      isDirty.current = false
    } catch (err) {
      const msg = 'Auto-save failed. Your changes may not be saved.'
      setSaveError(msg)
      if (!silent) toast.error(msg)
      // Re-throw so callers (saveSnapshot) know the save failed and can abort
      throw err
    } finally {
      setSaving(false)
    }
  }, [editor, id, title, headers])

  // Periodic autosave every 3 seconds
  useEffect(() => {
    if (!editor) return
    const interval = setInterval(() => {
      // Only save if there are actual unsaved changes
      if (isDirty.current) saveDocument().catch(() => {/* already surfaced via setSaveError */})
    }, 3000)
    return () => clearInterval(interval)
  }, [editor, saveDocument])

  // ⌘S / Ctrl+S manual save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveDocument().catch(() => {})
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [saveDocument])

  // Warn before closing the tab — but only if there are genuinely unsaved changes.
  // Previously fired on any non-empty document, which was a false positive.
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty.current) {
        e.preventDefault()
        // Chrome requires returnValue to be set
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return { saving, lastSaved, saveError, saveDocument, isDirty }
}
