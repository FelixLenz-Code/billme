import { test } from '@playwright/test';
import { runWorkerFlowScenario } from '../worker-flows.mjs';

test('lite worker jobs run end-to-end in server mode', async () => {
  test.slow();
  await runWorkerFlowScenario('lite');
});
