import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const user = params.get('user')

    if (token && user) {
      localStorage.setItem('token', token)
      localStorage.setItem('user', user)
      navigate('/dashboard')
    } else {
      // Guard against React 18 StrictMode double-mount clearing search params on second run
      if (localStorage.getItem('token') && localStorage.getItem('user')) {
        navigate('/dashboard')
      } else {
        navigate('/login')
      }
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Signing you in...</p>
    </div>
  )
}