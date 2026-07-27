import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { Moon, Sun, ArrowRight, Users, FileText, Share2, Zap, Lock, Edit3, ExternalLink } from 'lucide-react'

// ── Feature card data ─────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <Users size={18} className="text-zinc-900 dark:text-zinc-100" />,
    title: 'Real-time Collaboration',
    desc: 'Multiple users edit simultaneously. Conflicts resolved automatically with Operational Transformation — the same algorithm used by Google Docs.'
  },
  {
    icon: <Edit3 size={18} className="text-zinc-900 dark:text-zinc-100" />,
    title: 'Rich Text Editing',
    desc: 'Powered by Tiptap and ProseMirror. Bold, headings, lists, code — a full writing experience that feels completely native.'
  },
  {
    icon: <Share2 size={18} className="text-zinc-900 dark:text-zinc-100" />,
    title: 'Secure Sharing',
    desc: 'Generate shareable JWT-signed links with granular permissions. Control who can view or edit, and links expire automatically.'
  },
  {
    icon: <Zap size={18} className="text-zinc-900 dark:text-zinc-100" />,
    title: 'Live Presence',
    desc: 'See cursor positions of everyone editing in real time. Collaboration indicators update with sub-100 ms latency.'
  },
  {
    icon: <Lock size={18} className="text-zinc-900 dark:text-zinc-100" />,
    title: 'Secure Authentication',
    desc: 'Sign in with Google OAuth 2.0 or traditional email/password. Sessions are secured with signed JWTs and a 7-day expiry.'
  },
  {
    icon: <FileText size={18} className="text-zinc-900 dark:text-zinc-100" />,
    title: 'Version History',
    desc: 'Save named snapshots at any point. Preview any past version and restore it in one click — with an automatic audit trail.'
  }
]

export default function Landing() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard')
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 selection:bg-brand/20 transition-colors">
      
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-colors">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="CollabDocs" className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-tight">CollabDocs</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <button
              onClick={toggleTheme}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/login" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm">
              Log in
            </Link>
            <Link to="/login" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#09090b]">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-20 px-6 max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Operational Transformation enabled
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 max-w-3xl mb-6 leading-[1.1] animate-slide-up">
            Write together, <br className="hidden sm:block" />in real time.
          </h1>
          
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: '50ms' }}>
            CollabDocs is a collaborative writing workspace engineered for speed and focus. Create, edit, and share rich-text documents without friction.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium px-6 py-2.5 rounded-lg text-sm transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#09090b]"
            >
              Get started
              <ArrowRight size={16} />
            </Link>
            <a
              href="https://github.com/divya-3005/collab-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium px-6 py-2.5 rounded-lg text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#09090b]"
            >
              <ExternalLink size={16} />
              View source
            </a>
          </div>
        </div>
      </section>

      {/* ── Editor Mockup ────────────────────────────────────────────────── */}
      <section className="px-6 pb-32 max-w-5xl mx-auto animate-slide-up" style={{ animationDelay: '150ms' }}>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0e0e11] shadow-sm overflow-hidden flex flex-col h-[500px]">
          {/* Mock Header */}
          <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 justify-between bg-zinc-50/50 dark:bg-[#18181b]/50">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                <FileText size={12} className="text-zinc-500" />
              </div>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Product Strategy Q4</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold border border-blue-200">A</div>
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold border border-emerald-200 -ml-1.5">D</div>
            </div>
          </div>
          {/* Mock Content */}
          <div className="p-10 flex-1 overflow-hidden relative">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 tracking-tight">Q4 Objectives</h1>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              Our primary focus for this quarter is stabilizing the collaboration layer and improving the core writing experience. We will be transitioning from a character-based OT engine to a ProseMirror step-based architecture.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-400">
              <li>Implement sticky toolbars for better UX.</li>
              <li>Refine the design system to a neutral palette.</li>
              <li className="relative">
                <span className="bg-brand/10 text-zinc-900 dark:text-zinc-100">Ensure WCAG AA compliance across all views.</span>
                {/* Mock cursor */}
                <div className="absolute -top-3.5 left-0 bg-brand text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] rounded-bl-none">
                  Alex
                </div>
                <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-brand" />
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#18181b] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-3">Designed for focus</h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl text-lg">Every feature is built to get out of your way and let you write.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feat) => (
              <div key={feat.title} className="flex flex-col">
                <div className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#09090b] flex items-center justify-center mb-4 shadow-sm">
                  {feat.icon}
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{feat.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-10 bg-white dark:bg-[#09090b]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="CollabDocs" className="h-5 w-auto grayscale opacity-80" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">CollabDocs</span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            A real-time workspace · Built by Divya Singh
          </p>
        </div>
      </footer>
    </div>
  )
}
