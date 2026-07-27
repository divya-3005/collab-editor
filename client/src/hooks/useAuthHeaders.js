/**
 * useAuthHeaders.js — Shared hook for authenticated Axios request headers.
 *
 * Centralises the pattern of reading the JWT from localStorage and building
 * the Authorization header object. Using a hook (rather than declaring headers
 * inline in each component) ensures:
 *  - A single place to change auth transport if we ever switch from localStorage
 *    to HTTP-only cookies or another mechanism.
 *  - The headers object is memoised and does not re-create on every render.
 */

import { useMemo } from 'react'

/**
 * @returns {{ Authorization: string }} — Memoised Axios-compatible headers object.
 */
export function useAuthHeaders() {
  const token = localStorage.getItem('token') || ''
  return useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  )
}
