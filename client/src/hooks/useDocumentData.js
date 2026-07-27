/**
 * useDocumentData.js — Fetches a document from the REST API and manages
 * its title state.
 *
 * Responsibilities:
 *  - One-time fetch of title + content when the editor is ready.
 *  - Exposes `setTitle` so the title toolbar input can update it.
 *  - Exposes `loading` and `error` so the parent can render appropriate states.
 *
 * Does NOT own: socket connections, autosave, version history, presence.
 */

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * @param {string}   id      — Document ID from URL params
 * @param {object}   headers — Auth headers from useAuthHeaders
 * @param {object}   editor  — Tiptap editor instance (null while initialising)
 */
export function useDocumentData(id, headers, editor) {
  const navigate = useNavigate()
  const [title,   setTitle]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!editor) return

    let cancelled = false

    const fetchDoc = async () => {
      try {
        const res = await axios.get(`${API}/documents/${id}`, { headers })
        if (cancelled) return
        setTitle(res.data.title)
        if (res.data.content) {
          editor.commands.setContent(res.data.content, false)
        }
      } catch (err) {
        if (cancelled) return
        setError(err)
        toast.error('Failed to load document')
        navigate('/dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDoc()
    return () => { cancelled = true }
  }, [editor, id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { title, setTitle, loading, error }
}
