import { test, expect } from '@playwright/test';

// Test credentials from seed.ts
const TEST_USER = { email: 'admin@acme-corp.com', password: 'Admin123!@#' };

// Helper function to login
async function login(page: any, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 10000 });
}

test.describe('Risk Assessment Project Form', () => {

  test('should load risk assessments list page', async ({ page }) => {
    await login(page, TEST_USER);
    await page.goto('/risk-assessments');

    // Should see the page header
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should load create assessment page with matrix selector', async ({ page }) => {
    await login(page, TEST_USER);
    await page.goto('/risk-assessments/new');

    // Should see the form with specific labels
    await expect(page.locator('label:has-text("Subject")')).toBeVisible();
    await expect(page.locator('label:has-text("Risk Matrix")')).toBeVisible();
    await expect(page.locator('label:has-text("Due Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Assign to myself")')).toBeVisible();
  });

  test('should show description field on create form', async ({ page }) => {
    await login(page, TEST_USER);
    await page.goto('/risk-assessments/new');

    // Should see description field
    await expect(page.locator('text=Description')).toBeVisible();
  });

  test('should show create assessment button on list page', async ({ page }) => {
    await login(page, TEST_USER);
    await page.goto('/risk-assessments');

    // Should see the Create Assessment button
    await expect(page.getByRole('link', { name: /create assessment/i })).toBeVisible({ timeout: 10000 });
  });

  test('should load assessment detail page with identified risks section', async ({ page }) => {
    await login(page, TEST_USER);
    await page.goto('/risk-assessments');

    // Click on first assessment card's View or Continue button
    const viewButton = page.getByRole('button', { name: /view|continue/i }).first();
    await viewButton.click();

    // Wait for navigation to detail page
    await page.waitForURL(/\/risk-assessments\/[a-z0-9-]+/i, { timeout: 10000 });

    // Should see the assessment detail page with back link and identified risks section
    await expect(page.getByText('Back to Assessments')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Identified Risks')).toBeVisible({ timeout: 10000 });
  });
});
