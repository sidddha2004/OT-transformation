import express, { Router } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

import { connectDB } from './config/database';
import router from './routes/documentRoutes';
import { SocketHandler } from './socket/socketHandler-queue';

// Connect to database FIRST
connectDB();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from client folder
app.use(express.static(path.join(process.cwd(), 'client')));
app.use('/api', router);

// Basic route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  SocketHandler.handleConnection(socket);
});

// Start server AFTER database connects
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export io instance for testing
export { io };