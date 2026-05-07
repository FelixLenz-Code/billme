import { test } from '@playwright/test';
import { runLiteRegressionScenario } from './scenarios.mjs';

test('keeps deep links and export failures predictable in the lite web shell', async ({ page }, testInfo) => {
  await runLiteRegressionScenario(page, `${testInfo.project.name}-${testInfo.title}`);
});
