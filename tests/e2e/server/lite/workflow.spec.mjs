import { test } from '@playwright/test';
import { runLiteWorkflowScenario } from './scenarios.mjs';

test('creates lite clients, invoices, and offers against the seeded server stack', async ({ page }, testInfo) => {
  await runLiteWorkflowScenario(page, `${testInfo.project.name}-${testInfo.title}`);
});
