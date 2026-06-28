import { Request, Response, NextFunction } from 'express';
import { Operation } from '../types/operation-enhanced';

/**
 * Validation middleware for API requests
 */

export function validateOperation(req: Request, res: Response, next: NextFunction): void {
  const operation = req.body;

  if (!operation) {
    res.status(400).json({ error: 'Operation is required' });
    return;
  }

  // Validate operation type
  if (operation.type !== 'insert' && operation.type !== 'delete') {
    res.status(400).json({ error: 'Invalid operation type' });
    return;
  }

  // Validate position
  if (typeof operation.position !== 'number' || operation.position < 0) {
    res.status(400).json({ error: 'Invalid position' });
    return;
  }

  // Validate insert-specific fields
  if (operation.type === 'insert') {
    if (typeof operation.content !== 'string') {
      res.status(400).json({ error: 'Content is required for insert operations' });
      return;
    }
    if (operation.content.length > 10000) {
      res.status(400).json({ error: 'Content too long (max 10000 characters)' });
      return;
    }
  }

  // Validate delete-specific fields
  if (operation.type === 'delete') {
    if (typeof operation.length !== 'number' || operation.length < 0) {
      res.status(400).json({ error: 'Invalid length for delete operation' });
      return;
    }
  }

  // Sanitize content
  if (operation.type === 'insert' && operation.content) {
    operation.content = sanitizeContent(operation.content);
  }

  next();
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
function sanitizeContent(content: string): string {
  // Remove potentially dangerous HTML/JS content
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
}

/**
 * Validate document ID
 */
export function validateDocumentId(req: Request, res: Response, next: NextFunction): void {
  const documentId = req.params.id || req.body.documentId;

  if (!documentId) {
    res.status(400).json({ error: 'Document ID is required' });
    return;
  }

  // Basic MongoDB ObjectId validation
  if (!/^[0-9a-fA-F]{24}$/.test(documentId)) {
    res.status(400).json({ error: 'Invalid document ID format' });
    return;
  }

  next();
}

/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    let userLimits = rateLimitMap.get(key);

    if (!userLimits || userLimits.resetTime < windowStart) {
      userLimits = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, userLimits);
      return next();
    }

    if (userLimits.count >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((userLimits.resetTime - now) / 1000)
      });
      return;
    }

    userLimits.count++;
    next();
  };
}
