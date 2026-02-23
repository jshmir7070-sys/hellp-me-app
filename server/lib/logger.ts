const isProd = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface Logger {
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
  debug: (message: string, data?: any) => void;
}

function formatError(data: any): any {
  if (data instanceof Error) {
    return {
      message: data.message,
      stack: data.stack,
      name: data.name,
    };
  }
  return data;
}

function logProd(level: LogLevel, module: string, message: string, data?: any): void {
  const entry: Record<string, any> = {
    level,
    module,
    msg: message,
    ts: new Date().toISOString(),
  };

  if (data !== undefined) {
    entry.data = formatError(data);
  }

  const line = JSON.stringify(entry);

  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

function logDev(level: LogLevel, module: string, message: string, data?: any): void {
  const prefix = `[${module}]`;
  const formatted = data instanceof Error
    ? `${prefix} ${message}: ${data.message}\n${data.stack}`
    : data !== undefined
      ? `${prefix} ${message} ${JSON.stringify(data)}`
      : `${prefix} ${message}`;

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export function createLogger(module: string): Logger {
  const log = isProd ? logProd : logDev;

  return {
    info: (message: string, data?: any) => log('info', module, message, data),
    warn: (message: string, data?: any) => log('warn', module, message, data),
    error: (message: string, data?: any) => log('error', module, message, data),
    debug: (message: string, data?: any) => log('debug', module, message, data),
  };
}

export const logger = createLogger('App');
