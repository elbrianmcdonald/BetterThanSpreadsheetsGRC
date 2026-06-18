import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Maturity Assessment.
 * Create a maturity assessment against a framework → land on the assessment →
 * verify it renders without error.
 */

test.describe('Workflow: Maturity Assessment', () => {
  test('create a maturity assessment', async ({ page }) => {
    test.slow();
    await login(page, USERS.admin);
    await page.goto('/maturity/dashboard');

    await page.getByRole('button', { name: /New Assessment/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Framework is the first combobox in the dialog (label not aria-associated).
    const framework = dialog.getByRole('combobox').first();
    await framework.click();
    await page.getByRole('option').first().click();
    // Ensure a framework is actually chosen before filling the rest.
    await expect(framework).not.toContainText(/Select a framework|Select Framework/i);

    await dialog.getByRole('textbox', { name: /Assessment Name/i }).fill(`E2E Maturity ${uid()}`);
    // Tall dialog: the footer submit can sit outside the viewport in the
    // internally-scrolled content, so force the click.
    await dialog.getByRole('button', { name: /Create Assessment/i }).click({ force: true });

    // Redirects to the new assessment.
    await page.waitForURL(/\/maturity\/[^/]+$/, { timeout: 20000 });
    await assertNoError(page, 'maturity assessment detail');
  });
});
