/**
 * Queue-based OT Service with Version Checking and Transformation
 * Implements proper Operational Transformation for collaborative editing
 */

import { Operation, isInsertOp, isDeleteOp } from '../types/operation-enhanced';
import { apply, validateOperation } from './apply';
import { transformOperation, findConcurrentOperations, validateTransformedOperation } from './ot-transformer';

interface QueuedOperation {
  id: string;
  operation: Operation;
  clientVersion: number; // Client's version when they sent this
  timestamp: number;
  userId: string;
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface DocumentState {
  content: string;
  version: number;
  operations: Operation[];
}

export class OTQueueService {
  private operationQueues: Map<string, QueuedOperation[]> = new Map();
  private documentStates: Map<string, DocumentState> = new Map();
  private processingLocks: Map<string, boolean> = new Map();
  private operationCounter: number = 0;

  /**
   * Initialize document state in queue system
   */
  initializeDocument(documentId: string, initialState: DocumentState): void {
    if (!this.operationQueues.has(documentId)) {
      this.operationQueues.set(documentId, []);
      this.documentStates.set(documentId, initialState);
      this.processingLocks.set(documentId, false);
      console.log(`📄 Document ${documentId} initialized - Version: ${initialState.version}`);
    }
  }

  /**
   * Queue an operation for processing with client version
   */
  queueOperation(
    documentId: string,
    operation: Operation,
    userId: string,
    clientVersion: number
  ): string {
    // Ensure document is initialized
    if (!this.operationQueues.has(documentId)) {
      this.initializeDocument(documentId, {
        content: '',
        version: 0,
        operations: []
      });
    }

    // Generate unique operation ID
    const operationId = `op-${documentId}-${this.operationCounter++}-${Date.now()}`;

    const queuedOp: QueuedOperation = {
      id: operationId,
      operation: { ...operation },
      clientVersion,
      timestamp: Date.now(),
      userId,
      documentId,
      status: 'pending'
    };

    const queue = this.operationQueues.get(documentId)!;
    queue.push(queuedOp);

    // Sort queue by timestamp (FIFO order)
    queue.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`📝 Operation queued: ${operationId} by ${userId} - Type: ${operation.type} - Client Version: ${clientVersion}`);

    return operationId;
  }

  /**
   * Process next operation in queue with proper OT flow
   */
  async processNextOperation(documentId: string): Promise<QueuedOperation | null> {
    // Check if document is being processed
    if (this.processingLocks.get(documentId)) {
      console.log(`⏳ Document ${documentId} is being processed, waiting...`);
      return null;
    }

    const queue = this.operationQueues.get(documentId);
    if (!queue || queue.length === 0) {
      return null;
    }

    // Find next pending operation
    const nextOp = queue.find(op => op.status === 'pending');
    if (!nextOp) {
      return null;
    }

    // Set processing lock
    this.processingLocks.set(documentId, true);
    nextOp.status = 'processing';

    try {
      const currentState = this.documentStates.get(documentId)!;

      console.log(`\n🔄 Processing: ${nextOp.id}`);
      console.log(`   Server Version: ${currentState.version}`);
      console.log(`   Client Version: ${nextOp.clientVersion}`);
      console.log(`   Operation: ${nextOp.operation.type} at position ${nextOp.operation.position}`);

      // STEP 1: Version Checking
      const concurrentOps = findConcurrentOperations(
        currentState.operations,
        nextOp.clientVersion
      );

      console.log(`   Concurrent operations: ${concurrentOps.length}`);

      // STEP 2: OT Transformation
      let transformedOp = nextOp.operation;

      if (concurrentOps.length > 0) {
        console.log(`   Transforming operation against ${concurrentOps.length} concurrent ops...`);

        const originalPosition = transformedOp.position;
        transformedOp = transformOperation(transformedOp, concurrentOps);

        console.log(`   Position transformed: ${originalPosition} → ${transformedOp.position}`);
      }

      // STEP 3: Validation
      if (!validateTransformedOperation(transformedOp, currentState.content.length)) {
        console.error(`❌ Invalid operation after transformation: ${nextOp.id}`);
        console.error(`   Content length: ${currentState.content.length}`);
        console.error(`   Operation position: ${transformedOp.position}`);

        nextOp.status = 'failed';
        return nextOp;
      }

      // STEP 4: Apply Operation
      const newContent = apply(currentState.content, transformedOp);
      const newVersion = currentState.version + 1;

      // Create operation record for history
      const operationRecord: Operation = {
        ...transformedOp,
        id: nextOp.id,
        version: newVersion
      };

      // STEP 5: Update State
      this.documentStates.set(documentId, {
        content: newContent,
        version: newVersion,
        operations: [...currentState.operations, operationRecord]
      });

      nextOp.operation = { ...transformedOp, version: newVersion };
      nextOp.status = 'completed';

      console.log(`✅ Operation processed: ${nextOp.id}`);
      console.log(`   New Version: ${newVersion}`);
      console.log(`   Content: "${newContent.substring(0, 30)}${newContent.length > 30 ? '...' : ''}"`);

      // Cleanup old completed operations (keep last 100)
      const completedOps = queue.filter(op => op.status === 'completed');
      if (completedOps.length > 100) {
        const toRemove = completedOps.slice(0, completedOps.length - 100);
        toRemove.forEach(op => {
          const index = queue.indexOf(op);
          if (index > -1) queue.splice(index, 1);
        });
      }

      return nextOp;

    } catch (error) {
      console.error(`❌ Error processing operation ${nextOp.id}:`, error);
      nextOp.status = 'failed';
      return nextOp;
    } finally {
      // Release processing lock
      this.processingLocks.set(documentId, false);
    }
  }

  /**
   * Get current document state
   */
  getDocumentState(documentId: string): DocumentState | null {
    return this.documentStates.get(documentId) || null;
  }

  /**
   * Get current document content
   */
  getDocumentContent(documentId: string): string {
    return this.documentStates.get(documentId)?.content || '';
  }

  /**
   * Get current document version
   */
  getDocumentVersion(documentId: string): number {
    return this.documentStates.get(documentId)?.version || 0;
  }

  /**
   * Update document state (for initial load from database)
   */
  updateDocumentState(documentId: string, state: DocumentState): void {
    this.initializeDocument(documentId, state);
    this.documentStates.set(documentId, state);
  }

  /**
   * Get pending operations for document
   */
  getPendingOperations(documentId: string): QueuedOperation[] {
    const queue = this.operationQueues.get(documentId) || [];
    return queue.filter(op => op.status === 'pending');
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): QueuedOperation | null {
    for (const queue of this.operationQueues.values()) {
      const op = queue.find(o => o.id === operationId);
      if (op) return op;
    }
    return null;
  }

  /**
   * Clear all operations for document
   */
  clearDocumentQueue(documentId: string): void {
    this.operationQueues.set(documentId, []);
  }

  /**
   * Get queue statistics
   */
  getQueueStats(documentId: string): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const queue = this.operationQueues.get(documentId) || [];
    return {
      pending: queue.filter(op => op.status === 'pending').length,
      processing: queue.filter(op => op.status === 'processing').length,
      completed: queue.filter(op => op.status === 'completed').length,
      failed: queue.filter(op => op.status === 'failed').length
    };
  }
}

// Export singleton instance
export const otQueueService = new OTQueueService();