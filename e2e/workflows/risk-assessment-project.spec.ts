import { test, expect } from '@playwright/test';
import { USERS, authedContext, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Risk Assessment Project (two-user).
 * Alice (admin) creates a risk-assessment project (subject + matrix); Bob
 * (analyst), in a separate session, opens the same project — cross-user org
 * visibility of the created assessment.
 */

const SUBJECT = `E2E Assessment Project ${uid()}`;
let projectUrl = '';

test.describe.serial('Workflow: Risk Assessment Project (two-user)', () => {
  test('admin creates an assessment project', async ({ browser }) => {
    test.slow(); // two contexts + matrix async load
    const { context, page } = await authedContext(browser, USERS.admin);
    try {
      await page.goto('/risk-assessments/new');
      await page.getByPlaceholder(/AWS Migration Project/i).fill(SUBJECT);

      // Risk Matrix is required; the MatrixSelector loads its options async.
      const matrix = page.getByRole('combobox', { name: 'Risk Matrix *' });
      await matrix.waitFor({ state: 'visible', timeout: 20000 });
      await matrix.click();
      await page.getByRole('option', { name: 'Standard 3×3 Risk Matrix', exact: false }).first().click();
      await expect(matrix).toContainText(/Standard 3.3 Risk Matrix/);

      await page.getByRole('button', { name: /Create Assessment/i }).click();
      await page.waitForURL(
        (url) => /\/risk-assessments\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'),
        { timeout: 20000 },
      );
      await expect(page.getByText(SUBJECT).first()).toBeVisible({ timeout: 15000 });
      projectUrl = new URL(page.url()).pathname;
      await assertNoError(page, 'RAP detail (admin)');
    } finally {
      await context.close();
    }
  });

  test('analyst opens the same assessment project', async ({ browser }) => {
    const { context, page } = await authedContext(browser, USERS.analyst);
    try {
      expect(projectUrl).toMatch(/\/risk-assessments\/[^/]+$/);
      await page.goto(projectUrl);
      await expect(page.getByText(SUBJECT).first()).toBeVisible({ timeout: 15000 });
      await assertNoError(page, 'RAP detail (analyst)');
    } finally {
      await context.close();
    }
  });
});
