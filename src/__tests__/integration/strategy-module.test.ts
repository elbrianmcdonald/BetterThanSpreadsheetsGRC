/**
 * Strategy Module Integration Tests
 *
 * Story 6.4: Integration & E2E Testing for Strategy Module
 *
 * **Test Coverage:**
 * - AC1: Permission integration tests for all roles
 * - AC2: Multi-tenant isolation tests
 * - AC3: History creation tests
 * - AC4: Progress rollup consistency tests
 * - AC5: E2E workflow tests
 * - AC6: Cascade delete tests
 * - AC7: Atomic operation tests
 *
 * @see Story 6.4: Integration & E2E Testing
 * @see docs/epics-strategy.md
 */

import { type UserRole, StrategyStatus, ObjectiveStatus, KpiType, ChangeType } from "@prisma/client";
import { randomUUID } from "crypto";
import { db, rawPrisma } from "@/server/db";
import { appRouter } from "@/server/api/root";

// Test data
let orgA: { id: string; name: string };
let orgB: { id: string; name: string };

// Users with different roles in Org A
let cisoA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let analystA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let adminA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let secEngA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let itStakeA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let bizStakeA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let auditorA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };

// User in Org B for cross-tenant tests
let adminB: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrgA = await db.organization.findUnique({
    where: { slug: "test-strategy-org-a" },
  });
  if (existingOrgA) {
    await rawPrisma.strategyHistory.deleteMany({ where: { strategy: { organizationId: existingOrgA.id } } });
    await rawPrisma.goalHistory.deleteMany({ where: { goal: { strategy: { organizationId: existingOrgA.id } } } });
    await rawPrisma.objectiveHistory.deleteMany({ where: { objective: { goal: { strategy: { organizationId: existingOrgA.id } } } } });
    await rawPrisma.comment.deleteMany({ where: { OR: [{ goal: { strategy: { organizationId: existingOrgA.id } } }, { objective: { goal: { strategy: { organizationId: existingOrgA.id } } } }] } });
    await rawPrisma.objectiveAssignee.deleteMany({ where: { objective: { goal: { strategy: { organizationId: existingOrgA.id } } } } });
    await rawPrisma.objective.deleteMany({ where: { goal: { strategy: { organizationId: existingOrgA.id } } } });
    await rawPrisma.goal.deleteMany({ where: { strategy: { organizationId: existingOrgA.id } } });
    await rawPrisma.strategy.deleteMany({ where: { organizationId: existingOrgA.id } });
    await rawPrisma.auditLog.deleteMany({ where: { organizationId: existingOrgA.id } });
    await rawPrisma.user.deleteMany({ where: { organizationId: existingOrgA.id } });
    await rawPrisma.organization.delete({ where: { id: existingOrgA.id } });
  }
  const existingOrgB = await rawPrisma.organization.findUnique({
    where: { slug: "test-strategy-org-b" },
  });
  if (existingOrgB) {
    await rawPrisma.strategyHistory.deleteMany({ where: { strategy: { organizationId: existingOrgB.id } } });
    await rawPrisma.goalHistory.deleteMany({ where: { goal: { strategy: { organizationId: existingOrgB.id } } } });
    await rawPrisma.objectiveHistory.deleteMany({ where: { objective: { goal: { strategy: { organizationId: existingOrgB.id } } } } });
    await rawPrisma.comment.deleteMany({ where: { OR: [{ goal: { strategy: { organizationId: existingOrgB.id } } }, { objective: { goal: { strategy: { organizationId: existingOrgB.id } } } }] } });
    await rawPrisma.objectiveAssignee.deleteMany({ where: { objective: { goal: { strategy: { organizationId: existingOrgB.id } } } } });
    await rawPrisma.objective.deleteMany({ where: { goal: { strategy: { organizationId: existingOrgB.id } } } });
    await rawPrisma.goal.deleteMany({ where: { strategy: { organizationId: existingOrgB.id } } });
    await rawPrisma.strategy.deleteMany({ where: { organizationId: existingOrgB.id } });
    await rawPrisma.auditLog.deleteMany({ where: { organizationId: existingOrgB.id } });
    await rawPrisma.user.deleteMany({ where: { organizationId: existingOrgB.id } });
    await rawPrisma.organization.delete({ where: { id: existingOrgB.id } });
  }

  // Create test organizations
  orgA = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Strategy Test Org A",
      slug: "test-strategy-org-a",
      updatedAt: new Date(),
    },
  });

  orgB = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Strategy Test Org B",
      slug: "test-strategy-org-b",
      updatedAt: new Date(),
    },
  });

  // Create test users with all roles in Org A
  cisoA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "CISO A",
      email: "ciso-a@strategy-test.com",
      role: "CISO",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  analystA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Analyst A",
      email: "analyst-a@strategy-test.com",
      role: "GRC_ANALYST",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  adminA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Admin A",
      email: "admin-a@strategy-test.com",
      role: "ORG_ADMIN",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  secEngA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Security Engineer A",
      email: "seceng-a@strategy-test.com",
      role: "SECURITY_ENGINEER",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  itStakeA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "IT Stakeholder A",
      email: "itstake-a@strategy-test.com",
      role: "IT_STAKEHOLDER",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  bizStakeA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Business Stakeholder A",
      email: "bizstake-a@strategy-test.com",
      role: "BUSINESS_STAKEHOLDER",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  auditorA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Auditor A",
      email: "auditor-a@strategy-test.com",
      role: "AUDITOR",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  adminB = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Admin B",
      email: "admin-b@strategy-test.com",
      role: "ORG_ADMIN",
      organizationId: orgB.id,
      updatedAt: new Date(),
    },
  });
});

