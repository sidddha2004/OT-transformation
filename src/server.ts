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
import fs from 'fs';

const possibleClientPaths = [
  path.join(process.cwd(), 'client'),
  path.join(__dirname, '..', '..', 'client'),
  '/opt/render/project/src/client',
  '/opt/render/project/client'
];

let clientPath = possibleClientPaths.find(p => {
  try {
    return fs.existsSync(p) && fs.readdirSync(p).includes('queue-client.html');
  } catch {
    return false;
  }
});

if (!clientPath) {
  console.error('ERROR: Client folder not found!');
  console.error('Searched paths:', possibleClientPaths);
  console.error('Current cwd:', process.cwd());
  clientPath = path.join(process.cwd(), 'client'); // fallback
} else {
  console.log('✅ Serving client files from:', clientPath);
  const files = fs.readdirSync(clientPath);
  console.log('Client files available:', files);
}

app.use(express.static(clientPath));
app.use('/api', router);

// Basic routes
app.get('/', (req, res) => {
  res.redirect('/queue-client.html');
});

// Explicit route for /client/ URLs
app.get('/client/queue-client.html', (req, res) => {
  res.sendFile(path.join(clientPath, 'queue-client.html'));
});

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