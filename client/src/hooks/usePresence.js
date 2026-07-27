/**
 * usePresence.js — Live user presence (online list + cursor positions).
 *
 * Responsibilities:
 *  - Maintain a Map of currently connected remote users.
 *  - Handle user-joined, user-left, presence-list, and cursor-move socket events.
 *  - Schedule name label visibility: show the label for 3 seconds after a cursor
 *    move, then hide it. Clear the timer when the user leaves.
 *  - Track total connected user count.
 *
 * Does NOT own: socket connection lifecycle (that is useDocumentSocket's job).
 * This hook only registers event handlers — the socket must be connected before
 * these handlers will fire.
 */

import { useState, useRef, useEffect } from 'react'
import socket from '../socket/socket.js'

/**
 * @param {string|null} documentId — null while the document is still loading
 */
export function usePresence(documentId) {
  const [remoteUsers,     setRemoteUsers]     = useState(new Map())
  const [connectedUsers,  setConnectedUsers]  = useState(0)
  // Map<socketId, timeoutId> — label-hide timers
  const labelTimeoutRefs = useRef(new Map())

  useEffect(() => {
    if (!documentId) return

    const onPresenceList = (users) => {
      setRemoteUsers(prev => {
        const next = new Map(prev)
        users.forEach(u => next.set(u.socketId, { ...u, showLabel: true }))
        return next
      })
    }

    const onUserJoined = (user) => {
      setRemoteUsers(prev => {
        const next = new Map(prev)
        next.set(user.socketId, { ...user, showLabel: true })
        return next
      })
    }

    const onUserLeft = (socketId) => {
      // Cancel any pending label timer for the departing user
      if (labelTimeoutRefs.current.has(socketId)) {
        clearTimeout(labelTimeoutRefs.current.get(socketId))
        labelTimeoutRefs.current.delete(socketId)
      }
      setRemoteUsers(prev => {
        const next = new Map(prev)
        next.delete(socketId)
        return next
      })
    }

    const onCursorMove = (data) => {
      setRemoteUsers(prev => {
        const next     = new Map(prev)
        const existing = next.get(data.socketId) || {}
        next.set(data.socketId, { ...existing, ...data, showLabel: true })
        return next
      })

      // Reset the label-hide timer for this user
      if (labelTimeoutRefs.current.has(data.socketId)) {
        clearTimeout(labelTimeoutRefs.current.get(data.socketId))
      }
      const timeout = setTimeout(() => {
        setRemoteUsers(prev => {
          if (!prev.has(data.socketId)) return prev
          const next = new Map(prev)
          const user = next.get(data.socketId)
          next.set(data.socketId, { ...user, showLabel: false })
          return next
        })
      }, 3000)
      labelTimeoutRefs.current.set(data.socketId, timeout)
    }

    const onUserCount = (count) => setConnectedUsers(count)

    socket.on('presence-list', onPresenceList)
    socket.on('user-joined',   onUserJoined)
    socket.on('user-left',     onUserLeft)
    socket.on('cursor-move',   onCursorMove)
    socket.on('user-count',    onUserCount)

    return () => {
      socket.off('presence-list', onPresenceList)
      socket.off('user-joined',   onUserJoined)
      socket.off('user-left',     onUserLeft)
      socket.off('cursor-move',   onCursorMove)
      socket.off('user-count',    onUserCount)

      // Clear all label timers on unmount
      labelTimeoutRefs.current.forEach(clearTimeout)
      labelTimeoutRefs.current.clear()
    }
  }, [documentId])

  return { remoteUsers, connectedUsers }
}
