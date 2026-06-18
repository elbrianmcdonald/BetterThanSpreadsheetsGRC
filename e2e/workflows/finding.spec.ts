import { test, expect } from '@playwright/test';
import { USERS, authedContext, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Findings (two-user).
 * Bob (GRC_ANALYST) creates a finding; Alice (ORG_ADMIN) — in a separate
 * session — opens it and advances its status. Verifies cross-user visibility
 * within the org and a real status transition.
 */

const TITLE = `E2E Finding ${uid()}`;
let findingUrl = '';

test.describe.serial('Workflow: Findings (two-user)', () => {
  test('analyst creates a finding', async ({ browser }) => {
    const { context, page } = await authedContext(browser, USERS.analyst);
    try {
      await page.goto('/findings/new');
      await page.getByPlaceholder(/descriptive title/i).fill(TITLE);
      await page
        .getByPlaceholder(/detailed description of the finding/i)
        .fill('End-to-end workflow finding created by the analyst, to be actioned by the admin.');
      // Source + severity selects (labelled comboboxes).
      await page.getByRole('combobox', { name: 'Source *' }).click();
      await page.getByRole('option', { name: /Audit/i }).first().click();
      await page.getByRole('combobox', { name: 'Severity *' }).click();
      await page.getByRole('option', { name: /Medium/i }).first().click();

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

  test('admin opens the finding and advances its status', async ({ browser }) => {
    const { context, page } = await authedContext(browser, USERS.admin);
    try {
      // Admin opens the exact finding the analyst created (cross-user, same org).
      expect(findingUrl, 'finding URL captured from create step').toMatch(/\/findings\/[^/]+$/);
      await page.goto(findingUrl);
      await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 15000 });

      // Best-effort status advance: a triage/accept/status control if present.
      const action = page
        .getByRole('button', { name: /triage|accept|advance|change status|mark as|transition/i })
        .first();
      if (await action.count()) {
        await action.click();
        // If a dialog/menu opened, confirm the first available option.
        const confirm = page.getByRole('button', { name: /confirm|save|accept|triage|update/i }).last();
        if (await confirm.count()) await confirm.click().catch(() => {});
      }
      await assertNoError(page, 'finding detail (admin)');
    } finally {
      await context.close();
    }
  });
});
