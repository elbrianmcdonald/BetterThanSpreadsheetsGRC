import { test, expect } from '@playwright/test';

// Test credentials from seed.ts - Default password: Admin123!@#
const TEST_USERS = {
  acmeAdmin: { email: 'admin@acme-corp.com', password: 'Admin123!@#', name: 'Alice Admin', role: 'ORG_ADMIN' },
  acmeAnalyst: { email: 'analyst@acme-corp.com', password: 'Admin123!@#', name: 'Bob Analyst', role: 'GRC_ANALYST' },
};

// Helper function to login
async function login(page: any, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 10000 });
}

test.describe('Epic 4: Risk Management', () => {

  test.describe('Story 4.1: Risk Creation', () => {

    test.beforeEach(async ({ page }) => {
      await login(page, TEST_USERS.acmeAdmin);
    });

    test('should navigate to risk creation page', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Should stay on /risks/new (not redirected)
      expect(page.url()).toContain('/risks/new');

      // Check for page heading
      await expect(page.locator('h1')).toContainText(/Create.*Risk|New.*Risk/i);
    });

    test('risk creation form should have required fields', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Check for Title field
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]');
      await expect(titleInput).toBeVisible();

      // Check for Severity dropdown
      const severityTrigger = page.locator('button:has-text("Select severity")');
      await expect(severityTrigger).toBeVisible();

      // Check for Description field
      const descriptionField = page.locator('textarea').first();
      await expect(descriptionField).toBeVisible();

      // Check for Create Risk button
      const submitButton = page.getByRole('button', { name: /Create Risk/i });
      await expect(submitButton).toBeVisible();
    });
  });

  test.describe('Story 4.2: Risk Templates', () => {

    test.beforeEach(async ({ page }) => {
      await login(page, TEST_USERS.acmeAdmin);
    });

    test('AC22: risk creation form includes template selector dropdown', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Check for template selector section
      await expect(page.getByText('Start with a Template')).toBeVisible();

      // Check for template dropdown
      const templateDropdown = page.locator('button:has-text("Select a template"), button:has-text("Start from scratch")');
      await expect(templateDropdown).toBeVisible();
    });

    test('AC23: template selector shows template name and category', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Click template dropdown to open it
      const templateDropdown = page.locator('button[role="combobox"]').first();
      await templateDropdown.click();
      await page.waitForTimeout(500);

      // Check that templates are visible with names (use role to be more specific)
      await expect(page.getByRole('option', { name: /Cloud Infrastructure/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Access Control/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Data Security/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Network Security/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Application Security/i })).toBeVisible();
    });

    test('AC26: "Start from scratch" option available', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Click template dropdown
      const templateDropdown = page.locator('button[role="combobox"]').first();
      await templateDropdown.click();
      await page.waitForTimeout(500);

      // Check for "Start from scratch" option
      await expect(page.getByRole('option', { name: /Start from scratch/i })).toBeVisible();
    });

    test('AC24: selecting template pre-populates description field', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Click template dropdown
      const templateDropdown = page.locator('button[role="combobox"]').first();
      await templateDropdown.click();
      await page.waitForTimeout(500);

      // Select Cloud Infrastructure template using role option
      await page.getByRole('option', { name: /Cloud Infrastructure/i }).click();
      await page.waitForTimeout(500);

      // Check that description is pre-populated
      const descriptionField = page.locator('textarea[name="description"]');
      const descriptionValue = await descriptionField.inputValue();

      // Should contain template description and evidence guidance
      expect(descriptionValue.toLowerCase()).toContain('cloud');
    });

    test('AC24: selecting template pre-populates severity', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Click template dropdown
      const templateDropdown = page.locator('button[role="combobox"]').first();
      await templateDropdown.click();
      await page.waitForTimeout(500);

      // Select Access Control template (default severity: HIGH)
      await page.getByRole('option', { name: /Access Control/i }).click();
      await page.waitForTimeout(500);

      // Check that severity is pre-populated to HIGH - look for the severity dropdown showing High
      await expect(page.locator('button[role="combobox"]:has-text("High")')).toBeVisible();
    });

    test('AC25: user can override pre-populated values', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Select a template first
      const templateDropdown = page.locator('button[role="combobox"]').first();
      await templateDropdown.click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: /Cloud Infrastructure/i }).click();
      await page.waitForTimeout(500);

      // Modify the description
      const descriptionField = page.locator('textarea[name="description"]');
      await descriptionField.fill('My custom description that overrides the template content');

      // Verify the description was changed
      const newValue = await descriptionField.inputValue();
      expect(newValue).toBe('My custom description that overrides the template content');
    });

    test('template info card shows selected template details', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Select a template
      const templateDropdown = page.locator('button[role="combobox"]').first();
      await templateDropdown.click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: /Cloud Infrastructure/i }).click();
      await page.waitForTimeout(500);

      // Check for template info card - use first() to avoid duplicates
      await expect(page.getByText('Pre-populated domains:').first()).toBeVisible();
      await expect(page.getByText('Default severity:').first()).toBeVisible();
    });

    test('full risk creation form is ready for submission with template', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Select a template
      const templateDropdown = page.locator('button[role="combobox"]').first();
      await templateDropdown.click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: /Cloud Infrastructure/i }).click();
      await page.waitForTimeout(500);

      // Fill in title (required)
      const titleInput = page.locator('input[name="title"]');
      await titleInput.fill('E2E Test: Cloud Security Misconfiguration');

      // Verify all fields are properly populated
      // Title is filled
      expect(await titleInput.inputValue()).toBe('E2E Test: Cloud Security Misconfiguration');

      // Description is pre-populated from template
      const descriptionField = page.locator('textarea[name="description"]');
      const descValue = await descriptionField.inputValue();
      expect(descValue.length).toBeGreaterThan(100);

      // Severity is pre-populated (Medium for Cloud Infrastructure template)
      await expect(page.locator('button[role="combobox"]:has-text("Medium")')).toBeVisible();

      // Submit button is enabled and ready
      const submitButton = page.getByRole('button', { name: /Create Risk/i });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('Story 4.3: Risk Finding Documentation', () => {

    test.beforeEach(async ({ page }) => {
      await login(page, TEST_USERS.acmeAdmin);
    });

    test('AC1-AC3: Description field has markdown preview', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Check for description textarea
      const descriptionField = page.locator('textarea[name="description"]');
      await expect(descriptionField).toBeVisible();

      // Check for preview toggle button
      const previewToggle = page.locator('button:has-text("Preview"), button:has-text("Edit")');
      await expect(previewToggle).toBeVisible();
    });

    test('AC6: Description field has formatting toolbar', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Check for formatting buttons (Bold, Italic, Code, List, Link)
      const boldButton = page.locator('button[title*="Bold"], button:has-text("B")').first();
      const italicButton = page.locator('button[title*="Italic"], button:has-text("I")').first();

      await expect(boldButton).toBeVisible();
      await expect(italicButton).toBeVisible();
    });

    test('AC12-AC14: Severity dropdown with color-coded options', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Click severity dropdown
      const severityDropdown = page.locator('button:has-text("Select severity")');
      await severityDropdown.click();
      await page.waitForTimeout(500);

      // Check for severity options with colors
      await expect(page.getByRole('option', { name: /High/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Medium/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Low/i })).toBeVisible();
    });

    test('AC18: Finding Source dropdown is present', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Check for Finding Source field
      const findingSourceLabel = page.getByText('Finding Source');
      await expect(findingSourceLabel).toBeVisible();

      // Click the dropdown
      const findingSourceDropdown = page.locator('button:has-text("How was this discovered?")');
      await findingSourceDropdown.click();
      await page.waitForTimeout(500);

      // Check for options
      await expect(page.getByRole('option', { name: /Vulnerability Scan/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Penetration Test/i })).toBeVisible();
    });

    test('AC19: CVE/Reference ID field is present', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Check for CVE ID field
      const cveInput = page.locator('input[name="cveId"], input[placeholder*="CVE" i]');
      await expect(cveInput).toBeVisible();
    });

    test('AC20: Discovery Date field is present', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Check for Discovery Date field
      const discoveryDateLabel = page.getByText('Discovery Date');
      await expect(discoveryDateLabel).toBeVisible();
    });

    test('AC21: Technical Details section is present', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Check for Technical Details collapsible section
      const technicalDetailsLabel = page.getByText('Technical Details');
      await expect(technicalDetailsLabel).toBeVisible();
    });

    test('can create risk with Story 4.3 fields', async ({ page }) => {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Fill in required fields
      await page.locator('input[name="title"]').fill('E2E Test: SQL Injection Finding');

      const descriptionField = page.locator('textarea[name="description"]');
      await descriptionField.fill('## Summary\n\nSQL injection vulnerability found in login form.\n\n**Impact:** High - data breach potential.');

      // Select severity
      await page.locator('button:has-text("Select severity")').click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /High/i }).click();

      // Select finding source
      await page.locator('button:has-text("How was this discovered?")').click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /Penetration Test/i }).click();

      // Fill CVE ID
      const cveInput = page.locator('input[name="cveId"]');
      if (await cveInput.isVisible()) {
        await cveInput.fill('CVE-2024-12345');
      }

      // Submit the form
      await page.getByRole('button', { name: /Create Risk/i }).click();
      await page.waitForTimeout(2000);

      // Should redirect or show success
      // Either we're on a detail page or we see a success message
      const successOrRedirect = await Promise.race([
        page.waitForURL(/\/risks\/[a-zA-Z0-9]+$/, { timeout: 5000 }).then(() => 'redirected'),
        page.getByText(/successfully|created/i).waitFor({ timeout: 5000 }).then(() => 'success message'),
      ]).catch(() => 'timeout');

      expect(['redirected', 'success message']).toContain(successOrRedirect);
    });
  });
});
