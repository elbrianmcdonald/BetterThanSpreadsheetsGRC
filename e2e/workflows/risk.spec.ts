import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError, deleteRiskByTitle } from '../support/helpers';

/**
 * Deep workflow: Risk register — Risk Model Cleanup era.
 * /risks/new is the ER-style aggregate-risk form (Story 22.3): name +
 * description, pick a matrix, and choose a scoring path — linked findings
 * (calculated rollup) or a manual override. This spec takes the manual path,
 * verifies the risk lands in the register, then deletes it in teardown.
 */

const RISK_TITLE = `E2E Risk ${uid()}`;

test.describe.serial('Workflow: Risk register', () => {
  test('create an aggregate risk with a manual score', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/risks/new');

    await page.getByPlaceholder(/Short, specific risk name/i).fill(RISK_TITLE);
    await page
      .getByPlaceholder(/What could happen, why it matters/i)
      .fill('End-to-end workflow test: an aggregate risk created through the ER-style form with a manual score.');

    // Risk Matrix enables the severity selects. The MatrixSelector trigger
    // has no accessible name (its text is a child value node), so filter by
    // visible text instead.
    await page
      .getByRole('combobox')
      .filter({ hasText: 'Select a risk matrix' })
      .first()
      .click();
    await page.getByRole('option', { name: /Standard 3.3 Risk Matrix/i }).first().click();

    // Manual-override scoring path (no linked findings yet).
    await page.getByText(/Set a manual score/i).click();
    await page.getByRole('combobox', { name: 'Likelihood' }).first().click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: 'Impact' }).first().click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /Create Risk$/i }).click();

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

  test('open the risk detail page — effective severity shows the manual source', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/risks');
    await page.locator('tbody tr', { hasText: RISK_TITLE }).first().click();
    await expect(page).toHaveURL(/\/risks\/[^/]+$/);
    await expect(page.getByText(RISK_TITLE).first()).toBeVisible({ timeout: 15000 });
    // Story 22.1: the Effective Severity card carries the score source badge.
    await expect(page.getByText(/Effective Severity/i).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'risk detail');
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, USERS.admin);
    await deleteRiskByTitle(page, RISK_TITLE);
    await page.close();
  });
});
