/**
 * Unit Tests for User-BusinessUnit Relationship Functions
 *
 * Tests the Story 7.0.2 functions for User-BU relationships:
 * - AC5: validateUserBUAssignment validates org match
 * - AC6: getUsersByBusinessUnit returns users directly in a BU
 * - AC7: getUsersByBUWithDescendants includes descendant users
 * - AC10-AC12: canDeleteBusinessUnit checks for assigned users
 *
 * @see Story 7.0.2: User-BU Relationship
 */

import { db } from "@/server/db";
import {
  validateUserBUAssignment,
  getUsersByBusinessUnit,
  getUsersByBUWithDescendants,
  canDeleteBusinessUnit,
  assignUserToBusinessUnit,
  getBUWithDescendants,
} from "@/server/services/businessUnitService";
import { TRPCError } from "@trpc/server";

// Mock the Prisma client
jest.mock("@/server/db", () => ({
  db: {
    businessUnit: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockDb = db as jest.Mocked<typeof db>;

describe("User-BusinessUnit Relationship Service (Story 7.0.2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateUserBUAssignment", () => {
    it("should return valid when user and BU are in same org (AC5)", async () => {
      // Mock user
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
      });

      // Mock BU
      (mockDb.businessUnit.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
        isActive: true,
      });

      const result = await validateUserBUAssignment("user-1", "bu-1");

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should return invalid when user not found (AC5)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await validateUserBUAssignment("user-notfound", "bu-1");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("User not found");
    });

    it("should return invalid when BU not found (AC5)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
      });
      (mockDb.businessUnit.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await validateUserBUAssignment("user-1", "bu-notfound");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Business unit not found");
    });

    it("should return invalid when BU is inactive (AC5)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
      });
      (mockDb.businessUnit.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
        isActive: false,
      });

      const result = await validateUserBUAssignment("user-1", "bu-inactive");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Business unit is not active");
    });

    it("should return invalid when user and BU are in different orgs (AC5)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
      });
      (mockDb.businessUnit.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-2", // Different org
        isActive: true,
      });

      const result = await validateUserBUAssignment("user-1", "bu-other-org");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe(
        "Business unit must be in the same organization as user"
      );
    });
  });

  describe("getUsersByBusinessUnit", () => {
    it("should return users directly assigned to BU (AC6)", async () => {
      const mockUsers = [
        {
          id: "user-1",
          name: "Alice",
          email: "alice@example.com",
          role: "GRC_ANALYST",
          businessUnit: { id: "bu-1", name: "Engineering", parentId: null },
        },
        {
          id: "user-2",
          name: "Bob",
          email: "bob@example.com",
          role: "IT_STAKEHOLDER",
          businessUnit: { id: "bu-1", name: "Engineering", parentId: null },
        },
      ];

      (mockDb.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await getUsersByBusinessUnit("bu-1", "org-1");

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe("Alice");
      expect(result[1]?.name).toBe("Bob");
      expect(mockDb.user.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          businessUnitId: "bu-1",
        },
        select: expect.objectContaining({
          id: true,
          name: true,
          email: true,
          role: true,
          businessUnit: expect.anything(),
        }),
        orderBy: { name: "asc" },
      });
    });

    it("should return empty array when no users in BU (AC6)", async () => {
      (mockDb.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getUsersByBusinessUnit("bu-empty", "org-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("getUsersByBUWithDescendants", () => {
    it("should return users from BU and all descendant BUs (AC7)", async () => {
      // Mock getBUWithDescendants: parent BU has two children
      (mockDb.businessUnit.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: "bu-child1" }, { id: "bu-child2" }]) // children of bu-parent
        .mockResolvedValueOnce([]) // children of bu-child1
        .mockResolvedValueOnce([]); // children of bu-child2

      // Mock users from all BUs
      const mockUsers = [
        {
          id: "user-1",
          name: "Alice",
          email: "alice@example.com",
          role: "GRC_ANALYST",
          businessUnit: { id: "bu-parent", name: "Engineering", parentId: null },
        },
        {
          id: "user-2",
          name: "Bob",
          email: "bob@example.com",
          role: "IT_STAKEHOLDER",
          businessUnit: {
            id: "bu-child1",
            name: "Platform",
            parentId: "bu-parent",
          },
        },
        {
          id: "user-3",
          name: "Carol",
          email: "carol@example.com",
          role: "SECURITY_ENGINEER",
          businessUnit: {
            id: "bu-child2",
            name: "Frontend",
            parentId: "bu-parent",
          },
        },
      ];

      (mockDb.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await getUsersByBUWithDescendants("bu-parent", "org-1");

      expect(result).toHaveLength(3);
      expect(mockDb.user.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          businessUnitId: { in: ["bu-parent", "bu-child1", "bu-child2"] },
        },
        select: expect.objectContaining({
          id: true,
          name: true,
          email: true,
          role: true,
          businessUnit: expect.anything(),
        }),
        orderBy: { name: "asc" },
      });
    });
  });

  describe("canDeleteBusinessUnit", () => {
    it("should return canDelete: false when users are assigned (AC10)", async () => {
      (mockDb.user.count as jest.Mock).mockResolvedValue(3);

      const result = await canDeleteBusinessUnit("bu-with-users");

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain("3 assigned user(s)");
      expect(result.userCount).toBe(3);
    });

    it("should return canDelete: false when children exist (AC10)", async () => {
      (mockDb.user.count as jest.Mock).mockResolvedValue(0);
      (mockDb.businessUnit.count as jest.Mock).mockResolvedValue(2);

      const result = await canDeleteBusinessUnit("bu-with-children");

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain("2 child unit(s)");
      expect(result.childCount).toBe(2);
    });

    it("should return canDelete: true when no users or children (AC10)", async () => {
      (mockDb.user.count as jest.Mock).mockResolvedValue(0);
      (mockDb.businessUnit.count as jest.Mock).mockResolvedValue(0);

      const result = await canDeleteBusinessUnit("bu-empty");

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should check users before children (AC10-AC12)", async () => {
      // If users exist, don't even check children
      (mockDb.user.count as jest.Mock).mockResolvedValue(1);

      const result = await canDeleteBusinessUnit("bu-test");

      expect(result.canDelete).toBe(false);
      expect(result.userCount).toBe(1);
      // businessUnit.count should not be called since users check failed first
      expect(mockDb.businessUnit.count).not.toHaveBeenCalled();
    });
  });

  describe("assignUserToBusinessUnit", () => {
    it("should unassign user when buId is null", async () => {
      (mockDb.user.update as jest.Mock).mockResolvedValue({
        id: "user-1",
        businessUnitId: null,
      });

      await assignUserToBusinessUnit("user-1", null);

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { businessUnitId: null },
      });
    });

    it("should assign user to BU when validation passes", async () => {
      // Mock validation success
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
      });
      (mockDb.businessUnit.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
        isActive: true,
      });
      (mockDb.user.update as jest.Mock).mockResolvedValue({
        id: "user-1",
        businessUnitId: "bu-1",
      });

      await assignUserToBusinessUnit("user-1", "bu-1");

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { businessUnitId: "bu-1" },
      });
    });

    it("should throw TRPCError when validation fails", async () => {
      // Mock validation failure: different orgs
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-1",
      });
      (mockDb.businessUnit.findUnique as jest.Mock).mockResolvedValue({
        organizationId: "org-2", // Different org
        isActive: true,
      });

      await expect(assignUserToBusinessUnit("user-1", "bu-other-org")).rejects.toThrow(
        TRPCError
      );

      // Update should not be called
      expect(mockDb.user.update).not.toHaveBeenCalled();
    });
  });
});
