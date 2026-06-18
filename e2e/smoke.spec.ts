import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Platform-wide smoke test.
 *
 * Goal: a fast, broad pass that proves every major feature area is reachable and
 * renders without crashing — it does NOT exercise deep workflows. It logs in
 * once (shared storage state), then visits every static feature route asserting:
 *   - the HTTP response is < 400,
 *   - we were not bounced to /login (auth/session works),
 *   - no error boundary / 404 text is shown,
 *   - the authenticated app shell rendered.
 * Plus light content checks on the seeded registers and a few detail drill-downs.
 *
 * Run against the Docker app (port 80):
 *   PW_BASE_URL=http://127.0.0.1 npx playwright test smoke
 * Run against `npm run dev` (port 3000): npx playwright test smoke
 *
 * Requires the demo seed (admin@acme-corp.com / Admin123!@#).
 */

const ADMIN = { email: 'admin@acme-corp.com', password: 'Admin123!@#' };

// Substrings that indicate a crashed page rather than a rendered feature.
const ERROR_TEXT =
  /Application error|server-side exception|Something went wrong|This page could not be found|Internal Server Error|Unhandled Runtime Error/i;

/**
 * Every static (non-parameterized) feature entry point, grouped by area. Detail
 * (/[id]), /new and /edit routes are covered separately via drill-downs since
 * they need real records. Dev-only scaffolding (/test, /examples) is excluded.
 */
const ROUTES: Array<{ area: string; path: string }> = [
  // Core
  { area: 'Core', path: '/' },
  { area: 'Core', path: '/profile' },
  { area: 'Core', path: '/changelog' },
  // Assignments
  { area: 'Assignments', path: '/my-assignments' },
  { area: 'Assignments', path: '/assignments' },
  { area: 'Assignments', path: '/assignments/backlog' },
  { area: 'Assignments', path: '/assignments/my-assignments' },
  // Risk
  { area: 'Risk', path: '/risks' },
  { area: 'Risk', path: '/risks/register' },
  { area: 'Risk', path: '/risks/dashboard' },
  { area: 'Risk', path: '/risks/enterprise' },
  { area: 'Risk', path: '/risks/my-risks' },
  { area: 'Risk', path: '/risks/my-assignments' },
  { area: 'Risk', path: '/risks/assignment-queue' },
  { area: 'Risk', path: '/risks/decisions' },
  { area: 'Risk', path: '/risk-assessments' },
  // Findings
  { area: 'Findings', path: '/findings' },
  // Assessments / Engagements
  { area: 'Assessments', path: '/assessments' },
  { area: 'Assessments', path: '/engagements' },
  // Compliance
  { area: 'Compliance', path: '/compliance/dashboard' },
  { area: 'Compliance', path: '/compliance/assessments' },
  { area: 'Compliance', path: '/compliance/velocity' },
  { area: 'Compliance', path: '/controls' },
  { area: 'Compliance', path: '/framework-controls' },
  { area: 'Compliance', path: '/standards' },
  // Maturity
  { area: 'Maturity', path: '/maturity' },
  { area: 'Maturity', path: '/maturity/dashboard' },
  // Strategy
  { area: 'Strategy', path: '/strategy' },
  { area: 'Strategy', path: '/strategy/dashboard' },
  // Third-party / vendors
  { area: 'TPRM', path: '/vendors' },
  { area: 'TPRM', path: '/tprm/dashboard' },
  { area: 'TPRM', path: '/tprm/assessments' },
  { area: 'TPRM', path: '/tprm/questionnaires' },
  // Business impact
  { area: 'BIA', path: '/bia/dashboard' },
  { area: 'BIA', path: '/bia/functions' },
  { area: 'BIA', path: '/bia/processes' },
  { area: 'BIA', path: '/bia/system-contingency' },
  { area: 'BIA', path: '/bia/reports/asset-impact' },
  { area: 'BIA', path: '/bia/reports/vendor-dependencies' },
  { area: 'BIA', path: '/assets' },
  // MITRE
  { area: 'MITRE', path: '/mitre/tactics' },
  { area: 'MITRE', path: '/mitre/techniques' },
  // Evidence
  { area: 'Evidence', path: '/evidence-requests' },
  // Admin
  { area: 'Admin', path: '/admin/users' },
  { area: 'Admin', path: '/admin/frameworks' },
  { area: 'Admin', path: '/admin/frameworks/assignments' },
  { area: 'Admin', path: '/admin/frameworks/configure' },
  { area: 'Admin', path: '/admin/risk-matrices' },
  { area: 'Admin', path: '/admin/risk-assessment-templates' },
  { area: 'Admin', path: '/admin/assessment-types' },
  { area: 'Admin', path: '/admin/business-units' },
  { area: 'Admin', path: '/admin/taxonomy' },
  { area: 'Admin', path: '/admin/mappings' },
  { area: 'Admin', path: '/admin/evidence' },
  { area: 'Admin', path: '/admin/evidence-requests/sent' },
  { area: 'Admin', path: '/admin/email-queue' },
  { area: 'Admin', path: '/admin/backups' },
  { area: 'Admin', path: '/admin/settings' },
  { area: 'Admin', path: '/admin/settings/hostname' },
  { area: 'Admin', path: '/admin/bia-config' },
];

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

// Logged-in session captured once and reused across route tests.
let storageState: Awaited<ReturnType<BrowserContext['storageState']>>;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, ADMIN);
  storageState = await context.storageState();
  await context.close();
});

