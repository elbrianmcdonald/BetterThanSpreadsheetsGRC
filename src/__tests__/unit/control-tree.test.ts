import {
  allScores,
  ancestorsOfMatches,
  buildControlTree,
  flattenTree,
  type ControlGroupTree,
  type ScoreNode,
} from "@/lib/compliance/control-tree";

interface Score {
  id: string;
  control: { id: string; controlId: string; parentControlId: string | null };
}

const s = (id: string, controlId: string, parent: string | null): Score => ({
  id: `score-${id}`,
  control: { id, controlId, parentControlId: parent },
});

/**
 * Every control id the page would render for these groups: the group headers
 * plus every row nested inside them. Nothing else is drawn, so anything absent
 * here is invisible to the user and missing from the denominator.
 */
const renderedIds = (groups: ControlGroupTree<Score>[]) => {
  const rows = groups.flatMap((g) => allScores(g.nodes).map((score) => score.control.id));
  const headers = groups.map((g) => g.parent.control.id);
  return { rows, all: new Set([...rows, ...headers]) };
};

// NIST 800-53's real shape: family -> base control -> enhancement.
const AC = s("ac", "AC", null);
const AC01 = s("ac01", "AC-01", "ac");
const AC02 = s("ac02", "AC-02", "ac");
const AC02_1 = s("ac02-1", "AC-02(01)", "ac02");
const AC02_2 = s("ac02-2", "AC-02(02)", "ac02");
const AT = s("at", "AT", null);
const AT01 = s("at01", "AT-01", "at");

