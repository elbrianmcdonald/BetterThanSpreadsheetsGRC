import { test, expect } from '@playwright/test';
import { USERS, authedContext, uid, assertNoError } from '../support/helpers';

/**
 * Deep workflow: Framework Import (Epic 24, Stories 24.1–24.4).
 *
 * Alice (ORG_ADMIN) imports a control framework end-to-end from a CSV:
 *   upload → preview → column-map (auto-suggested) → framework details →
 *   commit → success. Then verifies the imported framework behaves like a
 *   seeded one: it appears in the frameworks list, activates like any
 *   compliance framework, its controls render with the Family → Base →
 *   Enhancement hierarchy, and it functions in the compliance coverage view.
 *
 * The CSV uses deliberately non-obvious headers (Ref#, Control Name, Details,
 * Domain, Parent) to exercise Story 24.2's alias auto-suggest, and a unique
 * code per run so re-runs don't collide on (organizationId, code, version).
 */

const CODE = `E2EIMP${uid()}`.toUpperCase();
const NAME = `E2E Imported Framework ${uid()}`;
const VERSION = '1.0';

// AC-01/AU-01 have a Family but no Parent → synthesized family parents.
// AC-02 has an explicit Parent (AC-01).
const CSV = [
  'Ref#,Control Name,Details,Domain,Parent',
  'AC-01,Access Control Policy,Develops an access control policy,Access Control,',
  'AC-02,Account Management,Manages information system accounts,Access Control,AC-01',
  'AU-01,Audit Policy,Develops an audit policy,Audit and Accountability,',
].join('\n');

test.describe.serial('Workflow: Framework Import (end-to-end)', () => {
  test('admin imports a framework from CSV and it behaves like a seeded one', async ({
    browser,
  }) => {
    const { context, page } = await authedContext(browser, USERS.admin);
    let frameworkId = '';
    try {
      // --- Stage 1: upload (Story 24.1) ---
      await page.goto('/admin/frameworks/import');
      await assertNoError(page, 'import page');
      await expect(page.getByText(/Step 1 of 3/i)).toBeVisible();

      await page.locator('input[type="file"]').setInputFiles({
        name: `framework-${CODE}.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(CSV),
      });

      // --- Stage 2: preview (Story 24.1) ---
      await expect(page.getByText(/Step 2 of 3/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/3 data rows/i)).toBeVisible();
      await page.getByRole('button', { name: /Continue to Column Mapping/i }).click();

      // --- Stage 3: mapping with auto-suggest (Story 24.2) ---
      await expect(page.getByText(/Step 3 of 3/i)).toBeVisible();
      await expect(page.getByRole('combobox', { name: /Map Control ID/i })).toContainText(/Ref#/);
      await expect(page.getByRole('combobox', { name: /Map Title/i })).toContainText(
        /Control Name/,
      );

      // Framework details (Story 24.3)
      await page.locator('#fw-name').fill(NAME);
      await page.locator('#fw-code').fill(CODE);
      await page.locator('#fw-version').fill(VERSION);

      // --- Commit → success (Story 24.3) ---
      await page.getByRole('button', { name: /Import Framework/i }).click();
      await expect(page.getByText(/Framework imported/i)).toBeVisible({ timeout: 20000 });
      // 3 CSV rows + 2 synthesized family parents = 5 controls.
      await expect(page.getByText(/5 controls/i)).toBeVisible();

      // Capture the framework id from the "View framework" link for direct nav.
      const viewHref = await page
        .getByRole('link', { name: /View framework/i })
        .getAttribute('href');
      frameworkId = viewHref?.split('/').pop() ?? '';
      expect(frameworkId).toMatch(/^[0-9a-f-]{36}$/);

      // --- Parity AC2: controls + hierarchy on the detail page ---
      await page.goto(`/admin/frameworks/${frameworkId}`);
      await assertNoError(page, 'framework detail');
      await expect(page.getByText('AC-01').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('AC-02').first()).toBeVisible();
      // Synthesized family parents appear as controls.
      await expect(page.getByText('Access Control').first()).toBeVisible();
      await expect(page.getByText('Audit and Accountability').first()).toBeVisible();

      // --- Parity AC1: appears in the list + activates like a seeded framework ---
      await page.goto('/admin/frameworks');
      await assertNoError(page, 'frameworks list');
      // Scope to THIS framework's row: the item div containing both its heading
      // and a View link (the item wrapper), avoiding the whole-list container.
      const row = page
        .locator('div')
        .filter({ has: page.getByRole('heading', { name: NAME, exact: true }) })
        .filter({ has: page.getByRole('link', { name: /View/i }) })
        .last();
      await expect(row).toBeVisible();

      const activate = row.getByRole('button', { name: /^Activate$/i });
      if (await activate.count()) {
        await activate.click();
        // Direct mutation → row re-renders with a Deactivate button.
        await expect(row.getByRole('button', { name: /Deactivate/i })).toBeVisible({
          timeout: 15000,
        });
      } else {
        // Already active — the Deactivate affordance must be present.
        await expect(row.getByRole('button', { name: /Deactivate/i })).toBeVisible();
      }

      // --- Parity AC3: functions in the compliance coverage view ---
      await page.goto(`/compliance/frameworks/${frameworkId}`);
      await assertNoError(page, 'compliance coverage');
      await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 15000 });
    } finally {
      // Best-effort teardown: delete the imported framework so it doesn't
      // clutter the demo list. Delete uses a native confirm() dialog — accept
      // it. Never fail the test on cleanup.
      try {
        page.on('dialog', (d) => d.accept().catch(() => {}));
        await page.goto('/admin/frameworks');
        const row = page
          .locator('div')
          .filter({ has: page.getByRole('heading', { name: NAME, exact: true }) })
          .filter({ has: page.getByRole('link', { name: /View/i }) })
          .last();
        // The trash button is the last icon-only button in the row.
        await row.getByRole('button').last().click({ timeout: 5000 });
        await expect(page.getByRole('heading', { name: NAME, exact: true })).toHaveCount(0, {
          timeout: 10000,
        });
      } catch {
        // ignore cleanup failures
      }
      await context.close();
    }
  });
});
