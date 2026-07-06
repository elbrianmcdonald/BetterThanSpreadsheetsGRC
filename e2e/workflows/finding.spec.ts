import { test, expect } from '@playwright/test';
import { USERS, authedContext, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Findings (two-user) — Risk Model Cleanup era.
 * Bob (GRC_ANALYST) creates a scored finding via the identified-risk card at
 * /findings/new; Alice (ORG_ADMIN) — in a separate session — opens it and
 * links it to a register risk ("Link to Risk", which replaced the legacy
 * accept-into-assessment flow). Verifies cross-user visibility and the
 * finding→risk link landing in the Linked Risks section.
 */

const TITLE = `E2E Finding ${uid()}`;
let findingUrl = '';

test.describe.serial('Workflow: Findings (two-user)', () => {
  test('analyst creates a scored finding via the card form', async ({ browser }) => {
    const { context, page } = await authedContext(browser, USERS.analyst);
    try {
      await page.goto('/findings/new');
      await page.getByPlaceholder(/Short, specific finding label/i).fill(TITLE);
      await page
        .getByPlaceholder(/Describe the finding in detail/i)
        .fill('End-to-end workflow finding created by the analyst, to be linked to a risk by the admin.');

      await page.getByRole('combobox', { name: /Source/ }).click();
      await page.getByRole('option', { name: /Audit/i }).first().click();

      // Severity scoring: inherent likelihood × impact on the org matrix.
      await page.getByRole('combobox', { name: 'Likelihood' }).first().click();
      await page.getByRole('option').first().click();
      await page.getByRole('combobox', { name: 'Impact' }).first().click();
      await page.getByRole('option').first().click();

      // Mark eliminated to satisfy residual scoring without a second pass.
      const eliminated = page.getByRole('checkbox', { name: /Finding eliminated/i });
      if (await eliminated.count()) await eliminated.check();

      await page.getByRole('button', { name: /Create Finding/i }).click();
      await page.waitForURL((url) => /\/findings\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'), {
        timeout: 20000,
      });
      await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 15000 });
      await assertNoError(page, 'finding detail (analyst)');
      findingUrl = new URL(page.url()).pathname;
    } finally {
      await context.close();
    }
  });

  test('admin links the finding to a register risk', async ({ browser }) => {
    const { context, page } = await authedContext(browser, USERS.admin);
    try {
      // Admin opens the exact finding the analyst created (cross-user, same org).
      expect(findingUrl, 'finding URL captured from create step').toMatch(/\/findings\/[^/]+$/);
      await page.goto(findingUrl);
      await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 15000 });

      // "Link to Risk" replaced the legacy accept flow (Story 21.2/23.3).
      await page.getByRole('button', { name: /Link to Risk/i }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Link to Risk').first()).toBeVisible({ timeout: 10000 });

      // Pick the first available register risk and link it.
      await dialog.getByRole('checkbox').first().click();
      await dialog.getByRole('button', { name: /Link \d+ risk/i }).click();

      // The link lands in the Linked Risks section (count badge appears).
      await expect(page.getByText(/Linked Risks/i).first()).toBeVisible({ timeout: 15000 });
      await assertNoError(page, 'finding detail (admin, after link)');
    } finally {
      await context.close();
    }
  });
});
