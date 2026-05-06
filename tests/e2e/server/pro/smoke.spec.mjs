import { test } from '@playwright/test';
import { runProSmokeScenario } from './scenarios.mjs';

test('pro web shell reaches the bootstrap screen against the server stack', async ({ page }) => {
  await runProSmokeScenario(page);
});
