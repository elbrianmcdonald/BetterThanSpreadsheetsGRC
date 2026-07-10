/**
 * Role Consolidation — Permission Matrix Contract (Epic 1, Story 1.1 / 1.2)
 *
 * This is the enforcement contract for the four-role model. It is written as an
 * explicit truth table (NOT derived from the module under test) so that a change
 * to the tiers must be a deliberate change here too. It also guards the 8→4
 * migration against silent privilege drift.
 *
 * @see docs/epics-role-consolidation.md
 */

import {
  AppRole,
  type Capability,
  can,
  isPlatformRole,
  STAFF_ROLES,
  LEGACY_ROLE_MAP,
} from "@/lib/auth/roles";

/** Hand-authored expected matrix — the source of truth for this test. */
const EXPECTED: Record<AppRole, Record<Capability, boolean>> = {
  [AppRole.ANALYST]: { read: true, write: true, approve: false, administer: false },
  [AppRole.MANAGER]: { read: true, write: true, approve: true, administer: false },
  [AppRole.ADMINISTRATOR]: { read: true, write: true, approve: true, administer: true },
  [AppRole.BUSINESS_USER]: { read: true, write: false, approve: false, administer: false },
};

const ALL_ROLES = Object.values(AppRole);
const ALL_CAPS: Capability[] = ["read", "write", "approve", "administer"];

describe("Role consolidation — four-role permission matrix", () => {
  it("defines exactly four roles", () => {
    expect(new Set(ALL_ROLES)).toEqual(
      new Set(["ADMINISTRATOR", "MANAGER", "ANALYST", "BUSINESS_USER"]),
    );
  });

  describe("every (role × capability) cell matches the contract", () => {
    for (const role of ALL_ROLES) {
      for (const capability of ALL_CAPS) {
        const expected = EXPECTED[role][capability];
        it(`${role} ${expected ? "CAN" : "cannot"} ${capability}`, () => {
          expect(can(role, capability)).toBe(expected);
        });
      }
    }
  });

  it("Business User is read-only (no write, approve, or administer)", () => {
    expect(can(AppRole.BUSINESS_USER, "read")).toBe(true);
    expect(can(AppRole.BUSINESS_USER, "write")).toBe(false);
    expect(can(AppRole.BUSINESS_USER, "approve")).toBe(false);
    expect(can(AppRole.BUSINESS_USER, "administer")).toBe(false);
  });

  it("only Administrator can administer", () => {
    const admins = ALL_ROLES.filter((r) => can(r, "administer"));
    expect(admins).toEqual([AppRole.ADMINISTRATOR]);
  });

  it("approve is limited to Manager and Administrator", () => {
    const approvers = ALL_ROLES.filter((r) => can(r, "approve")).sort();
    expect(approvers).toEqual([AppRole.ADMINISTRATOR, AppRole.MANAGER].sort());
  });
});

describe("Role consolidation — scope axis", () => {
  it("the three staff roles are platform-scoped; Business User is not", () => {
    expect(STAFF_ROLES.sort()).toEqual(
      [AppRole.ADMINISTRATOR, AppRole.MANAGER, AppRole.ANALYST].sort(),
    );
    expect(isPlatformRole(AppRole.ANALYST)).toBe(true);
    expect(isPlatformRole(AppRole.MANAGER)).toBe(true);
    expect(isPlatformRole(AppRole.ADMINISTRATOR)).toBe(true);
    expect(isPlatformRole(AppRole.BUSINESS_USER)).toBe(false);
  });
});

describe("Role consolidation — legacy 8→4 migration map", () => {
  const LEGACY_ROLES = [
    "ORG_ADMIN",
    "GRC_MANAGER",
    "GRC_ANALYST",
    "SECURITY_ENGINEER",
    "CISO",
    "IT_STAKEHOLDER",
    "BUSINESS_STAKEHOLDER",
    "AUDITOR",
  ];

  it("maps every one of the eight legacy roles exactly once", () => {
    for (const legacy of LEGACY_ROLES) {
      expect(LEGACY_ROLE_MAP[legacy]).toBeDefined();
    }
    expect(Object.keys(LEGACY_ROLE_MAP).sort()).toEqual([...LEGACY_ROLES].sort());
  });

  it("every mapped target is one of the four consolidated roles", () => {
    for (const target of Object.values(LEGACY_ROLE_MAP)) {
      expect(ALL_ROLES).toContain(target);
    }
  });

  it("no privilege drift: read-only legacy roles map to a non-writing role", () => {
    for (const legacy of ["IT_STAKEHOLDER", "BUSINESS_STAKEHOLDER", "AUDITOR"]) {
      const target = LEGACY_ROLE_MAP[legacy]!;
      expect(can(target, "write")).toBe(false);
      expect(can(target, "approve")).toBe(false);
      expect(can(target, "administer")).toBe(false);
    }
  });

  it("no privilege drift: approver legacy roles map to a role that can approve", () => {
    for (const legacy of ["GRC_MANAGER", "CISO", "ORG_ADMIN"]) {
      expect(can(LEGACY_ROLE_MAP[legacy]!, "approve")).toBe(true);
    }
  });

  it("only ORG_ADMIN gains administer authority", () => {
    for (const legacy of LEGACY_ROLES) {
      const canAdminister = can(LEGACY_ROLE_MAP[legacy]!, "administer");
      expect(canAdminister).toBe(legacy === "ORG_ADMIN");
    }
  });

  it("the migration snapshot is stable", () => {
    expect(LEGACY_ROLE_MAP).toMatchInlineSnapshot(`
      {
        "AUDITOR": "BUSINESS_USER",
        "BUSINESS_STAKEHOLDER": "BUSINESS_USER",
        "CISO": "MANAGER",
        "GRC_ANALYST": "ANALYST",
        "GRC_MANAGER": "MANAGER",
        "IT_STAKEHOLDER": "BUSINESS_USER",
        "ORG_ADMIN": "ADMINISTRATOR",
        "SECURITY_ENGINEER": "ANALYST",
      }
    `);
  });
});
