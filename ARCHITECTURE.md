# 🏗️ Architecture Diagram - Collaborative Sync Engine

## Complete System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Client1["👤 User 1 Browser"]
        Client2["👤 User 2 Browser"]
        Client3["👤 User N Browser"]
        Editor["📝 Text Editor<br/>queue-client.html"]
        DiffEngine["🔍 Operation Detection<br/>Diff Algorithm"]
    end

    subgraph "Real-time Communication Layer"
        SocketIO["🔌 Socket.io Server<br/>WebSocket Handler"]
        ClientSocket["🔌 Socket.io Client"]
    end

    subgraph "Queue Processing Layer"
        OperationQueue["📋 Operation Queue<br/>FIFO Processing"]
        VersionChecker["🔍 Version Checker<br/>Find Concurrent Ops"]
        OTTransformer["🔄 OT Transformer<br/>Position Transformation"]
        OperationApplier["⚡ Operation Applier<br/>Apply to State"]
    end

    subgraph "State Management Layer"
        DocumentState["📄 Document State<br/>Content + Version"]
        OperationHistory["📚 Operation History<br/>All Operations"]
        PresenceTracker["👥 Presence Service<br/>Users + Cursors"]
    end

    subgraph "Persistence Layer"
        MongoDB["💾 MongoDB<br/>Document Collection"]
    end

    subgraph "API Layer"
        ExpressAPI["🚀 Express API<br/>REST Routes"]
        DocumentRoutes["📝 Document Routes<br/>CRUD Operations"]
    end

    %% Client connections
    Client1 --> ClientSocket
    Client2 --> ClientSocket
    Client3 --> ClientSocket
    Editor --> DiffEngine
    DiffEngine --> ClientSocket

    %% Socket.io communication
    ClientSocket <-->|"WebSocket<br/>Real-time"| SocketIO

    %% Operation flow (Client to Server)
    SocketIO -->|"1. receive operation<br/>with clientVersion"| OperationQueue
    OperationQueue -->|"2. next operation"| VersionChecker
    VersionChecker -->|"3. concurrent ops"| OTTransformer
    OTTransformer -->|"4. transformed op"| OperationApplier

    %% State updates
    OperationApplier -->|"5. update state"| DocumentState
    OperationApplier -->|"6. append to history"| OperationHistory
    OperationApplier -->|"7. broadcast to all"| SocketIO

    %% Persistence (non-blocking)
    DocumentState -->|"async save"| MongoDB
    OperationHistory -->|"async save"| MongoDB

    %% Socket.io broadcasts back to clients
    SocketIO -->|"8. broadcast operation<br/>with server content"| ClientSocket
    ClientSocket -->|"9. sync editor"| Editor

    %% Presence system
    SocketIO --> PresenceTracker
    PresenceTracker -->|"user/cursor updates"| SocketIO

    %% REST API
    ExpressAPI --> DocumentRoutes
    DocumentRoutes --> MongoDB
    Client1 -->|"HTTP REST"| ExpressAPI
    Client2 -->|"HTTP REST"| ExpressAPI

    %% Styling
    classDef clientStyle fill:#e8f4f8,stroke:#3b82f6,stroke-width:2px
    classDef realtimeStyle fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    classDef queueStyle fill:#d1fae5,stroke:#10b981,stroke-width:2px
    classDef stateStyle fill:#e0e7ff,stroke:#6366f1,stroke-width:2px
    classDef dbStyle fill:#fee2e2,stroke:#ef4444,stroke-width:2px
    classDef apiStyle fill:#fce7f3,stroke:#ec4899,stroke-width:2px

    class Client1,Client2,Client3,Editor,DiffEngine clientStyle
    class SocketIO,ClientSocket realtimeStyle
    class OperationQueue,VersionChecker,OTTransformer,OperationApplier queueStyle
    class DocumentState,OperationHistory,PresenceTracker stateStyle
    class MongoDB dbStyle
    class ExpressAPI,DocumentRoutes apiStyle
