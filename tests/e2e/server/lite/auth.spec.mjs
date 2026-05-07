import { test } from '@playwright/test';
import { runLiteAuthScenario } from './scenarios.mjs';

test('bootstraps the lite web shell, restores sessions, and clears stale tokens', async ({ page }) => {
  await runLiteAuthScenario(page);
});
