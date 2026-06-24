/**
 * Landing.jsx — Public marketing page for CollabDocs.
 *
 * Sections (top to bottom):
 *   - Navbar        fixed, glassmorphism
 *   - Hero          gradient headline, animated orbs, editor preview mock
 *   - Features      6-card grid with hover-lift effect
 *   - How it works  3-step numbered flow
 *   - Tech stack    categorised pill badges
 *   - CTA           final call-to-action with glow card
 *   - Footer        minimal branding line
 */

import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { Moon, Sun, ArrowRight, Users, FileText, Share2, Zap, Lock, Edit3, ExternalLink } from 'lucide-react'

// ── Feature card data ─────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <Users size={20} />,
    color: 'from-indigo-500 to-violet-500',
    title: 'Real-time Collaboration',
    desc: 'Multiple users edit simultaneously. Conflicts resolved automatically with Operational Transformation — the same algorithm used by Google Docs.'
  },
  {
    icon: <Edit3 size={20} />,
    color: 'from-sky-500 to-cyan-500',
    title: 'Rich Text Editing',
    desc: 'Powered by Tiptap and ProseMirror. Bold, headings, lists, code — a full writing experience that feels completely native.'
  },
  {
    icon: <Share2 size={20} />,
    color: 'from-emerald-500 to-teal-500',
    title: 'Secure Sharing',
    desc: 'Generate shareable JWT-signed links with granular permissions. Control who can view or edit, and links expire automatically after 7 days.'
  },
  {
    icon: <Zap size={20} />,
    color: 'from-amber-500 to-orange-500',
    title: 'Live Presence',
    desc: 'See coloured cursor positions of everyone editing in real time. Collaboration indicators update with sub-100 ms latency via Socket.io.'
  },
  {
    icon: <Lock size={20} />,
    color: 'from-rose-500 to-pink-500',
    title: 'Google Auth + Local Auth',
    desc: 'Sign in with Google OAuth 2.0 or traditional email/password. Sessions are secured with signed JWTs and a 7-day expiry.'
  },
  {
    icon: <FileText size={20} />,
    color: 'from-violet-500 to-purple-500',
    title: 'Version History',
    desc: 'Save named snapshots at any point. Preview any past version and restore it in one click — with an automatic audit trail.'
  }
]

const STEPS = [
  { step: '01', title: 'Create a document', desc: 'Click "New Document" from your dashboard. Give it a title and start writing immediately.' },
  { step: '02', title: 'Share with your team', desc: 'Generate a secure share link with view or edit permissions. Send it to anyone — no account required.' },
  { step: '03', title: 'Write together, live', desc: 'Collaborators open the link and edit the same document in real time — no refresh needed, no sync delays.' }
]

// Tech stack grouped by layer so recruiters can see the full architecture at a glance
const TECH_STACK = [
  { label: 'Frontend', items: ['React + Vite', 'Tiptap / ProseMirror', 'Tailwind CSS'] },
  { label: 'Real-time', items: ['Socket.io', 'Operational Transformation'] },
  { label: 'Backend', items: ['Node.js + Express', 'Prisma ORM', 'PostgreSQL'] },
  { label: 'Auth', items: ['Google OAuth 2.0', 'JWT Auth', 'bcrypt'] },
]

