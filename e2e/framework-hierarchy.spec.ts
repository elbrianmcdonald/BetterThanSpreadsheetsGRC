import { test, expect, type Page } from '@playwright/test';
import { USERS, login, assertNoError } from './support/helpers';

/**
 * The two framework detail pages render through the same FrameworkNodeTable.
 * This suite locks in the hierarchy behaviour of both, plus the product rule
 * that the maturity view carries no risk/finding/health columns.
 *
 * Read-only: it creates nothing and mutates nothing, so it is re-runnable.
 *
 * Selector notes:
 * - /admin/frameworks lists TWO frameworks whose names start with "NIST
 *   Cybersecurity Framework" — a compliance one and the 2.0 maturity one. Every
 *   navigation is therefore scoped to the card that holds the framework's own
 *   exact <h3>, never an nth() index, and the resulting URL is asserted before
 *   anything else.
 * - Rows are addressed by the expand control's aria-label ("Expand <code>" /
 *   "Collapse <code>", FrameworkNodeTable.tsx:262), which is a real button with
 *   aria-expanded. Leaf codes (no chevron) fall back to an exact text match on
 *   the code cell's span.
 */

/** Open a framework's detail page from the list, scoped to its own card. */
async function openFramework(page: Page, name: string): Promise<void> {
  await page.goto('/admin/frameworks');
  const heading = page.getByRole('heading', { name, exact: true });
  await expect(heading).toBeVisible({ timeout: 20000 });
  // Innermost div that holds both this framework's heading and a View link:
  // the list row itself. Ancestors come first in document order, so last() is
  // the row and not the whole list container.
  const card = page
    .locator('div')
    .filter({ has: heading })
    .filter({ has: page.getByRole('link', { name: 'View' }) })
    .last();
  await card.getByRole('link', { name: 'View' }).click();
}

test.describe('Framework detail views render a hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.admin);
  });

  test('NIST SP 800-171 shows families that expand to requirements', async ({ page }) => {
    await openFramework(page, 'NIST SP 800-171');
    await expect(page).toHaveURL(/\/admin\/frameworks\/[^/]+$/);

    // Top-level families are the only rows loaded. 03.01 has children, so it
    // owns a collapsed expand button.
    const expand0301 = page.getByRole('button', { name: 'Expand 03.01', exact: true });
    await expect(expand0301).toBeVisible({ timeout: 20000 });
    await expect(expand0301).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Expand 03.05', exact: true })).toBeVisible();

    // Requirements under it are not rendered until it is expanded.
    await expect(page.getByText('03.01.01', { exact: true })).toHaveCount(0);

    await expand0301.click();

    await expect(page.getByText('03.01.01', { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Collapse 03.01', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // Collapsing puts them away again.
    await page.getByRole('button', { name: 'Collapse 03.01', exact: true }).click();
    await expect(page.getByText('03.01.01', { exact: true })).toHaveCount(0);

    await assertNoError(page, 'nist 800-171 detail');
  });

  test('NIST CSF 2.0 maturity shows Functions that expand to Categories', async ({ page }) => {
    await openFramework(page, 'NIST Cybersecurity Framework 2.0');
    // The compliance "NIST Cybersecurity Framework" lives at /admin/frameworks/[id];
    // this must be the maturity route.
    await expect(page).toHaveURL(/\/admin\/frameworks\/maturity\/[^/]+$/);

    // The six CSF Functions, in framework order — not alphabetical.
    const functionCodes = ['GV', 'ID', 'PR', 'DE', 'RS', 'RC'];
    for (const code of functionCodes) {
      await expect(
        page.getByRole('button', { name: `Expand ${code}`, exact: true }),
        `function ${code} row`,
      ).toBeVisible({ timeout: 20000 });
    }
    await expect(page.getByText('FUNCTION', { exact: true })).toHaveCount(6);

    // Categories stay collapsed until GV is opened.
    await expect(page.getByText('GV.OC', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Expand GV', exact: true }).click();

    await expect(page.getByText('GV.OC', { exact: true })).toBeVisible();
    await expect(page.getByText('GV.SC', { exact: true })).toBeVisible();
    // Subcategories remain hidden one level further down.
    await expect(page.getByText('GV.OC-01', { exact: true })).toHaveCount(0);

    await assertNoError(page, 'nist csf 2.0 detail');
  });

  test('the maturity view does not offer risk, finding, or health columns', async ({ page }) => {
    await openFramework(page, 'NIST Cybersecurity Framework 2.0');
    await expect(page).toHaveURL(/\/admin\/frameworks\/maturity\/[^/]+$/);

    // The table has rendered before the absence assertions are meaningful.
    await expect(page.getByRole('columnheader', { name: 'Code', exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('columnheader', { name: 'Level', exact: true })).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Risks', exact: true })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Findings', exact: true })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Health', exact: true })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Domains', exact: true })).toHaveCount(0);
  });
});
