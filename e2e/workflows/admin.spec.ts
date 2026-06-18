import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Admin configuration entities.
 * Each create uses a unique name (these have (orgId, name)/(orgId, email)
 * unique constraints) so the suite is re-runnable.
 */

test.describe('Workflow: Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.admin);
  });

  test('create a business unit', async ({ page }) => {
    const name = `E2E BU ${uid()}`;
    await page.goto('/admin/business-units');
    await page.getByRole('button', { name: /Add Business Unit/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Name/i).fill(name);
    await dialog.getByRole('button', { name: /^Create$/i }).click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'business units');
  });

  test('create an assessment type', async ({ page }) => {
    const name = `E2E AssessType ${uid()}`;
    await page.goto('/admin/assessment-types');
    await page.getByRole('button', { name: /Add Type/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Name/i).fill(name);
    await dialog.getByRole('button', { name: /^Create$/i }).click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'assessment types');
  });

  test('create a risk matrix', async ({ page }) => {
    const name = `E2E Matrix ${uid()}`;
    await page.goto('/admin/risk-matrices');
    await page.getByRole('button', { name: /Create Matrix/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Name/i).fill(name);
    // Dimension/grid/scale have valid defaults (2D, 5×5, 100). Submit.
    await dialog.getByRole('button', { name: /Create|Save/i }).last().click();
    // Create lands on the matrix builder or shows it in the list.
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'risk matrices');
  });

  test('create a user (one-time password shown)', async ({ page }) => {
    const email = `e2e+${uid()}@acme-corp.com`;
    await page.goto('/admin/users');
    await page.getByRole('button', { name: /Create User/i }).first().click();
    // CreateUserDialog is a custom (non-Radix) modal — target inputs by id.
    await page.locator('#name').fill(`E2E User ${uid()}`);
    await page.locator('#email').fill(email);
    await page.getByRole('button', { name: /Create User/i }).last().click();
    // The generated one-time password panel appears.
    await expect(page.getByText(/only be shown once/i)).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'users');
  });
});
