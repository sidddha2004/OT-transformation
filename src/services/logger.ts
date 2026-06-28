/**
 * Simple logging service for monitoring and debugging
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

export class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    return `[${timestamp}] [${entry.level}] ${entry.message}${metadata}`;
  }

  log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata
    };

    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to console
    const formatted = this.formatMessage(entry);
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.logs.length,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    };

    for (const log of this.logs) {
      const level = log.level.toLowerCase();
      if (stats[level] !== undefined) {
        stats[level]++;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const logger = new Logger();
