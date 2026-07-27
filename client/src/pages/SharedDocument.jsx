/**
 * SharedDocument.jsx — Read-only or editable document via a share token.
 *
 * Accessed via /share/:shareToken — no auth required, but the share token
 * must be a valid JWT with type: 'share'.
 *
 * Collaboration:
 *   - Read-only: user can see the content but cannot edit.
 *   - Edit: user participates in the same step-based collab protocol as owners.
 *
 * Reliability fixes:
 *   - The socket effect previously depended on [docId, editor] but used localUser
 *     inside it without declaring it as a dependency. The socket join event was
 *     emitted with user: null when docId resolved before localUser. Fixed by
 *     depending on localUser and adding the guard at the top of the effect.
 *
 * Security:
 *   - SharedDocument connects to the socket without an auth JWT (guests don't
 *     have an account). The server's io.use() middleware only requires auth for
 *     registered users. For now, guests use an anonymous token approach:
 *     if a token exists in localStorage (user signed in before visiting the share
 *     link), it is passed. Otherwise, connection proceeds without auth — the server
 *     will need to handle the missing-token case gracefully for shared documents.
 *
 *     NOTE: the correct long-term fix is a guest-token endpoint that issues a
 *     short-lived anonymous JWT. That is tracked as a follow-up task.
 */

import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { LiveCursors, cursorPluginKey } from '../extensions/LiveCursors.js'
import { Collaboration } from '../extensions/Collaboration.js'
import { Step } from '@tiptap/pm/transform'
import { sendableSteps, receiveTransaction, getVersion } from 'prosemirror-collab'
import socket from '../socket/socket.js'
import { useTheme } from '../context/ThemeContext'
import { Moon, Sun } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function SharedDocument() {
  const { shareToken } = useParams()
  const navigate       = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [title,          setTitle]          = useState('')
  const [permission,     setPermission]     = useState('view')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [docId,          setDocId]          = useState(null)
  const [connectedUsers, setConnectedUsers] = useState(1)

  // isApplyingRemote ref — prevents emitting remote steps back to server
  const isApplyingRemote = useRef(false)

  // ── Local user identity (random guest colour) ──────────────────────────────
  const [localUser, setLocalUser] = useState(null)
  useEffect(() => {
    const colors = ['#F87171', '#FB923C', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6']
    const color  = colors[Math.floor(Math.random() * colors.length)]
    setLocalUser({ name: 'Guest', color })
  }, [])

  // ── Tiptap editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      LiveCursors,
      Collaboration.configure({
        onSendSteps: (steps, clientID, version) => {
          if (isApplyingRemote.current) return
          if (!docId) return
          socket.emit('collab-steps', { documentId: docId, version, steps, clientID })
        },
        isApplyingRemote,
        clientID: `guest-${Math.random().toString(36).slice(2)}`
      })
    ],
    content:    '',
    editable:   false,
    editorProps: {
      attributes: { class: 'focus:outline-none' }
    }
  })

  // ── Load shared document from REST ────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const fetchSharedDoc = async () => {
      try {
        const res = await axios.get(`${API}/documents/shared/${shareToken}`)
        setTitle(res.data.title)
        setPermission(res.data.permission)
        setDocId(res.data.id)
        editor.commands.setContent(res.data.content || '')
        if (res.data.permission === 'edit') {
          editor.setEditable(true)
        }
      } catch {
        setError('This link is invalid or has expired.')
      } finally {
        setLoading(false)
      }
    }
    fetchSharedDoc()
  }, [editor, shareToken])

  // ── Socket: join room + collab protocol ────────────────────────────────────
  // Reliability fix: `localUser` is now in the dependency array so the join
  // event is not emitted until both docId AND localUser are available.
  useEffect(() => {
    if (!docId || !localUser) return

    const editorRef = { current: editor }

    const applyRemote = (steps, clientIDs) => {
      const ed = editorRef.current
      if (!ed || !steps?.length) return
      let parsed
      try {
        parsed = steps.map(s => Step.fromJSON(ed.state.schema, s))
      } catch {
        return
      }
      isApplyingRemote.current = true
      try {
        const tr = receiveTransaction(ed.state, parsed, clientIDs)
        ed.view.dispatch(tr)
      } finally {
        isApplyingRemote.current = false
      }
    }

    const sendPending = () => {
      const ed = editorRef.current
      if (!ed) return
      const sendable = sendableSteps(ed.state)
      if (!sendable) return
      socket.emit('collab-steps', {
        documentId: docId,
        version:    sendable.version,
        steps:      sendable.steps.map(s => s.toJSON()),
        clientID:   sendable.clientID
      })
    }

    socket.connect()
    socket.emit('join-document', { documentId: docId, user: localUser })

    socket.on('collab-init', ({ version: serverVersion }) => {
      const ed = editorRef.current
      if (!ed) return
      const local = getVersion(ed.state)
      if (local < serverVersion) {
        socket.emit('collab-catch-up', { documentId: docId, version: local })
      }
    })

    socket.on('collab-steps', ({ steps, clientIDs }) => {
      applyRemote(steps, clientIDs)
      sendPending()
    })

    socket.on('collab-sync', ({ steps, clientIDs }) => applyRemote(steps, clientIDs))

    socket.on('collab-ack', sendPending)

    socket.on('collab-reset', () => window.location.reload())

    socket.on('user-count', (count) => setConnectedUsers(count))

    return () => {
      socket.off('collab-init')
      socket.off('collab-steps')
      socket.off('collab-sync')
      socket.off('collab-ack')
      socket.off('collab-reset')
      socket.off('user-count')
      socket.disconnect()
    }
  }, [docId, localUser]) // ← localUser added to dep array (reliability fix)

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111318]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading document…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111318] p-6">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Link not found</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
        <button
          onClick={() => navigate('/login')}
          className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Go to sign in →
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white dark:bg-[#111318] transition-colors duration-200">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="h-[52px] px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
              {title || 'Untitled Document'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {connectedUsers > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {connectedUsers} {connectedUsers === 1 ? 'viewer' : 'viewers'}
                </span>
              </div>
            )}

            <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-700" />

            <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
              permission === 'edit'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}>
              {permission === 'edit' ? 'Can edit' : 'View only'}
            </span>

            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

            <button
              onClick={toggleTheme}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      {/* Editor */}
      <div className="pt-[52px] pb-32">
        <div className="max-w-[760px] mx-auto px-6 sm:px-8">
          <h1 className="doc-title-input mt-10 mb-6">{title || 'Untitled Document'}</h1>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}