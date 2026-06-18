import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Compliance Assessment.
 * From the Frameworks tab, start an assessment against a seeded framework →
 * land on the assessment detail (control scoring) page → verify it renders.
 */

test.describe('Workflow: Compliance Assessment', () => {
  test('start an assessment for a framework', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/compliance/assessments');

    // Frameworks tab is the default; each framework card has "Create Assessment".
    await page.getByRole('button', { name: /Create Assessment/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog.getByLabel(/Assessment Name/i).fill(`E2E Compliance ${uid()}`);
    // Submit (other fields default). The dialog's own create button.
    await dialog.getByRole('button', { name: /Create Assessment|Start Assessment/i }).last().click();

    // Lands on the assessment detail / scoring page.
    await page.waitForURL(/\/compliance\/assessments\/[^/]+$/, { timeout: 20000 });
    await assertNoError(page, 'compliance assessment detail');
  });
});
