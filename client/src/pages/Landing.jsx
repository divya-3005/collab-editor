import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { Moon, Sun, ArrowRight, Users, FileText, Share2, Zap, Lock, Edit3 } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard')
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-white dark:bg-[#111318] font-sans transition-colors duration-200">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#111318]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="CollabDocs" className="h-7 w-auto" />
            <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">CollabDocs</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link to="/login" className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 border border-indigo-100 dark:border-indigo-900">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block presence-dot"></span>
            Real-time collaboration — live
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white tracking-tight leading-[1.1] mb-6">
            Write together,{' '}
            <span className="text-indigo-600 dark:text-indigo-400">in real time</span>
          </h1>

          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            CollabDocs is a collaborative writing workspace where your team can create, edit, and share rich-text documents simultaneously — no refresh needed.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-950"
            >
              Start writing free
              <ArrowRight size={18} />
            </Link>
            <a
              href="https://github.com/divya-3005/collab-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-semibold px-6 py-3 rounded-xl text-base border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Editor Preview */}
        <div className="max-w-5xl mx-auto mt-20">
          <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl shadow-gray-200/60 dark:shadow-none overflow-hidden bg-white dark:bg-[#1a1f2e]">
            {/* Fake browser chrome */}
            <div className="bg-gray-50 dark:bg-[#0d1117] border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400"></span>
              <span className="w-3 h-3 rounded-full bg-amber-400"></span>
              <span className="w-3 h-3 rounded-full bg-green-400"></span>
              <div className="ml-4 flex-1 bg-white dark:bg-gray-800 rounded-md h-6 flex items-center px-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">collabdocs.vercel.app/document/...</span>
              </div>
              <div className="flex items-center gap-1.5 ml-4">
                <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">D</span>
                <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">A</span>
                <span className="text-xs text-gray-400 ml-1">2 live</span>
              </div>
            </div>
            {/* Fake editor content */}
            <div className="p-8 sm:p-12">
              <div className="max-w-2xl mx-auto">
                <p className="text-xs text-gray-400 mb-4 font-medium tracking-wide uppercase">Q4 Product Roadmap</p>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Strategic Priorities for Q4</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-3 leading-relaxed text-sm">Our focus this quarter is to ship the collaboration layer, improve onboarding, and prepare for the Series A deck. The team has agreed on three core themes:</p>
                <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>Real-time presence and cursor tracking</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>Permission-based sharing with secure JWT links</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>Google OAuth and password-based authentication</li>
                </ul>
                <div className="h-0.5 bg-gray-100 dark:bg-gray-700 w-full mb-4"></div>
                <p className="text-xs text-gray-400">Last edited just now · Auto-saved</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-center mb-3">Capabilities</p>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center tracking-tight mb-4">Everything you need to write together</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-xl mx-auto mb-16 text-base">
            Built with the tools that power real-time collaborative products at scale.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Users size={20} />,
                title: 'Real-time Collaboration',
                desc: 'Multiple users can edit the same document simultaneously. Conflicts resolved automatically with Operational Transformation.'
              },
              {
                icon: <Edit3 size={20} />,
                title: 'Rich Text Editing',
                desc: 'Powered by Tiptap and ProseMirror. Bold, headings, lists, code — a full writing experience that feels native.'
              },
              {
                icon: <Share2 size={20} />,
                title: 'Secure Sharing',
                desc: 'Generate shareable links with granular permissions. Control who can view or edit your documents.'
              },
              {
                icon: <Zap size={20} />,
                title: 'Live Presence',
                desc: 'See who is currently editing in real time. Collaboration indicators let you know your team is active.'
              },
              {
                icon: <Lock size={20} />,
                title: 'Google Auth + Local Auth',
                desc: 'Sign in with Google OAuth or a traditional email/password. Your session is secured with JWTs.'
              },
              {
                icon: <FileText size={20} />,
                title: 'Document Workspace',
                desc: 'Manage all your owned and shared documents from a clean dashboard. Create, open, and delete with ease.'
              }
            ].map((feat) => (
              <div key={feat.title} className="group p-6 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1f2e] hover:border-indigo-200 dark:hover:border-indigo-900 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950 transition-colors">
                  {feat.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-6 bg-gray-50 dark:bg-[#0d1117] border-y border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-center mb-3">Workflow</p>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center tracking-tight mb-16">
            Collaborate in three steps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create a document', desc: 'Click "New Document" from your dashboard. Give it a title and start writing immediately.' },
              { step: '02', title: 'Share with your team', desc: 'Generate a secure share link with view or edit permissions. Send it to anyone.' },
              { step: '03', title: 'Write together, live', desc: 'Your collaborators open the link and edit the same document in real time — no sync delays.' }
            ].map((step) => (
              <div key={step.step} className="flex flex-col">
                <span className="text-4xl font-bold text-indigo-100 dark:text-indigo-950 mb-4 select-none">{step.step}</span>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="py-16 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-8">Built with</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['React + Vite', 'Socket.io', 'Operational Transformation', 'Tiptap / ProseMirror', 'Node.js + Express', 'Prisma ORM', 'PostgreSQL', 'Google OAuth 2.0', 'JWT Auth', 'Tailwind CSS'].map((tech) => (
              <span key={tech} className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Footer ── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">
            Ready to start writing?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-base">
            Create your first document in seconds. No credit card required.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-950"
          >
            Get started — it's free
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 dark:border-gray-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="CollabDocs" className="h-5 w-auto" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">CollabDocs</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Built with Socket.io & Operational Transformation · Portfolio project
          </p>
        </div>
      </footer>
    </div>
  )
}
