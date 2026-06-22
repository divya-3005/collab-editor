import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import socket from '../socket/socket.js'
import { transform, apply } from '../ot/transform.js'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import { Moon, Sun } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function Document() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const { theme, toggleTheme } = useTheme()

  const [title, setTitle] = useState('Untitled Document')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [connectedUsers, setConnectedUsers] = useState(1)

  const revision = useRef(0)
  const pendingOps = useRef([])
  const isApplyingRemote = useRef(false)

  const [shareUrl, setShareUrl] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)

  const shareDocument = async (permission) => {
    try {
      const res = await axios.post(`${API}/documents/${id}/share`,
        { permission },
        { headers }
      )
      setShareUrl(res.data.shareUrl)
    } catch (err) {
      toast.error('Failed to generate share link')
    }
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg mx-auto focus:outline-none min-h-screen p-8'
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

  function stepToOperations(step, doc) {
    const ops = []
    const stepJson = step.toJSON()

    if (stepJson.stepType === 'replace') {
      const from = stepJson.from
      const to = stepJson.to

      // deletions
      for (let i = to - 1; i >= from; i--) {
        ops.push({ type: 'delete', position: from })
      }

      // insertions
      if (stepJson.slice?.content) {
        let pos = from
        const extractText = (content) => {
          content.forEach(node => {
            if (node.type === 'text' && node.text) {
              for (const char of node.text) {
                ops.push({ type: 'insert', position: pos, character: char })
                pos++
              }
            }
            if (node.content) extractText(node.content)
          })
        }
        extractText(stepJson.slice.content)
      }
    }

    return ops
  }

  // load document
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

  // connect socket and join document room
  useEffect(() => {
    socket.connect()
    socket.emit('join-document', id)

    socket.on('document-revision', ({ revision: rev }) => {
      revision.current = rev
    })

    socket.on('content-update', ({ content }) => {
      if (!editor) return
      isApplyingRemote.current = true
      const { from, to } = editor.state.selection
      editor.commands.setContent(content, false)
      isApplyingRemote.current = false
    })

    socket.on('operation-ack', ({ revision: newRev }) => {
      revision.current = newRev
      pendingOps.current.shift()
    })

    socket.on('user-count', (count) => {
      setConnectedUsers(count)
    })

    return () => {
      socket.off('document-revision')
      socket.off('operation')
      socket.off('operation-ack')
      socket.off('user-count')
      socket.disconnect()
    }
  }, [editor, id])

  // auto save every 2 seconds
  const saveDocument = useCallback(async () => {
    if (!editor) return
    setSaving(true)
    try {
      await axios.patch(`${API}/documents/${id}`, {
        content: editor.getHTML(),
        title
      }, { headers })
      setLastSaved(new Date())
    } catch (err) {
      toast.error('Failed to save document')
    } finally {
      setSaving(false)
    }
  }, [editor, id, title])

  useEffect(() => {
    if (!editor) return
    const interval = setInterval(saveDocument, 2000)
    return () => clearInterval(interval)
  }, [saveDocument])

  const formatTime = (date) => {
    if (!date) return ''
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      <div className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between z-50 shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-sm font-medium transition-colors"
          >
            ← Back
          </button>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-sm font-semibold text-gray-800 dark:text-gray-100 border-none outline-none bg-transparent w-64 focus:ring-0"
            placeholder="Untitled Document"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2.5 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{connectedUsers} online</span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {saving ? 'Saving...' : lastSaved ? `Saved at ${formatTime(lastSaved)}` : ''}
          </span>
          
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700"></div>

          <button onClick={toggleTheme} className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Share
          </button>

          <button
            onClick={saveDocument}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 shadow-sm transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      <div className="fixed top-[53px] left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-700/50 px-6 py-2 flex items-center gap-1.5 z-40 transition-colors duration-200">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2 py-1.5 rounded-md text-sm font-bold transition-colors ${editor?.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
        >
          B
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2 py-1.5 rounded-md text-sm italic transition-colors ${editor?.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
        >
          I
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={`px-2 py-1.5 rounded-md text-sm line-through transition-colors ${editor?.isActive('strike') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
        >
          S
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2.5 py-1.5 rounded-md text-sm font-bold transition-colors ${editor?.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
        >
          H1
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2.5 py-1.5 rounded-md text-sm font-bold transition-colors ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
        >
          H2
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${editor?.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
        >
          • List
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${editor?.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
        >
          1. List
        </button>
      </div>

      <div className="pt-32 pb-16 max-w-4xl mx-auto px-8">
        <EditorContent editor={editor} />
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] transition-opacity">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-[400px] border border-gray-100 dark:border-gray-700 transform transition-all">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Share document</h3>

            <div className="flex gap-3 mb-5">
              <button
                onClick={() => shareDocument('view')}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                View only
              </button>
              <button
                onClick={() => shareDocument('edit')}
                className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
              >
                Edit access
              </button>
            </div>

            {shareUrl && (
              <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-1 truncate font-mono">{shareUrl}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl)
                      toast.success('Link copied to clipboard!')
                    }}
                    className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => { setShowShareModal(false); setShareUrl('') }}
              className="mt-6 w-full text-gray-500 dark:text-gray-400 text-sm font-medium hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}