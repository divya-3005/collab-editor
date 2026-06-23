import './loadEnv.js';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import passport from 'passport'
import googleAuthRoutes from './routes/googleAuth.js'


const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use(passport.initialize())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

app.use('/api/documents', documentRoutes);

app.use('/api/auth/google', googleAuthRoutes);

import { getDocumentState, transformAgainstHistory, applyOperation } from './ot/server.js'

io.on('connection', (socket) => {
  console.log('user connected:', socket.id)

  socket.on('join-document', (payload) => {
    let documentId, user
    if (typeof payload === 'string') {
      documentId = payload
    } else {
      documentId = payload.documentId
      user = payload.user
    }

    socket.join(documentId)
    socket.data.currentDocumentId = documentId
    
    if (user) {
      socket.data.user = user
      socket.to(documentId).emit('user-joined', { socketId: socket.id, ...user })
    }

    const state = getDocumentState(documentId)
    // send current revision to client so it knows where it stands
    socket.emit('document-revision', { revision: state.revision })
    
    // Broadcast user count to everyone in the room (including sender)
    const count = io.sockets.adapter.rooms.get(documentId)?.size || 0
    io.to(documentId).emit('user-count', count)
    
    console.log(`socket ${socket.id} joined document ${documentId}`)
  })

  // When a client explicitly requests the list of connected users
  socket.on('get-presence', (documentId) => {
    const room = io.sockets.adapter.rooms.get(documentId)
    if (!room) return
    
    const presence = []
    for (const sid of room) {
      if (sid === socket.id) continue // Don't send the user their own presence
      const clientSocket = io.sockets.sockets.get(sid)
      if (clientSocket && clientSocket.data.user) {
        presence.push({ socketId: sid, ...clientSocket.data.user })
      }
    }
    socket.emit('presence-list', presence)
  })

  socket.on('operation', ({ documentId, operation, revision }) => {

    // transform against any operations that happened since client's revision
    const transformed = transformAgainstHistory(operation, revision, documentId)

    if (transformed === null) {
      // op became a no-op after transformation, nothing to do
      return
    }

    // apply to server state and get new revision
    const newRevision = applyOperation(transformed, documentId)

    // broadcast transformed op to everyone else in the room
    socket.to(documentId).emit('operation', {
      operation: transformed,
      revision: newRevision
    })

    // ack back to sender with new revision
    socket.emit('operation-ack', { revision: newRevision })
  })

  socket.on('disconnecting', () => {
    // When a socket disconnects, it leaves all its rooms.
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        const currentSize = io.sockets.adapter.rooms.get(room)?.size || 0
        const newCount = Math.max(0, currentSize - 1)
        io.to(room).emit('user-count', newCount)
        
        // Broadcast user-left so clients can remove their cursor
        socket.to(room).emit('user-left', socket.id)
      }
    }
  })

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id)
  })

  socket.on('content-update', ({ documentId, content }) => {
    socket.to(documentId).emit('content-update', { content })
  })

  socket.on('cursor-move', ({ documentId, position, name, color }) => {
    socket.to(documentId).emit('cursor-move', { 
      socketId: socket.id, 
      position, 
      name, 
      color 
    })
  })
})

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});