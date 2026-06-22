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

  socket.on('join-document', (documentId) => {
    socket.join(documentId)
    const state = getDocumentState(documentId)
    // send current revision to client so it knows where it stands
    socket.emit('document-revision', { revision: state.revision })
    
    // Broadcast user count to everyone in the room (including sender)
    const count = io.sockets.adapter.rooms.get(documentId)?.size || 0
    io.to(documentId).emit('user-count', count)
    
    console.log(`socket ${socket.id} joined document ${documentId}`)
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
    // 'disconnecting' fires before it actually leaves, so we can see which rooms it was in.
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        // The socket is about to leave, so the new size will be current size - 1
        const currentSize = io.sockets.adapter.rooms.get(room)?.size || 0
        const newCount = Math.max(0, currentSize - 1)
        io.to(room).emit('user-count', newCount)
      }
    }
  })

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id)
  })
  socket.on('content-update', ({ documentId, content }) => {
    socket.to(documentId).emit('content-update', { content })
  })
})

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});