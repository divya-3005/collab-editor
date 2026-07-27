/**
 * Document.jsx — Collaborative rich-text editor page.
 *
 * Architecture:
 *   This component is a composition of focused custom hooks. It owns no async
 *   logic directly — all data fetching, persistence, presence, and real-time
 *   collaboration are delegated to their respective hooks.
 *
 * Hook responsibilities:
 *   useAuthHeaders      — builds the memoised Authorization header object
 *   useDocumentData     — fetches document from REST, owns title state
 *   useAutoSave         — periodic save, ⌘S, isDirty tracking, beforeunload
 *   useVersionHistory   — snapshot/preview/restore operations
 *   usePresence         — remote user map, cursor label timers
 *   useCollabSocket     — socket lifecycle, ProseMirror step-based collaboration
 *
 * Collaboration protocol:
 *   The previous content-update broadcast (full HTML on every keystroke) has
 *   been replaced with a ProseMirror step-based protocol. Changes are sent as
 *   serialised ProseMirror Step JSON objects via `collab-steps`. The server
 *   sequences them; peers apply them via receiveTransaction which correctly
 *   rebases concurrent edits using ProseMirror's Mapping system.
 *
 *   This correctly handles all rich-text operations: bold, italic, headings,
 *   lists, blockquotes, code blocks, and concurrent formatting changes —
 *   which the previous character-OT engine could not represent.
 */

// ── Imports ───────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

// Tiptap editor
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { LiveCursors, cursorPluginKey } from '../extensions/LiveCursors.js'
import { Collaboration } from '../extensions/Collaboration.js'

// Real-time
import socket from '../socket/socket.js'

// Custom hooks
import { useAuthHeaders }    from '../hooks/useAuthHeaders.js'
import { useDocumentData }   from '../hooks/useDocumentData.js'
import { useAutoSave }       from '../hooks/useAutoSave.js'
import { useVersionHistory } from '../hooks/useVersionHistory.js'
import { usePresence }       from '../hooks/usePresence.js'
import { useCollabSocket }   from '../hooks/useCollabSocket.js'

