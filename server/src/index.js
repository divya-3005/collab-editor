/**
 * Server entry point.
 *
 * Express REST API + Socket.io server for real-time collaborative editing.
 * Sequences ProseMirror steps and manages rooms, presence, and document persistence.
 */

// ── Env & Core ───────────────────────────────────────────────────────────────
import './loadEnv.js'
import express from 'express'
import { createServer } from 'http'

// ── Third-party ──────────────────────────────────────────────────────────────
import { Server } from 'socket.io'
import cors from 'cors'
import passport from 'passport'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'

// ── Local routes ─────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.js'
import documentRoutes from './routes/documents.js'
import googleAuthRoutes from './routes/googleAuth.js'

// ── Persistence ──────────────────────────────────────────────────────────────
import prisma from './lib/prisma.js'

// ── Collaboration module ─────────────────────────────────────────────────────
import {
  getCollabState,
  addSteps,
  getStepsSince,
  evictDocument
} from './ot/collab.js'

// ── App & HTTP server ────────────────────────────────────────────────────────
const app = express()
const httpServer = createServer(app)

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:  process.env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
})

// ── Express middleware ───────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json({ limit: '2mb' }))
app.use(passport.initialize())

// Trust the first proxy (needed for accurate IP-based rate limiting on Render/Heroku)
app.set('trust proxy', 1)

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs:       15 * 60 * 1000, // 15-minute window
  max:            15,
  standardHeaders: true,
  legacyHeaders:  false,
  message: { error: 'Too many attempts. Please try again later.' }
})

const documentLimiter = rateLimit({
  windowMs:       60 * 1000, // 1-minute window
  max:            120,        // generous for autosave (every 3s = 20/min per user)
  standardHeaders: true,
  legacyHeaders:  false,
  message: { error: 'Too many requests. Please slow down.' }
})

// ── REST routes ───────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'ok', uptime: process.uptime() })
  } catch {
    res.status(503).json({ status: 'degraded', db: 'error', uptime: process.uptime() })
  }
})

app.get('/api/status', (req, res) => res.json({ status: 'active' }))

app.use('/api/auth',         authLimiter,     authRoutes)
app.use('/api/auth/google',  authLimiter,     googleAuthRoutes)
app.use('/api/documents',    documentLimiter, documentRoutes)

// ── WebSocket Authentication middleware ───────────────────────────────────────
// Authenticate incoming socket connections via JWT (supports both auth and share tokens)
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      return next(new Error('Authentication required'))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.type === 'auth') {
      socket.data.userId = decoded.userId
      socket.data.tokenType = 'auth'
      return next()
    }

    if (decoded.type === 'share') {
      socket.data.documentId = decoded.documentId
      socket.data.permission = decoded.permission
      socket.data.tokenType = 'share'
      socket.data.userId = `guest-${socket.id.slice(0, 6)}`
      return next()
    }

    return next(new Error('Invalid token type'))
  } catch {
    next(new Error('Invalid or expired token'))
  }
})

// ── Per-socket event rate limiter ─────────────────────────────────────────────
// Tracks event counts in a 1-second sliding window per socket.
// Prevents a buggy or malicious client from flooding the broadcast channel.
const SOCKET_RATE_LIMIT = 60 // max events per second per socket

function makeRateLimiter() {
  let count = 0
  let windowStart = Date.now()

  return function isAllowed() {
    const now = Date.now()
    if (now - windowStart > 1000) {
      count = 0
      windowStart = now
    }
    count++
    return count <= SOCKET_RATE_LIMIT
  }
}

