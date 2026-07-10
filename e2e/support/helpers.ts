import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Shared helpers for the deep workflow E2E suite (e2e/workflows/*).
 *
 * Conventions:
 * - Tests run against the seeded demo DB (admin@acme-corp.com / Admin123!@#).
 * - Mutating tests use uid() suffixes on user-named entities so re-runs don't
 *   collide on (organizationId, name) unique constraints.
 * - Teardown is best-effort (UI delete where supported); never fail on cleanup.
 */

export const USERS = {
  admin: { email: 'admin@acme-corp.com', password: 'Admin123!@#', role: 'ADMINISTRATOR' as const },
  analyst: { email: 'analyst@acme-corp.com', password: 'Admin123!@#', role: 'ANALYST' as const },
};

export type TestUser = { email: string; password: string };

/** Crash / 404 copy that should never appear on a working page. */
export const ERROR_TEXT =
  /Application error|server-side exception|Something went wrong|This page could not be found|Internal Server Error|Unhandled Runtime Error/i;

/** Short unique suffix for names that have a (orgId, name) unique constraint. */
export function uid(): string {
  return Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 1000).toString(36);
}

/** Log a page's context in via the credentials form. */
export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
}

/** A fresh authenticated browser context+page for a given user (second actors). */
export async function authedContext(
  browser: Browser,
  user: TestUser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user);
  return { context, page };
}

/** Assert no crash/404 copy is showing. */
export async function assertNoError(page: Page, label: string): Promise<void> {
  await expect(page.getByText(ERROR_TEXT), `${label}: error text present`).toHaveCount(0);
}

/**
 * Select an option from a shadcn/Radix Select. `scope` is the page or a dialog
 * locator; `trigger` is the current trigger text (placeholder or selected
 * value) or a [role=combobox] near a label.
 */
export async function selectByTrigger(
  scope: Page,
  triggerName: RegExp | string,
  optionName: RegExp | string,
): Promise<void> {
  const trigger = scope.getByRole('combobox', { name: triggerName }).first();
  if (await trigger.count()) {
    await trigger.click();
  } else {
    // Fallback: combobox whose visible text matches the placeholder.
    await scope.getByText(triggerName).first().click();
  }
  await scope.getByRole('option', { name: optionName }).first().click();
}

/** Assert a react-hot-toast (or inline success) message appears. */
export async function expectToast(page: Page, text: RegExp | string): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15000 });
}

/**
 * Best-effort teardown: open the risk register, find the row by title, open it,
 * and delete via the detail page's delete control. Swallows all errors.
 */
export async function deleteRiskByTitle(page: Page, title: string): Promise<void> {
  try {
    await page.goto('/risks');
    const row = page.locator('tbody tr', { hasText: title }).first();
    if (!(await row.count())) return;
    await row.click();
    await page.waitForURL(/\/risks\/[^/]+$/, { timeout: 10000 });
    const del = page.getByRole('button', { name: /delete/i }).first();
    if (!(await del.count())) return;
    await del.click();
    // Confirm in the alert dialog if one appears.
    const confirm = page.getByRole('button', { name: /delete|confirm|yes/i }).last();
    if (await confirm.count()) await confirm.click();
    await page.waitForTimeout(500);
  } catch {
    /* best-effort */
  }
}

/** Best-effort teardown for a vendor by name. */
export async function deleteVendorByName(page: Page, name: string): Promise<void> {
  try {
    await page.goto('/vendors');
    const row = page.locator('tbody tr, [role="row"]', { hasText: name }).first();
    if (!(await row.count())) return;
    await row.click();
    await page.waitForURL(/\/vendors\/[^/]+$/, { timeout: 10000 });
    const del = page.getByRole('button', { name: /delete/i }).first();
    if (!(await del.count())) return;
    await del.click();
    const confirm = page.getByRole('button', { name: /delete|confirm|yes/i }).last();
    if (await confirm.count()) await confirm.click();
    await page.waitForTimeout(500);
  } catch {
    /* best-effort */
  }
}
