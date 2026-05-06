import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkerTaskQueue } from './taskQueue.js';

const createLogger = () => ({
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return createLogger();
  },
});

test('WorkerTaskQueue deduplicates pending and running tasks', async () => {
  const queue = new WorkerTaskQueue(createLogger());
  const calls: string[] = [];
  const releaseCurrentRun: Array<(value?: void | PromiseLike<void>) => void> = [];

  const task = {
    name: 'recurring',
    async run() {
      calls.push('run');
      await new Promise<void>((resolve) => {
        releaseCurrentRun[0] = resolve;
      });
    },
  };

  assert.equal(queue.enqueue(task), true);
  assert.equal(queue.enqueue(task), false);

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queue.enqueue(task), false);

  if (releaseCurrentRun[0]) {
    releaseCurrentRun[0]();
  }
  await queue.whenIdle();

  assert.deepEqual(calls, ['run']);
  assert.equal(queue.enqueue(task), true);

  await new Promise((resolve) => setImmediate(resolve));
  if (releaseCurrentRun[0]) {
    releaseCurrentRun[0]();
  }
  await queue.whenIdle();

  assert.deepEqual(calls, ['run', 'run']);
});