// UI
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import {
  Moon, Sun, Share2, Save, ArrowLeft, Bold, Italic,
  Strikethrough, Heading1, Heading2, List, ListOrdered,
  Copy, Check, X, History, Clock, RotateCcw, Wifi, WifiOff
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolbarBtn({ onClick, active, title, disabled, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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

// ── SaveErrorBanner — surfaces autosave failures to the user ─────────────────
function SaveErrorBanner({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
      <span>⚠️ {error}</span>
      <button
        onClick={onRetry}
        className="underline underline-offset-2 hover:no-underline transition-all"
      >
        Retry
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Document() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { theme, toggleTheme } = useTheme()

  // ── Auth headers ──────────────────────────────────────────────────────────
  const headers = useAuthHeaders()

  // ── Share modal state ─────────────────────────────────────────────────────
  const [showShareModal,  setShowShareModal]  = useState(false)
  const [shareUrl,        setShareUrl]        = useState('')
  const [sharePermission, setSharePermission] = useState('view')
  const [copied,          setCopied]          = useState(false)
  const [generatingLink,  setGeneratingLink]  = useState(false)

  // ── Connection status ─────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState(false)

  // ── Local user identity (colour-coded presence dot) ───────────────────────
  // Generated once per mount; stable across re-renders.
  const [localUser, setLocalUser] = useState(null)
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]))
      const colors  = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444']
      setLocalUser({
        name:  decoded.name || 'Anonymous',
        color: colors[Math.abs(decoded.userId?.charCodeAt(0) || 0) % colors.length]
      })
    } catch { /* token unreadable — no presence dot */ }
  }, [])

  // ── isApplyingRemote ref ──────────────────────────────────────────────────
  // Prevents the onTransaction handler from emitting steps received from the
  // server back to the server. Passed into both the Collaboration extension
  // and useCollabSocket so they share the same flag.
  const isApplyingRemote = useRef(false)

  // ── Tiptap editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      LiveCursors,
      Collaboration.configure({
        // Steps are emitted via the onSendSteps callback below.
        // The collab plugin is registered here; the actual socket emit happens
        // in useCollabSocket which holds the socket lifecycle.
        onSendSteps: (steps, clientID, version) => {
          if (!isApplyingRemote.current) {
            socket.emit('collab-steps', {
              documentId: id,
              version,
              steps,
              clientID
            })
          }
        },
        isApplyingRemote,
        clientID: `client-${Math.random().toString(36).slice(2)}`
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        'data-gramm': 'false',
        'data-placeholder': 'Start writing…',
      }
    },
    // Emit cursor position on every selection change (throttled to 50 ms)
    onSelectionUpdate: ({ editor: ed }) => {
      if (!localUser || !id) return
      if (cursorThrottleRef.current) return
      cursorThrottleRef.current = setTimeout(() => {
        cursorThrottleRef.current = null
      }, 50)
      socket.emit('cursor-move', {
        documentId: id,
        position:   ed.state.selection.anchor,
        name:       localUser.name,
        color:      localUser.color
      })
    }
  })

  // ── Cursor throttle ref ───────────────────────────────────────────────────
  // Declared here so onSelectionUpdate can reference it via closure.
  // Also exposed to useCollabSocket for cleanup.
  const cursorThrottleRef = useRef(null)

  // ── Sync remote cursor map → LiveCursors plugin ───────────────────────────
  const { remoteUsers, connectedUsers } = usePresence(id)

  useEffect(() => {
    if (!editor) return
    editor.storage.liveCursors.cursors = remoteUsers
    editor.view.dispatch(
      editor.state.tr.setMeta(cursorPluginKey, { cursors: remoteUsers })
    )
  }, [editor, remoteUsers])

  // ── Data, autosave, version history, collaboration ────────────────────────
  const { title, setTitle } = useDocumentData(id, headers, editor)

  const { saving, lastSaved, saveError, saveDocument } =
    useAutoSave(editor, id, title, headers)

  const {
    showHistoryPanel, setShowHistoryPanel,
    versions, previewingVersion, loadingVersions,
    saveSnapshot, previewVersion, exitPreview, restoreVersion
  } = useVersionHistory(id, headers, editor, saveDocument, setTitle)

  useCollabSocket(id, editor, localUser, setIsConnected)

  // ── Word + character count ────────────────────────────────────────────────
  // State-based to avoid useMemo([editor?.state]) anti-pattern.
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const text = editor.getText()
      setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length)
      setCharCount(text.length)
    }
    editor.on('update', update)
    return () => editor.off('update', update)
  }, [editor])

  // ── Share link helpers ────────────────────────────────────────────────────
  const generateShareLink = async () => {
    setGeneratingLink(true)
    try {
      const res = await axios.post(
        `${API}/documents/${id}/share`,
        { permission: sharePermission },
        { headers }
      )
      setShareUrl(res.data.shareUrl)
    } catch {
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

  // ── Utility formatters ────────────────────────────────────────────────────
  const formatTime = (date) => {
    if (!date) return ''
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateFull = (dateStr) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-[#111318] transition-colors duration-200">

      {/* ── Top header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-200">
        <div className="h-[52px] px-4 flex items-center gap-3 justify-between">

          {/* Left: back button + logo */}
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
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:block">CollabDocs</span>
            </Link>
          </div>

          {/* Right: save status, collaborators, actions */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Connection indicator */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
              isConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40'
            }`}>
              {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isConnected ? '#10b981' : '#ef4444' }} />
            </div>

            {/* Save status */}
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
              {saving ? 'Saving…' : lastSaved ? `Saved ${formatTime(lastSaved)}` : ''}
            </span>

            {/* Live collaborator avatars */}
            {remoteUsers.size > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1">
                {Array.from(remoteUsers.values()).map(user => (
                  <div
                    key={user.socketId}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-[#16181f] shadow-sm -ml-2 first:ml-0 relative group"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
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

            {/* History toggle */}
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

            {/* Share */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              <Share2 size={14} />
              <span className="hidden sm:block">Share</span>
            </button>

            {/* Manual save */}
            <button
              onClick={() => saveDocument().catch(() => {})}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </div>
      </header>

      {/* ── Formatting toolbar ── */}
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

          {/* Word + character count */}
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 pr-1">
            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            <span className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
            <span>{charCount.toLocaleString()} chars</span>
          </div>
        </div>
      </div>

      {/* ── Version preview banner ── */}
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

      {/* ── Main layout: editor + history sidebar ── */}
      <div className="flex pt-[92px] min-h-screen">

        <div className={`flex-1 transition-all duration-300 ${showHistoryPanel ? 'mr-80' : ''}`}>
          <div className={`max-w-[760px] mx-auto px-6 sm:px-8 pb-32 ${previewingVersion ? 'mt-14' : ''}`}>

            {/* Title input */}
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => saveDocument().catch(() => {})}
              disabled={!!previewingVersion}
              className="doc-title-input mt-10 mb-6 w-full disabled:opacity-80"
              placeholder="Untitled Document"
            />

            {/* Editor */}
            <div className={previewingVersion ? 'opacity-80 pointer-events-none grayscale-[20%]' : ''}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* ── Version history sidebar ── */}
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No versions saved yet. Click the button above to create a snapshot.
                </p>
              </div>
            ) : (
              versions.map((v) => {
                const isPreviewing = previewingVersion?.id === v.id
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
                      {isPreviewing && (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                          Previewing
                        </span>
                      )}
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

      {/* ── Share modal ── */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[100] bg-gray-900/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowShareModal(false); setShareUrl('') } }}
        >
          <div className="bg-white dark:bg-[#1e2432] rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700 animate-fade-in-up">
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

      {/* ── Save error banner ── */}
      <SaveErrorBanner
        error={saveError}
        onRetry={() => saveDocument().catch(() => {})}
      />
    </div>
  )
}