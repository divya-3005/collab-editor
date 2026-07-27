/**
 * Socket.io client singleton.
 *
 * Exports a single pre-configured socket instance shared across the entire app.
 * `autoConnect: false` gives page components explicit control — each page calls
 * `socket.connect()` on mount and `socket.disconnect()` on unmount.
 *
 * Authentication: the JWT is passed in `auth.token` at connection time so the
 * server's `io.use()` middleware can verify it before accepting the connection.
 * The token is read from localStorage at module evaluation time. Because the
 * socket is autoConnect: false, the token is re-read on each explicit connect()
 * call via the `auth` option function pattern below.
 */

import { io } from 'socket.io-client'

const API_URL    = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SOCKET_URL = API_URL.replace('/api', '')

const socket = io(SOCKET_URL, {
  autoConnect: false,
  // Provide auth lazily so the current token is used at connect time,
  // not the token that existed when this module was first imported.
  auth: (cb) => cb({ token: localStorage.getItem('token') || '' })
})

export default socket