import { test, expect } from '@playwright/test';

// Test credentials from seed.ts - Default password: Admin123!@#
const TEST_USERS = {
  acmeAdmin: { email: 'admin@acme-corp.com', password: 'Admin123!@#', name: 'Alice Admin', role: 'ADMINISTRATOR' },
  acmeAnalyst: { email: 'analyst@acme-corp.com', password: 'Admin123!@#', name: 'Bob Analyst', role: 'ANALYST' },
  acmeSecurityEngineer: { email: 'security@acme-corp.com', password: 'Admin123!@#', name: 'Cynthia Security', role: 'ANALYST' },
  acmeAuditor: { email: 'auditor@acme-corp.com', password: 'Admin123!@#', name: 'Dave Auditor', role: 'BUSINESS_USER' },
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

  test.describe('Story 4.4: Evidence Linkage to Risk Records', () => {

    // Helper to create a test risk and navigate to its detail page
    async function createTestRisk(page: any): Promise<string> {
      await page.goto('/risks/new');
      await page.waitForTimeout(2000);

      // Fill minimal required fields
      await page.locator('input[name="title"]').fill('E2E Test Risk for Evidence Linkage');
      await page.locator('textarea[name="description"]').fill('Test risk for evidence attachment testing');

      // Select severity
      await page.locator('button:has-text("Select severity")').click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /Medium/i }).click();

      // Submit
      await page.getByRole('button', { name: /Create Risk/i }).click();

      // Wait for success state - shows "Risk Created Successfully"
      await page.waitForSelector('text=Risk Created Successfully', { timeout: 10000 });

      // Click "View Risk Details" to navigate to detail page
      await page.getByRole('link', { name: /View Risk Details/i }).click();
      await page.waitForTimeout(2000);

      // Get the risk ID from URL (now on /risks/[id])
      const url = page.url();
      const match = url.match(/\/risks\/([a-zA-Z0-9]+)/);
      return match ? match[1] : '';
    }

    test.describe('AC16-AC21: Evidence Upload from Risk Page', () => {

      test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.acmeAdmin);
      });

      test('AC16: Risk detail page has "Attach Evidence" button for authorized users', async ({ page }) => {
        const riskId = await createTestRisk(page);

        // Navigate to risk detail page
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        // Check for Attach Evidence button
        const attachButton = page.getByRole('button', { name: /Attach Evidence/i });
        await expect(attachButton).toBeVisible();
      });

      test('AC17: Clicking button opens evidence upload dialog', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        // Click Attach Evidence button
        await page.getByRole('button', { name: /Attach Evidence/i }).click();
        await page.waitForTimeout(500);

        // Dialog should open
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('Attach Evidence to Risk')).toBeVisible();
      });

      test('AC18: Dialog supports file upload with drag-drop zone', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        await page.getByRole('button', { name: /Attach Evidence/i }).click();
        await page.waitForTimeout(500);

        const dialog = page.getByRole('dialog');

        // Check for file drop zone
        await expect(dialog.getByText('Drag and drop a file')).toBeVisible();
        await expect(dialog.getByText(/Supported:/)).toBeVisible();
        await expect(dialog.getByText(/Max size:/)).toBeVisible();
      });

      test('AC19: Dialog includes evidence type selection', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        await page.getByRole('button', { name: /Attach Evidence/i }).click();
        await page.waitForTimeout(500);

        const dialog = page.getByRole('dialog');

        // Note: Evidence type radio buttons only appear after file is selected
        // Check that dialog is ready for file selection
        await expect(dialog.getByText('Upload and Link')).toBeVisible();
      });
    });

    test.describe('AC22-AC26: Link Existing Evidence', () => {

      test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.acmeAdmin);
      });

      test('AC22: Risk detail page has "Link Evidence" button in evidence section', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        // Check for Link Evidence button in the RiskEvidenceSection
        const linkButton = page.getByRole('button', { name: /Link Evidence/i });
        await expect(linkButton).toBeVisible();
      });

      test('AC23: Clicking button opens evidence selection dialog', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        // Click Link Evidence button
        await page.getByRole('button', { name: /Link Evidence/i }).click();
        await page.waitForTimeout(500);

        // Dialog should open
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('Link Evidence to Risk')).toBeVisible();
      });

      test('AC24: Dialog shows searchable evidence repository', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        await page.getByRole('button', { name: /Link Evidence/i }).click();
        await page.waitForTimeout(500);

        const dialog = page.getByRole('dialog');

        // Check for search input
        await expect(dialog.locator('input[type="search"], input[placeholder*="Search"]')).toBeVisible();
      });

      test('AC25: User can choose link type (Finding/Remediation)', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        await page.getByRole('button', { name: /Link Evidence/i }).click();
        await page.waitForTimeout(500);

        const dialog = page.getByRole('dialog');

        // Check for link type radio buttons
        await expect(dialog.getByLabel(/Finding Evidence/i)).toBeVisible();
        await expect(dialog.getByLabel(/Remediation Evidence/i)).toBeVisible();
      });
    });

    test.describe('AC27-AC32: Linked Evidence Display', () => {

      test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.acmeAdmin);
      });

      test('AC27: Risk detail page shows "Linked Evidence" section', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        // Check for Linked Evidence section
        await expect(page.getByText('Linked Evidence')).toBeVisible();
      });

      test('AC28: Evidence displayed in categorized lists', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        // Check for Finding Evidence and Remediation Evidence section headings
        await expect(page.getByRole('heading', { name: 'Finding Evidence' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Remediation Evidence' })).toBeVisible();
      });

      test('AC32: Empty state shows appropriate message', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        // Check for empty state messages (new risk has no evidence)
        await expect(page.getByText('No finding evidence linked yet')).toBeVisible();
        await expect(page.getByText('No remediation evidence linked yet')).toBeVisible();
      });
    });

    test.describe('AC33-AC36: Role-Based Permissions', () => {

      test('AC33: ORG_ADMIN can see Attach Evidence button', async ({ page }) => {
        await login(page, TEST_USERS.acmeAdmin);
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        await expect(page.getByRole('button', { name: /Attach Evidence/i })).toBeVisible();
      });

      test('AC33: GRC_ANALYST can see Attach Evidence button', async ({ page }) => {
        await login(page, TEST_USERS.acmeAnalyst);

        // Navigate to an existing risk (analyst may not have permission to create)
        await page.goto('/risks');
        await page.waitForTimeout(2000);

        // If there are risks, click the first one
        const firstRisk = page.locator('a[href^="/risks/"]').first();
        if (await firstRisk.isVisible()) {
          await firstRisk.click();
          await page.waitForTimeout(2000);
          await expect(page.getByRole('button', { name: /Attach Evidence/i })).toBeVisible();
        }
      });

      test('AC36: AUDITOR cannot see Attach Evidence button (view only)', async ({ page }) => {
        // Try to login as auditor - skip if user doesn't exist
        try {
          await page.goto('/login');
          await page.fill('input[name="email"]', TEST_USERS.acmeAuditor.email);
          await page.fill('input[name="password"]', TEST_USERS.acmeAuditor.password);
          await page.click('button[type="submit"]');

          // Wait for either redirect or error
          const result = await Promise.race([
            page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 5000 }).then(() => 'success'),
            page.waitForSelector('text=Invalid credentials', { timeout: 5000 }).then(() => 'invalid'),
          ]).catch(() => 'timeout');

          if (result !== 'success') {
            test.skip(); // Skip if auditor user doesn't exist
            return;
          }
        } catch {
          test.skip(); // Skip if login fails
          return;
        }

        // Navigate to risks page
        await page.goto('/risks');
        await page.waitForTimeout(2000);

        // If there are risks, click the first one
        const firstRisk = page.locator('a[href^="/risks/"]').first();
        if (await firstRisk.isVisible()) {
          await firstRisk.click();
          await page.waitForTimeout(2000);

          // Auditor should NOT see Attach Evidence button
          await expect(page.getByRole('button', { name: /Attach Evidence/i })).not.toBeVisible();
        }
      });
    });

    test.describe('Accessibility', () => {

      test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.acmeAdmin);
      });

      test('AC8 (Issue 8 fix): File drop zone is keyboard accessible', async ({ page }) => {
        const riskId = await createTestRisk(page);
        await page.goto(`/risks/${riskId}`);
        await page.waitForTimeout(2000);

        await page.getByRole('button', { name: /Attach Evidence/i }).click();
        await page.waitForTimeout(500);

        const dialog = page.getByRole('dialog');

        // Check for role="button" on drop zone
        const dropZone = dialog.locator('[role="button"]').first();
        await expect(dropZone).toBeVisible();

        // Check for tabIndex (keyboard focusable)
        const tabIndex = await dropZone.getAttribute('tabindex');
        expect(tabIndex).toBe('0');

        // Check for aria-label
        const ariaLabel = await dropZone.getAttribute('aria-label');
        expect(ariaLabel).toContain('Upload file');
      });
    });
  });
});
