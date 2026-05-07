import { expect, test } from '@playwright/test';
import { runStackSmokeScenario } from './scenarios.mjs';

if (process.env.E2E_SERVER_DEBUG === '1') {
  console.error('[stack-smoke-spec] loaded');
}

test('server-mode stack boots cleanly through Docker Compose', async () => {
  await runStackSmokeScenario();
});
