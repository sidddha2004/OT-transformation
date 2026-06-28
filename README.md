#  Collaborative Sync Engine - OT Transformation

A real-time collaborative editing system built from first principles with proper Operational Transformation (OT) - no Yjs, pure custom implementation.

##  Features

- ** Real-time Collaboration** - Google Docs-style editing with multiple users
- ** Proper OT Transformation** - Custom implementation with queue-based processing  
- ** Fast Sync** - Non-blocking database operations for optimal performance
- ** Conflict Resolution** - Position transformation for concurrent edits
- ** Persistent Storage** - MongoDB with operation history
- ** Multi-user Support** - User presence and cursor tracking
- ** Queue-based Processing** - Serialized operations with version checking

##  Architecture

```
Client → Socket.io → Queue → Version Check → OT Transform → Apply → MongoDB → ACK → Broadcast
```

### Core Components

- **OT Transformer** (`src/services/ot-transformer.ts`) - Handles Insert-Insert, Insert-Delete, Delete-Insert, Delete-Delete transformations
- **Queue Service** (`src/services/otService-queue.ts`) - Manages operation queues per document with version checking
- **Socket Handler** (`src/socket/socketHandler-queue.ts`) - Real-time WebSocket communication
- **Operation Application** (`src/services/apply.ts`) - Applies operations with proper validation

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 5.0+
- TypeScript

### Installation

```bash
npm install
```

### Configuration

Create `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/ot-collaborative-db
PORT=3000
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Testing

Open `http://localhost:3000/client/queue-client.html` in multiple browser windows with different usernames to test real-time collaboration.

##  Testing Scenarios

1. **Concurrent Edits** - Multiple users typing simultaneously
2. **Position Conflicts** - Edits at beginning, middle, and end
3. **Delete Operations** - Backspace/delete synchronization
4. **Race Conditions** - Rapid concurrent operations

##  How It Works

### Operational Transformation Process

1. **Client sends operation** with their current version
2. **Server receives operation** and queues it
3. **Version check** - Finds concurrent operations since client version
4. **OT Transform** - Transforms operation against concurrent ops
5. **Apply** - Applies transformed operation to server state
6. **Persist** - Saves to MongoDB (non-blocking)
7. **ACK & Broadcast** - Confirms to sender and broadcasts to others

### Transformation Rules

- **Insert-Insert** - Adjust position based on concurrent insert length
- **Insert-Delete** - Adjust position based on concurrent delete position
- **Delete-Insert** - Shift delete position based on concurrent insert
- **Delete-Delete** - Adjust position and length based on concurrent delete

##  Learning Path

This project was built phase-by-phase to understand:
1. Basic WebSocket communication
2. Simple operation queuing
3. Version tracking and concurrent operation detection
4. Operational Transformation algorithms
5. Position transformation for accurate conflict resolution
6. Performance optimization with non-blocking operations

##  Project Structure

```
collaborative-sync-engine/
├── client/
│   └── queue-client.html          # Collaborative editing client
├── src/
│   ├── config/
│   │   └── database.ts            # MongoDB configuration
│   ├── middleware/
│   │   └── validation.ts          # Request validation
│   ├── models/
│   │   └── Document.ts            # Document model
│   ├── routes/
│   │   └── documentRoutes.ts      # API routes
│   ├── services/
│   │   ├── apply.ts               # Operation application
│   │   ├── logger.ts              # Logging service
│   │   ├── ot-transformer.ts      # OT transformation engine
│   │   ├── otService-queue.ts     # Queue-based OT service
│   │   └── presenceService.ts     # User presence tracking
│   ├── socket/
│   │   └── socketHandler-queue.ts # Socket.io handler
│   ├── types/
│   │   ├── operation-enhanced.ts  # Operation types
│   │   └── presence.ts            # Presence types
│   └── server.ts                  # Main server
├── package.json
├── tsconfig.json
└── .env
```

##  Tech Stack

- **Backend** - Node.js, Express, Socket.io
- **Database** - MongoDB with Mongoose
- **Frontend** - Vanilla JavaScript, Socket.io client
- **Language** - TypeScript
- **Transformation** - Custom OT implementation

##  Contributing

This is a learning project for understanding Operational Transformation. Feel free to:
- Report issues
- Suggest improvements
- Submit PRs for enhancements

##  License

MIT License - feel free to use this for learning and building your own collaborative systems!

##  Key Achievements

 **Proper OT Implementation** - Custom transformation without external libraries  
 **Queue-based Processing** - Serialized operations with conflict resolution  
 **Real-time Sync** - Fast, reliable multi-user editing  
 **Performance Optimized** - Non-blocking database operations  
 **Production Ready** - Clean, minimal codebase with proper error handling  

---

**Built with ❤️ for learning collaborative systems from first principles**
