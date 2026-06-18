import { test, expect } from '@playwright/test';
import { USERS, authedContext, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Assignments (two-user handoff).
 * Bob (analyst) creates a finding and assigns it to Alice (admin); Alice — in a
 * separate session — opens the assigned finding. Exercises a real cross-user
 * work handoff via the AssigneePicker.
 */

const TITLE = `E2E Assigned Finding ${uid()}`;
let findingUrl = '';

test.describe.serial('Workflow: Assignments (two-user)', () => {
  test('analyst creates a finding assigned to the admin', async ({ browser }) => {
    test.slow();
    const { context, page } = await authedContext(browser, USERS.analyst);
    try {
      await page.goto('/findings/new');
      await page.getByPlaceholder(/descriptive title/i).fill(TITLE);
      await page
        .getByPlaceholder(/detailed description of the finding/i)
        .fill('Finding created by the analyst and assigned to the admin for triage.');
      await page.getByRole('combobox', { name: 'Source *' }).click();
      await page.getByRole('option', { name: /Audit/i }).first().click();
      await page.getByRole('combobox', { name: 'Severity *' }).click();
      await page.getByRole('option', { name: /Medium/i }).first().click();

      // Assign to Alice via the AssigneePicker (combobox named by its placeholder).
      await page.getByRole('combobox', { name: /Select assignee/i }).click();
      await page.getByRole('option', { name: /Alice Admin/i }).first().click();
      // Confirm the assignee was applied in the form (sidebar shows "Bob Analyst").
      await expect(page.locator('main').getByText(/Alice Admin/i).first()).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /Create Finding/i }).click();
      await page.waitForURL((url) => /\/findings\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'), {
        timeout: 20000,
      });
      await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 15000 });
      findingUrl = new URL(page.url()).pathname;
      await assertNoError(page, 'assigned finding (analyst)');
    } finally {
      await context.close();
    }
  });

  test('admin receives the assigned finding', async ({ browser }) => {
    const { context, page } = await authedContext(browser, USERS.admin);
    try {
      expect(findingUrl).toMatch(/\/findings\/[^/]+$/);
      await page.goto(findingUrl);
      await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 15000 });
      await assertNoError(page, 'assigned finding (admin)');
    } finally {
      await context.close();
    }
  });
});
