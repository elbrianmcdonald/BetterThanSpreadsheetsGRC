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
/**
 * The baseline-scoped assessment: 287 score rows and ZERO family rows, because a
 * baseline scopes to baselined controls only. Every base control is therefore a
 * root of the tree, and 54 of them (AC-02 among them) have baselined enhancements
 * below. Making a root with children a header-only group turned those 54 scored
 * controls into unscoreable card titles.
 */
const BASELINE_ASSESSMENT_URL = '/compliance/assessments/demo-ca-002';

/** Open an assessment and switch to the Controls tab. */
async function openControlsTab(page: Page, url = ASSESSMENT_URL): Promise<void> {
  await page.goto(url);
  await page.getByRole('tab', { name: 'Controls', exact: true }).click();
  // The tab really rendered — everything after this is meaningful.
  await expect(page.getByRole('heading', { name: /Control Assessments/ })).toBeVisible({
    timeout: 30000,
  });
}

/**
 * A control's own scoreable row: the innermost div holding that control's expand
 * chevron and its own "Control Details" disclosure. A group header has neither —
 * which is the whole point: a header cannot be scored.
 */
function expandedRow(page: Page, code: string) {
  return page
    .locator('div')
    .filter({ has: page.getByRole('button', { name: `Collapse ${code}`, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Control Details' }) })
    .last();
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

    // AC has 25 base controls, 147 controls once the enhancements below them are
    // counted, and 148 score rows once the family's own row is counted — the
    // family has a score row in the database like every other control, so it must
    // be in the denominator AND scoreable. The old two-level grouping rendered
    // "0/25 controls"; the first fix rendered "0/147" and left the family
    // unscoreable, so the page could never reach notAssessedCount === 0.
    const acHeader = familyHeader(page, 'AC');
    await expect(acHeader).toBeVisible({ timeout: 20000 });
    await expect(acHeader).toContainText(/\d+\/148 controls/);
    await expect(acHeader.getByText(/\/\s*25 controls/)).toHaveCount(0);
    await expect(acHeader.getByText(/\/\s*147 controls/)).toHaveCount(0);

    await assertNoError(page, 'nist 800-53 group denominator');
  });

  test('the family that names the group is itself a scoreable row', async ({ page }) => {
    await openControlsTab(page);
    await page.getByText('AC', { exact: true }).click();

    // AC is not just a card title: it has a score row in the database and the
    // assessment cannot be submitted until it is scored, so it must render as a
    // row with a status control of its own.
    const acRow = expandedRow(page, 'AC');
    await expect(acRow).toBeVisible({ timeout: 20000 });
    await expect(acRow.getByRole('combobox')).toBeVisible();

    await assertNoError(page, 'nist 800-53 family row');
  });

  test('a baseline-scoped assessment can score its base controls', async ({ page }) => {
    // demo-ca-002 has no family rows at all, so AC-02 — the control the whole
    // hierarchy fix exists for — is a ROOT with enhancements below it. It used to
    // render as a group header only: scored in the database, unscoreable on the
    // page, one of 54 controls in that state.
    await openControlsTab(page, BASELINE_ASSESSMENT_URL);

    // The group card is named after the base control itself.
    const card = page
      .locator('div')
      .filter({ has: page.getByText('AC-02', { exact: true }) })
      .filter({ hasText: /\d+\/\d+ controls/ })
      .last();
    await expect(card).toBeVisible({ timeout: 20000 });
    await card.click();

    // AC-02 now has a row of its own, with a status control — it is scoreable.
    const ac02 = expandedRow(page, 'AC-02');
    await expect(ac02).toBeVisible();
    await expect(ac02).toContainText('Account Management');
    await expect(ac02.getByRole('combobox')).toBeVisible();

    // And it is still the parent of its baselined enhancements.
    await expect(page.getByText('AC-02(01)', { exact: true })).toBeVisible();

    await assertNoError(page, 'baseline-scoped assessment');
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

    const statement = ac02
      .locator('p')
      .filter({ hasText: 'Define and document the types of accounts' })
      .last();
    await expect(statement).toBeVisible();

    // toContainText() normalizes whitespace, so it cannot see the formatting bug
    // it would be written to protect: it passes whether or not the newlines
    // survive. innerText is what the user actually reads — NIST's statement is a
    // structured list, and HTML collapses every \n unless the block says so.
    await expect(statement).toHaveCSS('white-space', 'pre-wrap');
    const rendered = await statement.innerText();
    const lines = rendered
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines.length, 'AC-02 renders as a run-on paragraph, not a lettered list').toBeGreaterThan(
      5,
    );
    expect(lines.some((line) => /^a\.\s*Define and document the types of accounts/i.test(line))).toBe(
      true,
    );
    // b. is a LINE of its own, not swallowed into the middle of a. 's line.
    expect(lines.some((line) => /^b\.\s*Assign account managers/i.test(line))).toBe(true);
  });

  test("a control's NIST discussion is on the page the assessor scores it on", async ({ page }) => {
    // The Discussion was imported for 1,014 controls and rendered only on
    // /admin/frameworks — dead data on the assessment, which is the page that
    // tells an assessor how to judge the control.
    await openControlsTab(page);
    await page.getByText('AC', { exact: true }).click();

    const ac02 = controlRow(page, 'AC-02');
    await expect(ac02).toBeVisible({ timeout: 20000 });

    const guidance = ac02.getByRole('button', { name: 'Guidance', exact: true });
    await expect(guidance).toBeVisible();
    await guidance.click();

    // AC-02's Discussion, verbatim from the OSCAL catalog.
    await expect(ac02).toContainText(/Examples of system account types include individual/i);
  });
});
