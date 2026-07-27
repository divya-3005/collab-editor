/**
 * AuthCallback.jsx — OAuth post-redirect handler.
 *
 * After a successful Google OAuth flow, the server redirects to:
 *   /auth/callback?code=<hex>&user=<JSON>
 *
 * This page:
 *  1. Reads the ?code param from the URL.
 *  2. POSTs it to POST /api/auth/google/exchange to receive the JWT in the
 *     response body (never in the URL, preventing browser-history leakage).
 *  3. Stores the token + user in localStorage and navigates to /dashboard.
 *
 * The ?user param carries display-only data (name, email) and is not trusted
 * for auth — the authoritative identity comes from the server via the exchange.
 *
 * If the code is missing or the exchange fails, the user is redirected to /login.
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function AuthCallback() {
  const navigate      = useNavigate()
  const hasExchanged  = useRef(false)  // guard against React 18 double-mount

  useEffect(() => {
    // Guard: only run the exchange once (React 18 StrictMode mounts effects twice)
    if (hasExchanged.current) return
    hasExchanged.current = true

    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    const user   = params.get('user')

    if (!code) {
      // No code: either a legacy URL with a direct ?token param (old flow),
      // or the user navigated here directly. Fall back to login.
      const legacyToken = params.get('token')
      if (legacyToken && user) {
        // Legacy path — still functional; will be removed once all sessions expire
        localStorage.setItem('token', legacyToken)
        localStorage.setItem('user', user)
        navigate('/dashboard', { replace: true })
      } else if (localStorage.getItem('token')) {
        // Already signed in (e.g. page refresh after auth)
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
      return
    }

    // Exchange the one-time code for the JWT
    axios
      .post(`${API}/auth/google/exchange`, { code })
      .then(res => {
        const { token } = res.data
        localStorage.setItem('token', token)
        // User display data comes from the ?user param (JSON-encoded)
        if (user) {
          try {
            localStorage.setItem('user', user)
          } catch { /* non-critical — dashboard fetches user from token */ }
        }
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        // Exchange failed (code expired, already used, or server error)
        navigate('/login', { replace: true })
      })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111318]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-400 dark:text-gray-500">Signing you in…</p>
      </div>
    </div>
  )
}