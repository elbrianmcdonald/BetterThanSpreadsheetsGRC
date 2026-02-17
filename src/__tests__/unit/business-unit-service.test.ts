/**
 * Unit Tests for Business Unit Hierarchy Service
 *
 * Tests the BusinessUnit hierarchy utility functions.
 *
 * **Critical Test Coverage:**
 * - AC16: getBUWithDescendants returns BU + all descendant IDs
 * - AC18: getBUPath formats path correctly
 * - AC19: validateBUHierarchy detects circular references
 * - AC12: validateBUDepth enforces depth limit
 *
 * @see Story 7.0.1: BusinessUnit Schema with Hierarchy
 */

import { db } from "@/server/db";
import {
  getBUWithDescendants,
  getBUAncestors,
  getBUPath,
  validateBUHierarchy,
  getBUDepth,
  validateBUDepth,
} from "@/server/services/businessUnitService";

// Mock the Prisma client
jest.mock("@/server/db", () => ({
  db: {
    businessUnit: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const mockDb = db as jest.Mocked<typeof db>;

describe("BusinessUnit Hierarchy Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBUWithDescendants", () => {
    it("should return only the BU ID for a leaf node (AC16)", async () => {
      // Mock: no children
      (mockDb.businessUnit.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getBUWithDescendants("bu-leaf");

      expect(result).toEqual(["bu-leaf"]);
      expect(mockDb.businessUnit.findMany).toHaveBeenCalledWith({
        where: { parentId: "bu-leaf", isActive: true },
        select: { id: true },
      });
    });

    it("should return BU + all descendants for a parent node (AC16)", async () => {
      // Mock: bu-parent has two children, one of which has a grandchild
      (mockDb.businessUnit.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: "bu-child1" }, { id: "bu-child2" }]) // children of bu-parent
        .mockResolvedValueOnce([{ id: "bu-grandchild" }]) // children of bu-child1
        .mockResolvedValueOnce([]) // grandchildren of bu-grandchild (none)
        .mockResolvedValueOnce([]); // children of bu-child2 (none)

      const result = await getBUWithDescendants("bu-parent");

      expect(result).toContain("bu-parent");
      expect(result).toContain("bu-child1");
      expect(result).toContain("bu-child2");
      expect(result).toContain("bu-grandchild");
      expect(result).toHaveLength(4);
    });
  });

  describe("getBUAncestors", () => {
    it("should return empty array for root BU (AC17)", async () => {
      // Mock: root BU has no parent
      (mockDb.businessUnit.findUnique as jest.Mock).mockResolvedValue({
        parentId: null,
      });

      const result = await getBUAncestors("bu-root");

      expect(result).toEqual([]);
    });

    it("should return parent chain in root-first order (AC17)", async () => {
      // Mock: bu-child has parent bu-parent, which has parent bu-root
      (mockDb.businessUnit.findUnique as jest.Mock)
        .mockResolvedValueOnce({ parentId: "bu-parent" }) // bu-child's parent
        .mockResolvedValueOnce({ id: "bu-parent", name: "Parent", parentId: "bu-root" }) // bu-parent
        .mockResolvedValueOnce({ id: "bu-root", name: "Root", parentId: null }); // bu-root

      const result = await getBUAncestors("bu-child");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "bu-root", name: "Root", parentId: null });
      expect(result[1]).toEqual({ id: "bu-parent", name: "Parent", parentId: "bu-root" });
    });
  });

  describe("getBUPath", () => {
    it("should return single name for root BU (AC18)", async () => {
      // Mock: root BU has no parent
      (mockDb.businessUnit.findUnique as jest.Mock)
        .mockResolvedValueOnce({ parentId: null }) // for getBUAncestors
        .mockResolvedValueOnce({ name: "Engineering" }); // for getBUPath final lookup

      const result = await getBUPath("bu-root");

      expect(result).toBe("Engineering");
    });

    it("should return formatted path string with arrows (AC18)", async () => {
      // Mock: bu-backend has parent bu-platform, which has parent bu-engineering
      (mockDb.businessUnit.findUnique as jest.Mock)
        .mockResolvedValueOnce({ parentId: "bu-platform" }) // getBUAncestors start
        .mockResolvedValueOnce({ id: "bu-platform", name: "Platform", parentId: "bu-engineering" })
        .mockResolvedValueOnce({ id: "bu-engineering", name: "Engineering", parentId: null })
        .mockResolvedValueOnce({ name: "Backend" }); // final lookup

      const result = await getBUPath("bu-backend");

      expect(result).toBe("Engineering > Platform > Backend");
    });
  });

  describe("validateBUHierarchy", () => {
    it("should return true for null parent (root assignment) (AC19)", async () => {
      const result = await validateBUHierarchy("bu-any", null);

      expect(result).toBe(true);
    });

    it("should return false when BU is set as its own parent (AC19)", async () => {
      const result = await validateBUHierarchy("bu-self", "bu-self");

      expect(result).toBe(false);
    });

    it("should return false when parent is a descendant (AC19)", async () => {
      // Mock: bu-parent has child bu-child
      (mockDb.businessUnit.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: "bu-child" }]) // children of bu-parent
        .mockResolvedValueOnce([]); // children of bu-child

      const result = await validateBUHierarchy("bu-parent", "bu-child");

      expect(result).toBe(false);
    });

    it("should return true when parent is not a descendant (AC19)", async () => {
      // Mock: bu-x has no children, trying to set parent to bu-y (unrelated)
      (mockDb.businessUnit.findMany as jest.Mock).mockResolvedValue([]);

      const result = await validateBUHierarchy("bu-x", "bu-y");

      expect(result).toBe(true);
    });
  });

  describe("getBUDepth", () => {
    it("should return 0 for root BU (AC20)", async () => {
      // Mock: root BU has no parent
      (mockDb.businessUnit.findUnique as jest.Mock).mockResolvedValue({
        parentId: null,
      });

      const result = await getBUDepth("bu-root");

      expect(result).toBe(0);
    });

    it("should return correct depth for nested BU (AC20)", async () => {
      // Mock: bu-child has 2 ancestors
      (mockDb.businessUnit.findUnique as jest.Mock)
        .mockResolvedValueOnce({ parentId: "bu-parent" })
        .mockResolvedValueOnce({ id: "bu-parent", name: "Parent", parentId: "bu-root" })
        .mockResolvedValueOnce({ id: "bu-root", name: "Root", parentId: null });

      const result = await getBUDepth("bu-child");

      expect(result).toBe(2);
    });
  });

  describe("validateBUDepth", () => {
    it("should return valid for root creation (depth 1) (AC12)", async () => {
      // Mock: creating root BU (no parent)
      const result = await validateBUDepth(null);

      expect(result.valid).toBe(true);
      expect(result.currentDepth).toBe(1);
      expect(result.maxDepth).toBe(5);
    });

    it("should return valid for depth 5 (AC12)", async () => {
      // Mock: parent is at depth 4 (4 ancestors), new BU at depth 5
      (mockDb.businessUnit.findUnique as jest.Mock)
        .mockResolvedValueOnce({ parentId: "bu-3" }) // getBUAncestors start: bu-4's parent
        .mockResolvedValueOnce({ id: "bu-3", name: "L3", parentId: "bu-2" })
        .mockResolvedValueOnce({ id: "bu-2", name: "L2", parentId: "bu-1" })
        .mockResolvedValueOnce({ id: "bu-1", name: "L1", parentId: "bu-0" })
        .mockResolvedValueOnce({ id: "bu-0", name: "L0", parentId: null });

      const result = await validateBUDepth("bu-4");

      expect(result.valid).toBe(true);
      expect(result.currentDepth).toBe(5);
    });

    it("should return invalid for depth > 5 (AC12)", async () => {
      // Mock: parent is at depth 5 (5 ancestors), new BU at depth 6
      (mockDb.businessUnit.findUnique as jest.Mock)
        .mockResolvedValueOnce({ parentId: "bu-4" }) // getBUAncestors start: bu-5's parent
        .mockResolvedValueOnce({ id: "bu-4", name: "L4", parentId: "bu-3" })
        .mockResolvedValueOnce({ id: "bu-3", name: "L3", parentId: "bu-2" })
        .mockResolvedValueOnce({ id: "bu-2", name: "L2", parentId: "bu-1" })
        .mockResolvedValueOnce({ id: "bu-1", name: "L1", parentId: "bu-0" })
        .mockResolvedValueOnce({ id: "bu-0", name: "L0", parentId: null });

      const result = await validateBUDepth("bu-5");

      expect(result.valid).toBe(false);
      expect(result.currentDepth).toBe(6);
    });
  });
});
