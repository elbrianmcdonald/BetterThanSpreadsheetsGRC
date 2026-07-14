/**
 * Group a flat list of control scores into a tree.
 *
 * NIST 800-53 is three levels deep — family (AC) -> base control (AC-02) ->
 * enhancement (AC-02(01)) — but the assessment page used to bucket scores by
 * parent and then read only the children of top-level controls. An
 * enhancement's parent is a base control, which is itself a child, so all 872
 * enhancements were silently discarded: scored in the database, invisible in
 * the UI. This builds the real tree, at whatever depth the framework has.
 */

export interface ControlLike {
  control: {
    id: string;
    controlId: string;
    parentControlId: string | null;
  };
}

export interface ScoreNode<T> {
  score: T;
  /** 0 for a group's immediate members. Drives indentation. */
  depth: number;
  children: ScoreNode<T>[];
}

export interface ControlGroupTree<T> {
  /** The top-level control the group is named after (the family). */
  parent: T;
  /** Its members, nested. */
  nodes: ScoreNode<T>[];
  /** Every descendant, at any depth — the honest denominator. */
  total: number;
}

const byControlId = <T extends ControlLike>(a: ScoreNode<T>, b: ScoreNode<T>) =>
  a.score.control.controlId.localeCompare(b.score.control.controlId);

export function buildControlTree<T extends ControlLike>(scores: T[]): ControlGroupTree<T>[] {
  const byParent = new Map<string, T[]>();
  const roots: T[] = [];
  const known = new Set(scores.map((s) => s.control.id));

  for (const score of scores) {
    const parentId = score.control.parentControlId;
    // A score whose parent is not in this list is treated as a root rather than
    // dropped — a partial or filtered set must never lose rows.
    if (parentId === null || !known.has(parentId)) {
      roots.push(score);
      continue;
    }
    const bucket = byParent.get(parentId);
    if (bucket) bucket.push(score);
    else byParent.set(parentId, [score]);
  }

  const build = (score: T, depth: number): ScoreNode<T> => ({
    score,
    depth,
    children: (byParent.get(score.control.id) ?? [])
      .map((child) => build(child, depth + 1))
      .sort(byControlId),
  });

  const count = (node: ScoreNode<T>): number =>
    1 + node.children.reduce((sum, child) => sum + count(child), 0);

  return roots
    .map((root) => {
      const children = (byParent.get(root.control.id) ?? [])
        .map((child) => build(child, 0))
        .sort(byControlId);

      // A childless top-level control (ISO 27001, NIST CSF) is its own member,
      // so every framework renders through the same shape.
      const nodes =
        children.length > 0 ? children : [{ score: root, depth: 0, children: [] }];

      return {
        parent: root,
        nodes,
        total: nodes.reduce((sum, node) => sum + count(node), 0),
      };
    })
    .sort((a, b) => a.parent.control.controlId.localeCompare(b.parent.control.controlId));
}

/** Depth-first list of the rows to draw, honouring `expanded` (keyed by control id). */
export function flattenTree<T extends ControlLike>(
  nodes: ScoreNode<T>[],
  expanded: ReadonlySet<string>,
): ScoreNode<T>[] {
  const out: ScoreNode<T>[] = [];
  const visit = (node: ScoreNode<T>) => {
    out.push(node);
    if (!expanded.has(node.score.control.id)) return;
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return out;
}
