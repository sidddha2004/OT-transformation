import { Socket } from 'socket.io';
import { UserPresence, CursorPosition, UserActivity, DocumentPresence } from '../types/presence';

/**
 * Advanced presence tracking service
 */
export class PresenceService {
  private documents: Map<string, DocumentPresence> = new Map();
  private inactivityTimeout: number = 30000; // 30 seconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Get or create document presence
   */
  private getDocumentPresence(documentId: string): DocumentPresence {
    if (!this.documents.has(documentId)) {
      this.documents.set(documentId, {
        users: new Map(),
        cursors: new Map(),
        activities: new Map()
      });
    }
    return this.documents.get(documentId)!;
  }

  /**
   * Add user to document presence
   */
  addUser(documentId: string, userId: string, socketId: string, username?: string): void {
    const presence = this.getDocumentPresence(documentId);

    const userPresence: UserPresence = {
      userId,
      socketId,
      documentId,
      username: username || userId,
      color: this.generateUserColor(userId)
    };

    presence.users.set(socketId, userPresence);
    presence.activities.set(socketId, {
      lastSeen: Date.now(),
      isTyping: false
    });

    console.log(`User ${userId} joined document ${documentId}`);
  }

  /**
   * Remove user from document presence
   */
  removeUser(documentId: string, socketId: string): void {
    const presence = this.documents.get(documentId);
    if (!presence) return;

    const userPresence = presence.users.get(socketId);
    if (userPresence) {
      console.log(`User ${userPresence.userId} left document ${documentId}`);
    }

    presence.users.delete(socketId);
    presence.cursors.delete(socketId);
    presence.activities.delete(socketId);

    // Clean up empty document presence
    if (presence.users.size === 0) {
      this.documents.delete(documentId);
    }
  }

  /**
   * Update cursor position
   */
  updateCursor(documentId: string, socketId: string, position: number, selectionStart?: number, selectionEnd?: number): void {
    const presence = this.documents.get(documentId);
    if (!presence) return;

    const cursor: CursorPosition = {
      userId: presence.users.get(socketId)?.userId || 'unknown',
      socketId,
      position,
      selectionStart,
      selectionEnd,
      timestamp: Date.now()
    };

    presence.cursors.set(socketId, cursor);

    // Update activity
    const activity = presence.activities.get(socketId);
    if (activity) {
      activity.lastSeen = Date.now();
      activity.cursorPosition = position;
      activity.isTyping = true;
    }
  }

  /**
   * Get all users in document
   */
  getDocumentUsers(documentId: string): UserPresence[] {
    const presence = this.documents.get(documentId);
    if (!presence) return [];

    return Array.from(presence.users.values()).map(user => ({
      userId: user.userId,
      socketId: user.socketId,
      documentId: user.documentId,
      username: user.username,
      color: user.color
    }));
  }

  /**
   * Get all cursors in document (excluding specified socket)
   */
  getDocumentCursors(documentId: string, excludeSocketId?: string): CursorPosition[] {
    const presence = this.documents.get(documentId);
    if (!presence) return [];

    return Array.from(presence.cursors.values()).filter(
      cursor => excludeSocketId ? cursor.socketId !== excludeSocketId : true
    );
  }

  /**
   * Get user typing status
   */
  isUserTyping(documentId: string, socketId: string): boolean {
    const presence = this.documents.get(documentId);
    if (!presence) return false;

    const activity = presence.activities.get(socketId);
    return activity?.isTyping || false;
  }

  /**
   * Get all active users (recently active)
   */
  getActiveUsers(documentId: string): UserPresence[] {
    const presence = this.documents.get(documentId);
    if (!presence) return [];

    const now = Date.now();
    return Array.from(presence.users.values()).filter(user => {
      const activity = presence.activities.get(user.socketId);
      return activity && (now - activity.lastSeen) < this.inactivityTimeout;
    });
  }

  /**
   * Mark user as stopped typing
   */
  stopTyping(documentId: string, socketId: string): void {
    const presence = this.documents.get(documentId);
    if (!presence) return;

    const activity = presence.activities.get(socketId);
    if (activity) {
      activity.isTyping = false;
      activity.lastSeen = Date.now();
    }
  }

  /**
   * Get document presence summary
   */
  getDocumentSummary(documentId: string): {
    totalUsers: number;
    activeUsers: number;
    cursors: CursorPosition[];
  } {
    const presence = this.documents.get(documentId);
    if (!presence) {
      return { totalUsers: 0, activeUsers: 0, cursors: [] };
    }

    return {
      totalUsers: presence.users.size,
      activeUsers: this.getActiveUsers(documentId).length,
      cursors: this.getDocumentCursors(documentId)
    };
  }

  /**
   * Cleanup inactive users
   */
  private cleanupInactiveUsers(): void {
    const now = Date.now();

    for (const [documentId, presence] of this.documents.entries()) {
      const inactiveSockets: string[] = [];

      for (const [socketId, activity] of presence.activities.entries()) {
        if ((now - activity.lastSeen) > this.inactivityTimeout) {
          inactiveSockets.push(socketId);
        }
      }

      // Remove inactive users
      for (const socketId of inactiveSockets) {
        this.removeUser(documentId, socketId);
      }

      if (inactiveSockets.length > 0) {
        console.log(`Cleaned up ${inactiveSockets.length} inactive users from document ${documentId}`);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveUsers();
    }, 60000); // Every minute
  }

  /**
   * Stop cleanup interval
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate consistent color for user
   */
  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788'
    ];

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Clear all presence data (useful for testing)
   */
  public clearAll(): void {
    this.documents.clear();
  }
}

// Export singleton instance
export const presenceService = new PresenceService();
