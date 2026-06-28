/**
 * Enhanced operation types with positioning strategies
 */

export interface BaseOperation {
  id: string;
  userId: string;
  version: number;
  timestamp: number;
}

export interface InsertOperation extends BaseOperation {
  type: 'insert';
  position: number;
  content: string;
  positioningStrategy?: 'absolute' | 'append' | 'replace-selection';
}

export interface DeleteOperation extends BaseOperation {
  type: 'delete';
  position: number;
  length: number;
  positioningStrategy?: 'absolute' | 'clear-selection';
}

export type Operation = InsertOperation | DeleteOperation;

// Type guards
export function isInsertOp(op: Operation): op is InsertOperation {
  return op.type === 'insert';
}

export function isDeleteOp(op: Operation): op is DeleteOperation {
  return op.type === 'delete';
}

/**
 * Enhanced operation creator that determines positioning strategy
 */
export function createOperation(
  type: 'insert' | 'delete',
  params: {
    position: number;
    content?: string;
    length?: number;
    userId: string;
    currentContentLength: number;
    positioningStrategy?: 'absolute' | 'append' | 'replace-selection' | 'clear-selection';
  }
): Operation {
  const baseOperation = {
    id: `op-${Date.now()}-${Math.random()}`,
    userId: params.userId,
    version: 0,
    timestamp: Date.now()
  };

  // Auto-detect positioning strategy
  let strategy = params.positioningStrategy;

  if (!strategy) {
    if (type === 'insert') {
      // If position is at end, use 'append' strategy
      if (params.position === params.currentContentLength) {
        strategy = 'append';
      } else {
        strategy = 'absolute';
      }
    } else {
      strategy = 'absolute';
    }
  }

  if (type === 'insert') {
    return {
      ...baseOperation,
      type: 'insert',
      position: params.position,
      content: params.content || '',
      positioningStrategy: strategy as 'absolute' | 'append' | 'replace-selection'
    };
  } else {
    return {
      ...baseOperation,
      type: 'delete',
      position: params.position,
      length: params.length || 0,
      positioningStrategy: strategy as 'absolute' | 'clear-selection'
    };
  }
}
