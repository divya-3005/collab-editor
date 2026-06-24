/**
 * Dashboard.jsx — Authenticated user's document workspace.
 *
 * Features:
 *   - Fixed top navigation with user avatar menu
 *   - Contextual greeting based on time of day
 *   - Full-text document search with highlighted matches
 *   - Document list with staggered fade-in animation
 *   - Skeleton loading state
 *   - Delete with confirmation
 *   - Account management (sign out, delete account)
 */

// ── Imports ───────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, LogOut, FileText, Trash2, Moon, Sun, ChevronRight, Search } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// ── Helper: time-of-day greeting ──────────────────────────────────────────────
/**
 * Returns a greeting string based on the current hour.
 * @param {string} name - The user's display name
 */
function getGreeting(name) {
  const hour = new Date().getHours()
  const firstName = (name || 'there').split(' ')[0]
  if (hour < 12) return `Good morning, ${firstName} ☀️`
  if (hour < 18) return `Good afternoon, ${firstName} 👋`
  return `Good evening, ${firstName} 🌙`
}

// ── Helper: highlight search query in text ────────────────────────────────────
/**
 * Wraps the matching substring in a <mark> element so it appears highlighted.
 * Returns the original string as-is when there is no match.
 */
function highlightMatch(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Helper: user avatar with initials ─────────────────────────────────────────
/**
 * Renders a circular avatar with up to two initials derived from the user's name.
 */
function UserAvatar({ name }) {
  const initials = (name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none shadow-sm">
      {initials}
    </div>
  )
}

// ── Helper: relative date formatting ─────────────────────────────────────────
/**
 * Converts an ISO date string to a short human-readable relative label
 * (e.g. "Just now", "3h ago", "Jun 20").
 */
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Refs ───────────────────────────────────────────────────────────────────
  const menuRef = useRef(null)

  // ── Router / context ───────────────────────────────────────────────────────
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  // ── Auth data from localStorage ────────────────────────────────────────────
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  // ── Fetch documents on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetchDocuments()
  }, [])

  // ── Close user dropdown when clicking outside it ───────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── API: load document list ────────────────────────────────────────────────
  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API}/documents`, { headers })
      setDocuments(res.data)
    } catch (err) {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  // ── API: create new document ───────────────────────────────────────────────
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

  // ── API: delete document ───────────────────────────────────────────────────
  const handleDeleteDoc = async (id, e) => {
    e.stopPropagation() // Prevent row click navigating to the document
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

  // ── Auth: sign out ─────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  // ── API: delete account ────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    setShowUserMenu(false)
    if (!window.confirm('Delete your account and all documents permanently?')) return
    try {
      await axios.delete(`${API}/auth/me`, { headers })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/')
      toast.success('Account deleted')
    } catch (err) {
      toast.error('Failed to delete account')
    }
  }

  // ── Derived: filtered document list ───────────────────────────────────────
  const filteredDocs = documents.filter(doc =>
    (doc.title || 'Untitled Document').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0f14] transition-colors duration-200">

      {/* ── Top navigation ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#111318] border-b border-gray-100 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="CollabDocs" className="h-6 w-auto" />
            <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">CollabDocs</span>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User avatar + dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <UserAvatar name={user.name} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">{user.name}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#1e2432] rounded-xl border border-gray-100 dark:border-white/10 shadow-xl shadow-black/10 py-1.5 z-50 animate-fade-in-up">
                  {/* User info */}
                  <div className="px-3 py-2 mb-1">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="h-px bg-gray-100 dark:bg-white/10 mx-3 mb-1" />

                  {/* Sign out */}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>

                  <div className="h-px bg-gray-100 dark:bg-white/10 mx-3 my-1" />

                  {/* Delete account — destructive action, red colour */}
                  <button
                    onClick={handleDeleteAccount}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={15} />
                    Delete account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-5xl mx-auto px-6 pt-24 pb-16">

        {/* Greeting + page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-0.5">
              {getGreeting(user.name)}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Your Documents</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {loading ? '…' : `${documents.length} document${documents.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Create new document */}
          <button
            onClick={createDocument}
            disabled={creating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 shadow-sm hover:shadow-md hover:shadow-indigo-500/25 hover:-translate-y-0.5"
          >
            <Plus size={16} />
            {creating ? 'Creating…' : 'New document'}
          </button>
        </div>

        {/* Search bar — only shown when there are documents to filter */}
        {!loading && documents.length > 0 && (
          <div className="relative mb-5">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search documents…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-[#161b27] border border-gray-200 dark:border-white/[0.08] rounded-xl text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* ── Document list / loading / empty state ── */}
        {loading ? (
          /* Skeleton loading rows */
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white dark:bg-[#161b27] rounded-xl border border-gray-100 dark:border-white/[0.06] animate-shimmer" />
            ))}
          </div>

        ) : documents.length === 0 ? (
          /* ── Empty state ── */
          <div className="text-center py-24 px-6">
            {/* Gradient ring around the icon */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-400 to-violet-500 opacity-20 blur-lg" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/60 dark:to-violet-950/60 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40">
                <FileText size={32} className="text-indigo-500 dark:text-indigo-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">No documents yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-8 leading-relaxed">
              Create your first document and invite collaborators to edit with you in real time.
            </p>
            <button
              onClick={createDocument}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all hover:shadow-md hover:shadow-indigo-500/25"
            >
              <Plus size={16} />
              Create first document
            </button>
          </div>

        ) : filteredDocs.length === 0 ? (
          /* ── No search results ── */
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No documents matching <span className="font-semibold text-gray-700 dark:text-gray-300">"{searchQuery}"</span>
            </p>
            <button onClick={() => setSearchQuery('')} className="text-xs text-indigo-500 hover:underline mt-2">
              Clear search
            </button>
          </div>

        ) : (
          /* ── Document rows with staggered fade-in ── */
          <div className="bg-white dark:bg-[#161b27] rounded-2xl border border-gray-100 dark:border-white/[0.06] overflow-hidden divide-y divide-gray-50 dark:divide-white/[0.04] shadow-sm">
            {filteredDocs.map((doc, idx) => (
              <div
                key={doc.id}
                onClick={() => navigate(`/document/${doc.id}`)}
                className="group flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                style={{
                  // Stagger each row's entrance animation by 40 ms per row
                  animation: `row-in 0.25s ease-out ${idx * 40}ms both`
                }}
              >
                {/* Document icon — highlights to indigo on row hover */}
                <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-white/[0.06] border border-gray-100 dark:border-white/[0.08] flex items-center justify-center flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:border-indigo-200 dark:group-hover:border-indigo-900 group-hover:text-indigo-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition-all">
                  <FileText size={17} />
                </div>

                {/* Title + timestamp */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {searchQuery
                      ? highlightMatch(doc.title || 'Untitled Document', searchQuery)
                      : doc.title || 'Untitled Document'
                    }
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Edited {formatRelativeDate(doc.updatedAt)}
                  </p>
                </div>

                {/* Row actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => handleDeleteDoc(doc.id, e)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete document"
                  >
                    <Trash2 size={15} />
                  </button>
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-700 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}