import type { WorkerLogger } from './logger.js';

export interface WorkerTask {
  name: string;
  run(): Promise<void>;
}

export class WorkerTaskQueue {
  private readonly pending = new Map<string, WorkerTask>();
  private runningTaskName: string | null = null;
  private drainPromise: Promise<void> | null = null;

  constructor(private readonly logger: WorkerLogger) {}

  enqueue(task: WorkerTask): boolean {
    if (this.runningTaskName === task.name || this.pending.has(task.name)) {
      return false;
    }

    this.pending.set(task.name, task);
    this.ensureDrain();
    return true;
  }

  whenIdle(): Promise<void> {
    return this.drainPromise ?? Promise.resolve();
  }

  private ensureDrain() {
    if (this.drainPromise) {
      return;
    }

    this.drainPromise = this.drain().finally(() => {
      this.drainPromise = null;
      if (this.pending.size > 0) {
        this.ensureDrain();
      }
    });
  }

  private async drain(): Promise<void> {
    while (this.pending.size > 0) {
      const next = this.pending.entries().next().value as [string, WorkerTask] | undefined;
      if (!next) {
        return;
      }

      const [name, task] = next;
      this.pending.delete(name);
      this.runningTaskName = name;

      try {
        await task.run();
      } catch (error) {
        this.logger.error('Task queue execution failed', {
          task: name,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.runningTaskName = null;
      }
    }
  }
}
