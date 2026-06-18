import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Standards.
 * Create an organizational standard → land on its detail page → verify.
 */

const TITLE = `E2E Standard ${uid()}`;

test.describe.serial('Workflow: Standards', () => {
  test('create a standard', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/standards');

    await page.getByRole('button', { name: /Create Standard/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Title/i).fill(TITLE);
    await dialog.getByLabel(/Description/i).fill('E2E workflow test standard for compliance tracking.');
    await dialog.getByLabel(/Effective Date/i).fill('2026-01-01');
    await dialog.getByRole('button', { name: /Create Standard/i }).click();

    await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'standard after create');
  });
});
