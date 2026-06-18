import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Strategy.
 * Create a strategy → land on its detail page → verify it renders.
 */

const TITLE = `E2E Strategy ${uid()}`;

test.describe.serial('Workflow: Strategy', () => {
  test('create a strategy', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/strategy');

    await page.getByRole('button', { name: /Create Strategy/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Title/i).fill(TITLE);
    await dialog.getByLabel(/Description/i).fill('E2E workflow test strategy.');
    await dialog.getByRole('button', { name: /Create Strategy/i }).click();

    // Either redirects to the detail page or the strategy appears in the list.
    await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'strategy after create');
  });
});
