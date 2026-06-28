/**
 * User presence and cursor position types
 */

export interface UserPresence {
  userId: string;
  socketId: string;
  documentId: string;
  username?: string;
  color?: string;
}

export interface CursorPosition {
  userId: string;
  socketId: string;
  position: number;
  selectionStart?: number;
  selectionEnd?: number;
  timestamp: number;
}

export interface UserActivity {
  lastSeen: number;
  isTyping: boolean;
  cursorPosition?: number;
}

export interface DocumentPresence {
  users: Map<string, UserPresence>;
  cursors: Map<string, CursorPosition>;
  activities: Map<string, UserActivity>;
}
