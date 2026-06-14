import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';

dotenv.config();

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

app.use('/api/documents', documentRoutes);

io.on('connection', (socket) => {
  console.log('user connected:', socket.id);

  socket.on('join-document', (documentId) => {
    socket.join(documentId);
    console.log(`socket ${socket.id} joined document ${documentId}`);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});