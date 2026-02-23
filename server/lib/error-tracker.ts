import { createLogger } from './logger';

const log = createLogger('ErrorTracker');

const isProd = process.env.NODE_ENV === 'production';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
}

export function trackError(error: Error, context?: ErrorContext): void {
  if (isProd) {
    const entry = {
      level: 'error',
      module: 'ErrorTracker',
      ts: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: context || {},
    };
    process.stderr.write(JSON.stringify(entry) + '\n');
  } else {
    const parts = [
      `[ErrorTracker] ${error.name}: ${error.message}`,
    ];
    if (context) {
      parts.push(`  Context: ${JSON.stringify(context)}`);
    }
    if (error.stack) {
      parts.push(`  Stack: ${error.stack}`);
    }
    console.error(parts.join('\n'));
  }
}

export function setupGlobalErrorHandlers(): void {
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error
      ? reason
      : new Error(String(reason));
    log.error('Unhandled promise rejection', error);
    trackError(error, { route: 'global/unhandledRejection' });
  });

  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception', error);
    trackError(error, { route: 'global/uncaughtException' });
    // Give time for logs to flush before exiting
    setTimeout(() => process.exit(1), 1000);
  });

  log.info('Global error handlers registered');
}
