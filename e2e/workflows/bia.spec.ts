import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Business Impact Analysis.
 * Create a business function → create a business process under it → verify the
 * process appears in the register.
 */

const FUNC = `E2E Function ${uid()}`;
const PROC = `E2E Process ${uid()}`;

test.describe.serial('Workflow: BIA', () => {
  test('create a business function', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/bia/functions');
    await page.getByRole('button', { name: /Add Function/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Name/i).fill(FUNC);
    await dialog.getByRole('button', { name: /Create|Save/i }).last().click();
    await expect(page.getByText(FUNC).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'bia functions');
  });

  test('create a business process under the function', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/bia/processes/new');
    await page.getByLabel(/^Name/i).fill(PROC);
    // Link it to the function we just created.
    const fn = page.getByRole('combobox', { name: /Business Function/i });
    if (await fn.count()) {
      await fn.click();
      const opt = page.getByRole('option', { name: new RegExp(FUNC) });
      if (await opt.count()) await opt.click();
      else await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: /Create Process/i }).click();
    // Lands on the new process detail page, which shows its name.
    await page.waitForURL((url) => !url.pathname.endsWith('/bia/processes/new'), { timeout: 15000 });
    await expect(page.getByText(PROC).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'process detail');
  });
});
