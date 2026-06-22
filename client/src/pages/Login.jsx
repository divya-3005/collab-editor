import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard')
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login'
      const payload = isRegister
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email, password: form.password }

      const res = await axios.post(`${API}${endpoint}`, payload)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      toast.success(isRegister ? 'Account created!' : 'Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#111318]">

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col bg-[#0f0e17] relative overflow-hidden flex-shrink-0">
        {/* Subtle gradient orb */}
        <div className="absolute top-1/3 -left-24 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 mb-auto">
            <img src="/logo.svg" alt="CollabDocs" className="h-8 w-auto" />
            <span className="text-white font-semibold text-lg tracking-tight">CollabDocs</span>
          </Link>

          {/* Central message */}
          <div className="py-16">
            <h2 className="text-3xl font-bold text-white mb-4 leading-tight tracking-tight">
              Your collaborative<br />writing workspace
            </h2>
            <p className="text-gray-400 text-base leading-relaxed mb-10">
              Real-time editing, secure sharing, and a clean writing experience — built for teams who value focus.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              {[
                'Real-time multi-user editing',
                'Share with view or edit permissions',
                'Rich text — headings, lists, and more',
                'Google or email sign-in',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial-style quote */}
          <div className="mt-auto border-t border-gray-800 pt-8">
            <p className="text-sm text-gray-500 italic leading-relaxed">
              "Built with Socket.io and Operational Transformation to resolve real-time edit conflicts — the same technique used in Google Docs."
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Back link for mobile */}
        <div className="lg:hidden w-full max-w-sm mb-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
            <ArrowLeft size={15} />
            Back to home
          </Link>
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src="/logo.svg" alt="CollabDocs" className="h-7 w-auto" />
            <span className="font-semibold text-gray-900 dark:text-white tracking-tight">CollabDocs</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            {isRegister ? 'Start collaborating in seconds.' : 'Sign in to your workspace.'}
          </p>

          {/* Google auth — first class */}
          <a
            href={`${API}/auth/google`}
            className="w-full flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all mb-5"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" className="flex-shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </a>

          {/* Divider */}
          <div className="relative flex items-center mb-5">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <span className="mx-3 text-xs text-gray-400 dark:text-gray-600">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Name</label>
                <input
                  type="text"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Password</label>
              <input
                type="password"
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}