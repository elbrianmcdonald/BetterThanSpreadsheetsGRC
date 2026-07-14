import { buildControlTree, flattenTree, type ScoreNode } from "@/lib/compliance/control-tree";

interface Score {
  id: string;
  control: { id: string; controlId: string; parentControlId: string | null };
}

const s = (id: string, controlId: string, parent: string | null): Score => ({
  id: `score-${id}`,
  control: { id, controlId, parentControlId: parent },
});

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
});
