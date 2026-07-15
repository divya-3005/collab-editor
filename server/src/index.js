/**
 * Entry point for the CollabDocs server.
 *
 * Architecture:
 *   - Express  → handles REST API routes (auth, documents)
 *   - Socket.io → manages real-time WebSocket connections for collaborative editing
 *   - OT module → applies Operational Transformation so concurrent edits from
 *                  multiple clients never corrupt the document
 *
 * Key flows:
 *   1. A client opens a document → "join-document" event
 *   2. A client types → "content-update" or "operation" event → server broadcasts to peers
 *   3. A client moves the cursor → "cursor-move" event → server relays to peers
 *   4. A client disconnects → "disconnecting" event → server notifies room
 */

// ── Env & Core ──────────────────────────────────────────────────────────────
import './loadEnv.js';
import express from 'express';
import { createServer } from 'http';

// ── Third-party ──────────────────────────────────────────────────────────────
import { Server } from 'socket.io';
import cors from 'cors';
import passport from 'passport';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// ── Local routes ─────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import googleAuthRoutes from './routes/googleAuth.js';

// ── Operational Transformation helpers ──────────────────────────────────────
import { getDocumentState, transformAgainstHistory, applyOperation } from './ot/server.js';

// ── App & HTTP server setup ──────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app); // Socket.io must share the same http.Server as Express

// ── Socket.io configuration ──────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// ── Express middleware ───────────────────────────────────────────────────────
app.use(helmet());                                    // Security headers (HSTS, X-Content-Type, etc.)
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: '1mb' }));              // Prevent oversized payloads
app.use(passport.initialize());                       // Passport is used for the Google OAuth 2.0 strategy

// ── Rate limiting — auth routes only ─────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15-minute window
  max: 15,                     // 15 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

// ── REST routes ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/status', (req, res) => res.json({ status: 'active' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/auth/google', authLimiter, googleAuthRoutes);

// ── Socket.io real-time events ───────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('user connected:', socket.id);

  // ── Room management ─────────────────────────────────────────────────────
  // A "room" maps 1:1 to a documentId so broadcasts only reach relevant clients.
  socket.on('join-document', (payload) => {
    // Payload can be a plain string (legacy) or { documentId, user }
    let documentId, user;
    if (typeof payload === 'string') {
      documentId = payload;
    } else {
      documentId = payload.documentId;
      user = payload.user;
    }

    socket.join(documentId);
    socket.data.currentDocumentId = documentId;

    // Announce the new user to everyone already in the room
    if (user) {
      socket.data.user = user;
      socket.to(documentId).emit('user-joined', { socketId: socket.id, ...user });
    }

    // Tell the joining client what revision the server is at so the OT
    // module can compute which operations it needs to transform against.
    const state = getDocumentState(documentId);
    socket.emit('document-revision', { revision: state.revision });

    // Broadcast updated participant count to the whole room
    const count = io.sockets.adapter.rooms.get(documentId)?.size || 0;
    io.to(documentId).emit('user-count', count);

    console.log(`socket ${socket.id} joined document ${documentId}`);
  });

  // ── Presence ─────────────────────────────────────────────────────────────
  // Lets a newly joined client request the full list of users already online.
  socket.on('get-presence', (documentId) => {
    const room = io.sockets.adapter.rooms.get(documentId);
    if (!room) return;

    const presence = [];
    for (const sid of room) {
      if (sid === socket.id) continue; // Exclude the requester from their own list
      const clientSocket = io.sockets.sockets.get(sid);
      if (clientSocket && clientSocket.data.user) {
        presence.push({ socketId: sid, ...clientSocket.data.user });
      }
    }
    socket.emit('presence-list', presence);
  });

  // ── Operational Transformation ───────────────────────────────────────────
  // Operations from different clients may have been based on different revisions.
  // We transform the incoming op against the history since the client's revision,
  // apply it to the server state, then broadcast the result to peers.
  socket.on('operation', ({ documentId, operation, revision }) => {
    const transformed = transformAgainstHistory(operation, revision, documentId);

    if (transformed === null) {
      // The operation became a no-op after transformation (e.g. two clients
      // deleted the same character). Nothing to broadcast.
      return;
    }

    const newRevision = applyOperation(transformed, documentId);

    // Broadcast the transformed operation to every other client in the room
    socket.to(documentId).emit('operation', {
      operation: transformed,
      revision: newRevision
    });

    // Acknowledge the sender with the new server revision so they can advance
    socket.emit('operation-ack', { revision: newRevision });
  });

  // ── Disconnect handling ──────────────────────────────────────────────────
  // "disconnecting" fires while the socket is still in its rooms, so we can
  // still broadcast to them before the socket is removed.
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room === socket.id) continue; // Skip the socket's own private room

      const currentSize = io.sockets.adapter.rooms.get(room)?.size || 0;
      const newCount = Math.max(0, currentSize - 1);
      io.to(room).emit('user-count', newCount);

      // Remove this user's cursor from all peers
      socket.to(room).emit('user-left', socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });

  // ── Content sync (simple full-document strategy) ─────────────────────────
  // In addition to granular OT operations, clients also sync the full HTML
  // content on every editor update. This is a fallback to keep all clients
  // consistent even if an OT operation is dropped.
  socket.on('content-update', ({ documentId, content }) => {
    socket.to(documentId).emit('content-update', { content });
  });

  // ── Live cursor positions ────────────────────────────────────────────────
  // Each client emits their cursor position (ProseMirror document offset)
  // so peers can render the coloured cursor widget via the LiveCursors extension.
  socket.on('cursor-move', ({ documentId, position, name, color }) => {
    socket.to(documentId).emit('cursor-move', {
      socketId: socket.id,
      position,
      name,
      color
    });
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
// Ensures in-flight requests and socket connections close cleanly on SIGTERM
// (e.g. Docker stop, Render deploys). Without this, connections are killed mid-request.
const shutdown = () => {
  console.log('SIGTERM received — shutting down gracefully…');
  io.close(() => {
    httpServer.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });
  // Force-kill after 10 seconds if connections don't close in time
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);