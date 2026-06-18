import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError, deleteRiskByTitle } from '../support/helpers';

/**
 * Deep workflow: Risk register.
 * /risks/new is a full risk-assessment form: pick a matrix, score the risk
 * (inherent likelihood × impact), then create. Verify the risk lands in the
 * register, then delete it in teardown.
 */

const RISK_TITLE = `E2E Risk ${uid()}`;

test.describe.serial('Workflow: Risk register', () => {
  test('create a scored risk via the assessment form', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/risks/new');

    await page.getByRole('textbox', { name: 'Assessment Title' }).fill(`E2E Assessment ${uid()}`);

    // Risk Matrix is required and enables the L/I scoring selects.
    await page.getByRole('combobox', { name: 'Risk Matrix' }).click();
    await page.getByRole('option', { name: /Standard 3.3 Risk Matrix/i }).first().click();

    await page.getByRole('textbox', { name: 'Risk Title' }).fill(RISK_TITLE);
    await page
      .getByRole('textbox', { name: 'Risk Statement' })
      .fill('End-to-end workflow test: a scored risk created through the assessment form.');

    // Inherent severity (the first Likelihood/Impact pair).
    await page.getByRole('combobox', { name: 'Likelihood' }).first().click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: 'Impact' }).first().click();
    await page.getByRole('option').first().click();

    // Mark risk eliminated to satisfy residual scoring without a second pass.
    const eliminated = page.getByRole('checkbox', { name: /Risk eliminated/i });
    if (await eliminated.count()) await eliminated.check();

    await page.getByRole('button', { name: /Create Risk Assessment/i }).click();

    // Leaves the create form on success.
    await page.waitForURL((url) => !url.pathname.endsWith('/risks/new'), { timeout: 20000 });
    await assertNoError(page, 'after risk create');
  });

  test('the new risk appears in the register', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/risks');
    await expect(page.locator('tbody tr', { hasText: RISK_TITLE }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('open the risk detail page', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/risks');
    await page.locator('tbody tr', { hasText: RISK_TITLE }).first().click();
    await expect(page).toHaveURL(/\/risks\/[^/]+$/);
    await expect(page.getByText(RISK_TITLE).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'risk detail');
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, USERS.admin);
    await deleteRiskByTitle(page, RISK_TITLE);
    await page.close();
  });
});
