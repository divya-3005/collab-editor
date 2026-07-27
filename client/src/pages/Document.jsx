import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { LiveCursors, cursorPluginKey } from '../extensions/LiveCursors.js'
import { Collaboration } from '../extensions/Collaboration.js'
import socket from '../socket/socket.js'
import { useAuthHeaders } from '../hooks/useAuthHeaders.js'
import { useDocumentData } from '../hooks/useDocumentData.js'
import { useAutoSave } from '../hooks/useAutoSave.js'
import { useVersionHistory } from '../hooks/useVersionHistory.js'
import { usePresence } from '../hooks/usePresence.js'
import { useCollabSocket } from '../hooks/useCollabSocket.js'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import {
  Moon, Sun, Share, ArrowLeft, Bold, Italic, Strikethrough,
  Heading1, Heading2, List, ListOrdered, Copy, Check, X,
  History, Clock, RotateCcw, Wifi, WifiOff, Cloud, CloudOff
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function ToolbarBtn({ onClick, active, title, disabled, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
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

  const [showShareModal, setShowShareModal] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [sharePermission, setSharePermission] = useState('view')
  const [copied, setCopied] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

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
    } catch { }
  }, [])

  const isApplyingRemote = useRef(false)
  const cursorThrottleRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
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
        class: 'focus:outline-none',
        'data-placeholder': 'Start typing…',
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

  const { remoteUsers } = usePresence(id)
  useEffect(() => {
    if (!editor) return
    editor.storage.liveCursors.cursors = remoteUsers
    editor.view.dispatch(editor.state.tr.setMeta(cursorPluginKey, { cursors: remoteUsers }))
  }, [editor, remoteUsers])

  const { title, setTitle } = useDocumentData(id, headers, editor)
  const { saving, saveError, saveDocument } = useAutoSave(editor, id, title, headers)
  const { showHistoryPanel, setShowHistoryPanel, versions, previewingVersion, loadingVersions, saveSnapshot, previewVersion, exitPreview, restoreVersion } = useVersionHistory(id, headers, editor, saveDocument, setTitle)
  useCollabSocket(id, editor, localUser, setIsConnected)

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

  const formatDateFull = (dateStr) => new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] transition-colors flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 h-11">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-1 rounded-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <ArrowLeft size={16} />
            </Link>
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">{title || 'Untitled'}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Status indicators */}
            <div className="flex items-center gap-2 mr-2">
              <div className="flex items-center gap-1.5" title={isConnected ? 'Connected' : 'Disconnected'}>
                {isConnected ? <Wifi size={12} className="text-zinc-400" /> : <WifiOff size={12} className="text-red-500" />}
              </div>
              <div className="flex items-center gap-1.5" title={saveError ? 'Save failed' : saving ? 'Saving...' : 'Saved to cloud'}>
                {saveError ? <CloudOff size={12} className="text-red-500" /> : <Cloud size={12} className={saving ? 'text-zinc-400 animate-pulse' : 'text-zinc-400'} />}
              </div>
            </div>

            {/* Avatars */}
            {remoteUsers.size > 0 && (
              <div className="flex items-center mr-2">
                {Array.from(remoteUsers.values()).map(u => (
                  <div key={u.socketId} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white dark:border-[#09090b] -ml-1.5 relative group" style={{ backgroundColor: u.color }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}

            <button onClick={toggleTheme} className="p-1 rounded-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={() => setShowHistoryPanel(!showHistoryPanel)} className={`p-1 rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${showHistoryPanel ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <History size={15} />
            </button>
            <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <Share size={12} /> Share
            </button>
          </div>
        </div>
        
        {/* TOOLBAR */}
        <div className={`border-t border-zinc-200 dark:border-zinc-800 px-4 h-9 flex items-center transition-all ${showHistoryPanel ? 'pr-[320px]' : ''}`}>
          <div className="w-full max-w-[700px] mx-auto flex items-center gap-0.5">
            <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} disabled={!!previewingVersion}><Bold size={14} /></ToolbarBtn>
            <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} disabled={!!previewingVersion}><Italic size={14} /></ToolbarBtn>
            <ToolbarBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} disabled={!!previewingVersion}><Strikethrough size={14} /></ToolbarBtn>
            <ToolbarDivider />
            <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} disabled={!!previewingVersion}><Heading1 size={14} /></ToolbarBtn>
            <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} disabled={!!previewingVersion}><Heading2 size={14} /></ToolbarBtn>
            <ToolbarDivider />
            <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} disabled={!!previewingVersion}><List size={14} /></ToolbarBtn>
            <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} disabled={!!previewingVersion}><ListOrdered size={14} /></ToolbarBtn>
          </div>
        </div>
      </header>

      {/* PREVIEW BANNER */}
      {previewingVersion && (
        <div className={`sticky top-[89px] z-30 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 transition-all ${showHistoryPanel ? 'pr-[320px]' : ''}`}>
          <div className="max-w-[700px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 text-xs font-medium">
              <Clock size={14} /> Previewing {formatDateFull(previewingVersion.createdAt)}
            </div>
            <div className="flex gap-2">
              <button onClick={exitPreview} className="px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
              <button onClick={restoreVersion} className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md">
                <RotateCcw size={12} /> Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WORKSPACE */}
      <div className="flex flex-1 overflow-hidden relative">
        <main className={`flex-1 overflow-y-auto transition-all ${showHistoryPanel ? 'mr-80' : ''}`}>
          <div className="max-w-[700px] mx-auto px-6 py-12">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => saveDocument().catch(() => {})}
              disabled={!!previewingVersion}
              className="doc-title-input mb-8"
              placeholder="Untitled Document"
            />
            <div className={previewingVersion ? 'opacity-50 pointer-events-none' : ''}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </main>

        {/* HISTORY PANEL */}
        <div className={`absolute top-0 right-0 bottom-0 w-80 bg-zinc-50 dark:bg-[#0e0e11] border-l border-zinc-200 dark:border-zinc-800 transition-transform duration-200 flex flex-col z-20 ${showHistoryPanel ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#09090b]">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">History</span>
            <button onClick={() => setShowHistoryPanel(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"><X size={14} /></button>
          </div>
          <div className="p-3 bg-white dark:bg-[#09090b] border-b border-zinc-200 dark:border-zinc-800">
            <button onClick={saveSnapshot} className="w-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 py-1.5 rounded-md transition-colors">
              Save snapshot
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingVersions ? (
              <p className="text-xs text-center text-zinc-500 py-4">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="text-xs text-center text-zinc-500 py-4">No snapshots.</p>
            ) : (
              versions.map((v) => (
                <div key={v.id} onClick={() => previewVersion(v)} className={`p-2 rounded-md cursor-pointer border text-sm transition-colors ${previewingVersion?.id === v.id ? 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600' : 'border-transparent hover:bg-white dark:hover:bg-zinc-900 hover:border-zinc-200 dark:hover:border-zinc-800'}`}>
                  <div className="flex justify-between items-center text-zinc-900 dark:text-zinc-100 font-medium">
                    {new Date(v.createdAt).toLocaleDateString()} <span className="text-[10px] text-zinc-500">v{v.versionNumber}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{new Date(v.createdAt).toLocaleTimeString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false) }}>
          <div className="bg-white dark:bg-[#18181b] rounded-lg shadow-xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800 animate-slide-up">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Share document</span>
              <button onClick={() => setShowShareModal(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Link permissions</label>
                <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-md">
                  {['view', 'edit'].map((perm) => (
                    <button key={perm} onClick={() => { setSharePermission(perm); setShareUrl('') }} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors capitalize ${sharePermission === perm ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                      {perm}
                    </button>
                  ))}
                </div>
              </div>
              {!shareUrl ? (
                <button onClick={generateShareLink} disabled={generatingLink} className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium py-2 rounded-md text-sm">
                  {generatingLink ? 'Generating…' : 'Generate link'}
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2.5 py-2">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex-1 font-mono">{shareUrl}</span>
                  <button onClick={handleCopy} className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors ${copied ? 'bg-brand/10 text-brand' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}>
                    {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}