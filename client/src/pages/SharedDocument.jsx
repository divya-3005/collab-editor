import { useEffect, useState } from 'react'
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
  const { theme, toggleTheme } = useTheme()
  const isApplyingRemote = { current: false }

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editable: false,
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      }
    }
  })

  useEffect(() => {
    const fetchSharedDoc = async () => {
      try {
        const res = await axios.get(`${API}/documents/shared/${shareToken}`)
        setTitle(res.data.title)
        setPermission(res.data.permission)
        setDocId(res.data.id)
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
    if (!docId) return
    socket.connect()
    socket.emit('join-document', docId)
    socket.on('content-update', ({ content }) => {
      if (!editor) return
      isApplyingRemote.current = true
      editor.commands.setContent(content, false)
      isApplyingRemote.current = false
    })
    return () => {
      socket.off('content-update')
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