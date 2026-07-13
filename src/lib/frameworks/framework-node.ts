/**
 * The one shape every framework detail view renders.
 *
 * Compliance frameworks (Control rows joined by parentControlId) and maturity
 * frameworks (MaturityDomain rows joined by parentId, plus MaturityQuestion
 * leaves) are structurally different on the server. Both normalize to this so a
 * single table component can render either.
 */

export type FrameworkNodeKind = "control" | "domain" | "question";

export interface FrameworkNodeDomainTag {
  id: string;
  code: string;
  name: string;
}

export interface FrameworkNode {
  id: string;
  /** controlId ("03.01.01"), domain code ("GV.OC-01"), or practiceCode ("ASSET-1a"). */
  code: string;
  title: string;
  description: string | null;
  kind: FrameworkNodeKind;
  /** "FUNCTION" | "CATEGORY" | "SUBCATEGORY" | "MIL 1" for maturity; null for compliance. */
  levelLabel: string | null;
  /** 0 for roots. Drives indentation. */
  depth: number;
  /** How many children exist, even when they are not loaded. Drives the chevron. */
  childCount: number;
  /**
   * Loaded children, or `null` when children exist but have not been fetched.
   * Maturity trees arrive whole, so they are never null. Compliance trees are
   * lazy: a parent starts null and is filled in on expand.
   */
  children: FrameworkNode[] | null;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
  /** Compliance only. */
  domains?: FrameworkNodeDomainTag[];
  isActive?: boolean;
}

// --- Compliance ------------------------------------------------------------

export interface ControlInput {
  id: string;
  controlId: string;
  title: string;
  description: string | null;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
  isActive: boolean;
  _count?: { other_Control: number } | null;
  ControlDomains?: Array<{ ControlDomain: FrameworkNodeDomainTag }> | null;
}

export function controlsToNodes(controls: ControlInput[], depth = 0): FrameworkNode[] {
  return controls.map((c) => {
    const childCount = c._count?.other_Control ?? 0;
    return {
      id: c.id,
      code: c.controlId,
      title: c.title,
      description: c.description,
      kind: "control" as const,
      levelLabel: null,
      depth,
      childCount,
      // A leaf is loaded by definition; a parent must be fetched on expand.
      children: childCount === 0 ? [] : null,
      testInstructions: c.testInstructions,
      acceptanceCriteria: c.acceptanceCriteria,
      domains: (c.ControlDomains ?? []).map((cd) => cd.ControlDomain),
      isActive: c.isActive,
    };
  });
}

// --- Maturity --------------------------------------------------------------

export interface MaturityDomainInput {
  id: string;
  code: string;
  name: string;
  description: string | null;
  level: string;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
  children: MaturityDomainInput[];
}

export interface MaturityQuestionInput {
  id: string;
  domainId: string | null;
  questionText: string;
  practiceCode: string | null;
  practiceLevel: number | null;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
}

export function maturityToNodes(
  roots: MaturityDomainInput[],
  questions: MaturityQuestionInput[],
): FrameworkNode[] {
  const byDomain = new Map<string, MaturityQuestionInput[]>();
  for (const q of questions) {
    if (q.domainId === null) continue; // rendered separately, outside the tree
    const bucket = byDomain.get(q.domainId);
    if (bucket) bucket.push(q);
    else byDomain.set(q.domainId, [q]);
  }

  const walk = (domain: MaturityDomainInput, depth: number): FrameworkNode => {
    const childDomains = domain.children.map((child) => walk(child, depth + 1));
    const childQuestions = (byDomain.get(domain.id) ?? []).map(
      (q): FrameworkNode => ({
        id: q.id,
        code: q.practiceCode ?? q.id.slice(0, 8),
        title: q.questionText,
        description: null,
        kind: "question",
        levelLabel: q.practiceLevel === null ? null : `MIL ${q.practiceLevel}`,
        depth: depth + 1,
        childCount: 0,
        children: [],
        testInstructions: q.testInstructions,
        acceptanceCriteria: q.acceptanceCriteria,
      }),
    );
    const children = [...childDomains, ...childQuestions];

    return {
      id: domain.id,
      code: domain.code,
      title: domain.name,
      description: domain.description,
      kind: "domain",
      levelLabel: domain.level,
      depth,
      childCount: children.length,
      children,
      testInstructions: domain.testInstructions,
      acceptanceCriteria: domain.acceptanceCriteria,
    };
  };

  return roots.map((root) => walk(root, 0));
}

// --- Rendering helper ------------------------------------------------------

/**
 * Depth-first list of the rows the table should draw, honouring `expanded`.
 * An expanded node whose children are still `null` contributes only itself —
 * the caller is responsible for fetching them.
 */
export function flattenVisible(
  nodes: FrameworkNode[],
  expanded: ReadonlySet<string>,
): FrameworkNode[] {
  const out: FrameworkNode[] = [];
  const visit = (node: FrameworkNode) => {
    out.push(node);
    if (!expanded.has(node.id) || node.children === null) return;
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return out;
}
