import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { LiveCursors, cursorPluginKey } from '../extensions/LiveCursors.js'
import { Collaboration } from '../extensions/Collaboration.js'
import socket, { setSocketToken } from '../socket/socket.js'
import { useAuthHeaders } from '../hooks/useAuthHeaders.js'
import { useDocumentData } from '../hooks/useDocumentData.js'
import { useAutoSave } from '../hooks/useAutoSave.js'
import { useVersionHistory } from '../hooks/useVersionHistory.js'
import { usePresence } from '../hooks/usePresence.js'
import { useCollabSocket } from '../hooks/useCollabSocket.js'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import {
  Moon, Sun, Share, ArrowLeft, Bold, Italic, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus,
  Undo2, Redo2, Copy, Check, X, History, Clock, RotateCcw,
  Wifi, WifiOff, Cloud, CloudOff, MessageSquare, Download,
  HelpCircle, Maximize2, Minimize2, Send, FileText, Sparkles
} from 'lucide-react'

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

export default function Document() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const headers = useAuthHeaders()

  // Modals & Panels
  const [showShareModal, setShowShareModal] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [activeSidePanel, setActiveSidePanel] = useState(null) // null | 'history' | 'chat'
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Sharing state
  const [shareUrl, setShareUrl] = useState('')
  const [sharePermission, setSharePermission] = useState('view')
  const [copied, setCopied] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [unreadChat, setUnreadChat] = useState(0)
  const chatBottomRef = useRef(null)

  // Local user profile
  const [localUser, setLocalUser] = useState(null)
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]))
      const colors = ['#2563eb','#059669','#ea580c','#4f46e5','#0284c7','#c026d3','#e11d48']
      setLocalUser({
        name: decoded.name || 'Anonymous',
        color: colors[Math.abs(decoded.userId?.charCodeAt(0) || 0) % colors.length]
      })
      setSocketToken(token)
    } catch { }
  }, [])

  const isApplyingRemote = useRef(false)
  const cursorThrottleRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false // prosemirror-collab handles undo/redo transitions safely
      }),
      LiveCursors,
      Collaboration.configure({
        onSendSteps: (steps, clientID, version) => {
          if (!isApplyingRemote.current) {
            socket.emit('collab-steps', { documentId: id, version, steps, clientID })
          }
        },
        isApplyingRemote,
        clientID: `client-${Math.random().toString(36).slice(2)}`
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[500px]',
        'data-placeholder': 'Start writing your document…',
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (!localUser || !id) return
      if (cursorThrottleRef.current) return
      cursorThrottleRef.current = setTimeout(() => { cursorThrottleRef.current = null }, 50)
      socket.emit('cursor-move', {
        documentId: id,
        position: ed.state.selection.anchor,
        name: localUser.name,
        color: localUser.color
      })
    }
  })

  // Live cursor integration
  const { remoteUsers } = usePresence(id)
  useEffect(() => {
    if (!editor) return
    editor.storage.liveCursors.cursors = remoteUsers
    editor.view.dispatch(editor.state.tr.setMeta(cursorPluginKey, { cursors: remoteUsers }))
  }, [editor, remoteUsers])

  const { title, setTitle } = useDocumentData(id, headers, editor)
  const { saving, saveError, saveDocument } = useAutoSave(editor, id, title, headers)
  const {
    showHistoryPanel,
    setShowHistoryPanel,
    versions,
    previewingVersion,
    loadingVersions,
    saveSnapshot,
    previewVersion,
    exitPreview,
    restoreVersion
  } = useVersionHistory(id, headers, editor, saveDocument, setTitle)

  useCollabSocket(id, editor, localUser, setIsConnected)

  // Real-time Room Chat socket listener
  useEffect(() => {
    const handleDocChat = (msg) => {
      setChatMessages((prev) => [...prev, msg])
      if (activeSidePanel !== 'chat') {
        setUnreadChat((prev) => prev + 1)
      }
    }
    socket.on('doc-chat', handleDocChat)
    return () => socket.off('doc-chat', handleDocChat)
  }, [activeSidePanel])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeSidePanel === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, activeSidePanel])

  // Sync side panel states
  useEffect(() => {
    setShowHistoryPanel(activeSidePanel === 'history')
    if (activeSidePanel === 'chat') {
      setUnreadChat(0)
    }
  }, [activeSidePanel, setShowHistoryPanel])

  // Document word/character statistics
  const stats = useMemo(() => {
    if (!editor) return { words: 0, characters: 0, readingTime: 1 }
    const text = editor.getText() || ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const characters = text.length
    const readingTime = Math.max(1, Math.ceil(words / 200))
    return { words, characters, readingTime }
  }, [editor?.state.doc]) // eslint-disable-line react-hooks/exhaustive-deps

  // Generate share link
  const generateShareLink = async () => {
    setGeneratingLink(true)
    try {
      const res = await axios.post(`${API}/documents/${id}/share`, { permission: sharePermission }, { headers })
      setShareUrl(res.data.shareUrl)
    } catch {
      toast.error('Failed to generate link')
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Send a chat message
  const handleSendChat = (e) => {
    e.preventDefault()
    if (!chatInput.trim() || !localUser) return
    socket.emit('doc-chat', {
      documentId: id,
      text: chatInput.trim(),
      sender: localUser.name,
      color: localUser.color
    })
    setChatInput('')
  }

  // Document Export Handlers
  const handleExport = (format) => {
    setShowExportMenu(false)
    const docTitle = (title || 'Untitled Document').replace(/[^a-zA-Z0-9_-]/g, '_')

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
      // Clean text with basic title heading
      data = `# ${title || 'Untitled Document'}\n\n${editor.getText()}`
      mimeType = 'text/markdown'
      fileExt = 'md'
    } else if (format === 'html') {
      data = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || 'Document'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #18181b; }
    h1 { font-size: 2em; border-bottom: 1px solid #e4e4e7; padding-bottom: 0.3em; }
    pre { background: #f4f4f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 3px solid #d4d4d8; margin: 0; padding-left: 1rem; color: #71717a; }
  </style>
</head>
<body>
  <h1>${title || 'Untitled Document'}</h1>
  ${editor.getHTML()}
</body>
</html>`
      mimeType = 'text/html'
      fileExt = 'html'
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

  // Keyboard shortcut listener for Help modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '?' && !e.target.matches('input, textarea, [contenteditable="true"]')) {
        setShowShortcuts(prev => !prev)
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false)
        setShowExportMenu(false)
        setShowShareModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const formatDateFull = (dateStr) =>
    new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`min-h-screen bg-white dark:bg-[#09090b] transition-colors flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 overflow-hidden' : ''}`}>
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Left: Back + Doc Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand flex-shrink-0"
              title="Return to Dashboard"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => saveDocument().catch(() => {})}
              disabled={!!previewingVersion}
              placeholder="Untitled Document"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-transparent border-none outline-none truncate max-w-[220px] sm:max-w-[340px] focus:ring-1 focus:ring-brand rounded px-1 -ml-1 transition-all"
            />
          </div>

          {/* Right: Actions & Collaborators */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Status indicators */}
            <div className="hidden sm:flex items-center gap-2 mr-1">
              <div
                className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400"
                title={isConnected ? 'Connected to collaboration engine' : 'Disconnected'}
              >
                {isConnected ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden md:inline">Live</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500">
                    <WifiOff size={12} />
                    <span className="hidden md:inline">Offline</span>
                  </span>
                )}
              </div>

              <div
                className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400"
                title={saveError ? saveError : saving ? 'Persisting to cloud…' : 'All changes saved to cloud'}
              >
                {saveError ? (
                  <CloudOff size={13} className="text-red-500" />
                ) : (
                  <Cloud size={13} className={saving ? 'text-brand animate-pulse' : 'text-zinc-400'} />
                )}
              </div>
            </div>

            {/* Active Collaborators Bar */}
            {remoteUsers.size > 0 && (
              <div className="flex items-center -space-x-1.5 mr-1">
                {Array.from(remoteUsers.values()).map((u) => (
                  <div
                    key={u.socketId}
                    title={`${u.name} (Active now)`}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white dark:border-[#09090b] shadow-sm select-none"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}

            {/* Export Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                title="Export Document"
              >
                <Download size={15} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#18181b] rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl py-1 z-50 text-xs animate-slide-up origin-top-right">
                  <div className="px-3 py-1.5 font-semibold text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-100 dark:border-zinc-800">
                    Export Document
                  </div>
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
                    onClick={() => handleExport('html')}
                    className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between"
                  >
                    <span>HTML Document</span>
                    <span className="text-[10px] text-zinc-400 font-mono">.html</span>
                  </button>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                  <button
                    onClick={() => handleExport('print')}
                    className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between"
                  >
                    <span>Print or PDF</span>
                    <span className="text-[10px] text-zinc-400">⌘P</span>
                  </button>
                </div>
              )}
            </div>

            {/* Room Chat Button with Unread Badge */}
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'chat' ? null : 'chat')}
              className={`p-1.5 rounded relative transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                activeSidePanel === 'chat'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Collaborator Chat"
            >
              <MessageSquare size={15} />
              {unreadChat > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadChat}
                </span>
              )}
            </button>

            {/* Version History Toggle */}
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'history' ? null : 'history')}
              className={`p-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                activeSidePanel === 'history'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Version Snapshots"
            >
              <History size={15} />
            </button>

            {/* Zen / Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand hidden sm:block"
              title={isFullscreen ? 'Exit Focus Mode (Esc)' : 'Zen Focus Mode'}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              title="Toggle Dark / Light Theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Share Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand shadow-sm ml-1"
            >
              <Share size={13} />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* ── RICH TEXT TOOLBAR ─────────────────────────────────────────────────── */}
        <div
          className={`border-t border-zinc-200 dark:border-zinc-800 px-4 h-10 flex items-center overflow-x-auto transition-all ${
            activeSidePanel ? 'pr-[320px]' : ''
          }`}
        >
          <div className="w-full max-w-[760px] mx-auto flex items-center gap-0.5">
            {/* Formatting */}
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive('bold')}
              disabled={!!previewingVersion}
              title="Bold (⌘B)"
            >
              <Bold size={14} />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive('italic')}
              disabled={!!previewingVersion}
              title="Italic (⌘I)"
            >
              <Italic size={14} />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              active={editor?.isActive('strike')}
              disabled={!!previewingVersion}
              title="Strikethrough"
            >
              <Strikethrough size={14} />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleCode().run()}
              active={editor?.isActive('code')}
              disabled={!!previewingVersion}
              title="Inline Code (⌘E)"
            >
              <Code size={14} />
            </ToolbarBtn>

            <ToolbarDivider />

            {/* Headings */}
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor?.isActive('heading', { level: 1 })}
              disabled={!!previewingVersion}
              title="Heading 1"
            >
              <Heading1 size={14} />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor?.isActive('heading', { level: 2 })}
              disabled={!!previewingVersion}
              title="Heading 2"
            >
              <Heading2 size={14} />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor?.isActive('heading', { level: 3 })}
              disabled={!!previewingVersion}
              title="Heading 3"
            >
              <Heading3 size={14} />
            </ToolbarBtn>

            <ToolbarDivider />

            {/* Lists & Quotes */}
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive('bulletList')}
              disabled={!!previewingVersion}
              title="Bullet List"
            >
              <List size={14} />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive('orderedList')}
              disabled={!!previewingVersion}
              title="Numbered List"
            >
              <ListOrdered size={14} />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              active={editor?.isActive('blockquote')}
              disabled={!!previewingVersion}
              title="Blockquote"
            >
              <Quote size={14} />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              disabled={!!previewingVersion}
              title="Divider / Horizontal Rule"
            >
              <Minus size={14} />
            </ToolbarBtn>

            <div className="flex-1" />

            {/* Shortcuts help button */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 text-xs flex items-center gap-1 transition-colors"
              title="Shortcuts (?)"
            >
              <HelpCircle size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ── PREVIEW BANNER (Version Restore Mode) ──────────────────────────────── */}
      {previewingVersion && (
        <div
          className={`sticky top-[96px] z-30 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2 transition-all ${
            activeSidePanel ? 'pr-[320px]' : ''
          }`}
        >
          <div className="max-w-[760px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs font-medium">
              <Clock size={14} />
              <span>Previewing version from {formatDateFull(previewingVersion.createdAt)} (Read-only)</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exitPreview}
                className="px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={restoreVersion}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors shadow-sm"
              >
                <RotateCcw size={12} />
                <span>Restore this version</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        <main
          className={`flex-1 overflow-y-auto transition-all ${
            activeSidePanel ? 'mr-80' : ''
          }`}
        >
          <div className="max-w-[760px] mx-auto px-6 sm:px-8 py-10 pb-24">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => saveDocument().catch(() => {})}
              disabled={!!previewingVersion}
              className="doc-title-input mb-6"
              placeholder="Untitled Document"
            />
            <div className={previewingVersion ? 'opacity-60 pointer-events-none' : ''}>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Bottom Floating Stats Pill */}
          <div className="fixed bottom-4 left-6 z-30 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#18181b]/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 shadow-sm">
            <span>{stats.words} words</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>{stats.characters} chars</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>{stats.readingTime} min read</span>
          </div>
        </main>

        {/* ── SIDE PANEL: VERSION HISTORY ─────────────────────────────────────── */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-80 bg-zinc-50 dark:bg-[#0e0e11] border-l border-zinc-200 dark:border-zinc-800 transition-transform duration-200 flex flex-col z-20 ${
            activeSidePanel === 'history' ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#09090b]">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Version History</span>
            <button
              onClick={() => setActiveSidePanel(null)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <X size={14} />
            </button>
          </div>
          <div className="p-3 bg-white dark:bg-[#09090b] border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={saveSnapshot}
              className="w-full text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 py-1.5 rounded-md transition-colors"
            >
              Save snapshot
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingVersions ? (
              <p className="text-xs text-center text-zinc-500 py-6">Loading versions…</p>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-zinc-400">
                <Clock size={24} className="mx-auto mb-2 opacity-40" />
                <p>No snapshots saved yet.</p>
                <p className="text-[11px] mt-1 text-zinc-500">Save a snapshot anytime to record a milestone.</p>
              </div>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  onClick={() => previewVersion(v)}
                  className={`p-2.5 rounded-md cursor-pointer border text-xs transition-colors ${
                    previewingVersion?.id === v.id
                      ? 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 shadow-sm'
                      : 'border-transparent hover:bg-white dark:hover:bg-zinc-900 hover:border-zinc-200 dark:hover:border-zinc-800'
                  }`}
                >
                  <div className="flex justify-between items-center text-zinc-900 dark:text-zinc-100 font-medium mb-0.5">
                    <span>{v.name || `Version ${v.versionNumber}`}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">v{v.versionNumber}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">{new Date(v.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── SIDE PANEL: ROOM CHAT ───────────────────────────────────────────── */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-80 bg-zinc-50 dark:bg-[#0e0e11] border-l border-zinc-200 dark:border-zinc-800 transition-transform duration-200 flex flex-col z-20 ${
            activeSidePanel === 'chat' ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#09090b]">
            <div className="flex items-center gap-1.5">
              <MessageSquare size={13} className="text-brand" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Room Discussion
              </span>
            </div>
            <button
              onClick={() => setActiveSidePanel(null)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-zinc-400">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                <p>No messages in this session yet.</p>
                <p className="text-[11px] mt-1 text-zinc-500">Send notes to connected collaborators in real time.</p>
              </div>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className="text-xs">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{m.sender}</span>
                    <span className="text-[10px] text-zinc-400">{m.time}</span>
                  </div>
                  <div className="bg-white dark:bg-zinc-800/60 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300 leading-relaxed break-words shadow-2xs">
                    {m.text}
                  </div>
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] flex gap-1.5">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send a note to peers…"
              className="flex-1 text-xs bg-zinc-100 dark:bg-zinc-800/70 border border-transparent focus:border-brand rounded-md px-2.5 py-1.5 outline-none text-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-1.5 rounded-md bg-brand text-white hover:bg-brand/90 disabled:opacity-40 transition-colors"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      </div>

      {/* ── SHARE MODAL ───────────────────────────────────────────────────────── */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false) }}
        >
          <div className="bg-white dark:bg-[#18181b] rounded-xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800 animate-slide-up">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Share document</span>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Link permissions
                </label>
                <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                  {['view', 'edit'].map((perm) => (
                    <button
                      key={perm}
                      onClick={() => { setSharePermission(perm); setShareUrl('') }}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                        sharePermission === perm
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                    >
                      {perm === 'view' ? 'View only' : 'Can edit'}
                    </button>
                  ))}
                </div>
              </div>
              {!shareUrl ? (
                <button
                  onClick={generateShareLink}
                  disabled={generatingLink}
                  className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium py-2 rounded-md text-xs transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200"
                >
                  {generatingLink ? 'Generating…' : 'Generate secure link'}
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-2">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex-1 font-mono">
                    {shareUrl}
                  </span>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded transition-colors ${
                      copied
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KEYBOARD SHORTCUTS MODAL ────────────────────────────────────────── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowShortcuts(false) }}
        >
          <div className="bg-white dark:bg-[#18181b] rounded-xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 animate-slide-up p-5">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Keyboard Shortcuts</span>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Bold</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">⌘ B</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Italic</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">⌘ I</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Inline Code</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">⌘ E</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Save to Cloud</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">⌘ S</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Heading 1</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]"># Space</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Heading 2</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">## Space</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Bullet List</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">- Space</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Blockquote</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">&gt; Space</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Shortcuts Help</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">?</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Close Modals</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