afterAll(async () => {
  // Get org IDs for cleanup using rawPrisma to bypass middleware
  const orgs = await rawPrisma.organization.findMany({
    where: {
      slug: {
        in: ["test-strategy-org-a", "test-strategy-org-b"],
      },
    },
    select: { id: true },
  });
  const orgIds = orgs.map(o => o.id);

  if (orgIds.length > 0) {
    // Delete history records first (they have RESTRICT FKs on changedById)
    await rawPrisma.objectiveHistory.deleteMany({
      where: { objective: { goal: { strategy: { organizationId: { in: orgIds } } } } },
    });
    await rawPrisma.goalHistory.deleteMany({
      where: { goal: { strategy: { organizationId: { in: orgIds } } } },
    });
    await rawPrisma.strategyHistory.deleteMany({
      where: { strategy: { organizationId: { in: orgIds } } },
    });

    // Delete comments
    await rawPrisma.comment.deleteMany({
      where: {
        OR: [
          { goal: { strategy: { organizationId: { in: orgIds } } } },
          { objective: { goal: { strategy: { organizationId: { in: orgIds } } } } },
        ],
      },
    });

    // Delete objective assignees
    await rawPrisma.objectiveAssignee.deleteMany({
      where: { objective: { goal: { strategy: { organizationId: { in: orgIds } } } } },
    });

    // Delete objectives
    await rawPrisma.objective.deleteMany({
      where: { goal: { strategy: { organizationId: { in: orgIds } } } },
    });

    // Delete goals
    await rawPrisma.goal.deleteMany({
      where: { strategy: { organizationId: { in: orgIds } } },
    });

    // Delete strategies
    await rawPrisma.strategy.deleteMany({
      where: { organizationId: { in: orgIds } },
    });

    // Delete audit logs
    await rawPrisma.auditLog.deleteMany({
      where: { organizationId: { in: orgIds } },
    });

    // Delete history records (they reference users via changedById)
    await rawPrisma.objectiveHistory.deleteMany({
      where: { changedBy: { organizationId: { in: orgIds } } },
    });
    await rawPrisma.goalHistory.deleteMany({
      where: { changedBy: { organizationId: { in: orgIds } } },
    });
    await rawPrisma.strategyHistory.deleteMany({
      where: { changedBy: { organizationId: { in: orgIds } } },
    });

    // Delete users
    await rawPrisma.user.deleteMany({
      where: { organizationId: { in: orgIds } },
    });

    // Finally delete organizations
    await rawPrisma.organization.deleteMany({
      where: { id: { in: orgIds } },
    });
  }
});

/**
 * Helper to create tRPC caller with specific user context
 */
