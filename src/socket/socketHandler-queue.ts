/**
 * Queue-based socket handler with proper OT protocol
 * Implements: Client → Socket.io → Queue → Version Check → OT → Apply → MongoDB → ACK → Broadcast
 */

import { Socket } from 'socket.io';
import { Operation } from '../types/operation-enhanced';
import { otQueueService } from '../services/otService-queue';
import { presenceService } from '../services/presenceService';
import Document from '../models/Document';

/**
 * Enhanced socket handler for proper OT collaborative editing
 */
export class SocketHandler {
  /**
   * Handle new socket connection
   */
  static handleConnection(socket: Socket): void {
    console.log('Client connected:', socket.id);

    // Join document room
    socket.on('join-document', async (data: { documentId: string; userId: string; username?: string }) => {
      await this.handleJoinDocument(socket, data);
    });

    // Leave document room
    socket.on('leave-document', (data: { documentId: string; userId: string }) => {
      this.handleLeaveDocument(socket, data);
    });

    // Handle incoming operation (NEW PROTOCOL - includes clientVersion)
    socket.on('operation', async (data: { documentId: string; operation: Operation; clientVersion: number }) => {
      await this.handleOperation(socket, data);
    });

    // Get document state
    socket.on('get-document', async (data: { documentId: string }) => {
      await this.handleGetDocument(socket, data);
    });

    // Handle cursor position update
    socket.on('cursor-update', (data: { documentId: string; position: number; selectionStart?: number; selectionEnd?: number }) => {
      this.handleCursorUpdate(socket, data);
    });

    // Request undo
    socket.on('undo', (data: { documentId: string; userId: string }) => {
      this.handleUndo(socket, data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  /**
   * Handle user joining a document room
   */
  private static async handleJoinDocument(
    socket: Socket,
    data: { documentId: string; userId: string; username?: string }
  ): Promise<void> {
    const { documentId, userId, username } = data;

    try {
      // Add to presence service
      presenceService.addUser(documentId, userId, socket.id, username);

      // Join socket room for this document
      socket.join(documentId);

      // Fetch document from database (SOURCE OF TRUTH)
      const document = await Document.findById(documentId);
      if (!document) {
        socket.emit('error', { message: 'Document not found' });
        presenceService.removeUser(documentId, socket.id);
        return;
      }

      // Initialize queue system with database state
      // Map MongoDB operations to proper Operation type with required fields
      const operations = (document.operations || []).map((op: any) => ({
        id: op.id || `op-${Date.now()}-${Math.random()}`,
        type: op.type,
        position: op.position,
        content: op.content,
        length: op.length,
        userId: op.userId,
        version: op.version || 0,
        timestamp: op.timestamp || Date.now()
      }));

      otQueueService.updateDocumentState(documentId, {
        content: document.content,
        version: document.version,
        operations: operations
      });

      // Get current users and cursors
      const currentUsers = presenceService.getDocumentUsers(documentId);
      const currentCursors = presenceService.getDocumentCursors(documentId, socket.id);

      // Send current state to client
      socket.emit('document-state', {
        id: document._id,
        title: document.title,
        content: document.content,
        version: document.version,
        users: currentUsers,
        cursors: currentCursors
      });

      // Notify others in room
      const joiningUser = presenceService.getDocumentUsers(documentId).find(u => u.socketId === socket.id);
      if (joiningUser) {
        socket.to(documentId).emit('user-joined', {
          user: joiningUser,
          users: currentUsers.filter(u => u.socketId !== socket.id)
        });
      }

      console.log(`👥 User ${userId} joined document ${documentId} - Version: ${document.version}`);
    } catch (error) {
      console.error('Error joining document:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  }

  /**
   * Handle user leaving a document room
   */
  private static handleLeaveDocument(
    socket: Socket,
    data: { documentId: string; userId: string }
  ): void {
    const { documentId, userId } = data;

    // Remove from presence service
    presenceService.removeUser(documentId, socket.id);

    // Leave socket room
    socket.leave(documentId);

    // Notify others
    const remainingUsers = presenceService.getDocumentUsers(documentId);
    socket.to(documentId).emit('user-left', {
      userId,
      socketId: socket.id,
      users: remainingUsers
    });

    console.log(`👋 User ${userId} left document ${documentId}`);
  }

  /**
   * Handle incoming operation from client with NEW PROTOCOL
   */
  private static async handleOperation(
    socket: Socket,
    data: { documentId: string; operation: Operation; clientVersion: number }
  ): Promise<void> {
    const { documentId, operation, clientVersion } = data;

    try {
      console.log(`📥 Operation received from ${operation.userId}:`);
      console.log(`   Type: ${operation.type}`);
      console.log(`   Position: ${operation.position}`);
      console.log(`   Client Version: ${clientVersion}`);

      // Queue the operation with client version
      const operationId = otQueueService.queueOperation(
        documentId,
        operation,
        operation.userId,
        clientVersion  // NEW: Include client version
      );

      // Process operations in queue
      await this.processOperationQueue(documentId, socket);

    } catch (error) {
      console.error('Error handling operation:', error);
      socket.emit('error', { message: 'Failed to queue operation' });
    }
  }

  /**
   * Process operation queue for document with proper flow
   */
  private static async processOperationQueue(documentId: string, senderSocket: Socket): Promise<void> {
    try {
      // Process all pending operations
      let processedOp;
      while ((processedOp = await otQueueService.processNextOperation(documentId))) {
        if (processedOp.status === 'completed') {
          const docState = otQueueService.getDocumentState(documentId);

          // ⚡ BROADCAST FIRST (FAST!)
          // Broadcast completed operation to ALL clients (including sender for sync)
          senderSocket.to(documentId).emit('operation', {
            operationId: processedOp.id,
            operation: processedOp.operation,
            userId: processedOp.userId,
            version: processedOp.operation.version,
            // Include content for clients that missed operations
            content: docState?.content,
            serverVersion: processedOp.operation.version
          });

          // Acknowledge to sender
          senderSocket.emit('operation-acknowledged', {
            operationId: processedOp.id,
            version: processedOp.operation.version,
            operation: processedOp.operation,
            content: docState?.content,
            serverVersion: processedOp.operation.version
          });

          console.log(`📤 Operation broadcast: ${processedOp.id} - Version: ${processedOp.operation.version}`);

          // 💾 SAVE TO DATABASE IN BACKGROUND (NON-BLOCKING)
          // Don't await - let it complete asynchronously
          this.updateDocumentInDatabase(documentId).catch(error => {
            console.error('Background DB save failed:', error);
          });

        } else if (processedOp.status === 'failed') {
          // Notify sender of failed operation
          senderSocket.emit('operation-rejected', {
            operationId: processedOp.id,
            reason: 'Invalid operation for current content'
          });
        }
      }
    } catch (error) {
      console.error('Error processing operation queue:', error);
    }
  }

  /**
   * Update document in database with latest state (ATOMIC)
   */
  private static async updateDocumentInDatabase(documentId: string): Promise<void> {
    try {
      const docState = otQueueService.getDocumentState(documentId);
      if (!docState) return;

      await Document.findByIdAndUpdate(documentId, {
        content: docState.content,
        version: docState.version,
        operations: docState.operations,
        updatedAt: new Date()
      });

      console.log(`💾 Document ${documentId} updated in database - Version: ${docState.version}`);
    } catch (error) {
      console.error('Error updating document in database:', error);
      throw error; // Re-throw to handle failure
    }
  }

  /**
   * Handle request for document state
   */
  private static async handleGetDocument(
    socket: Socket,
    data: { documentId: string }
  ): Promise<void> {
    const { documentId } = data;

    try {
      const document = await Document.findById(documentId);
      if (!document) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      socket.emit('document-state', {
        id: document._id,
        title: document.title,
        content: document.content,
        version: document.version
      });
    } catch (error) {
      console.error('Error fetching document:', error);
      socket.emit('error', { message: 'Failed to fetch document' });
    }
  }

  /**
   * Handle cursor position updates (presence)
   */
  private static handleCursorUpdate(
    socket: Socket,
    data: { documentId: string; position: number; selectionStart?: number; selectionEnd?: number }
  ): void {
    const { documentId, position, selectionStart, selectionEnd } = data;

    // Update cursor position in presence service
    presenceService.updateCursor(documentId, socket.id, position, selectionStart, selectionEnd);

    // Get cursor data
    const cursors = presenceService.getDocumentCursors(documentId, socket.id);
    const userCursor = cursors.find(c => c.socketId === socket.id);

    if (userCursor) {
      // Broadcast to other users in the room
      socket.to(documentId).emit('cursor-update', {
        userId: userCursor.userId,
        socketId: socket.id,
        position: userCursor.position,
        selectionStart: userCursor.selectionStart,
        selectionEnd: userCursor.selectionEnd,
        timestamp: userCursor.timestamp
      });
    }
  }

  /**
   * Handle undo request
   */
  private static async handleUndo(socket: Socket, data: { documentId: string; userId: string }): Promise<void> {
    const { documentId, userId } = data;

    try {
      const document = await Document.findById(documentId);
      if (!document) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      // Find last operation by this user
      const userOperations = document.operations
        .filter(op => op.userId === userId)
        .reverse();

      if (userOperations.length === 0) {
        socket.emit('undo-failed', { reason: 'No operations to undo' });
        return;
      }

      const lastOp = userOperations[0];
      const inverseOp = this.createInverseOperation(lastOp);

      if (inverseOp) {
        // Queue inverse operation for processing
        const docState = otQueueService.getDocumentState(documentId);
        const clientVersion = docState?.version || 0;

        const operationId = otQueueService.queueOperation(documentId, inverseOp, userId, clientVersion);

        // Process the queue
        await this.processOperationQueue(documentId, socket);

        socket.emit('undo-successful', {
          operationId: operationId,
          operation: inverseOp
        });
      }
    } catch (error) {
      console.error('Error handling undo:', error);
      socket.emit('undo-failed', { reason: 'Server error' });
    }
  }

  /**
   * Create inverse operation for undo
   */
  private static createInverseOperation(operation: any): Operation | null {
    if (operation.type === 'insert' && operation.content) {
      // Inverse of insert is delete
      return {
        id: `op-undo-${Date.now()}`,
        type: 'delete',
        position: operation.position,
        length: operation.content.length,
        userId: operation.userId,
        version: 0,
        timestamp: Date.now()
      };
    } else if (operation.type === 'delete' && operation.content) {
      // Inverse of delete is insert (need to store deleted content)
      return {
        id: `op-undo-${Date.now()}`,
        type: 'insert',
        position: operation.position,
        content: operation.content,
        userId: operation.userId,
        version: 0,
        timestamp: Date.now()
      };
    }
    return null;
  }

  /**
   * Handle socket disconnection
   */
  private static handleDisconnect(socket: Socket): void {
    console.log('Client disconnected:', socket.id);

    // Find and remove user from all documents
    for (const [documentId] of (presenceService as any).documents.entries()) {
      const users = (presenceService as any).documents.get(documentId)?.users;
      if (users && users.has(socket.id)) {
        presenceService.removeUser(documentId, socket.id);

        // Notify others in room
        const remainingUsers = presenceService.getDocumentUsers(documentId);
        socket.to(documentId).emit('user-left', {
          socketId: socket.id,
          users: remainingUsers
        });
      }
    }
  }
}