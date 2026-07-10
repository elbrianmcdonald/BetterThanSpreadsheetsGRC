/**
 * Canonical Role & Capability-Tier Model (Role Consolidation — Epic 1)
 *
 * Single source of truth for the **four consolidated roles** and the **coarse
 * capability tiers** that `requireRole()` guards against. This is the layer the
 * ~60 scattered `*_ROLES` constants (server routers, client components,
 * `useUserPermissions`) are being repointed to, so an authority change is a
 * one-file edit here — not a 60-file sweep.
 *
 * Two authorization layers exist and are intentionally separate:
 *  - **Coarse tiers (this file)** — read / write / approve / administer. Used by
 *    `requireRole()` at the procedure and page level.
 *  - **Fine-grained permissions** (`@/server/auth/permissions.ts`,
 *    `PERMISSION_MATRIX`) — per-resource operations (`RISK_CREATE`, …). Both
 *    layers are keyed to these four roles once the Prisma enum migration lands
 *    (Epic 3).
 *
 * The role identifiers below are the **target `UserRole` enum values**. Until the
 * schema migration (Epic 2/3) shrinks the Prisma enum, this module is the
 * forward-facing definition; `LEGACY_ROLE_MAP` bridges the current 8 values to
 * these 4 for the data migration and the privilege-drift snapshot test.
 *
 * @see docs/epics-role-consolidation.md
 */

/**
 * The four consolidated application roles, on two axes:
 *  - **Authority:** ANALYST < MANAGER < ADMINISTRATOR, plus read-only BUSINESS_USER.
 *  - **Scope:** ANALYST / MANAGER / ADMINISTRATOR are platform staff (all orgs),
 *    stored on `User.platformRole`; BUSINESS_USER is org-bound via
 *    `OrganizationMembership` and is never stored (it is computed on read).
 */
export const AppRole = {
  ADMINISTRATOR: "ADMINISTRATOR",
  MANAGER: "MANAGER",
  ANALYST: "ANALYST",
  BUSINESS_USER: "BUSINESS_USER",
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];

const { ADMINISTRATOR, MANAGER, ANALYST, BUSINESS_USER } = AppRole;

/** The coarse capabilities every `requireRole()` call-site maps onto. */
export type Capability = "read" | "write" | "approve" | "administer";

/**
 * Capability tiers — the four-role permission matrix, as role sets.
 *
 * | Capability | Analyst | Manager | Administrator | Business User |
 * |------------|:-------:|:-------:|:-------------:|:-------------:|
 * | read       |   ✅    |   ✅    |      ✅       |      ✅       |
 * | write      |   ✅    |   ✅    |      ✅       |      ❌       |
 * | approve    |   ❌    |   ✅    |      ✅       |      ❌       |
 * | administer |   ❌    |   ❌    |      ✅       |      ❌       |
 */
export const READ_ROLES: AppRole[] = [ADMINISTRATOR, MANAGER, ANALYST, BUSINESS_USER];
export const WRITE_ROLES: AppRole[] = [ADMINISTRATOR, MANAGER, ANALYST];
export const APPROVE_ROLES: AppRole[] = [ADMINISTRATOR, MANAGER];
export const ADMIN_ROLES: AppRole[] = [ADMINISTRATOR];

const TIER: Record<Capability, AppRole[]> = {
  read: READ_ROLES,
  write: WRITE_ROLES,
  approve: APPROVE_ROLES,
  administer: ADMIN_ROLES,
};

/** Does `role` hold `capability`? The single predicate all guards should use. */
export function can(role: AppRole, capability: Capability): boolean {
  return TIER[capability].includes(role);
}

/**
 * Platform-staff roles — all-org reach, stored on `User.platformRole`.
 * BUSINESS_USER is the sole org-bound role and is excluded here.
 */
export const STAFF_ROLES: AppRole[] = [ADMINISTRATOR, MANAGER, ANALYST];

/** True for staff (platform-scoped) roles; false for BUSINESS_USER. */
export function isPlatformRole(role: AppRole): boolean {
  return STAFF_ROLES.includes(role);
}

/**
 * Legacy 8-role → 4-role migration map (Epic 3 data migration + snapshot test).
 *
 * Staff-mapped legacy roles (→ ANALYST/MANAGER/ADMINISTRATOR) become
 * `User.platformRole` and their membership rows are dropped; BUSINESS_USER-mapped
 * legacy roles keep their (role-less) membership. `isPlatformAdmin = true` users
 * migrate to ADMINISTRATOR out-of-band (they are a boolean, not an enum value).
 *
 * Keyed by the string names of the current Prisma `UserRole` values so this map
 * does not depend on the enum that is being shrunk.
 */
export const LEGACY_ROLE_MAP: Record<string, AppRole> = {
  ORG_ADMIN: ADMINISTRATOR,
  GRC_MANAGER: MANAGER,
  CISO: MANAGER,
  GRC_ANALYST: ANALYST,
  SECURITY_ENGINEER: ANALYST,
  IT_STAKEHOLDER: BUSINESS_USER,
  BUSINESS_STAKEHOLDER: BUSINESS_USER,
  AUDITOR: BUSINESS_USER,
};
