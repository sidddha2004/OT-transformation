import { Operation, InsertOperation, DeleteOperation, isInsertOp, isDeleteOp } from '../types/operation-enhanced';

/**
 * Applies an operation to text content
 * Returns the new content after applying the operation
 */
export function apply(content: string, operation: Operation): string {
  if (isInsertOp(operation)) {
    return applyInsert(content, operation);
  }

  if (isDeleteOp(operation)) {
    return applyDelete(content, operation);
  }

  return content;
}

/**
 * Apply insert operation
 */
function applyInsert(content: string, operation: InsertOperation): string {
  if (!operation.content) {
    return content; // No content to insert
  }

  // Clamp position to valid range
  const position = Math.max(0, Math.min(operation.position, content.length));

  // Split and insert
  const before = content.substring(0, position);
  const after = content.substring(position);

  return before + operation.content + after;
}

/**
 * Apply delete operation
 */
function applyDelete(content: string, operation: DeleteOperation): string {
  const maxLength = content.length - operation.position;

  // Clamp length to valid range
  const length = Math.max(0, Math.min(operation.length, maxLength));

  if (length === 0) {
    return content; // Nothing to delete
  }

  // Split and remove
  const before = content.substring(0, operation.position);
  const after = content.substring(operation.position + length);

  return before + after;
}

/**
 * Validate operation before applying
 */
export function validateOperation(op: Operation, contentLength: number): boolean {
  if (isInsertOp(op)) {
    return op.position >= 0 && op.position <= contentLength;
  }

  if (isDeleteOp(op)) {
    return op.position >= 0 &&
           op.position < contentLength &&  // Changed: < instead of <= for delete operations
           op.length > 0 &&
           (op.position + op.length) <= contentLength;  // Ensure delete range is within bounds
  }

  return false;
}