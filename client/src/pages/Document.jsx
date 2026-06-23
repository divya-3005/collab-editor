import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { LiveCursors, cursorPluginKey } from '../extensions/LiveCursors.js'
import socket from '../socket/socket.js'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import {
  Moon, Sun, Share2, Save, ArrowLeft, Bold, Italic,
  Strikethrough, Heading1, Heading2, List, ListOrdered,
  Copy, Check, X, Users, History, Clock, RotateCcw
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

  // History State
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [versions, setVersions] = useState([])
  const [previewingVersion, setPreviewingVersion] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState(false)

  const isApplyingRemote = useRef(false)
  const cursorThrottleRef = useRef(null)
  
  // Presence State
  const [localUser, setLocalUser] = useState(null)
  const [remoteUsers, setRemoteUsers] = useState(new Map())
  const labelTimeoutRefs = useRef(new Map())

  // Initialize local user with a random color
  useEffect(() => {
    const userJson = localStorage.getItem('user')
    const user = userJson ? JSON.parse(userJson) : { name: 'Guest' }
    const colors = ['#F87171', '#FB923C', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6']
    const color = colors[Math.floor(Math.random() * colors.length)]
    setLocalUser({ name: user.name, color })
  }, [])

  const editor = useEditor({
    extensions: [StarterKit, LiveCursors],
    content: '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        'data-gramm': 'false',
        'data-placeholder': 'Start writing…',
      }
    },
    onUpdate: ({ editor }) => {
      if (isApplyingRemote.current) return
      socket.emit('content-update', {
        documentId: id,
        content: editor.getHTML()
      })
    },
    onSelectionUpdate: ({ editor }) => {
      if (!localUser) return
      
      // Throttle cursor movement emission to 50ms
      if (cursorThrottleRef.current) return
      cursorThrottleRef.current = setTimeout(() => {
        cursorThrottleRef.current = null
      }, 50)

      socket.emit('cursor-move', {
        documentId: id,
        position: editor.state.selection.anchor,
        name: localUser.name,
        color: localUser.color
      })
    }
  })

  // Sync remoteUsers to Tiptap extension
  useEffect(() => {
    if (!editor) return
    editor.storage.liveCursors.cursors = remoteUsers
    editor.view.dispatch(editor.state.tr.setMeta(cursorPluginKey, { cursors: remoteUsers }))
  }, [editor, remoteUsers])

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
    if (!localUser) return
    
    socket.connect()
    // Send user payload for presence
    socket.emit('join-document', { documentId: id, user: localUser })
    socket.emit('get-presence', id)

    socket.on('content-update', ({ content }) => {
      if (!editor) return
      isApplyingRemote.current = true
      editor.commands.setContent(content, false)
      isApplyingRemote.current = false
    })

    socket.on('presence-list', (users) => {
      setRemoteUsers(prev => {
        const next = new Map(prev)
        users.forEach(u => next.set(u.socketId, { ...u, showLabel: true }))
        return next
      })
    })

    socket.on('user-joined', (user) => {
      setRemoteUsers(prev => {
        const next = new Map(prev)
        next.set(user.socketId, { ...user, showLabel: true })
        return next
      })
    })

    socket.on('user-left', (socketId) => {
      setRemoteUsers(prev => {
        const next = new Map(prev)
        next.delete(socketId)
        return next
      })
    })

    socket.on('cursor-move', (data) => {
      setRemoteUsers(prev => {
        const next = new Map(prev)
        const existing = next.get(data.socketId) || {}
        next.set(data.socketId, { ...existing, ...data, showLabel: true })
        return next
      })

      // Hide label after 3 seconds of inactivity
      if (labelTimeoutRefs.current.has(data.socketId)) {
        clearTimeout(labelTimeoutRefs.current.get(data.socketId))
      }
      
      const timeout = setTimeout(() => {
        setRemoteUsers(prev => {
          if (!prev.has(data.socketId)) return prev
          const next = new Map(prev)
          const user = next.get(data.socketId)
          next.set(data.socketId, { ...user, showLabel: false })
          return next
        })
      }, 3000)
      
      labelTimeoutRefs.current.set(data.socketId, timeout)
    })

    return () => {
      socket.off('content-update')
      socket.off('presence-list')
      socket.off('user-joined')
      socket.off('user-left')
      socket.off('cursor-move')
      socket.disconnect()
      
      // Cleanup timeouts
      labelTimeoutRefs.current.forEach(clearTimeout)
    }
  }, [editor, id, localUser])

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
  
  const formatDateFull = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    })
  }

  // Version History Functions
  const fetchVersions = useCallback(async () => {
    setLoadingVersions(true)
    try {
      const res = await axios.get(`${API}/documents/${id}/versions`, { headers })
      setVersions(res.data)
    } catch (err) {
      toast.error('Failed to load history')
    } finally {
      setLoadingVersions(false)
    }
  }, [id, headers])

  useEffect(() => {
    if (showHistoryPanel) fetchVersions()
  }, [showHistoryPanel, fetchVersions])

  const saveSnapshot = async () => {
    try {
      await saveDocument() // ensure latest changes are saved first
      await axios.post(`${API}/documents/${id}/snapshot`, {}, { headers })
      toast.success('Version saved!')
      fetchVersions()
    } catch (err) {
      toast.error('Failed to save version')
    }
  }

  const previewVersion = async (version) => {
    try {
      const res = await axios.get(`${API}/documents/${id}/versions/${version.id}`, { headers })
      editor.commands.setContent(res.data.content, false)
      setTitle(res.data.title)
      editor.setEditable(false)
      setPreviewingVersion(res.data)
    } catch (err) {
      toast.error('Failed to load version preview')
    }
  }

  const exitPreview = async () => {
    try {
      const res = await axios.get(`${API}/documents/${id}`, { headers })
      editor.commands.setContent(res.data.content, false)
      setTitle(res.data.title)
      editor.setEditable(true)
      setPreviewingVersion(null)
    } catch (err) {
      toast.error('Failed to exit preview')
    }
  }

  const restoreVersion = async () => {
    if (!previewingVersion) return
    try {
      const res = await axios.post(`${API}/documents/${id}/versions/${previewingVersion.id}/restore`, {}, { headers })
      
      editor.commands.setContent(res.data.content, false)
      setTitle(res.data.title)
      editor.setEditable(true)
      setPreviewingVersion(null)
      
      socket.emit('content-update', {
        documentId: id,
        content: res.data.content
      })
      
      toast.success('Version restored!')
      fetchVersions()
    } catch (err) {
      toast.error('Failed to restore version')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#111318] transition-colors duration-200">

      {/* ── Top header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-200">
        <div className="h-[52px] px-4 flex items-center gap-3 justify-between">
          {/* Left: back + logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              to="/dashboard"
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src="/logo.svg" alt="CollabDocs" className="h-5 w-auto" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:block">CollabDocs</span>
            </Link>
          </div>

          {/* Right: status + actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Save status */}
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
              {saving ? 'Saving…' : lastSaved ? `Saved ${formatTime(lastSaved)}` : ''}
            </span>

            {/* Collaborators */}
            {remoteUsers.size > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1">
                {Array.from(remoteUsers.values()).map(user => (
                  <div 
                    key={user.socketId}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-[#16181f] shadow-sm -ml-2 first:ml-0 relative group"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                    {/* Tooltip */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {user.name}
                    </div>
                  </div>
                ))}
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

            {/* History button */}
            <button
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-all ${
                showHistoryPanel 
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' 
                  : 'text-gray-700 dark:text-gray-300 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <History size={14} />
              <span className="hidden sm:block">History</span>
            </button>

            {/* Share button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              <Share2 size={14} />
              <span className="hidden sm:block">Share</span>
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
      <div className={`fixed top-[52px] left-0 z-40 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 transition-all duration-200 ${showHistoryPanel ? 'right-80' : 'right-0'}`}>
        <div className="max-w-[760px] mx-auto h-10 flex items-center gap-0.5">
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold" disabled={!!previewingVersion}>
            <Bold size={15} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic" disabled={!!previewingVersion}>
            <Italic size={15} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough" disabled={!!previewingVersion}>
            <Strikethrough size={15} />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1" disabled={!!previewingVersion}>
            <Heading1 size={15} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2" disabled={!!previewingVersion}>
            <Heading2 size={15} />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list" disabled={!!previewingVersion}>
            <List size={15} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Ordered list" disabled={!!previewingVersion}>
            <ListOrdered size={15} />
          </ToolbarBtn>
        </div>
      </div>

      {/* ── Preview Banner ── */}
      {previewingVersion && (
        <div className={`fixed top-[92px] left-0 z-30 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/30 px-4 py-2.5 transition-all duration-200 ${showHistoryPanel ? 'right-80' : 'right-0'}`}>
          <div className="max-w-[760px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
              <Clock size={16} />
              <span className="text-sm font-medium">
                Previewing version from {formatDateFull(previewingVersion.createdAt)}
              </span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={exitPreview}
                className="px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={restoreVersion}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-sm"
              >
                <RotateCcw size={14} />
                Restore this version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Layout (Editor + Sidebar) ── */}
      <div className="flex pt-[92px] min-h-screen">
        
        {/* Editor Area */}
        <div className={`flex-1 transition-all duration-300 ${showHistoryPanel ? 'mr-80' : ''}`}>
          <div className={`max-w-[760px] mx-auto px-6 sm:px-8 pb-32 ${previewingVersion ? 'mt-14' : ''}`}>
            {/* Large document title */}
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveDocument}
              disabled={!!previewingVersion}
              className="doc-title-input mt-10 mb-6 w-full disabled:opacity-80"
              placeholder="Untitled Document"
            />
            {/* Body editor */}
            <div className={previewingVersion ? 'opacity-80 pointer-events-none grayscale-[20%]' : ''}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* ── History Panel Sidebar ── */}
        <div 
          className={`fixed top-[52px] right-0 bottom-0 w-80 bg-gray-50 dark:bg-[#1a1f2e] border-l border-gray-200 dark:border-gray-800 shadow-xl transition-transform duration-300 z-40 flex flex-col ${
            showHistoryPanel ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#16181f]">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <History size={16} className="text-indigo-500" />
              Version History
            </h2>
            <button 
              onClick={() => setShowHistoryPanel(false)}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="p-4 bg-white dark:bg-[#16181f] border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={saveSnapshot}
              className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 font-semibold py-2 rounded-lg text-sm transition-colors border border-indigo-100 dark:border-indigo-800/30"
            >
              <Save size={14} />
              Save current version
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingVersions ? (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 py-4">Loading history…</p>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Clock size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">No versions saved yet. Click the button above to create a snapshot of your document.</p>
              </div>
            ) : (
              versions.map((v) => {
                const isPreviewing = previewingVersion?.id === v.id;
                return (
                  <div 
                    key={v.id}
                    onClick={() => previewVersion(v)}
                    className={`p-3 rounded-xl cursor-pointer border transition-all ${
                      isPreviewing 
                        ? 'bg-white dark:bg-[#23293b] border-indigo-300 dark:border-indigo-600 shadow-sm' 
                        : 'bg-white dark:bg-[#16181f] border-transparent hover:border-gray-200 dark:hover:border-gray-700 shadow-sm'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5 flex items-center justify-between">
                      {formatDateFull(v.createdAt)}
                      {isPreviewing && <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">Previewing</span>}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        v{v.versionNumber}
                      </span>
                      {v.name && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 truncate font-medium">
                          {v.name}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
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