describe("buildControlTree", () => {
  it("nests enhancements under their base control instead of dropping them", () => {
    const groups = buildControlTree([AC, AC01, AC02, AC02_1, AC02_2]);

    expect(groups).toHaveLength(1);
    const ac = groups[0]!;
    expect(ac.parent.control.controlId).toBe("AC");
    expect(ac.nodes.map((n) => n.score.control.controlId)).toEqual(["AC-01", "AC-02"]);

    const ac02 = ac.nodes[1]!;
    expect(ac02.children.map((n) => n.score.control.controlId)).toEqual([
      "AC-02(01)",
      "AC-02(02)",
    ]);
  });

  it("counts every descendant, so the group denominator is not just its direct children", () => {
    // The old code said "0/25 controls" for AC when AC really has ~175.
    const groups = buildControlTree([AC, AC01, AC02, AC02_1, AC02_2]);
    expect(groups[0]!.total).toBe(4); // AC-01, AC-02, AC-02(01), AC-02(02)
  });

  it("assigns depth relative to the group, driving indentation", () => {
    const groups = buildControlTree([AC, AC01, AC02, AC02_1]);
    const ac = groups[0]!;
    expect(ac.nodes[0]!.depth).toBe(0);
    expect(ac.nodes[1]!.children[0]!.depth).toBe(1);
  });

  it("sorts siblings by controlId at every level", () => {
    const groups = buildControlTree([AC, AC02, AC01, AC02_2, AC02_1]);
    const ac = groups[0]!;
    expect(ac.nodes.map((n) => n.score.control.controlId)).toEqual(["AC-01", "AC-02"]);
    expect(ac.nodes[1]!.children.map((n) => n.score.control.controlId)).toEqual([
      "AC-02(01)",
      "AC-02(02)",
    ]);
  });

  it("sorts the groups themselves by controlId", () => {
    const groups = buildControlTree([AT, AT01, AC, AC01]);
    expect(groups.map((g) => g.parent.control.controlId)).toEqual(["AC", "AT"]);
  });

  it("gives a childless top-level control a group containing itself", () => {
    // Frameworks like ISO 27001 are flat — every control is top-level.
    const lone = s("iso1", "A.5.1", null);
    const groups = buildControlTree([lone]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.nodes.map((n) => n.score.control.controlId)).toEqual(["A.5.1"]);
    expect(groups[0]!.total).toBe(1);
  });

  it("does not drop a score whose parent is missing from the list", () => {
    // A filtered or partial score set must not silently lose rows.
    const orphan = s("x", "XX-01", "no-such-parent");
    const groups = buildControlTree([orphan]);
    expect(groups.flatMap((g) => g.nodes.map((n) => n.score.control.controlId))).toContain(
      "XX-01",
    );
  });

  it("nests at arbitrary depth, not just the three levels 800-53 happens to have", () => {
    const l1 = s("l1", "L-01", null);
    const l2 = s("l2", "L-01.1", "l1");
    const l3 = s("l3", "L-01.1.1", "l2");
    const l4 = s("l4", "L-01.1.1.1", "l3");

    const groups = buildControlTree([l4, l2, l1, l3]);
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.total).toBe(3); // L-01.1, L-01.1.1, L-01.1.1.1

    const depth0 = group.nodes[0]!;
    const depth1 = depth0.children[0]!;
    const depth2 = depth1.children[0]!;
    expect(depth0.score.control.controlId).toBe("L-01.1");
    expect(depth1.score.control.controlId).toBe("L-01.1.1");
    expect(depth2.score.control.controlId).toBe("L-01.1.1.1");
    expect(depth0.depth).toBe(0);
    expect(depth1.depth).toBe(1);
    expect(depth2.depth).toBe(2);
  });

  it("still renders controls caught in a parent cycle instead of deleting them", () => {
    // Two updateControl calls can make A the parent of B and B the parent of A.
    // Neither is a root and neither is reachable from one — the naive walk drops
    // both, and their enhancements, from the page AND from the denominator.
    const a = s("a", "AC-02", "b");
    const b = s("b", "AC-03", "a");
    const enh = s("a1", "AC-02(01)", "a");

    const groups = buildControlTree([a, b, enh]);
    const { all } = renderedIds(groups);
    expect(all).toEqual(new Set(["a", "b", "a1"]));
  });

  it("still renders a control that is its own parent", () => {
    const self = s("x", "AC-02", "x");
    const groups = buildControlTree([self]);
    expect(renderedIds(groups).all).toEqual(new Set(["x"]));
  });

  it("renders every input score exactly once — no row is lost and none is duplicated", () => {
    const scores = [
      AC,
      AC01,
      AC02,
      AC02_1,
      AC02_2,
      AT,
      AT01,
      s("orphan", "ZZ-01", "gone"), // parent filtered out of the set
      s("cyc1", "CY-01", "cyc2"), // cycle
      s("cyc2", "CY-02", "cyc1"),
      s("self", "SF-01", "self"), // self-parent
      s("iso", "A.5.1", null), // flat framework control
    ];

    const groups = buildControlTree(scores);
    const { rows, all } = renderedIds(groups);

    expect(all).toEqual(new Set(scores.map((score) => score.control.id)));
    expect(new Set(rows).size).toBe(rows.length); // no control drawn twice
  });
});

describe("allScores", () => {
  it("counts a base control AND its enhancements — the honest denominator", () => {
    const groups = buildControlTree([AC, AC01, AC02, AC02_1, AC02_2]);
    expect(allScores(groups[0]!.nodes).map((score) => score.control.controlId)).toEqual([
      "AC-01",
      "AC-02",
      "AC-02(01)",
      "AC-02(02)",
    ]);
  });

  it("agrees with the group total that the tree reports", () => {
    const groups = buildControlTree([AC, AC01, AC02, AC02_1, AC02_2, AT, AT01]);
    for (const group of groups) {
      expect(allScores(group.nodes)).toHaveLength(group.total);
    }
  });

  it("returns the lone member of a flat framework's group", () => {
    const groups = buildControlTree([s("iso1", "A.5.1", null)]);
    expect(allScores(groups[0]!.nodes).map((score) => score.control.controlId)).toEqual(["A.5.1"]);
  });
});

