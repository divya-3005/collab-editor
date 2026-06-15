import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const API = 'http://localhost:3001/api'

export default function Document() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const [title, setTitle] = useState('Untitled Document')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-screen p-8'
      }
    }
  })

  // load document on mount
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await axios.get(`${API}/documents/${id}`, { headers })
        setTitle(res.data.title)
        if (editor && res.data.content) {
          editor.commands.setContent(res.data.content)
        }
      } catch (err) {
        console.error(err)
        navigate('/dashboard')
      }
    }
    if (editor) fetchDoc()
  }, [editor, id])

  // auto save every 2 seconds after changes
  const saveDocument = useCallback(async () => {
    if (!editor) return
    setSaving(true)
    try {
      await axios.patch(`${API}/documents/${id}`, {
        content: editor.getHTML(),
        title
      }, { headers })
      setLastSaved(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }, [editor, id, title])

  useEffect(() => {
    if (!editor) return
    const interval = setInterval(saveDocument, 2000)
    return () => clearInterval(interval)
  }, [saveDocument])

  const formatTime = (date) => {
    if (!date) return ''
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* top bar */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ← Back
          </button>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-sm font-medium text-gray-800 border-none outline-none bg-transparent w-64"
            placeholder="Untitled Document"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {saving ? 'Saving...' : lastSaved ? `Saved at ${formatTime(lastSaved)}` : ''}
          </span>
          <button
            onClick={saveDocument}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>

      {/* toolbar */}
      <div className="fixed top-12 left-0 right-0 bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-2 z-10">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-sm font-bold ${editor?.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          B
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-sm italic ${editor?.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          I
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={`px-2 py-1 rounded text-sm line-through ${editor?.isActive('strike') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          S
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded text-sm font-bold ${editor?.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          H1
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded text-sm font-bold ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          H2
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-sm ${editor?.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          • List
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded text-sm ${editor?.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          1. List
        </button>
      </div>

      {/* editor area */}
      <div className="pt-24 max-w-4xl mx-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}