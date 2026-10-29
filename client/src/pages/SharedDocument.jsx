import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { LiveCursors, cursorPluginKey } from '../extensions/LiveCursors.js'
import { Collaboration } from '../extensions/Collaboration.js'
import { Step } from '@tiptap/pm/transform'
import { sendableSteps, receiveTransaction, getVersion } from 'prosemirror-collab'
import socket, { setSocketToken } from '../socket/socket.js'
import { useTheme } from '../context/ThemeContext'
import {
  Moon, Sun, Bold, Italic, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus,
  Download, FileText, Check, Lock, Edit3
} from 'lucide-react'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function ToolbarBtn({ onClick, active, title, disabled, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1 flex-shrink-0" />
}

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
  const [showExportMenu, setShowExportMenu] = useState(false)

  const isApplyingRemote = useRef(false)
  const cursorThrottleRef = useRef(null)

  // ── Local Guest Identity ──────────────────────────────────────────────────
  const [localUser, setLocalUser] = useState(null)
  useEffect(() => {
    const colors = ['#2563eb', '#059669', '#ea580c', '#4f46e5', '#0284c7', '#c026d3', '#e11d48']
    const color  = colors[Math.floor(Math.random() * colors.length)]
    setLocalUser({ name: 'Guest Collaborator', color })
  }, [])

  // ── Tiptap Editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false
      }),
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
      attributes: {
        class: 'focus:outline-none min-h-[500px]',
        'data-placeholder': 'Shared document content…'
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (!localUser || !docId) return
      if (cursorThrottleRef.current) return
      cursorThrottleRef.current = setTimeout(() => { cursorThrottleRef.current = null }, 50)
      socket.emit('cursor-move', {
        documentId: docId,
        position: ed.state.selection.anchor,
        name: localUser.name,
        color: localUser.color
      })
    }
  })

  // ── Fetch Shared Document ────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const fetchSharedDoc = async () => {
      try {
        const res = await axios.get(`${API}/documents/shared/${shareToken}`)
        setTitle(res.data.title)
        setPermission(res.data.permission)
        setDocId(res.data.id)
        editor.commands.setContent(res.data.content || '', false)
        if (res.data.permission === 'edit') {
          editor.setEditable(true)
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Invalid or expired share link')
      } finally {
        setLoading(false)
      }
    }
    fetchSharedDoc()
  }, [shareToken, editor])

  // ── Socket Connection with Share Token ────────────────────────────────────
  const editorRef = useRef(editor)
  useEffect(() => { editorRef.current = editor }, [editor])

  useEffect(() => {
    if (!docId || !localUser || !shareToken) return

    const applyRemote = (steps, clientIDs) => {
      const ed = editorRef.current
      if (!ed || !Array.isArray(steps) || steps.length === 0) return
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

    // Authenticate socket with share token
    setSocketToken(shareToken)
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
  }, [docId, localUser, shareToken])

  // Document word/character statistics
  const stats = useMemo(() => {
    if (!editor) return { words: 0, characters: 0, readingTime: 1 }
    const text = editor.getText() || ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const characters = text.length
    const readingTime = Math.max(1, Math.ceil(words / 200))
    return { words, characters, readingTime }
  }, [editor?.state.doc]) // eslint-disable-line react-hooks/exhaustive-deps

  // Export handlers
  const handleExport = (format) => {
    setShowExportMenu(false)
    const docTitle = (title || 'Shared Document').replace(/[^a-zA-Z0-9_-]/g, '_')

    if (format === 'print') {
      window.print()
      return
    }

    let mimeType = 'text/plain'
    let fileExt = 'txt'
    let data = ''

    if (format === 'txt') {
      data = editor.getText()
      mimeType = 'text/plain'
      fileExt = 'txt'
    } else if (format === 'md') {
      data = `# ${title || 'Shared Document'}\n\n${editor.getText()}`
      mimeType = 'text/markdown'
      fileExt = 'md'
    }

    const blob = new Blob([data], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docTitle}.${fileExt}`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported as .${fileExt}`)
  }

  // ── Loading / Error States ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-zinc-500">Loading shared document…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b] p-6">
        <div className="text-center max-w-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 bg-zinc-50/50 dark:bg-[#18181b]/50 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
            !
          </div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">Link unavailable</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Go to sign in →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors flex flex-col">
      {/* ── TOP NAV ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="h-12 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {title || 'Untitled Document'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Viewers count */}
            {connectedUsers > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{connectedUsers} {connectedUsers === 1 ? 'collaborator' : 'collaborators'}</span>
              </div>
            )}

            {/* Permission badge */}
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1 ${
                permission === 'edit'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {permission === 'edit' ? (
                <>
                  <Edit3 size={11} />
                  <span>Can edit</span>
                </>
              ) : (
                <>
                  <Lock size={11} />
                  <span>View only</span>
                </>
              )}
            </span>

            {/* Export Menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Export"
              >
                <Download size={15} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-[#18181b] rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl py-1 z-50 text-xs animate-slide-up origin-top-right">
                  <button
                    onClick={() => handleExport('md')}
                    className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between"
                  >
                    <span>Markdown</span>
                    <span className="text-[10px] text-zinc-400 font-mono">.md</span>
                  </button>
                  <button
                    onClick={() => handleExport('txt')}
                    className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between"
                  >
                    <span>Plain Text</span>
                    <span className="text-[10px] text-zinc-400 font-mono">.txt</span>
                  </button>
                  <button
                    onClick={() => handleExport('print')}
                    className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <span>Print / PDF</span>
                    <span className="text-[10px] text-zinc-400">⌘P</span>
                  </button>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        {/* ── TOOLBAR (when permission is edit) ────────────────────────────── */}
        {permission === 'edit' && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 h-10 flex items-center overflow-x-auto">
            <div className="w-full max-w-[760px] mx-auto flex items-center gap-0.5">
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
                <Bold size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
                <Italic size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strike">
                <Strikethrough size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="Code">
                <Code size={14} />
              </ToolbarBtn>
              <ToolbarDivider />
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="H1">
                <Heading1 size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="H2">
                <Heading2 size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="H3">
                <Heading3 size={14} />
              </ToolbarBtn>
              <ToolbarDivider />
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
                <List size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered list">
                <ListOrdered size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">
                <Quote size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Divider">
                <Minus size={14} />
              </ToolbarBtn>
            </div>
          </div>
        )}
      </header>

      {/* ── EDITOR WORKSPACE ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-6 sm:px-8 py-10 pb-24">
          <h1 className="doc-title-input mb-6">{title || 'Untitled Document'}</h1>
          <EditorContent editor={editor} />
        </div>

        {/* Bottom stats pill */}
        <div className="fixed bottom-4 left-6 z-30 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#18181b]/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 shadow-sm">
          <span>{stats.words} words</span>
          <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span>{stats.characters} chars</span>
          <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span>{stats.readingTime} min read</span>
        </div>
      </main>
    </div>
  )
}
