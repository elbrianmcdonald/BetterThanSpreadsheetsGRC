import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Enterprise Risk.
 * Create an enterprise risk → open it → Edit → tag an existing risk + finding
 * via TagItemsDialog → verify the tagged lists + heatmap on the view.
 */

const ER_NAME = `E2E Enterprise Risk ${uid()}`;

test.describe.serial('Workflow: Enterprise Risk', () => {
  test('create an enterprise risk', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/risks/enterprise');

    await page.getByRole('button', { name: /New Enterprise Risk/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(ER_NAME);
    await dialog.getByLabel('Description').fill('E2E enterprise risk created by the workflow suite.');
    await dialog.getByRole('button', { name: /^Create$/i }).click();

    await expect(page.getByText(ER_NAME).first()).toBeVisible({ timeout: 15000 });
    await assertNoError(page, 'enterprise risk list');
  });

  test('tag a risk and a finding, then verify on the view', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/risks/enterprise');
    await page.getByRole('link', { name: new RegExp(ER_NAME) }).first().click();
    await expect(page).toHaveURL(/\/risks\/enterprise\/[^/]+$/);

    // Enter edit mode and open the tag dialog.
    await page.getByRole('button', { name: /^Edit$/i }).click();
    await page.getByRole('button', { name: /Tag risks/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // Risks tab: check the first risk.
    await dialog.getByRole('checkbox').first().check();
    // Findings tab: check the first finding.
    await dialog.getByRole('tab', { name: /Findings/i }).click();
    await dialog.getByRole('checkbox').first().check();
    await dialog.getByRole('button', { name: /Save tags/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10000 });

    // Back in view mode, the tagged sections should show ≥1 each.
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText(/Tagged Risks \([1-9]/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Tagged Findings \([1-9]/)).toBeVisible();
    await expect(page.getByText('Risk Heatmap')).toBeVisible();
    await assertNoError(page, 'enterprise risk view');
  });
});
