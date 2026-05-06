import { test } from '@playwright/test';
import { runLiteSmokeScenario } from './scenarios.mjs';

test('lite web shell reaches the bootstrap screen against the server stack', async ({ page }) => {
  await runLiteSmokeScenario(page);
});
