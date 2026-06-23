import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import socket from '../socket/socket.js'
import { useTheme } from '../context/ThemeContext'
import { Moon, Sun, ArrowLeft } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function SharedDocument() {
  const { shareToken } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [permission, setPermission] = useState('view')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docId, setDocId] = useState(null)
  const [connectedUsers, setConnectedUsers] = useState(1)
  const { theme, toggleTheme } = useTheme()
  const isApplyingRemote = useRef(false)
  const docIdRef = useRef(null)

  // Local user for presence
  const [localUser, setLocalUser] = useState(null)
  useEffect(() => {
    const colors = ['#F87171', '#FB923C', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6']
    const color = colors[Math.floor(Math.random() * colors.length)]
    setLocalUser({ name: 'Guest', color })
  }, [])

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editable: false,
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      }
    },
    onUpdate: ({ editor }) => {
      // Only emit if this user has edit permission and the change came from local typing
      if (isApplyingRemote.current) return
      if (!docIdRef.current) return
      socket.emit('content-update', {
        documentId: docIdRef.current,
        content: editor.getHTML()
      })
    }
  })

  useEffect(() => {
    const fetchSharedDoc = async () => {
      try {
        const res = await axios.get(`${API}/documents/shared/${shareToken}`)
        setTitle(res.data.title)
        setPermission(res.data.permission)
        setDocId(res.data.id)
        docIdRef.current = res.data.id
        if (editor) {
          editor.commands.setContent(res.data.content || '')
          if (res.data.permission === 'edit') {
            editor.setEditable(true)
          }
        }
      } catch (err) {
        setError('This link is invalid or has expired.')
      } finally {
        setLoading(false)
      }
    }
    if (editor) fetchSharedDoc()
  }, [editor, shareToken])

  useEffect(() => {
    if (!docId || !localUser) return
    socket.connect()
    socket.emit('join-document', { documentId: docId, user: localUser })
    socket.on('content-update', ({ content }) => {
      if (!editor) return
      isApplyingRemote.current = true
      editor.commands.setContent(content, false)
      isApplyingRemote.current = false
    })
    socket.on('user-count', (count) => {
      setConnectedUsers(count)
    })
    return () => {
      socket.off('content-update')
      socket.off('user-count')
      socket.disconnect()
    }
  }, [docId, editor])

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

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="h-[52px] px-4 flex items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo.svg" alt="CollabDocs" className="h-6 w-auto" />
            </Link>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{title}</p>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Collaborators */}
            {connectedUsers > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 presence-dot flex-shrink-0" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {connectedUsers} {connectedUsers === 1 ? 'editor' : 'editing'}
                </span>
              </div>
            )}

            <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-700" />

            {/* Permission badge */}
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

      {/* ── Editor ── */}
      <div className="pt-[52px] pb-32">
        <div className="max-w-[760px] mx-auto px-6 sm:px-8">
          <h1 className="doc-title-input mt-10 mb-6">{title || 'Untitled Document'}</h1>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}