describe("ancestorsOfMatches", () => {
  it("names every collapsed ancestor hiding a match, so a filter can reveal it", () => {
    // Filtering to Non-Compliant must not bury the one matching enhancement
    // inside a collapsed AC-02.
    const groups = buildControlTree([AC, AC01, AC02, AC02_1, AC02_2]);
    const ids = ancestorsOfMatches(
      groups[0]!.nodes,
      (score: Score) => score.control.controlId === "AC-02(02)",
    );
    expect(ids).toEqual(new Set(["ac02"]));
  });

  it("does not expand a matching leaf itself, only what hides it", () => {
    const groups = buildControlTree([AC, AC01, AC02, AC02_1]);
    const ids = ancestorsOfMatches(groups[0]!.nodes, (score: Score) => score.control.controlId === "AC-01");
    expect(ids).toEqual(new Set());
  });

  it("expands the whole chain above a deeply nested match", () => {
    const l1 = s("l1", "L-01", null);
    const l2 = s("l2", "L-01.1", "l1");
    const l3 = s("l3", "L-01.1.1", "l2");
    const l4 = s("l4", "L-01.1.1.1", "l3");

    const groups = buildControlTree([l1, l2, l3, l4]);
    const ids = ancestorsOfMatches(groups[0]!.nodes, (score: Score) => score.id === "score-l4");
    expect(ids).toEqual(new Set(["l2", "l3"]));
  });
});

describe("flattenTree", () => {
  const tree: ScoreNode<Score>[] = [
    { score: AC01, depth: 0, children: [] },
    {
      score: AC02,
      depth: 0,
      children: [
        { score: AC02_1, depth: 1, children: [] },
        { score: AC02_2, depth: 1, children: [] },
      ],
    },
  ];

  it("hides children until their parent is expanded", () => {
    expect(flattenTree(tree, new Set()).map((n) => n.score.control.controlId)).toEqual([
      "AC-01",
      "AC-02",
    ]);
  });

  it("reveals the enhancements of an expanded base control, in order", () => {
    expect(flattenTree(tree, new Set(["ac02"])).map((n) => n.score.control.controlId)).toEqual([
      "AC-01",
      "AC-02",
      "AC-02(01)",
      "AC-02(02)",
    ]);
  });

  describe("over real buildControlTree output", () => {
    // Hand-built literals cannot catch a shape mismatch between the two
    // functions, so drive flattenTree with what the page actually gives it.
    const l1 = s("l1", "L-01", null);
    const l2 = s("l2", "L-01.1", "l1");
    const l3 = s("l3", "L-01.1.1", "l2");
    const l4 = s("l4", "L-01.1.1.1", "l3");
    const groups = buildControlTree([l1, l2, l3, l4, AC, AC01, AC02, AC02_1, AC02_2]);
    const ac = groups.find((g) => g.parent.control.controlId === "AC")!;
    const deep = groups.find((g) => g.parent.control.controlId === "L-01")!;

    it("draws only the top row of each group while everything is collapsed", () => {
      expect(flattenTree(ac.nodes, new Set()).map((n) => n.score.control.controlId)).toEqual([
        "AC-01",
        "AC-02",
      ]);
      expect(flattenTree(deep.nodes, new Set()).map((n) => n.score.control.controlId)).toEqual([
        "L-01.1",
      ]);
    });

    it("reveals grandchildren only when the intermediate node is expanded too", () => {
      const rows = (expanded: string[]) =>
        flattenTree(deep.nodes, new Set(expanded)).map((n) => n.score.control.controlId);

      // Expanding a node whose children themselves have children.
      expect(rows(["l2"])).toEqual(["L-01.1", "L-01.1.1"]);
      expect(rows(["l2", "l3"])).toEqual(["L-01.1", "L-01.1.1", "L-01.1.1.1"]);
      // A collapsed intermediate hides its whole subtree, expanded or not.
      expect(rows(["l3"])).toEqual(["L-01.1"]);
    });

    it("carries the depth the rows are indented by", () => {
      expect(flattenTree(deep.nodes, new Set(["l2", "l3"])).map((n) => n.depth)).toEqual([0, 1, 2]);
    });
  });
});
