import {
  controlsToNodes,
  maturityToNodes,
  flattenVisible,
  type FrameworkNode,
} from "@/lib/frameworks/framework-node";

describe("controlsToNodes", () => {
  it("maps a top-level control to a depth-0 node with unloaded children", () => {
    const nodes = controlsToNodes([
      {
        id: "c1",
        controlId: "03.01",
        title: "Access Control",
        description: "Access Control",
        testInstructions: null,
        acceptanceCriteria: null,
        isActive: true,
        _count: { other_Control: 22 },
        ControlDomains: [],
      },
    ]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: "c1",
      code: "03.01",
      title: "Access Control",
      kind: "control",
      depth: 0,
      childCount: 22,
      children: null, // null means "not loaded yet" — the caller lazy-loads
      levelLabel: null,
    });
  });

  it("reports childCount 0 and children [] for a leaf control", () => {
    const nodes = controlsToNodes([
      {
        id: "c2",
        controlId: "03.01.01",
        title: "Account Management",
        description: "Define the types of system accounts...",
        testInstructions: "Sample 10 accounts",
        acceptanceCriteria: null,
        isActive: true,
        _count: { other_Control: 0 },
        ControlDomains: [],
      },
    ]);

    expect(nodes[0]!.childCount).toBe(0);
    expect(nodes[0]!.children).toEqual([]);
    expect(nodes[0]!.testInstructions).toBe("Sample 10 accounts");
  });

  it("carries domain tags through", () => {
    const nodes = controlsToNodes([
      {
        id: "c3",
        controlId: "03.02",
        title: "Awareness and Training",
        description: null,
        testInstructions: null,
        acceptanceCriteria: null,
        isActive: true,
        _count: { other_Control: 2 },
        ControlDomains: [
          { ControlDomain: { id: "d1", code: "AT", name: "Awareness & Training" } },
        ],
      },
    ]);

    expect(nodes[0]!.domains).toEqual([{ id: "d1", code: "AT", name: "Awareness & Training" }]);
  });

  it("assigns the given depth to children when nesting", () => {
    const children = controlsToNodes(
      [
        {
          id: "c4",
          controlId: "03.01.01",
          title: "Account Management",
          description: null,
          testInstructions: null,
          acceptanceCriteria: null,
          isActive: true,
          _count: { other_Control: 0 },
          ControlDomains: [],
        },
      ],
      1,
    );

    expect(children[0]!.depth).toBe(1);
  });
});

describe("maturityToNodes", () => {
  const csfTree = [
    {
      id: "gv",
      code: "GV",
      name: "Govern",
      description: "The organization's cybersecurity risk management strategy...",
      level: "FUNCTION",
      testInstructions: null,
      acceptanceCriteria: null,
      children: [
        {
          id: "gvoc",
          code: "GV.OC",
          name: "Organizational Context",
          description: "The circumstances...",
          level: "CATEGORY",
          testInstructions: null,
          acceptanceCriteria: null,
          children: [
            {
              id: "gvoc01",
              code: "GV.OC-01",
              name: "The organizational mission is understood",
              description: null,
              level: "SUBCATEGORY",
              testInstructions: "Review the mission statement",
              acceptanceCriteria: null,
              children: [],
            },
          ],
        },
      ],
    },
  ];

  it("maps the CSF Function/Category/Subcategory tree with depth and levelLabel", () => {
    const nodes = maturityToNodes(csfTree, []);

    expect(nodes).toHaveLength(1);
    const fn = nodes[0]!;
    expect(fn).toMatchObject({ id: "gv", code: "GV", kind: "domain", depth: 0, levelLabel: "FUNCTION" });
    expect(fn.childCount).toBe(1);

    const cat = fn.children![0]!;
    expect(cat).toMatchObject({ code: "GV.OC", depth: 1, levelLabel: "CATEGORY" });

    const sub = cat.children![0]!;
    expect(sub).toMatchObject({ code: "GV.OC-01", depth: 2, levelLabel: "SUBCATEGORY", childCount: 0 });
    expect(sub.testInstructions).toBe("Review the mission statement");
  });

  it("never returns null children — a maturity tree is always fully loaded", () => {
    const nodes = maturityToNodes(csfTree, []);
    expect(nodes[0]!.children).not.toBeNull();
    expect(nodes[0]!.children![0]!.children![0]!.children).toEqual([]);
  });

  it("attaches C2M2/SAMM questions as question-kind leaves under their domain", () => {
    const nodes = maturityToNodes(
      [
        {
          id: "dm",
          code: "ASSET",
          name: "Asset Management",
          description: null,
          level: "FUNCTION",
          testInstructions: null,
          acceptanceCriteria: null,
          children: [],
        },
      ],
      [
        {
          id: "q1",
          domainId: "dm",
          questionText: "Are IT assets inventoried?",
          practiceCode: "ASSET-1a",
          practiceLevel: 1,
          testInstructions: null,
          acceptanceCriteria: null,
        },
      ],
    );

    const domain = nodes[0]!;
    expect(domain.childCount).toBe(1);
    const q = domain.children![0]!;
    expect(q).toMatchObject({
      id: "q1",
      code: "ASSET-1a",
      title: "Are IT assets inventoried?",
      kind: "question",
      depth: 1,
      levelLabel: "MIL 1",
      childCount: 0,
    });
  });

  it("ignores questions whose domainId is null (framework-level questions are rendered separately)", () => {
    const nodes = maturityToNodes(
      [
        {
          id: "dm",
          code: "ASSET",
          name: "Asset Management",
          description: null,
          level: "FUNCTION",
          testInstructions: null,
          acceptanceCriteria: null,
          children: [],
        },
      ],
      [
        {
          id: "q0",
          domainId: null,
          questionText: "Framework-level question",
          practiceCode: null,
          practiceLevel: null,
          testInstructions: null,
          acceptanceCriteria: null,
        },
      ],
    );

    expect(nodes[0]!.children).toEqual([]);
  });
});

describe("flattenVisible", () => {
  const tree: FrameworkNode[] = [
    {
      id: "a",
      code: "A",
      title: "Alpha",
      description: null,
      kind: "domain",
      levelLabel: "FUNCTION",
      depth: 0,
      childCount: 1,
      testInstructions: null,
      acceptanceCriteria: null,
      children: [
        {
          id: "a1",
          code: "A.1",
          title: "Alpha One",
          description: null,
          kind: "domain",
          levelLabel: "CATEGORY",
          depth: 1,
          childCount: 0,
          testInstructions: null,
          acceptanceCriteria: null,
          children: [],
        },
      ],
    },
  ];

  it("returns only roots when nothing is expanded", () => {
    expect(flattenVisible(tree, new Set()).map((n) => n.id)).toEqual(["a"]);
  });

  it("returns children of expanded nodes, in order, depth-first", () => {
    expect(flattenVisible(tree, new Set(["a"])).map((n) => n.id)).toEqual(["a", "a1"]);
  });

  it("does not descend into an expanded node whose children are not loaded", () => {
    const lazy: FrameworkNode[] = [{ ...tree[0]!, children: null }];
    expect(flattenVisible(lazy, new Set(["a"])).map((n) => n.id)).toEqual(["a"]);
  });
});
