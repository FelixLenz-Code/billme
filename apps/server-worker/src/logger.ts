export type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkerLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): WorkerLogger;
}

const levelOrder: Record<WorkerLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const emit = (level: WorkerLogLevel, message: string, meta: Record<string, unknown>) => {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  });

  if (level === 'error') {
    console.error(payload);
    return;
  }

  if (level === 'warn') {
    console.warn(payload);
    return;
  }

  console.log(payload);
};

export const createWorkerLogger = (
  minimumLevel: WorkerLogLevel = 'info',
  bindings: Record<string, unknown> = {},
): WorkerLogger => {
  const canLog = (level: WorkerLogLevel) => levelOrder[level] >= levelOrder[minimumLevel];

  const log =
    (level: WorkerLogLevel) =>
    (message: string, meta?: Record<string, unknown>) => {
      if (!canLog(level)) {
        return;
      }
      emit(level, message, {
        service: 'billme-server-worker',
        ...bindings,
        ...(meta ?? {}),
      });
    };

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child(extraBindings) {
      return createWorkerLogger(minimumLevel, {
        ...bindings,
        ...extraBindings,
      });
    },
  };
};
