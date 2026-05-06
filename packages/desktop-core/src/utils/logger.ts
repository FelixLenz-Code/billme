import fs from 'fs';
import path from 'path';

const resolveElectronApp = (): { getPath(name: 'userData'): string } | null => {
  if (typeof process === 'undefined' || !process.versions?.electron) {
    return null;
  }

  try {
    const dynamicRequire = Function('return typeof require !== "undefined" ? require : null;')() as
      | ((id: string) => unknown)
      | null;
    const electron = dynamicRequire?.('electron') as {
      app?: {
        getPath(name: 'userData'): string;
      };
    } | null | undefined;
    return electron?.app ?? null;
  } catch {
    return null;
  }
};

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
}

class Logger {
  private logDir: string | null;
  private logFile: string | null;
  private isDev: boolean;

  constructor() {
    this.isDev = typeof process === 'undefined' || process.env.NODE_ENV !== 'production';
    this.logDir = null;
    this.logFile = null;

    try {
      const electronApp = resolveElectronApp();
      if (!electronApp?.getPath) {
        throw new Error('Electron app runtime unavailable');
      }
      this.logDir = path.join(electronApp.getPath('userData'), 'logs');
    } catch {
      if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
        this.logDir = path.join(process.cwd(), '.test-logs');
      }
    }

    if (this.logDir) {
      this.logFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    }
    this.ensureLogDir();
  }

  private ensureLogDir() {
    if (!this.logDir) {
      return;
    }
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private write(level: LogLevel, context: string, message: string, data?: unknown, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
      error: error ? { message: error.message, stack: error.stack } : undefined,
    };

    if (this.isDev) {
      const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[0m';
      console.log(`${color}[${level.toUpperCase()}] [${context}] ${message}\x1b[0m`, data || '');
      if (error) console.error(error);
    }

    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
      } catch (writeError) {
        console.error('Failed to write to log file:', writeError);
        console.error('Original log entry:', entry);
      }
    }
  }

  debug(context: string, message: string, data?: unknown) {
    if (this.isDev) this.write('debug', context, message, data);
  }

  info(context: string, message: string, data?: unknown) {
    this.write('info', context, message, data);
  }

  warn(context: string, message: string, data?: unknown) {
    this.write('warn', context, message, data);
  }

  error(context: string, message: string, error?: Error, data?: unknown) {
    this.write('error', context, message, data, error);
  }
}

export const logger = new Logger();
