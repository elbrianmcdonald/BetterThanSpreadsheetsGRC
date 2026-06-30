/**
 * Unit tests for evaluateGraphMigrationSafety (pure function — no DB needed).
 */
import {
  evaluateGraphMigrationSafety,
  type GuardInputs,
} from "../../../prisma/scripts/assert-graph-migration-safe";

describe("evaluateGraphMigrationSafety", () => {
  it("returns safe when roc table does not exist (fresh DB or already dropped)", () => {
    const inputs: GuardInputs = {
      rocTableExists: false,
      rocRowCount: 0,
      graphTablesExist: false,
      unmigratedRocCount: 0,
    };
    const result = evaluateGraphMigrationSafety(inputs);
    expect(result.safe).toBe(true);
  });

  it("returns safe when roc table exists but has zero rows", () => {
    const inputs: GuardInputs = {
      rocTableExists: true,
      rocRowCount: 0,
      graphTablesExist: false,
      unmigratedRocCount: 0,
    };
    const result = evaluateGraphMigrationSafety(inputs);
    expect(result.safe).toBe(true);
  });

  it("returns NOT safe when roc has rows but graph tables do not exist", () => {
    const inputs: GuardInputs = {
      rocTableExists: true,
      rocRowCount: 42,
      graphTablesExist: false,
      unmigratedRocCount: 0, // irrelevant — graph tables missing
    };
    const result = evaluateGraphMigrationSafety(inputs);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toMatch(/Node\/Edge.*tables do not exist/i);
      expect(result.reason).toContain("42");
    }
  });

  it("returns NOT safe when roc has rows, graph tables exist, but unmigrated count > 0", () => {
    const inputs: GuardInputs = {
      rocTableExists: true,
      rocRowCount: 100,
      graphTablesExist: true,
      unmigratedRocCount: 15,
    };
    const result = evaluateGraphMigrationSafety(inputs);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toMatch(/15.*100.*RiskOrganizationalControl/i);
      expect(result.reason).toMatch(/backfill incomplete/i);
    }
  });

  it("returns safe when roc has rows, graph tables exist, and all rows are migrated", () => {
    const inputs: GuardInputs = {
      rocTableExists: true,
      rocRowCount: 100,
      graphTablesExist: true,
      unmigratedRocCount: 0,
    };
    const result = evaluateGraphMigrationSafety(inputs);
    expect(result.safe).toBe(true);
  });
});