// ── Socket.io real-time events ────────────────────────────────────────────────
io.on('connection', (socket) => {
  const rateLimiter = makeRateLimiter()

  // ── Room management ───────────────────────────────────────────────────────
  // A "room" maps 1:1 to a documentId; broadcasts only reach relevant clients.
  socket.on('join-document', (payload) => {
    try {
      if (!rateLimiter()) return

      const documentId = typeof payload === 'string' ? payload : payload?.documentId
      const user       = typeof payload === 'object'  ? payload?.user : null

      if (!documentId) return

      // Enforce document scope for share tokens
      if (socket.data.tokenType === 'share' && socket.data.documentId !== documentId) {
        return socket.emit('error', 'Unauthorized document access')
      }

      socket.join(documentId)
      socket.data.currentDocumentId = documentId

      if (user) {
        socket.data.user = { ...user, userId: socket.data.userId }
        socket.to(documentId).emit('user-joined', { socketId: socket.id, ...user })
      }

      // Send the current collaboration version so the client knows what steps
      // it may have missed (used in reconnect logic).
      const state = getCollabState(documentId)
      socket.emit('collab-init', { version: state.version })

      const count = io.sockets.adapter.rooms.get(documentId)?.size || 0
      io.to(documentId).emit('user-count', count)
    } catch (err) {
      console.error('join-document error:', err.message)
    }
  })

  // ── Presence ──────────────────────────────────────────────────────────────
  socket.on('get-presence', (documentId) => {
    try {
      if (!rateLimiter()) return
      if (!documentId) return

      const room = io.sockets.adapter.rooms.get(documentId)
      if (!room) return

      const presence = []
      for (const sid of room) {
        if (sid === socket.id) continue
        const peer = io.sockets.sockets.get(sid)
        if (peer?.data?.user) {
          presence.push({ socketId: sid, ...peer.data.user })
        }
      }
      socket.emit('presence-list', presence)
    } catch (err) {
      console.error('get-presence error:', err.message)
    }
  })

  // ── Collaboration step protocol ───────────────────────────────────────────
  // Clients send serialized ProseMirror steps via this event.
  //
  // Payload: { documentId, version, steps: StepJSON[], clientID }
  //
  // The server:
  //  1. Checks the client's version matches the current server version.
  //     If the client is behind, it rejects and asks the client to catch up.
  //  2. Appends the steps with monotonically increasing version numbers.
  //  3. Broadcasts the steps to all peers so they can apply them.
  //  4. Acknowledges the sender with the new version.
  //
  // Conflict resolution is handled entirely on the client using
  // @tiptap/pm/collab (receiveTransaction + sendableSteps). The server is a
  // pure step sequencer — it does not interpret step content.
  socket.on('collab-steps', ({ documentId, version, steps, clientID }) => {
    try {
      if (!rateLimiter()) return
      if (!documentId || !Array.isArray(steps) || steps.length === 0) return

      // Read-only share link users cannot push edits
      if (socket.data.tokenType === 'share' && socket.data.permission !== 'edit') {
        return
      }

      const state = getCollabState(documentId)

      // Version mismatch: client is behind. Tell them to sync first.
      if (version !== state.version) {
        const missing = getStepsSince(documentId, version)
        socket.emit('collab-sync', {
          version:  state.version,
          steps:    missing.steps,
          clientIDs: missing.clientIDs
        })
        return
      }

      // Append steps and advance version
      const newVersion = addSteps(documentId, steps, clientID)

      // Broadcast to peers (everyone except the sender)
      socket.to(documentId).emit('collab-steps', {
        version:   newVersion,
        steps,
        clientID
      })

      // Acknowledge the sender
      socket.emit('collab-ack', { version: newVersion })
    } catch (err) {
      console.error('collab-steps error:', err.message)
    }
  })

  // ── Collab reconnect / catch-up ───────────────────────────────────────────
  // When a client reconnects after a network drop, it sends its last known
  // version. The server responds with all steps since that version.
  socket.on('collab-catch-up', ({ documentId, version }) => {
    try {
      if (!rateLimiter()) return
      if (!documentId) return

      const missing = getStepsSince(documentId, version)
      socket.emit('collab-sync', {
        version:   missing.currentVersion,
        steps:     missing.steps,
        clientIDs: missing.clientIDs
      })
    } catch (err) {
      console.error('collab-catch-up error:', err.message)
    }
  })

  // ── Live cursor positions ─────────────────────────────────────────────────
  socket.on('cursor-move', ({ documentId, position, name, color }) => {
    try {
      if (!rateLimiter()) return
      if (!documentId) return

      socket.to(documentId).emit('cursor-move', {
        socketId: socket.id,
        position,
        name,
        color
      })
    } catch (err) {
      console.error('cursor-move error:', err.message)
    }
  })

  // ── Document Room Chat ────────────────────────────────────────────────────
  socket.on('doc-chat', ({ documentId, text, sender, color }) => {
    try {
      if (!rateLimiter()) return
      if (!documentId || !text?.trim()) return

      const cleanText = text.trim().slice(0, 500)
      io.to(documentId).emit('doc-chat', {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: cleanText,
        sender: sender || 'Collaborator',
        color: color || '#2563eb',
        timestamp: Date.now()
      })
    } catch (err) {
      console.error('doc-chat error:', err.message)
    }
  })

  // ── Version restore broadcast ─────────────────────────────────────────────
  // Emitted by a client (via useVersionHistory) after a successful REST restore.
  // The server resets the in-memory collab state for this document (so all
  // version counters go back to 0) and broadcasts `collab-reset` to all peers
  // so they reload and re-join with the fresh document content.
  socket.on('collab-restore', ({ documentId }) => {
    try {
      if (!rateLimiter()) return
      if (!documentId) return

      // Evict and re-create the collab state → version resets to 0
      evictDocument(documentId)

      // Tell all peers (including the restorer) to reload
      io.to(documentId).emit('collab-reset')
    } catch (err) {
      console.error('collab-restore error:', err.message)
    }
  })

  // ── Disconnect handling ───────────────────────────────────────────────────
  socket.on('disconnecting', () => {
    try {
      for (const room of socket.rooms) {
        if (room === socket.id) continue
        const currentSize = io.sockets.adapter.rooms.get(room)?.size || 0
        const newCount = Math.max(0, currentSize - 1)
        io.to(room).emit('user-count', newCount)
        socket.to(room).emit('user-left', socket.id)
      }
    } catch (err) {
      console.error('disconnecting error:', err.message)
    }
  })

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id)
  })
})

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
})

// ── Graceful shutdown ──────────────────────────────────────────────────────────
const shutdown = () => {
  console.log('SIGTERM received — shutting down gracefully…')
  io.close(() => {
    httpServer.close(() => {
      console.log('Server closed.')
      process.exit(0)
    })
  })
  setTimeout(() => process.exit(1), 10_000)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)

// ── Unhandled error safety nets ────────────────────────────────────────────────
// Log and exit — continuing after an uncaught exception risks undefined state.
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — shutting down:', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason)
  process.exit(1)
})