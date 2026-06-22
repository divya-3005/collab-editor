import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, LogOut, FileText, Trash2, Moon, Sun, Settings, ChevronRight } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function Dashboard() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const token = localStorage.getItem('token')

  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchDocuments()
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
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteDoc = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this document?')) return
    try {
      await axios.delete(`${API}/documents/${id}`, { headers })
      setDocuments(documents.filter(d => d.id !== id))
      toast.success('Document deleted')
    } catch (err) {
      toast.error('Failed to delete document')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure you want to delete your account? This action cannot be undone and will delete all your documents.')) {
      return
    }
    try {
      await axios.delete(`${API}/auth/me`, { headers })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/login')
      toast.success('Account deleted successfully')
    } catch (err) {
      toast.error('Failed to delete account')
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-6 w-auto" />
          <h1 className="text-xl font-semibold text-blue-600 dark:text-blue-400">CollabDocs</h1>
        </div>
        <div className="flex items-center gap-4 relative">
          <button onClick={toggleTheme} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
          
          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{user.name}</span>
          
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <Settings size={20} />
            </button>
            {showSettings && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-20">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <LogOut size={16} /> Sign out
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                <button
                  onClick={handleDeleteAccount}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={16} /> Delete Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Your Documents</h2>
          <button
            onClick={createDocument}
            disabled={creating}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={16} /> {creating ? 'Creating...' : 'New Document'}
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
              <FileText size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No documents yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              Create your first document to start collaborating with your team in real-time.
            </p>
            <button
              onClick={createDocument}
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Create your first document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => (
              <div
                key={doc.id}
                onClick={() => navigate(`/document/${doc.id}`)}
                className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-center justify-between cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{doc.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Updated {formatDate(doc.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDeleteDoc(doc.id, e)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}