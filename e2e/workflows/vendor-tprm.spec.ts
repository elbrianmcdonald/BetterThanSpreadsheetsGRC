import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError, deleteVendorByName } from '../support/helpers';

/**
 * Deep workflow: Third-Party Risk (Vendors).
 * Create a vendor → land on its detail → verify it appears in the register,
 * then delete it in teardown (vendor delete is supported).
 */

const NAME = `E2E Vendor ${uid()}`;

test.describe.serial('Workflow: Vendors (TPRM)', () => {
  test('create a vendor', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/vendors/new');

    await page.getByPlaceholder('Enter vendor name').fill(NAME);
    await page.getByRole('button', { name: /Create Vendor/i }).click();

    await page.waitForURL((url) => !url.pathname.endsWith('/vendors/new'), { timeout: 15000 });
    await assertNoError(page, 'after vendor create');
  });

  test('the vendor appears in the register', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/vendors');
    await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, USERS.admin);
    await deleteVendorByName(page, NAME);
    await page.close();
  });
});
