import { test, expect } from '@playwright/test';
import { USERS, login, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Organizational Controls.
 * Create a control (name/type/status) → land on its detail → verify it appears
 * in the controls register.
 */

const NAME = `E2E Control ${uid()}`;

test.describe.serial('Workflow: Org Controls', () => {
  test('create a control', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/controls/new');

    await page.locator('#name').fill(NAME);

    // At least one Owner assignment is required. Add an assignee, pick a
    // seeded person, and set the role to Owner.
    await page.getByRole('button', { name: /Add assignee/i }).click();
    await page.getByText(/Select or create person/i).first().click();
    const search = page.getByPlaceholder(/search/i);
    if (await search.count()) await search.first().fill('Sarah');
    await page.getByRole('option', { name: /Sarah Chen/i }).first().click();
    // Set the assignment role to Owner (default is Operator).
    await page.getByText('Operator', { exact: true }).first().click();
    await page.getByRole('option', { name: /^Owner/i }).first().click();

    await page.getByRole('button', { name: /Create Control/i }).click();

    await page.waitForURL((url) => !url.pathname.endsWith('/controls/new'), { timeout: 15000 });
    await assertNoError(page, 'after control create');
  });

  test('the control appears in the register', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/controls');
    await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 15000 });
  });
});
