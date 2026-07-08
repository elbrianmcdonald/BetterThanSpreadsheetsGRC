import { test, expect } from '@playwright/test';
import { USERS, authedContext, assertNoError } from '../support/helpers';

/**
 * Workflow: Map Once, Comply Many — export the crosswalk as an audit deliverable
 * (Epic 26, Story 26.4).
 *
 * The generate → confirm → reject → coverage logic is covered deterministically
 * by the integration suites (crosswalk-suggestions / crosswalk-review /
 * crosswalk-coverage). This spec verifies the end-to-end export path through the
 * browser: open the org-control workbench for a seeded framework, trigger a CSV
 * export, and assert a well-formed audit file downloads with the expected header.
 */

const NISTCSF = '550e8400-e29b-41d4-a716-446655440071';

test.describe.serial('Workflow: Crosswalk export (audit deliverable)', () => {
  test('admin exports the org-control crosswalk as CSV from the workbench', async ({ browser }) => {
    const { context, page } = await authedContext(browser, USERS.admin);
    try {
      // Coverage dashboard renders (Story 26.3) — a read-only aggregate view.
      await page.goto(`/crosswalks/coverage/${NISTCSF}`);
      await assertNoError(page, 'coverage dashboard');
      await expect(page.getByRole('heading', { name: /Crosswalk Coverage/i })).toBeVisible();
      await expect(page.getByText(/confirmed/i).first()).toBeVisible();

      // Org-control workbench with the export controls (Story 26.4).
      await page.goto(`/crosswalks/org-controls/${NISTCSF}`);
      await assertNoError(page, 'org-control workbench');
      await expect(page.getByRole('heading', { name: /Org Control Crosswalk/i })).toBeVisible();

      // Export CSV → a download with the full audit header.
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /^CSV$/ }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/crosswalk-.*\.csv$/);

      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      const text = Buffer.concat(chunks).toString('utf-8');

      // Header carries the audit columns, incl. lineage + reviewer (FR19), and
      // "complete" scope means every framework control appears (mapped or not).
      expect(text).toContain('Org Control ID');
      expect(text).toContain('Lineage');
      expect(text).toContain('Reviewed By');
      // NIST CSF has controls, so at least one framework-control row is present.
      expect(text).toMatch(/PR\.AC-1|DE\.AE-1|\(no mapping\)/);
    } finally {
      await context.close();
    }
  });
});
