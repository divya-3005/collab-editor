import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import socket from '../socket/socket.js'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import {
  Moon, Sun, Share2, Save, ArrowLeft, Bold, Italic,
  Strikethrough, Heading1, Heading2, List, ListOrdered,
  Copy, Check, X, Users
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Toolbar button
function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 flex-shrink-0" />
}

export default function Document() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const { theme, toggleTheme } = useTheme()

  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [connectedUsers, setConnectedUsers] = useState(1)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [sharePermission, setSharePermission] = useState('view')
  const [copied, setCopied] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)

  const isApplyingRemote = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing…',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        'data-gramm': 'false',
      }
    },
    onUpdate: ({ editor }) => {
      if (isApplyingRemote.current) return
      socket.emit('content-update', {
        documentId: id,
        content: editor.getHTML()
      })
    }
  })

  // Load document
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await axios.get(`${API}/documents/${id}`, { headers })
        setTitle(res.data.title)
        if (editor && res.data.content) {
          editor.commands.setContent(res.data.content)
        }
      } catch (err) {
        toast.error('Failed to load document')
        navigate('/dashboard')
      }
    }
    if (editor) fetchDoc()
  }, [editor, id])

  // Socket
  useEffect(() => {
    socket.connect()
    socket.emit('join-document', id)

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
      socket.off('document-revision')
      socket.off('operation-ack')
      socket.off('user-count')
      socket.disconnect()
    }
  }, [editor, id])

  // Auto-save every 3 seconds
  const saveDocument = useCallback(async () => {
    if (!editor || !title) return
    setSaving(true)
    try {
      await axios.patch(`${API}/documents/${id}`, {
        content: editor.getHTML(),
        title
      }, { headers })
      setLastSaved(new Date())
    } catch (err) {
      // silent
    } finally {
      setSaving(false)
    }
  }, [editor, id, title])

  useEffect(() => {
    if (!editor) return
    const interval = setInterval(saveDocument, 3000)
    return () => clearInterval(interval)
  }, [saveDocument])

  const generateShareLink = async () => {
    setGeneratingLink(true)
    try {
      const res = await axios.post(`${API}/documents/${id}/share`, { permission: sharePermission }, { headers })
      setShareUrl(res.data.shareUrl)
    } catch (err) {
      toast.error('Failed to generate share link')
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied!')
  }

  const formatTime = (date) => {
    if (!date) return ''
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#111318] transition-colors duration-200">

      {/* ── Top header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-200">
        <div className="h-[52px] px-4 flex items-center gap-3 justify-between">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link
              to="/dashboard"
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              title="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </Link>

            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveDocument}
              className="flex-1 min-w-0 text-sm font-semibold text-gray-800 dark:text-gray-100 bg-transparent border-none outline-none focus:ring-0 truncate placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="Untitled Document"
            />
          </div>

          {/* Right: status + actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Save status */}
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
              {saving ? 'Saving…' : lastSaved ? `Saved ${formatTime(lastSaved)}` : ''}
            </span>

            {/* Collaborators */}
            {connectedUsers > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 presence-dot flex-shrink-0" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {connectedUsers} {connectedUsers === 1 ? 'editor' : 'editing'}
                </span>
              </div>
            )}

            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Share button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              <Share2 size={14} />
              Share
            </button>

            {/* Save button */}
            <button
              onClick={saveDocument}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="fixed top-[52px] left-0 right-0 z-40 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 transition-colors duration-200">
        <div className="max-w-[760px] mx-auto h-10 flex items-center gap-0.5">
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
            <Bold size={15} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
            <Italic size={15} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough">
            <Strikethrough size={15} />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1">
            <Heading1 size={15} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">
            <Heading2 size={15} />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
            <List size={15} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Ordered list">
            <ListOrdered size={15} />
          </ToolbarBtn>
        </div>
      </div>

      {/* ── Editor ── */}
      <div className="pt-[92px] pb-32">
        <div className="max-w-[760px] mx-auto px-6 sm:px-8">
          {/* Large document title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveDocument}
            className="doc-title-input mt-10 mb-6 w-full"
            placeholder="Untitled Document"
          />
          {/* Body editor */}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ── Share Modal ── */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[100] bg-gray-900/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowShareModal(false); setShareUrl('') } }}
        >
          <div className="bg-white dark:bg-[#1e2432] rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700 animate-fade-in-up">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Share document</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Generate a link to share with collaborators</p>
              </div>
              <button
                onClick={() => { setShowShareModal(false); setShareUrl('') }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={17} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Permission toggle */}
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Access level</p>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
                  {['view', 'edit'].map((perm) => (
                    <button
                      key={perm}
                      onClick={() => { setSharePermission(perm); setShareUrl('') }}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                        sharePermission === perm
                          ? 'bg-white dark:bg-[#2a3244] text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {perm === 'view' ? 'View only' : 'Can edit'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {sharePermission === 'view'
                    ? 'Anyone with the link can read but not edit this document.'
                    : 'Anyone with the link can read and edit this document.'}
                </p>
              </div>

              {/* Generate button or link */}
              {!shareUrl ? (
                <button
                  onClick={generateShareLink}
                  disabled={generatingLink}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-60"
                >
                  <Share2 size={15} />
                  {generatingLink ? 'Generating…' : 'Generate link'}
                </button>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Share link</p>
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate font-mono">{shareUrl}</span>
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-all ${
                        copied
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                      }`}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}