```

## Operation Flow Detail

```mermaid
sequenceDiagram
    participant User1 as 👤 User 1
    participant Client1 as 🌐 Client 1
    participant Socket as 🔌 Socket.io
    participant Queue as 📋 Queue Service
    participant OT as 🔄 OT Transformer
    participant State as 📄 Document State
    participant DB as 💾 MongoDB
    participant User2 as 👤 User 2
    participant Client2 as 🌐 Client 2

    %% User 1 makes an edit
    User1->>Client1: Type "Hello"
    Client1->>Client1: Detect operation (insert)
    Client1->>Socket: Emit operation<br/>(version: 5)
    
    %% Server processing
    Socket->>Queue: Queue operation<br/>(clientVersion: 5)
    Queue->>Queue: Check for concurrent ops
    
    Note over Queue: Found concurrent ops:<br/>Op6 (User2, v6)<br/>Op7 (User2, v7)
    
    Queue->>OT: Transform against concurrent ops
    OT->>OT: Transform positions
    OT->>Queue: Return transformed op
    
    Queue->>State: Apply operation
    State->>State: Update content & version (v8)
    
    %% Non-blocking persistence
    State->>DB: Async save (don't wait)
    
    %% Broadcast to all clients
    State->>Socket: Broadcast operation + content
    
    %% Acknowledge sender
    Socket->>Client1: operation-acknowledged<br/>(version: 8, content)
    
    %% Sync receiver
    Socket->>Client2: operation event<br/>(version: 8, content)
    
    %% Both clients sync to server state
    Client1->>Client1: Update editor with server content
    Client2->>Client2: Update editor with server content
    
    Note over Client1,Client2: Both clients now<br/>synced to version 8
```

## OT Transformation Logic

```mermaid
graph LR
    subgraph "Input Operations"
        Op1["Op1: Insert 'AB'<br/>at position 5"]
        Op2["Op2: Delete 3 chars<br/>at position 8"]
    end

    subgraph "Transformation Engine"
        Transformer["🔄 OT Transformer"]
        
        subgraph "Transformation Rules"
            II["Insert vs Insert"]
            ID["Insert vs Delete"]
            DI["Delete vs Insert"]
            DD["Delete vs Delete"]
        end
    end

    subgraph "Output Operations"
        TransformedOp1["Transformed Op1:<br/>Insert 'AB'<br/>at position 8"]
        TransformedOp2["Transformed Op2:<br/>Delete 3 chars<br/>at position 5"]
    end

    Op1 --> Transformer
    Op2 --> Transformer
    
    Transformer --> II
    Transformer --> ID
    Transformer --> DI
    Transformer --> DD
    
    II --> TransformedOp1
    ID --> TransformedOp1
    DI --> TransformedOp2
    DD --> TransformedOp2

    classDef inputStyle fill:#e8f4f8,stroke:#3b82f6,stroke-width:2px
    classDef processStyle fill:#d1fae5,stroke:#10b981,stroke-width:2px
    classDef outputStyle fill:#fef3c7,stroke:#f59e0b,stroke-width:2px

    class Op1,Op2 inputStyle
    class Transformer,II,ID,DI,DD processStyle
    class TransformedOp1,TransformedOp2 outputStyle
```

## Component Interaction Map

```mermaid
graph TD
    subgraph "Frontend Components"
        A["queue-client.html"]
        B["Operation Detection"]
        C["State Management"]
    end

    subgraph "Backend Services"
        D["Socket Handler"]
        E["Queue Service"]
        F["OT Transformer"]
        G["Apply Service"]
        H["Presence Service"]
    end

    subgraph "Data Layer"
        I["Document Model"]
        J["MongoDB"]
    end

    A --> D
    B --> D
    C --> D
    
    D --> E
    E --> F
    E --> G
    
    F --> G
    G --> I
    I --> J
    
    D --> H
    H --> D
    
    D --> I
    E --> I

    classDef frontendStyle fill:#e8f4f8,stroke:#3b82f6
    classDef backendStyle fill:#d1fae5,stroke:#10b981
    classDef dataStyle fill:#fee2e2,stroke:#ef4444

    class A,B,C frontendStyle
    class D,E,F,G,H backendStyle
    class I,J dataStyle
```

## Data Flow Architecture

```mermaid
flowchart TD
    Start([User Action]) --> Detect[Detect Operation]
    Detect --> Emit[Emit to Socket.io]
    Emit --> Queue{Operation Queue}
    
    Queue --> Process[Process Operation]
    Process --> Version{Version Check}
    
    Version -->|Has concurrent ops| Transform[OT Transform]
    Version -->|No concurrent ops| Apply[Apply Operation]
    
    Transform --> Apply
    Apply --> Update[Update State]
    Update --> Broadcast[Broadcast to All]
    Broadcast --> Ack[Acknowledge Sender]
    Ack --> Persist[Async Persist]
    Persist --> End([Complete])
    
    Broadcast --> Receive[Client Receives]
    Receive --> Sync[Sync to Server State]
    Sync --> End

    classDef startEndStyle fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    classDef processStyle fill:#d1fae5,stroke:#10b981,stroke-width:2px
    classDef decisionStyle fill:#e0e7ff,stroke:#6366f1,stroke-width:2px

    class Start,End startEndStyle
    class Detect,Emit,Process,Transform,Apply,Update,Broadcast,Ack,Persist,Receive,Sync processStyle
    class Queue,Version decisionStyle
```

## Technology Stack

```mermaid
mindmap
  root((Collaborative<br/>Sync Engine))
    Frontend
      Vanilla JS
      Socket.io Client
      HTML/CSS
      Diff Algorithm
    Backend
      Node.js
      TypeScript
      Express
      Socket.io
    Real-time
      WebSocket
      Socket.io
      Event-driven
    Database
      MongoDB
      Mongoose
      Document Model
    Algorithms
      OT Transformation
      Position Transform
      Queue Processing
      Version Control
    Architecture
      Queue-based
      Non-blocking DB
      Server-authoritative
      Multi-user sync
```

## Key Architecture Principles

1. **Queue-Based Processing**: Operations are serialized through a queue system
2. **Server-Authoritative**: Server maintains the true state and broadcasts to clients
3. **Non-Blocking I/O**: Database writes don't block operation processing
4. **Version Control**: Client versions track operation concurrency
5. **Position Transformation**: OT transforms positions based on concurrent operations
6. **Event-Driven**: Socket.io enables real-time bidirectional communication

---

**Architecture designed for:**
- ⚡ **Performance** - Non-blocking operations, queue processing
- 🔄 **Consistency** - Server-authoritative state management  
- 👥 **Collaboration** - Multi-user real-time editing
- 🛡️ **Reliability** - Proper OT conflict resolution