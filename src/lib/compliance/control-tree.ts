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

  // Placed exactly once, ever. A cycle (A's parent is B, B's parent is A) or a
  // self-parent makes a score neither a root nor reachable from one, and the
  // naive walk would drop it and its whole subtree — off the page and out of
  // the denominator, silently. Nothing may leave this function un-placed.
  const placed = new Set<string>();

  const build = (score: T, depth: number): ScoreNode<T> => {
    placed.add(score.control.id);
    return {
      score,
      depth,
      // Skipping already-placed children is what stops a cycle from recursing
      // forever; the back-edge simply stops there.
      children: (byParent.get(score.control.id) ?? [])
        .filter((child) => !placed.has(child.control.id))
        .map((child) => build(child, depth + 1))
        .sort(byControlId),
    };
  };

  const count = (node: ScoreNode<T>): number =>
    1 + node.children.reduce((sum, child) => sum + count(child), 0);

  const toGroup = (root: T): ControlGroupTree<T> => {
    placed.add(root.control.id);
    const children = (byParent.get(root.control.id) ?? [])
      .filter((child) => !placed.has(child.control.id))
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
  };

  const groups = roots.map(toGroup);

  // Whatever the roots could not reach — a cycle, a self-parent — becomes its
  // own top-level group. A corrupt parent link degrades to "these controls
  // render at the top level" instead of "these controls cease to exist".
  for (const score of scores) {
    if (!placed.has(score.control.id)) groups.push(toGroup(score));
  }

  return groups.sort((a, b) =>
    a.parent.control.controlId.localeCompare(b.parent.control.controlId),
  );
}

/**
 * Every score in a group, at any depth — a base control AND its enhancements.
 * The group's denominator has to count these: 800-53's AC family has 147
 * controls once enhancements are included, not the 25 base controls the old
 * two-level grouping saw.
 */
export function allScores<T extends ControlLike>(nodes: ScoreNode<T>[]): T[] {
  return nodes.flatMap((node) => [node.score, ...allScores(node.children)]);
}

/**
 * The control ids that must be expanded for every matching score to be on
 * screen: each node with a match somewhere below it. A match's own id is not
 * included — expanding it reveals its children, not itself.
 *
 * Filtering to Non-Compliant keeps a family because one enhancement matches;
 * without this the assessor is handed the family's whole tree with the one row
 * they asked for hidden inside a collapsed base control.
 */
export function ancestorsOfMatches<T extends ControlLike>(
  nodes: ScoreNode<T>[],
  matches: (score: T) => boolean,
): Set<string> {
  const expand = new Set<string>();

  const visit = (node: ScoreNode<T>): boolean => {
    let hasMatchBelow = false;
    for (const child of node.children) {
      if (visit(child)) hasMatchBelow = true;
    }
    if (hasMatchBelow) expand.add(node.score.control.id);
    return hasMatchBelow || matches(node.score);
  };

  for (const node of nodes) visit(node);
  return expand;
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