function createCaller(user: typeof cisoA) {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email ?? "",
        role: user.role as UserRole,
        organizationId: user.organizationId,
        name: user.name ?? "",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

// =============================================================================
// AC1: Permission Integration Tests
// =============================================================================

describe("AC1: Permission Integration Tests", () => {
  describe("Strategy CRUD Permissions", () => {
    it("CISO can create strategies", async () => {
      const caller = createCaller(cisoA);
      const strategy = await caller.strategy.create({
        title: "CISO Strategy",
        fiscalYearStart: 2025,
        fiscalYearEnd: 2026,
        status: StrategyStatus.DRAFT,
      });
      expect(strategy).toBeDefined();
      expect(strategy.title).toBe("CISO Strategy");
      await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
    });

    it("GRC_ANALYST can create strategies", async () => {
      const caller = createCaller(analystA);
      const strategy = await caller.strategy.create({
        title: "Analyst Strategy",
        fiscalYearStart: 2025,
        fiscalYearEnd: 2026,
        status: StrategyStatus.DRAFT,
      });
      expect(strategy).toBeDefined();
      await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
    });

    it("ORG_ADMIN can create strategies", async () => {
      const caller = createCaller(adminA);
      const strategy = await caller.strategy.create({
        title: "Admin Strategy",
        fiscalYearStart: 2025,
        fiscalYearEnd: 2026,
        status: StrategyStatus.DRAFT,
      });
      expect(strategy).toBeDefined();
      await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
    });

    it("SECURITY_ENGINEER cannot create strategies", async () => {
      const caller = createCaller(secEngA);
      await expect(
        caller.strategy.create({
          title: "Should Fail",
          fiscalYearStart: 2025,
          fiscalYearEnd: 2026,
          status: StrategyStatus.DRAFT,
        })
      ).rejects.toThrow(/requires one of these roles|FORBIDDEN/i);
    });

    it("IT_STAKEHOLDER cannot create strategies", async () => {
      const caller = createCaller(itStakeA);
      await expect(
        caller.strategy.create({
          title: "Should Fail",
          fiscalYearStart: 2025,
          fiscalYearEnd: 2026,
          status: StrategyStatus.DRAFT,
        })
      ).rejects.toThrow(/requires one of these roles|FORBIDDEN/i);
    });

    it("BUSINESS_STAKEHOLDER cannot create strategies", async () => {
      const caller = createCaller(bizStakeA);
      await expect(
        caller.strategy.create({
          title: "Should Fail",
          fiscalYearStart: 2025,
          fiscalYearEnd: 2026,
          status: StrategyStatus.DRAFT,
        })
      ).rejects.toThrow(/requires one of these roles|FORBIDDEN/i);
    });

    it("AUDITOR cannot create strategies", async () => {
      const caller = createCaller(auditorA);
      await expect(
        caller.strategy.create({
          title: "Should Fail",
          fiscalYearStart: 2025,
          fiscalYearEnd: 2026,
          status: StrategyStatus.DRAFT,
        })
      ).rejects.toThrow(/requires one of these roles|FORBIDDEN/i);
    });
  });

  describe("View Permissions - All Roles Can View", () => {
    let testStrategy: { id: string };

    beforeAll(async () => {
      const caller = createCaller(cisoA);
      testStrategy = await caller.strategy.create({
        title: "Viewable Strategy",
        fiscalYearStart: 2025,
        fiscalYearEnd: 2026,
        status: StrategyStatus.ACTIVE,
      });
    });

    afterAll(async () => {
      await rawPrisma.strategy.deleteMany({ where: { id: testStrategy.id } });
    });

    it("SECURITY_ENGINEER can view strategies", async () => {
      const caller = createCaller(secEngA);
      const result = await caller.strategy.list({});
      expect(result.strategies).toBeDefined();
    });

    it("IT_STAKEHOLDER can view strategies", async () => {
      const caller = createCaller(itStakeA);
      const result = await caller.strategy.list({});
      expect(result.strategies).toBeDefined();
    });

    it("BUSINESS_STAKEHOLDER can view strategies", async () => {
      const caller = createCaller(bizStakeA);
      const result = await caller.strategy.list({});
      expect(result.strategies).toBeDefined();
    });

    it("AUDITOR can view strategies", async () => {
      const caller = createCaller(auditorA);
      const result = await caller.strategy.list({});
      expect(result.strategies).toBeDefined();
    });
  });

  describe("Comment Permissions - AUDITOR Cannot Comment", () => {
    let testStrategy: { id: string };
    let testGoal: { id: string };

    beforeAll(async () => {
      const caller = createCaller(cisoA);
      testStrategy = await caller.strategy.create({
        title: "Comment Test Strategy",
        fiscalYearStart: 2025,
        fiscalYearEnd: 2026,
        status: StrategyStatus.ACTIVE,
      });
      testGoal = await caller.goal.create({
        strategyId: testStrategy.id,
        title: "Comment Test Goal",
      });
    });

    afterAll(async () => {
      await rawPrisma.strategy.deleteMany({ where: { id: testStrategy.id } });
    });

    it("GRC_ANALYST can add comments", async () => {
      const caller = createCaller(analystA);
      const result = await caller.goal.addComment({
        goalId: testGoal.id,
        content: "Analyst comment",
      });
      expect(result.content).toBe("Analyst comment");
    });

    it("AUDITOR cannot add comments (read-only)", async () => {
      const caller = createCaller(auditorA);
      await expect(
        caller.goal.addComment({
          goalId: testGoal.id,
          content: "Should fail",
        })
      ).rejects.toThrow(/requires one of these roles|FORBIDDEN/i);
    });
  });
});

// =============================================================================
// AC2: Multi-Tenant Isolation Tests
// =============================================================================

describe("AC2: Multi-Tenant Isolation Tests", () => {
  let strategyA: { id: string };

  beforeAll(async () => {
    const caller = createCaller(cisoA);
    strategyA = await caller.strategy.create({
      title: "Org A Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await rawPrisma.strategy.deleteMany({ where: { id: strategyA.id } });
  });

  it("User in Org B cannot see Org A strategies in list", async () => {
    const callerB = createCaller(adminB);
    const result = await callerB.strategy.list({});
    const foundStrategy = result.strategies.find((s: { id: string }) => s.id === strategyA.id);
    expect(foundStrategy).toBeUndefined();
  });

  it("User in Org B gets 404 when accessing Org A strategy by ID", async () => {
    const callerB = createCaller(adminB);
    await expect(
      callerB.strategy.getById({ id: strategyA.id })
    ).rejects.toThrow(/not found/i);
  });

  it("User in Org B cannot update Org A strategy", async () => {
    const callerB = createCaller(adminB);
    await expect(
      callerB.strategy.update({ id: strategyA.id, title: "Hacked!" })
    ).rejects.toThrow(/not found/i);
  });

  it("User in Org B cannot delete Org A strategy", async () => {
    const callerB = createCaller(adminB);
    await expect(
      callerB.strategy.delete({ id: strategyA.id })
    ).rejects.toThrow(/not found/i);
  });
});

// =============================================================================
// AC3: History Creation Tests
// =============================================================================

describe("AC3: History Creation Tests", () => {
  it("CREATE operation creates history record", async () => {
    const caller = createCaller(cisoA);
    const strategy = await caller.strategy.create({
      title: "History Test Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.DRAFT,
    });

    const history = await db.strategyHistory.findFirst({
      where: { strategyId: strategy.id },
      orderBy: { changedAt: "desc" },
    });

    expect(history).toBeDefined();
    expect(history?.changeType).toBe(ChangeType.CREATE);
    expect(history?.changedById).toBe(cisoA.id);

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });

  it("UPDATE operation creates history record with changed fields", async () => {
    const caller = createCaller(cisoA);
    const strategy = await caller.strategy.create({
      title: "Original Title",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.DRAFT,
    });

    await caller.strategy.update({
      id: strategy.id,
      title: "Updated Title",
    });

    const history = await db.strategyHistory.findFirst({
      where: { strategyId: strategy.id, changeType: ChangeType.UPDATE },
      orderBy: { changedAt: "desc" },
    });

    expect(history).toBeDefined();
    expect(history?.changeType).toBe(ChangeType.UPDATE);

    const changedFields = history?.changedFields as Record<string, { old: unknown; new: unknown }>;
    expect(changedFields.title.old).toBe("Original Title");
    expect(changedFields.title.new).toBe("Updated Title");

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });
});

// =============================================================================
// AC4: Progress Rollup Consistency Tests
// =============================================================================

describe("AC4: Progress Rollup Consistency Tests", () => {
  it("Strategy with no goals has 0% progress", async () => {
    const caller = createCaller(cisoA);
    const strategy = await caller.strategy.create({
      title: "Empty Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });

    const result = await caller.strategy.getById({ id: strategy.id });
    expect(result.progress).toBe(0);

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });

  it("Goal with no objectives has 0% progress", async () => {
    const caller = createCaller(cisoA);
    const strategy = await caller.strategy.create({
      title: "Strategy with empty goal",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });

    await caller.goal.create({
      strategyId: strategy.id,
      title: "Empty Goal",
    });

    const result = await caller.strategy.getById({ id: strategy.id });
    expect(result.goals[0].progress).toBe(0);

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });

  it("Progress calculation is consistent across multiple calls", async () => {
    const caller = createCaller(cisoA);
    const strategy = await caller.strategy.create({
      title: "Consistency Test Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });

    const goal = await caller.goal.create({
      strategyId: strategy.id,
      title: "Consistency Goal",
    });

    await caller.objective.create({
      goalId: goal.id,
      title: "50% Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 50,
      targetValue: 100,
    });

    // Call multiple times and verify consistency
    const result1 = await caller.strategy.getById({ id: strategy.id });
    const result2 = await caller.strategy.getById({ id: strategy.id });
    const result3 = await caller.strategy.getById({ id: strategy.id });

    expect(result1.progress).toBe(result2.progress);
    expect(result2.progress).toBe(result3.progress);
    expect(result1.progress).toBe(50);

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });

  it("Objective progress rollup to goal is accurate", async () => {
    const caller = createCaller(cisoA);
    const strategy = await caller.strategy.create({
      title: "Rollup Test Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });

    const goal = await caller.goal.create({
      strategyId: strategy.id,
      title: "Rollup Goal",
    });

    // Create 3 objectives: 0%, 50%, 100% = average 50%
    await caller.objective.create({
      goalId: goal.id,
      title: "0% Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 0,
      targetValue: 100,
    });

    await caller.objective.create({
      goalId: goal.id,
      title: "50% Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 50,
      targetValue: 100,
    });

    await caller.objective.create({
      goalId: goal.id,
      title: "100% Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 100,
      targetValue: 100,
    });

    const result = await caller.strategy.getById({ id: strategy.id });
    expect(result.goals[0].progress).toBe(50);
    expect(result.progress).toBe(50);

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });
});

// =============================================================================
// AC5: E2E Workflow Tests
// =============================================================================

describe("AC5: E2E Workflow Tests", () => {
  it("Complete workflow: Create strategy → Add goal → Add objective → Update progress", async () => {
    const caller = createCaller(cisoA);

    // Step 1: Create strategy
    const strategy = await caller.strategy.create({
      title: "E2E Workflow Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });
    expect(strategy.id).toBeDefined();

    // Step 2: Add goal
    const goal = await caller.goal.create({
      strategyId: strategy.id,
      title: "E2E Workflow Goal",
    });
    expect(goal.id).toBeDefined();

    // Step 3: Add objective
    const objective = await caller.objective.create({
      goalId: goal.id,
      title: "E2E Workflow Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 0,
      targetValue: 100,
    });
    expect(objective.id).toBeDefined();

    // Step 4: Update progress
    await caller.objective.update({
      id: objective.id,
      currentValue: 75,
    });

    // Verify final state
    const finalStrategy = await caller.strategy.getById({ id: strategy.id });
    expect(finalStrategy.progress).toBe(75);
    expect(finalStrategy.goals[0].progress).toBe(75);

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });

  it("View history workflow", async () => {
    const caller = createCaller(cisoA);

    const strategy = await caller.strategy.create({
      title: "History Workflow Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.DRAFT,
    });

    await caller.strategy.update({
      id: strategy.id,
      status: StrategyStatus.ACTIVE,
    });

    await caller.strategy.update({
      id: strategy.id,
      title: "Updated History Strategy",
    });

    // View history
    const history = await caller.strategy.getHistory({
      strategyId: strategy.id,
    });

    expect(history.history.length).toBeGreaterThanOrEqual(2);
    expect(history.total).toBeGreaterThanOrEqual(2);

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });

  it("Dashboard metrics workflow", async () => {
    const caller = createCaller(cisoA);

    // Create some test data
    const strategy = await caller.strategy.create({
      title: "Dashboard Test Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });

    const goal = await caller.goal.create({
      strategyId: strategy.id,
      title: "Dashboard Goal",
    });

    await caller.objective.create({
      goalId: goal.id,
      title: "Dashboard Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 50,
      targetValue: 100,
    });

    // Get dashboard metrics
    const summary = await caller.strategyDashboard.getSummary({});
    expect(summary.totalStrategies).toBeGreaterThan(0);
    expect(summary.activeStrategyCount).toBeGreaterThan(0);

    const progressChart = await caller.strategyDashboard.getProgressChart({});
    expect(progressChart.strategies).toBeDefined();

    const statusBreakdown = await caller.strategyDashboard.getStatusBreakdown({});
    expect(statusBreakdown.objectives).toBeDefined();
    expect(statusBreakdown.strategies).toBeDefined();

    await rawPrisma.strategy.deleteMany({ where: { id: strategy.id } });
  });
});

// =============================================================================
// AC6: Cascade Delete Tests
// =============================================================================

describe("AC6: Cascade Delete Tests", () => {
  it("Deleting strategy cascades to goals, objectives, and history", async () => {
    const caller = createCaller(cisoA);

    // Create full hierarchy
    const strategy = await caller.strategy.create({
      title: "Cascade Delete Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });

    const goal = await caller.goal.create({
      strategyId: strategy.id,
      title: "Cascade Goal",
    });

    const objective = await caller.objective.create({
      goalId: goal.id,
      title: "Cascade Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 50,
      targetValue: 100,
    });

    // Capture IDs before delete
    const strategyId = strategy.id;
    const goalId = goal.id;
    const objectiveId = objective.id;

    // Delete strategy
    await caller.strategy.delete({ id: strategyId });

    // Verify cascade
    const deletedStrategy = await db.strategy.findUnique({ where: { id: strategyId } });
    const deletedGoal = await db.goal.findUnique({ where: { id: goalId } });
    const deletedObjective = await db.objective.findUnique({ where: { id: objectiveId } });
    const remainingHistory = await db.strategyHistory.count({ where: { strategyId } });

    expect(deletedStrategy).toBeNull();
    expect(deletedGoal).toBeNull();
    expect(deletedObjective).toBeNull();
    expect(remainingHistory).toBe(0);
  });
});

// =============================================================================
// AC7: Atomic Operation Tests
// =============================================================================

describe("AC7: Atomic Operation Tests", () => {
  it("Transaction rollback on failure maintains consistency", async () => {
    const caller = createCaller(cisoA);

    // Get initial count
    const initialCount = await db.strategy.count({
      where: { organizationId: orgA.id },
    });

    // Try to create with invalid data that would fail validation
    try {
      await caller.strategy.create({
        title: "Valid Title",
        fiscalYearStart: 2026, // Invalid: start > end
        fiscalYearEnd: 2025,
        status: StrategyStatus.DRAFT,
      });
    } catch {
      // Expected to fail
    }

    // Verify count unchanged
    const finalCount = await db.strategy.count({
      where: { organizationId: orgA.id },
    });

    expect(finalCount).toBe(initialCount);
  });
});

// =============================================================================
// IT_STAKEHOLDER Assignee-Only Access Tests (Story 6.1 AC6)
// =============================================================================

describe("IT_STAKEHOLDER Assignee-Only Access", () => {
  let testStrategy: { id: string };
  let testGoal: { id: string };
  let assignedObjective: { id: string };
  let unassignedObjective: { id: string };

  beforeAll(async () => {
    const caller = createCaller(cisoA);

    testStrategy = await caller.strategy.create({
      title: "IT Stakeholder Test Strategy",
      fiscalYearStart: 2025,
      fiscalYearEnd: 2026,
      status: StrategyStatus.ACTIVE,
    });

    testGoal = await caller.goal.create({
      strategyId: testStrategy.id,
      title: "IT Stakeholder Test Goal",
    });

    // Create objective assigned to IT_STAKEHOLDER
    assignedObjective = await caller.objective.create({
      goalId: testGoal.id,
      title: "Assigned Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 0,
      targetValue: 100,
      assigneeIds: [itStakeA.id],
    });

    // Create objective NOT assigned to IT_STAKEHOLDER
    unassignedObjective = await caller.objective.create({
      goalId: testGoal.id,
      title: "Unassigned Objective",
      kpiType: KpiType.MANUAL_PERCENTAGE,
      currentValue: 0,
      targetValue: 100,
    });
  });

  afterAll(async () => {
    await rawPrisma.strategy.deleteMany({ where: { id: testStrategy.id } });
  });

  it("IT_STAKEHOLDER can view assigned objectives", async () => {
    const caller = createCaller(itStakeA);
    const objective = await caller.objective.getById({ id: assignedObjective.id });
    expect(objective.id).toBe(assignedObjective.id);
  });

  it("IT_STAKEHOLDER cannot view unassigned objectives", async () => {
    const caller = createCaller(itStakeA);
    await expect(
      caller.objective.getById({ id: unassignedObjective.id })
    ).rejects.toThrow(/only view objectives you are assigned to/);
  });

  it("IT_STAKEHOLDER listByGoal only shows assigned objectives", async () => {
    const caller = createCaller(itStakeA);
    const objectives = await caller.objective.listByGoal({ goalId: testGoal.id });

    expect(objectives.length).toBe(1);
    expect(objectives[0].id).toBe(assignedObjective.id);
  });
});
