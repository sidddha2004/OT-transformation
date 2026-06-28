/**
 * Operational Transformation (OT) Engine
 * Transforms operations against concurrent operations to maintain consistency
 */

import { Operation, InsertOperation, DeleteOperation, isInsertOp, isDeleteOp } from '../types/operation-enhanced';

/**
 * Transform an operation against a list of concurrent operations
 * This handles the core OT logic for collaborative editing
 */
export function transformOperation(
  operation: Operation,
  concurrentOps: Operation[]
): Operation {
  let transformedOp = { ...operation };

  // Transform against each concurrent operation in order
  for (const concurrentOp of concurrentOps) {
    transformedOp = transformAgainst(transformedOp, concurrentOp);
  }

  return transformedOp;
}

/**
 * Transform operation against a single concurrent operation
 * Based on operational transformation rules
 */
function transformAgainst(op1: Operation, op2: Operation): Operation {
  if (isInsertOp(op1) && isInsertOp(op2)) {
    return transformInsertAgainstInsert(op1, op2);
  }

  if (isInsertOp(op1) && isDeleteOp(op2)) {
    return transformInsertAgainstDelete(op1, op2);
  }

  if (isDeleteOp(op1) && isInsertOp(op2)) {
    return transformDeleteAgainstInsert(op1, op2);
  }

  if (isDeleteOp(op1) && isDeleteOp(op2)) {
    return transformDeleteAgainstDelete(op1, op2);
  }

  return op1;
}

/**
 * Transform Insert against Insert
 * Rule: If positions are equal, use timestamp to decide order
 * Rule: If op2.position <= op1.position, increment op1.position
 */
function transformInsertAgainstInsert(
  op1: InsertOperation,
  op2: InsertOperation
): InsertOperation {
  const pos1 = op1.position;
  const pos2 = op2.position;

  if (pos1 < pos2) {
    // op1 comes before op2, no transformation needed
    return op1;
  }

  if (pos1 > pos2) {
    // op2 comes before op1, shift op1 position right
    return {
      ...op1,
      position: pos1 + op2.content.length
    };
  }

  // Positions are equal - use timestamp to decide order
  if (op1.timestamp < op2.timestamp) {
    // op1 came first, no transformation
    return op1;
  } else {
    // op2 came first, shift op1 position right
    return {
      ...op1,
      position: pos1 + op2.content.length
    };
  }
}

/**
 * Transform Insert against Delete
 * Rule: If op2.position < op1.position, shift op1 position left
 * Rule: If op2 overlaps op1.position, adjust op1.position
 */
function transformInsertAgainstDelete(
  op1: InsertOperation,
  op2: DeleteOperation
): InsertOperation {
  const pos1 = op1.position;
  const pos2 = op2.position;
  const delEnd = pos2 + op2.length;

  if (pos1 <= pos2) {
    // Insert comes before delete, no transformation
    return op1;
  }

  if (pos1 >= delEnd) {
    // Insert comes after delete, shift position left
    return {
      ...op1,
      position: pos1 - op2.length
    };
  }

  // Insert is within delete range - move to start of delete range
  return {
    ...op1,
    position: pos2
  };
}

/**
 * Transform Delete against Insert
 * Rule: If op2.position <= op1.position, shift op1 position right
 */
function transformDeleteAgainstInsert(
  op1: DeleteOperation,
  op2: InsertOperation
): DeleteOperation {
  const pos1 = op1.position;
  const pos2 = op2.position;

  if (pos2 <= pos1) {
    // Insert comes before or at delete, shift delete position right
    return {
      ...op1,
      position: pos1 + op2.content.length
    };
  }

  // Insert comes after delete, no transformation
  return op1;
}

/**
 * Transform Delete against Delete
 * Rule: Adjust position and length based on overlapping ranges
 */
function transformDeleteAgainstDelete(
  op1: DeleteOperation,
  op2: DeleteOperation
): DeleteOperation {
  const pos1 = op1.position;
  const pos2 = op2.position;
  const end1 = pos1 + op1.length;
  const end2 = pos2 + op2.length;

  // Case 1: op2 comes completely before op1
  if (end2 <= pos1) {
    return {
      ...op1,
      position: pos1 - op2.length
    };
  }

  // Case 2: op2 comes completely after op1
  if (pos2 >= end1) {
    return op1;
  }

  // Case 3: op2 overlaps op1
  let newLength = op1.length;
  let newPosition = pos1;

  if (pos2 <= pos1 && end2 >= end1) {
    // op2 completely covers op1
    // Result: delete nothing (op1 already deleted)
    return {
      ...op1,
      length: 0,
      position: pos1
    };
  }

  if (pos2 <= pos1) {
    // op2 overlaps start of op1
    const overlap = end2 - pos1;
    newLength = op1.length - overlap;
    newPosition = pos1;
  } else if (end2 >= end1) {
    // op2 overlaps end of op1
    const overlap = end1 - pos2;
    newLength = op1.length - overlap;
    newPosition = pos1;
  } else {
    // op2 is inside op1
    newLength = op1.length - op2.length;
    newPosition = pos1;
  }

  return {
    ...op1,
    position: newPosition,
    length: Math.max(0, newLength)
  };
}

/**
 * Find concurrent operations for a given client version
 */
export function findConcurrentOperations(
  allOperations: Operation[],
  clientVersion: number
): Operation[] {
  return allOperations.filter(op => op.version > clientVersion);
}

/**
 * Validate if operation can be applied to current content
 */
export function validateTransformedOperation(
  operation: Operation,
  contentLength: number
): boolean {
  if (isInsertOp(operation)) {
    return operation.position >= 0 && operation.position <= contentLength;
  }

  if (isDeleteOp(operation)) {
    return operation.position >= 0 &&
           operation.position < contentLength &&
           operation.length > 0 &&
           (operation.position + operation.length) <= contentLength;
  }

  return false;
}