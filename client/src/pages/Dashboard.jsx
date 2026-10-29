import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Plus, LogOut, FileText, Trash2, Moon, Sun, Search,
  ArrowUpDown, MoreVertical, Star, Copy, Share2, LayoutGrid,
  List as ListIcon, Check, X, Clock
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuthHeaders } from '../hooks/useAuthHeaders.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function getGreeting(name) {
  const hour = new Date().getHours()
  const firstName = (name || 'there').split(' ')[0]
  if (hour < 12) return `Good morning, ${firstName}`
  if (hour < 18) return `Good afternoon, ${firstName}`
  return `Good evening, ${firstName}`
}

function highlightMatch(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-brand/20 text-brand rounded px-0.5 not-italic font-medium">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function UserAvatar({ name }) {
  const initials = (name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div className="w-7 h-7 rounded-md bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 flex items-center justify-center text-[11px] font-bold flex-shrink-0 select-none shadow-xs">
      {initials}
    </div>
  )
}

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1)  return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7)  return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('recent')
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'starred'
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('collab_view_mode') || 'grid')

  // Starred document IDs in localStorage
  const [starredIds, setStarredIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('collab_starred_docs') || '[]')
    } catch {
      return []
    }
  })

  // Quick share state
  const [sharingDoc, setSharingDoc] = useState(null)
  const [sharePermission, setSharePermission] = useState('view')
  const [shareUrl, setShareUrl] = useState('')
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copied, setCopied] = useState(false)

  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const headers = useAuthHeaders()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    localStorage.setItem('collab_view_mode', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('collab_starred_docs', JSON.stringify(starredIds))
  }, [starredIds])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!loading) document.title = `Dashboard — CollabDocs`
  }, [loading])

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API}/documents?limit=500`, { headers })
      const docs = Array.isArray(res.data) ? res.data : res.data?.documents
      setDocuments(docs || [])
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const createDocument = async () => {
    setCreating(true)
    try {
      const res = await axios.post(`${API}/documents`, { title: 'Untitled Document' }, { headers })
      navigate(`/document/${res.data.id}`)
    } catch {
      toast.error('Failed to create document')
      setCreating(false)
    }
  }

  const handleDuplicateDoc = async (id, e) => {
    e.stopPropagation()
    setDuplicatingId(id)
    try {
      const res = await axios.post(`${API}/documents/${id}/duplicate`, {}, { headers })
      setDocuments((docs) => [res.data, ...docs])
      toast.success('Document duplicated')
    } catch {
      toast.error('Failed to duplicate document')
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleDeleteDoc = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await axios.delete(`${API}/documents/${id}`, { headers })
      setDocuments((docs) => docs.filter((d) => d.id !== id))
      setStarredIds((prev) => prev.filter((item) => item !== id))
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleStar = (id, e) => {
    e.stopPropagation()
    setStarredIds((prev) => {
      const isStarred = prev.includes(id)
      if (isStarred) {
        toast('Removed from favorites', { icon: '☆' })
        return prev.filter((item) => item !== id)
      } else {
        toast('Added to favorites', { icon: '⭐' })
        return [...prev, id]
      }
    })
  }

  const handleOpenShare = (doc, e) => {
    e.stopPropagation()
    setSharingDoc(doc)
    setShareUrl('')
    setSharePermission('view')
  }

  const generateShareLink = async () => {
    if (!sharingDoc) return
    setGeneratingLink(true)
    try {
      const res = await axios.post(
        `${API}/documents/${sharingDoc.id}/share`,
        { permission: sharePermission },
        { headers }
      )
      setShareUrl(res.data.shareUrl)
    } catch {
      toast.error('Failed to generate link')
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleCopyShare = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    setShowUserMenu(false)
    if (!window.confirm('Delete your account and all documents permanently?')) return
    try {
      await axios.delete(`${API}/auth/me`, { headers })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/')
    } catch {
      toast.error('Failed to delete account')
    }
  }

  // Filter & sort
  const filteredDocs = documents
    .filter((doc) => {
      const matchesSearch = (doc.title || 'Untitled Document').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTab = filterTab === 'starred' ? starredIds.includes(doc.id) : true
      return matchesSearch && matchesTab
    })
    .sort((a, b) => {
      if (sortOrder === 'title') {
        return (a.title || 'Untitled Document').localeCompare(b.title || 'Untitled Document')
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt)
    })

  const starredCount = documents.filter((d) => starredIds.includes(d.id)).length

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* ── TOP NAV ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm">
            <img src="/logo.svg" alt="CollabDocs" className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-tight">CollabDocs</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-2 p-1 pl-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
              >
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hidden sm:block">
                  {user.name}
                </span>
                <UserAvatar name={user.name} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#18181b] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl py-1 z-50 animate-slide-up origin-top-right">
                  <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{user.name}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <LogOut size={13} /> Sign out
                    </button>
                  </div>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 py-1">
                    <button
                      onClick={handleDeleteAccount}
                      className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 size={13} /> Delete account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 pt-10 pb-20">
        {/* Header Title + New Document Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Documents</h1>
              {!loading && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {documents.length}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{getGreeting(user.name)}</p>
          </div>

          <button
            onClick={createDocument}
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium px-4 py-2 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand shadow-sm disabled:opacity-50"
          >
            <Plus size={15} />
            <span>{creating ? 'Creating…' : 'New document'}</span>
          </button>
        </div>

        {/* ── FILTER BAR & SEARCH ─────────────────────────────────────────── */}
        {!loading && documents.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-fit">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filterTab === 'all'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                All ({documents.length})
              </button>
              <button
                onClick={() => setFilterTab('starred')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filterTab === 'starred'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Star size={12} className={filterTab === 'starred' ? 'fill-amber-400 text-amber-400' : ''} />
                <span>Starred ({starredCount})</span>
              </button>
            </div>

            {/* Search + View & Sort Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search (⌘K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand transition-shadow"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5 rounded"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Sort toggle */}
              <button
                onClick={() => setSortOrder((s) => (s === 'recent' ? 'title' : 'recent'))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title={`Sort: ${sortOrder === 'recent' ? 'Last modified' : 'Alphabetical'}`}
              >
                <ArrowUpDown size={13} />
                <span className="hidden md:inline">{sortOrder === 'recent' ? 'Recent' : 'A-Z'}</span>
              </button>

              {/* View mode toggle (Grid vs List) */}
              <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  title="List view"
                >
                  <ListIcon size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DOCUMENTS LIST / GRID ─────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-[#0e0e11]/50">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4 text-zinc-400 shadow-xs">
              <FileText size={22} />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">No documents yet</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 max-w-sm">
              Create your first rich-text document to experience real-time multi-user collaboration.
            </p>
            <button
              onClick={createDocument}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium px-4 py-2 rounded-lg text-xs transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              <Plus size={14} /> Create document
            </button>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-500">
              {filterTab === 'starred'
                ? 'No starred documents found.'
                : `No documents matching "${searchQuery}"`}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── GRID VIEW ─────────────────────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const isStarred = starredIds.includes(doc.id)
              return (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/document/${doc.id}`)}
                  className="group relative bg-white dark:bg-[#0e0e11] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl p-4.5 cursor-pointer transition-all hover:shadow-md flex flex-col justify-between h-40"
                >
                  {/* Card Header: Icon + Title + Star */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-brand transition-colors">
                        <FileText size={15} />
                      </div>
                      <button
                        onClick={(e) => toggleStar(doc.id, e)}
                        className={`p-1 rounded-md transition-colors ${
                          isStarred
                            ? 'text-amber-400 hover:text-amber-500'
                            : 'text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 opacity-0 group-hover:opacity-100'
                        }`}
                        title={isStarred ? 'Unstar' : 'Star document'}
                      >
                        <Star size={14} className={isStarred ? 'fill-amber-400' : ''} />
                      </button>
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-brand transition-colors">
                      {searchQuery ? highlightMatch(doc.title || 'Untitled Document', searchQuery) : doc.title || 'Untitled Document'}
                    </h3>
                  </div>

                  {/* Card Footer: Timestamp + Quick Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatRelativeDate(doc.updatedAt)}
                    </span>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleOpenShare(doc, e)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Share document"
                      >
                        <Share2 size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDuplicateDoc(doc.id, e)}
                        disabled={duplicatingId === doc.id}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Duplicate document"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        disabled={deletingId === doc.id}
                        className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Delete document"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── LIST VIEW ─────────────────────────────────────────────────── */
          <div className="flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-[#09090b]">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#18181b]/50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <div className="w-5"></div>
              <div>Name</div>
              <div className="w-32 hidden sm:block">Last edited</div>
              <div className="w-20 text-right">Actions</div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredDocs.map((doc) => {
                const isStarred = starredIds.includes(doc.id)
                return (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/document/${doc.id}`)}
                    className="group grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <button
                      onClick={(e) => toggleStar(doc.id, e)}
                      className={`p-1 rounded transition-colors ${
                        isStarred
                          ? 'text-amber-400 hover:text-amber-500'
                          : 'text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Star size={13} className={isStarred ? 'fill-amber-400' : ''} />
                    </button>

                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={16} className="text-zinc-400 flex-shrink-0 group-hover:text-brand transition-colors" />
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-brand transition-colors">
                        {searchQuery ? highlightMatch(doc.title || 'Untitled Document', searchQuery) : doc.title || 'Untitled Document'}
                      </span>
                    </div>

                    <div className="w-32 hidden sm:block text-xs text-zinc-500 truncate">
                      {formatRelativeDate(doc.updatedAt)}
                    </div>

                    <div className="w-20 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleOpenShare(doc, e)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        title="Share"
                      >
                        <Share2 size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDuplicateDoc(doc.id, e)}
                        disabled={duplicatingId === doc.id}
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        disabled={deletingId === doc.id}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── QUICK SHARE MODAL ──────────────────────────────────────────────── */}
      {sharingDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setSharingDoc(null) }}
        >
          <div className="bg-white dark:bg-[#18181b] rounded-xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800 animate-slide-up">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Share document</span>
                <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">{sharingDoc.title}</p>
              </div>
              <button
                onClick={() => setSharingDoc(null)}
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
                    onClick={handleCopyShare}
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
    </div>
  )
}