async function authedPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  return { context, page };
}

/** Assert no error-boundary / 404 copy is visible on the current page. */
async function assertNoErrorText(page: Page, label: string) {
  await expect(page.getByText(ERROR_TEXT), `${label}: error text present`).toHaveCount(0);
}

/**
 * Assert the current page rendered real content (not a blank/error page).
 * Layout-agnostic positive signal: either the persistent AppLayout sidebar
 * ("GRC Platform") OR a page <h1> is visible — covers both the sidebar pages
 * and the few features that use their own full-screen wrapper. Combined with a
 * no-error-text check.
 */
async function assertRendered(page: Page, label: string) {
  // Wait for the page to settle, then accept either the sidebar shell or an
  // <h1>. Checked separately (not via .or()) so AppLayout pages — which have
  // both — don't trip strict mode.
  const shell = page.getByText('GRC Platform').first();
  const heading = page.locator('h1').first();
  await Promise.race([
    shell.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
    heading.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
  ]);
  const ok = (await shell.isVisible().catch(() => false)) || (await heading.isVisible().catch(() => false));
  expect(ok, `${label}: nothing rendered (no app shell or heading)`).toBeTruthy();
  await assertNoErrorText(page, label);
}

/** Visit a route and assert it loaded (status, no login bounce) and rendered. */
async function assertFeatureRenders(page: Page, path: string) {
  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(resp, `${path}: no response`).toBeTruthy();
  expect(resp!.status(), `${path}: HTTP status`).toBeLessThan(400);
  expect(page.url(), `${path}: bounced to /login`).not.toContain('/login');
  await assertRendered(page, path);
}

test.describe('Smoke: public pages', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('forgot-password page renders', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/risks');
    await expect(page).toHaveURL(/\/login/);
  });

  test('tRPC health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Smoke: feature routes render', () => {
  for (const route of ROUTES) {
    test(`[${route.area}] ${route.path}`, async ({ browser }) => {
      const { context, page } = await authedPage(browser);
      try {
        await assertFeatureRenders(page, route.path);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe('Smoke: seeded register content', () => {
  test('risk register lists seeded risks', async ({ browser }) => {
    const { context, page } = await authedPage(browser);
    try {
      await page.goto('/risks');
      await expect(page.getByText(/RISK-2026-/).first()).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test('findings register lists seeded findings', async ({ browser }) => {
    const { context, page } = await authedPage(browser);
    try {
      await page.goto('/findings');
      await expect(page.getByText(/FND-2026-/).first()).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test('enterprise risk heatmap renders with scored ERs', async ({ browser }) => {
    const { context, page } = await authedPage(browser);
    try {
      await page.goto('/risks/enterprise');
      await expect(page.getByText('Enterprise Risk Heatmap')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Ranked by risk score')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('compliance assessments page renders with seeded data', async ({ browser }) => {
    const { context, page } = await authedPage(browser);
    try {
      await page.goto('/compliance/assessments');
      // Page defaults to the Frameworks tab; assert the heading + the
      // assessments tab (count from the 3 seeded compliance assessments).
      await expect(page.getByRole('heading', { name: 'Compliance Assessments' })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('Active Assessments', { exact: false })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('Smoke: detail drill-downs', () => {
  test('open first risk detail', async ({ browser }) => {
    const { context, page } = await authedPage(browser);
    try {
      await page.goto('/risks');
      // Register rows navigate via router.push on row click (not <a> links).
      const row = page.locator('tbody tr').first();
      await row.waitFor({ state: 'visible', timeout: 15000 });
      await row.click();
      await expect(page).toHaveURL(/\/risks\/[^/]+$/);
      await assertRendered(page, 'risk detail');
    } finally {
      await context.close();
    }
  });

  test('open first enterprise risk detail', async ({ browser }) => {
    const { context, page } = await authedPage(browser);
    try {
      await page.goto('/risks/enterprise');
      const link = page.locator('a[href^="/risks/enterprise/"]').first();
      await link.waitFor({ state: 'visible', timeout: 15000 });
      await link.click();
      await expect(page).toHaveURL(/\/risks\/enterprise\/.+/);
      await expect(page.getByText('Risk Heatmap')).toBeVisible({ timeout: 15000 });
      await assertNoErrorText(page, 'enterprise risk detail');
    } finally {
      await context.close();
    }
  });

  test('open first finding detail', async ({ browser }) => {
    const { context, page } = await authedPage(browser);
    try {
      await page.goto('/findings');
      const link = page.locator('a[href^="/findings/"]:not([href$="/new"])').first();
      await link.waitFor({ state: 'visible', timeout: 15000 });
      await link.click();
      await expect(page).toHaveURL(/\/findings\/[^/]+$/);
      await assertRendered(page, 'finding detail');
    } finally {
      await context.close();
    }
  });
});
