import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import socket from '../socket/socket.js'

const API = 'http://localhost:3001/api'

export default function SharedDocument() {
  const { shareToken } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [permission, setPermission] = useState('view')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docId, setDocId] = useState(null)

  const isApplyingRemote = { current: false }

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editable: false, // start as read-only
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg mx-auto focus:outline-none min-h-screen p-8'
      }
    }
  })

  useEffect(() => {
    const fetchSharedDoc = async () => {
      try {
        const res = await axios.get(`${API}/documents/shared/${shareToken}`)
        setTitle(res.data.title)
        setPermission(res.data.permission)
        setDocId(res.data.id)

        if (editor) {
          editor.commands.setContent(res.data.content || '')
          // make editable if permission allows
          if (res.data.permission === 'edit') {
            editor.setEditable(true)
          }
        }
      } catch (err) {
        setError('This link is invalid or has expired.')
      } finally {
        setLoading(false)
      }
    }

    if (editor) fetchSharedDoc()
  }, [editor, shareToken])

  // join socket room for real-time sync
  useEffect(() => {
    if (!docId) return

    socket.connect()
    socket.emit('join-document', docId)

    socket.on('content-update', ({ content }) => {
      if (!editor) return
      isApplyingRemote.current = true
      editor.commands.setContent(content, false)
      isApplyingRemote.current = false
    })

    return () => {
      socket.off('content-update')
      socket.disconnect()
    }
  }, [docId, editor])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading document...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <button
          onClick={() => navigate('/login')}
          className="text-blue-600 text-sm hover:underline"
        >
          Go to login
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <span className="text-xl font-semibold text-blue-600">CollabDocs</span>
          <span className="text-sm text-gray-600">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            permission === 'edit'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {permission === 'edit' ? 'Can edit' : 'View only'}
          </span>
        </div>
      </div>

      <div className="pt-16 max-w-4xl mx-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}