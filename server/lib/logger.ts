/**
 * Structured Logging System
 * Replaces console.log with proper logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  module?: string;
  userId?: string;
  orderId?: number;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private env: string;

  constructor() {
    this.env = process.env.NODE_ENV || 'development';
  }

  /**
   * Format timestamp
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.env === 'production') {
      // In production, only log info, warn, and error
      return ['info', 'warn', 'error'].includes(level);
    }
    // In development, log everything
    return true;
  }

  /**
   * Format log message
   */
  private format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.getTimestamp();
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${ctx} ${message}`;
  }

  /**
   * Mask sensitive data
   */
  private maskSensitive(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sensitiveFields = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      'cardNumber',
      'cvv',
      'phoneNumber',
      'email',
    ];

    const masked: LogContext = { ...context };

    for (const key of Object.keys(masked)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        masked[key] = '[MASKED]';
      }
    }

    return masked;
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      const masked = this.maskSensitive(context);
      console.log(this.format('debug', message, masked));
    }
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      const masked = this.maskSensitive(context);
      console.log(this.format('info', message, masked));
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      const masked = this.maskSensitive(context);
      console.warn(this.format('warn', message, masked));
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | any, context?: LogContext) {
    if (this.shouldLog('error')) {
      const masked = this.maskSensitive(context);
      const errorInfo = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { error };

      console.error(this.format('error', message, { ...masked, ...errorInfo }));
    }
  }

  /**
   * HTTP request logging
   */
  http(method: string, path: string, statusCode: number, duration: number, context?: LogContext) {
    this.info(`${method} ${path} ${statusCode} ${duration}ms`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience exports
export const log = logger;
