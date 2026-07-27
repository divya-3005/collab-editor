import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, LogOut, FileText, Trash2, Moon, Sun, ChevronRight, Search, ArrowUpDown, MoreVertical } from 'lucide-react'
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
      <mark className="bg-brand/20 text-brand rounded px-0.5 not-italic">
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
    <div className="w-7 h-7 rounded-md bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 flex items-center justify-center text-[11px] font-bold flex-shrink-0 select-none">
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
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('recent')

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
    } catch (err) {
      toast.error('Failed to create document')
      setCreating(false)
    }
  }

  const handleDeleteDoc = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await axios.delete(`${API}/documents/${id}`, { headers })
      setDocuments(docs => docs.filter(d => d.id !== id))
      toast.success('Document deleted')
    } catch (err) {
      toast.error('Failed to delete document')
    } finally {
      setDeletingId(null)
    }
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
    } catch (err) {
      toast.error('Failed to delete account')
    }
  }

  const filteredDocs = documents
    .filter(doc => (doc.title || 'Untitled Document').toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'title') {
        return (a.title || 'Untitled Document').localeCompare(b.title || 'Untitled Document')
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt)
    })

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm">
            <img src="/logo.svg" alt="CollabDocs" className="h-5 w-auto" />
            <span className="text-sm font-semibold tracking-tight">CollabDocs</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 p-1 pl-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
              >
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hidden sm:block">{user.name}</span>
                <UserAvatar name={user.name} />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#18181b] rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm py-1 z-50 animate-slide-up origin-top-right">
                  <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{user.name}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <button onClick={handleLogout} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
                      <LogOut size={13} /> Sign out
                    </button>
                  </div>
                  <div className="border-t border-zinc-100 dark:border-zinc-800/50 py-1">
                    <button onClick={handleDeleteAccount} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                      <Trash2 size={13} /> Delete account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 pt-12 pb-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">Documents</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{getGreeting(user.name)}</p>
          </div>
          <button
            onClick={createDocument}
            disabled={creating}
            className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium px-4 py-2 rounded-md text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#09090b] disabled:opacity-50"
          >
            <Plus size={16} />
            {creating ? 'Creating…' : 'New document'}
          </button>
        </div>

        {/* Search & Filters */}
        {!loading && documents.length > 0 && (
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search (⌘K)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-sm bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand transition-shadow"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => setSortOrder(s => s === 'recent' ? 'title' : 'recent')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ArrowUpDown size={13} />
              <span className="hidden sm:inline">{sortOrder === 'recent' ? 'Recent' : 'Alphabetical'}</span>
            </button>
          </div>
        )}

        {/* Document List */}
        {loading ? (
          <div className="space-y-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-zinc-100 dark:bg-zinc-800/50 rounded-md animate-shimmer" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 text-zinc-400">
              <FileText size={24} />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">No documents</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 max-w-xs">Create a new document to start collaborating with your team.</p>
            <button
              onClick={createDocument}
              className="flex items-center gap-2 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium px-4 py-2 rounded-md text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Plus size={14} /> New document
            </button>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-zinc-500">No documents found for "{searchQuery}"</p>
          </div>
        ) : (
          <div className="flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-[#09090b]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#18181b]/50 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <div>Name</div>
              <div className="w-32 hidden sm:block">Last edited</div>
              <div className="w-8"></div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/document/${doc.id}`)}
                  className="group grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} className="text-zinc-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-brand transition-colors">
                      {searchQuery ? highlightMatch(doc.title || 'Untitled Document', searchQuery) : doc.title || 'Untitled Document'}
                    </span>
                  </div>
                  <div className="w-32 hidden sm:block text-xs text-zinc-500 truncate">
                    {formatRelativeDate(doc.updatedAt)}
                  </div>
                  <div className="w-8 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDeleteDoc(doc.id, e)}
                      disabled={deletingId === doc.id}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:opacity-100"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}