import { test, expect, type Page } from '@playwright/test';
import { USERS, login, assertNoError } from './support/helpers';

/**
 * NIST SP 800-53 is three levels deep — family (AC) -> base control (AC-02) ->
 * enhancement (AC-02(01)). The compliance assessment page used to group exactly
 * two levels, so all 872 enhancements were dropped: they had score rows in the
 * database but never rendered, could not be scored, and did not count towards
 * the group's denominator (AC read "0/25 controls" when its real total is 147).
 * The seed also carried no control text — every description was a copy of the
 * control's own title.
 *
 * This suite guards all three. Read-only: it creates nothing and mutates
 * nothing (no scoring, no status changes), so it is re-runnable against the
 * live demo data.
 *
 * Selector notes:
 * - The page opens on the Executive Summary tab; the controls live behind the
 *   "Controls" tab (role=tab, client.tsx:1207-1222).
 * - A family card is addressed through its font-mono code Badge ("AC"), never
 *   its title: the family's title AND its description both read "Access
 *   Control", so a text match on the title is ambiguous. Clicking the badge
 *   bubbles to the CardHeader's onClick, which is what toggles the card.
 * - A control row's expand control is a real <button> carrying
 *   aria-label="Expand <code>" / "Collapse <code>" and aria-expanded
 *   (client.tsx:344-357) — role-based, not text.
 * - Each test asserts something positive on the page before any toHaveCount(0):
 *   an absence assertion also passes on a blank or wrong page.
 */

const ASSESSMENT_URL = '/compliance/assessments/cmrjrw3x4000g01mmlvdozzpu';

/** Open the assessment and switch to the Controls tab. */
async function openControlsTab(page: Page): Promise<void> {
  await page.goto(ASSESSMENT_URL);
  await page.getByRole('tab', { name: 'Controls', exact: true }).click();
  // The tab really rendered — everything after this is meaningful.
  await expect(page.getByRole('heading', { name: /Control Assessments/ })).toBeVisible({
    timeout: 30000,
  });
}

/** The family group card's header row, addressed by its code badge. */
function familyHeader(page: Page, code: string) {
  return page
    .locator('div')
    .filter({ has: page.getByText(code, { exact: true }) })
    .filter({ hasText: /\d+\/\d+ controls/ })
    .last();
}

/**
 * The innermost row container for a control: the only div holding both that
 * control's expand chevron and its own "Control Details" disclosure.
 */
function controlRow(page: Page, code: string) {
  return page
    .locator('div')
    .filter({ has: page.getByRole('button', { name: `Expand ${code}`, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Control Details' }) })
    .last();
}

test.describe('A compliance assessment exposes every level of the framework', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.admin);
  });

  test('NIST 800-53 control enhancements are reachable and not silently dropped', async ({
    page,
  }) => {
    await openControlsTab(page);

    // Open the Access Control family.
    await page.getByText('AC', { exact: true }).click();

    // Its base controls render. AC-02 has enhancements, so it owns a collapsed
    // expand button.
    const expandAc02 = page.getByRole('button', { name: 'Expand AC-02', exact: true });
    await expect(page.getByText('AC-02', { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(expandAc02).toHaveAttribute('aria-expanded', 'false');

    // The enhancements are not on the page until AC-02 is opened.
    await expect(page.getByText('AC-02(01)', { exact: true })).toHaveCount(0);
    await expect(page.getByText('AC-02(13)', { exact: true })).toHaveCount(0);

    await expandAc02.click();

    // THE REGRESSION: all 872 enhancements used to be dropped entirely — these
    // rows did not exist on the page at any point, at any depth.
    await expect(page.getByText('AC-02(01)', { exact: true })).toBeVisible();
    await expect(page.getByText('AC-02(13)', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Collapse AC-02', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');

    // Collapsing puts them away again.
    await page.getByRole('button', { name: 'Collapse AC-02', exact: true }).click();
    await expect(page.getByText('AC-02(01)', { exact: true })).toHaveCount(0);
    await expect(page.getByText('AC-02', { exact: true })).toBeVisible();

    await assertNoError(page, 'nist 800-53 assessment controls');
  });

  test('the group denominator counts every descendant, not just direct children', async ({
    page,
  }) => {
    await openControlsTab(page);

    // AC has 25 base controls and 147 controls once the enhancements below them
    // are counted. The old two-level grouping rendered "0/25 controls".
    const acHeader = familyHeader(page, 'AC');
    await expect(acHeader).toBeVisible({ timeout: 20000 });
    await expect(acHeader).toContainText(/\d+\/147 controls/);
    await expect(acHeader.getByText(/\/\s*25 controls/)).toHaveCount(0);

    await assertNoError(page, 'nist 800-53 group denominator');
  });

  test('controls carry their real NIST statement, not a copy of their title', async ({ page }) => {
    await openControlsTab(page);
    await page.getByText('AC', { exact: true }).click();

    const ac02 = controlRow(page, 'AC-02');
    await expect(ac02).toBeVisible({ timeout: 20000 });
    // The title, which the description used to be a verbatim copy of.
    await expect(ac02).toContainText('Account Management');

    // The statement lives behind the row's own "Control Details" disclosure.
    await ac02.getByRole('button', { name: 'Control Details' }).click();

    // AC-02's real OSCAL statement opens with its lettered account clause.
    await expect(ac02).toContainText(
      /a\.\s*Define and document the types of accounts allowed and specifically prohibited for use within the system/i,
    );
    await expect(ac02).toContainText(/b\.\s*Assign account managers/i);
  });
});