export default function Landing() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  // Redirect authenticated users straight to their dashboard
  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard')
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d0f14] font-sans transition-colors duration-200 overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-100 dark:border-white/[0.06] bg-white/80 dark:bg-[#0d0f14]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="CollabDocs" className="h-7 w-auto" />
            <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">CollabDocs</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link to="/login" className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-all hover:shadow-md hover:shadow-indigo-500/25">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">

        {/* Animated gradient orbs — pure CSS, no external images needed */}
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-orb-float absolute top-24 left-1/4 w-96 h-96 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="animate-orb-float absolute top-48 right-1/4 w-80 h-80 bg-violet-400/15 dark:bg-violet-500/10 rounded-full blur-3xl" style={{ animationDelay: '-5s' }} />
          <div className="animate-orb-float absolute bottom-0 left-1/3 w-64 h-64 bg-sky-400/10 dark:bg-sky-500/8 rounded-full blur-3xl" style={{ animationDelay: '-9s' }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">

          {/* "Live" pill badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 border border-indigo-100 dark:border-indigo-900/60">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block presence-dot" />
            Real-time collaboration — live
          </div>

          {/* Headline with gradient accent */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.08] mb-6">
            Write together,{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-300 bg-clip-text text-transparent">
              in real time
            </span>
          </h1>

          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            CollabDocs is a collaborative writing workspace where your team can create, edit, and share rich-text documents simultaneously — built on Operational Transformation.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              Start writing free
              <ArrowRight size={18} />
            </Link>
            <a
              href="https://github.com/divya-3005/collab-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-semibold px-7 py-3.5 rounded-xl text-base border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all hover:-translate-y-0.5"
            >
              <ExternalLink size={17} />
              View on GitHub
            </a>
          </div>
        </div>

        {/* ── Editor preview mock ── */}
        <div className="relative max-w-5xl mx-auto mt-20">
          {/* Soft glow behind the card */}
          <div className="absolute inset-x-8 top-8 bottom-0 bg-indigo-500/10 dark:bg-indigo-500/5 blur-2xl rounded-3xl pointer-events-none" />

          <div className="relative rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl shadow-gray-200/60 dark:shadow-black/40 overflow-hidden bg-white dark:bg-[#161b27]">

            {/* Fake browser chrome */}
            <div className="bg-gray-50 dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/10 px-4 py-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <div className="ml-4 flex-1 bg-white dark:bg-gray-800 rounded-md h-6 flex items-center px-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">collabdocs.vercel.app/document/...</span>
              </div>
              <div className="flex items-center gap-1.5 ml-4">
                {/* Live collaborator avatars */}
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">D</div>
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold -ml-1.5">A</div>
                <div className="flex items-center gap-1 ml-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 presence-dot" />
                  <span className="text-xs text-gray-400">2 live</span>
                </div>
              </div>
            </div>

            {/* Fake editor content */}
            <div className="p-8 sm:p-12">
              <div className="max-w-2xl mx-auto">
                <p className="text-xs text-gray-400 mb-4 font-medium tracking-wide uppercase">Q4 Product Roadmap</p>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Strategic Priorities for Q4</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-3 leading-relaxed text-sm">Our focus this quarter is to ship the collaboration layer, improve onboarding, and prepare for the Series A deck. The team has agreed on three core themes:</p>
                <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 mb-6">
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>Real-time presence and cursor tracking</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>Permission-based sharing with secure JWT links</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>Google OAuth and password-based authentication</li>
                </ul>

                {/* Fake remote cursor to illustrate live collaboration */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-white/80" />
                    Alex is typing…
                  </div>
                </div>

                <div className="h-0.5 bg-gray-100 dark:bg-white/5 w-full mb-4" />
                <p className="text-xs text-gray-400">Last edited just now · Auto-saved ✓</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-gray-100 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-center mb-3">Capabilities</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center tracking-tight mb-4">
            Everything you need to write together
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-xl mx-auto mb-16 text-base">
            Built with the tools that power real-time collaborative products at scale.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat) => (
              <div
                key={feat.title}
                className="group p-6 rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#161b27] hover:border-indigo-200 dark:hover:border-indigo-900/60 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300"
              >
                {/* Gradient icon ring */}
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center mb-5 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-300`}>
                  {feat.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50 dark:bg-[#0d1117] border-y border-gray-100 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-center mb-3">Workflow</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center tracking-tight mb-16">
            Collaborate in three steps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {STEPS.map((step) => (
              <div key={step.step} className="flex flex-col">
                <span className="text-5xl font-extrabold bg-gradient-to-br from-indigo-200 to-indigo-50 dark:from-indigo-900 dark:to-[#0d1117] bg-clip-text text-transparent mb-5 select-none">
                  {step.step}
                </span>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-10">Built with</p>
          <div className="space-y-5">
            {TECH_STACK.map(({ label, items }) => (
              <div key={label} className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest w-20 text-right flex-shrink-0 hidden sm:block">
                  {label}
                </span>
                {items.map((tech) => (
                  <span key={tech} className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-white/[0.08] hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                    {tech}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-2xl mx-auto text-center">
          {/* Glassmorphism glow card */}
          <div className="relative rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 p-px shadow-2xl shadow-indigo-500/40">
            <div className="rounded-[23px] bg-gradient-to-br from-indigo-600 to-violet-700 px-10 py-14">
              {/* Background orb for depth */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-violet-400/20 rounded-full blur-2xl" />
              </div>
              <h2 className="relative text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                Ready to start writing?
              </h2>
              <p className="relative text-indigo-200 mb-8 text-base">
                Create your first document in seconds. No credit card required.
              </p>
              <Link
                to="/login"
                className="relative inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
              >
                Get started — it's free
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 dark:border-white/[0.06] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="CollabDocs" className="h-5 w-auto" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">CollabDocs</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Built with Socket.io &amp; Operational Transformation · Portfolio project by Divya Singh
          </p>
        </div>
      </footer>
    </div>
  )
}
