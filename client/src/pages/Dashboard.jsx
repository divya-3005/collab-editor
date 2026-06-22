import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, LogOut, FileText, Trash2, Moon, Sun, ChevronRight, Users } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function UserAvatar({ name }) {
  const initials = (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
      {initials}
    </div>
  )
}

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      toast.success('Account deleted')
    } catch (err) {
      toast.error('Failed to delete account')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111318] transition-colors duration-200">

      {/* ── Top nav ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#16181f] border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="CollabDocs" className="h-6 w-auto" />
            <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">CollabDocs</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <UserAvatar name={user.name} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">{user.name}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#1e2432] rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg py-1.5 z-50 animate-fade-in-up">
                  <div className="px-3 py-2 mb-1">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3 mb-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg mx-0"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3 my-1" />
                  <button
                    onClick={handleDeleteAccount}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-lg"
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

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Documents</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {loading ? '…' : `${documents.length} document${documents.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={createDocument}
            disabled={creating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-60 shadow-sm hover:shadow-md"
          >
            <Plus size={16} />
            {creating ? 'Creating…' : 'New document'}
          </button>
        </div>

        {/* Document list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white dark:bg-[#16181f] rounded-xl border border-gray-100 dark:border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          /* ── Empty state ── */
          <div className="text-center py-20 px-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5">
              <FileText size={26} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">No documents yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-8 leading-relaxed">
              Create your first document and invite collaborators to edit with you in real time.
            </p>
            <button
              onClick={createDocument}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
            >
              <Plus size={16} />
              Create first document
            </button>
          </div>
        ) : (
          /* ── Document list ── */
          <div className="bg-white dark:bg-[#16181f] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-50 dark:divide-gray-800">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => navigate(`/document/${doc.id}`)}
                className="group flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* Doc icon */}
                <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:border-indigo-200 dark:group-hover:border-indigo-900 group-hover:text-indigo-500 transition-all">
                  <FileText size={17} />
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {doc.title || 'Untitled Document'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Edited {formatRelativeDate(doc.updatedAt)}
                  </p>
                </div>

                {/* Actions */}
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