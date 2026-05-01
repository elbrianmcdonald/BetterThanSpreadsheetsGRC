/**
 * Maturity Assessment Router
 *
 * tRPC router for Maturity Assessment operations supporting
 * NIST CSF 2.0 and C2M2 frameworks.
 *
 * Features:
 * - Framework management (list, get)
 * - Assessment CRUD with multi-assessor support
 * - Domain scoring with historical snapshots
 * - Guided assessment with questions
 * - Target planning and gap analysis
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import {
  Prisma,
  UserRole,
  MaturityFrameworkType,
  AssessmentDepth,
  AssessmentMode,
  MaturityAssessmentStatus,
  AssessorAssignmentStatus,
  MaturityScoringScale,
} from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { calculateMaturityScore, sammAnswerWeight } from "@/server/services/maturityCalculator";

/**
 * Roles that can manage maturity assessments
 */
const MATURITY_MANAGE_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Roles that can view maturity assessments
 */
const MATURITY_VIEW_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

/**
 * C2M2 Practice Implementation Levels
 * Used to score how well a practice is implemented
 */
export const ImplementationLevel = {
  NOT_IMPLEMENTED: 0,
  PARTIALLY_IMPLEMENTED: 1,
  LARGELY_IMPLEMENTED: 2,
  FULLY_IMPLEMENTED: 3,
} as const;

export type ImplementationLevelType = typeof ImplementationLevel[keyof typeof ImplementationLevel];

/**
 * Check if an implementation level counts as "performed" (pass)
 * Fully Implemented or Largely Implemented = pass
 * Partially Implemented or Not Implemented = fail
 */
export function isImplementationLevelPassing(level: number | null | undefined): boolean {
  return level !== null && level !== undefined && level >= ImplementationLevel.LARGELY_IMPLEMENTED;
}

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Schema for creating a maturity assessment
 */
const createAssessmentSchema = z.object({
  frameworkId: z.string().min(1, "Framework ID is required"),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  assessmentDepth: z.nativeEnum(AssessmentDepth).default(AssessmentDepth.FUNCTION),
  assessmentMode: z.nativeEnum(AssessmentMode).default(AssessmentMode.SELF),
  /// Only set for frameworks that offer multiple scales (currently NIST CSF 2.0).
  scoringScale: z.nativeEnum(MaturityScoringScale).optional().nullable(),
  /// Legacy single-target fallback (used when functionTargets isn't provided).
  targetLevel: z.number().int().min(0).max(5).optional().nullable(),
  /// Map of Function code → target level (e.g., { GV: 3, ID: 2, … }). When
  /// present, the server writes per-function targets on the Function-level
  /// MaturityDomainScore rows; non-Function domains inherit their ancestor's
  /// target at render time.
  functionTargets: z.record(z.string(), z.number().int().min(0).max(5)).optional(),
  targetDate: z.date().optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
});

/**
 * Schema for updating a maturity assessment
 */
const updateAssessmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.nativeEnum(MaturityAssessmentStatus).optional(),
  targetLevel: z.number().int().min(0).max(5).optional().nullable(),
  targetDate: z.date().optional().nullable(),
});

/**
 * Schema for listing assessments
 */
const listAssessmentsSchema = z.object({
  frameworkType: z.nativeEnum(MaturityFrameworkType).optional(),
  status: z.nativeEnum(MaturityAssessmentStatus).optional(),
  businessUnitId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

/**
 * Schema for updating a domain score
 */
const updateDomainScoreSchema = z.object({
  assessmentId: z.string().min(1),
  domainId: z.string().min(1),
  currentLevel: z.number().int().min(0).max(5).optional().nullable(),
  /// When true, the item is marked Not Applicable. currentLevel must be null.
  isNotApplicable: z.boolean().optional(),
  targetLevel: z.number().int().min(0).max(5).optional().nullable(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  evidenceLinks: z.array(z.string()).optional(),
});

/**
 * Schema for bulk updating domain scores
 */
const bulkUpdateDomainScoresSchema = z.object({
  assessmentId: z.string().min(1),
  scores: z.array(
    z.object({
      domainId: z.string().min(1),
      currentLevel: z.number().int().min(0).max(5).optional().nullable(),
      targetLevel: z.number().int().min(0).max(5).optional().nullable(),
      confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().nullable(),
      notes: z.string().max(5000).optional().nullable(),
    })
  ),
});

/**
 * Schema for creating a snapshot
 */
const createSnapshotSchema = z.object({
  assessmentId: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

/**
 * Schema for assigning assessors
 */
const assignAssessorsSchema = z.object({
  assessmentId: z.string().min(1),
  assignments: z.array(
    z.object({
      userId: z.string().min(1),
      domainCodes: z.array(z.string()),
    })
  ),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate assessment identifier (MAT-YYYY-NNNN)
 */
async function generateAssessmentIdentifier(
  db: PrismaClient,
  organizationId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MAT-${year}-`;

  // Get count of assessments this year
  const count = await db.maturityAssessment.count({
    where: {
      organizationId,
      identifier: { startsWith: prefix },
    },
  });

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/**
 * Calculate achieved MIL based on cumulative practice completion
 *
 * C2M2 MIL Cumulative Rule:
 * - MIL0: No practices performed
 * - MIL1: ALL MIL1 practices performed
 * - MIL2: ALL MIL1 AND ALL MIL2 practices performed
 * - MIL3: ALL MIL1, MIL2, AND MIL3 practices performed
 */
function calculateAchievedMIL(
  practicesByLevel: Record<
    number,
    { id: string; isPerformed: boolean }[]
  >
): number {
  // Check MIL1 - all MIL1 practices must be performed
  const mil1Practices = practicesByLevel[1] ?? [];
  const mil1Complete = mil1Practices.length > 0 && mil1Practices.every((p) => p.isPerformed);

  if (!mil1Complete) {
    return 0; // MIL0 - not all MIL1 practices performed
  }

  // Check MIL2 - all MIL1 + all MIL2 practices must be performed
  const mil2Practices = practicesByLevel[2] ?? [];
  const mil2Complete = mil2Practices.length === 0 || mil2Practices.every((p) => p.isPerformed);

  if (!mil2Complete) {
    return 1; // MIL1 achieved
  }

  // Check MIL3 - all MIL1 + MIL2 + all MIL3 practices must be performed
  const mil3Practices = practicesByLevel[3] ?? [];
  const mil3Complete = mil3Practices.length === 0 || mil3Practices.every((p) => p.isPerformed);

  if (!mil3Complete) {
    return 2; // MIL2 achieved
  }

  return 3; // MIL3 achieved - all practices complete
}

/**
 * Recalculate NIST CSF function score based on subcategory scores
 * Aggregates subcategory implementation levels to get function average
 */
async function recalculateNistFunctionScore(
  db: PrismaClient,
  assessmentId: string,
  functionId: string | null,
  userId: string
): Promise<void> {
  if (!functionId) return;

  // Get all categories under this function
  const categories = await db.maturityDomain.findMany({
    where: {
      parentId: functionId,
      level: "CATEGORY",
    },
  });

  if (categories.length === 0) return;

  const categoryIds = categories.map((c) => c.id);

  // Get all subcategories under these categories
  const subcategories = await db.maturityDomain.findMany({
    where: {
      parentId: { in: categoryIds },
      level: "SUBCATEGORY",
    },
  });

  if (subcategories.length === 0) return;

  // Get scores for all subcategories
  const subcategoryScores = await db.maturityDomainScore.findMany({
    where: {
      assessmentId,
      domainId: { in: subcategories.map((s) => s.id) },
    },
  });

  // Calculate average tier from scored subcategories
  const scoredLevels = subcategoryScores
    .filter((s) => s.currentLevel !== null)
    .map((s) => s.currentLevel!);

  if (scoredLevels.length === 0) return;

  const averageLevel = Math.round(
    scoredLevels.reduce((a, b) => a + b, 0) / scoredLevels.length
  );

  // Update function-level domain score
  await db.maturityDomainScore.upsert({
    where: {
      assessmentId_domainId: {
        assessmentId,
        domainId: functionId,
      },
    },
    update: {
      currentLevel: averageLevel,
      assessedBy: userId,
      assessedAt: new Date(),
    },
    create: {
      assessmentId,
      domainId: functionId,
      currentLevel: averageLevel,
      assessedBy: userId,
      assessedAt: new Date(),
    },
  });

  // Recalculate overall assessment score
  const assessment = await db.maturityAssessment.findUnique({
    where: { id: assessmentId },
    include: { framework: true },
  });

  if (assessment) {
    // Get all function-level scores
    const functionDomains = await db.maturityDomain.findMany({
      where: {
        frameworkId: assessment.frameworkId,
        level: "FUNCTION",
      },
    });

    const allFunctionScores = await db.maturityDomainScore.findMany({
      where: {
        assessmentId,
        domainId: { in: functionDomains.map((f) => f.id) },
      },
    });

    const scoredFunctions = allFunctionScores.filter(
      (s) => s.currentLevel !== null
    );

    if (scoredFunctions.length > 0) {
      const overallScore = calculateMaturityScore(
        assessment.framework.type,
        scoredFunctions.map((s) => s.currentLevel!)
      );

      await db.maturityAssessment.update({
        where: { id: assessmentId },
        data: {
          overallLevel: Math.floor(overallScore.level),
          overallScore: overallScore.score,
        },
      });
    }
  }
}

/**
 * Recalculate and update domain MIL score based on practice completion
 */
async function recalculateDomainMIL(
  db: PrismaClient,
  assessmentId: string,
  domainId: string,
  userId: string
): Promise<void> {
  // Get all practices for this domain
  const practices = await db.maturityQuestion.findMany({
    where: {
      domainId,
      answerType: "PRACTICE",
      isActive: true,
    },
  });

  // Get responses for these practices
  const responses = await db.maturityQuestionResponse.findMany({
    where: {
      assessmentId,
      questionId: { in: practices.map((p) => p.id) },
    },
  });

  const responseMap = new Map(responses.map((r) => [r.questionId, r]));

  // Organize by level
  const practicesByLevel: Record<number, { id: string; isPerformed: boolean }[]> = {
    1: [],
    2: [],
    3: [],
  };

  for (const practice of practices) {
    const response = responseMap.get(practice.id);
    const level = practice.practiceLevel ?? 1;

    if (!practicesByLevel[level]) {
      practicesByLevel[level] = [];
    }

    practicesByLevel[level].push({
      id: practice.id,
      isPerformed: response?.isPerformed ?? false,
    });
  }

  // Calculate achieved MIL
  const achievedMIL = calculateAchievedMIL(practicesByLevel);

  // Update domain score
  await db.maturityDomainScore.upsert({
    where: {
      assessmentId_domainId: {
        assessmentId,
        domainId,
      },
    },
    update: {
      currentLevel: achievedMIL,
      assessedBy: userId,
      assessedAt: new Date(),
    },
    create: {
      assessmentId,
      domainId,
      currentLevel: achievedMIL,
      assessedBy: userId,
      assessedAt: new Date(),
    },
  });

  // Recalculate overall assessment score
  const assessment = await db.maturityAssessment.findUnique({
    where: { id: assessmentId },
    include: { framework: true },
  });

  if (assessment) {
    const allScores = await db.maturityDomainScore.findMany({
      where: { assessmentId },
    });

    const scoredDomains = allScores.filter((s) => s.currentLevel !== null);
    if (scoredDomains.length > 0) {
      const overallScore = calculateMaturityScore(
        assessment.framework.type,
        scoredDomains.map((s) => s.currentLevel!)
      );

      await db.maturityAssessment.update({
        where: { id: assessmentId },
        data: {
          overallLevel: Math.floor(overallScore.level),
          overallScore: overallScore.score,
        },
      });
    }
  }
}

/**
 * Recalculate SAMM scores from question responses up through the hierarchy.
 * Stream score = SUM of question weights (0-3)
 * Practice score = AVG of 2 stream scores (0-3)
 * Function score = AVG of 3 practice scores (0-3)
 * Overall score = AVG of 5 function scores (0-3)
 */
async function recalculateSammScores(
  db: PrismaClient,
  assessmentId: string,
  userId: string
): Promise<void> {
  // Get the assessment with framework
  const assessment = await db.maturityAssessment.findUnique({
    where: { id: assessmentId },
    include: { framework: true },
  });
  if (!assessment) return;

  // Get all domains organized by level
  const allDomains = await db.maturityDomain.findMany({
    where: { frameworkId: assessment.frameworkId },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
  });

  const functions = allDomains.filter((d) => d.level === "FUNCTION");
  const practices = allDomains.filter((d) => d.level === "CATEGORY");
  const streams = allDomains.filter((d) => d.level === "SUBCATEGORY");

  // Get all questions and responses for this assessment
  const questions = await db.maturityQuestion.findMany({
    where: {
      frameworkId: assessment.frameworkId,
      answerType: "WEIGHTED_SCALE",
      isActive: true,
    },
  });

  const responses = await db.maturityQuestionResponse.findMany({
    where: {
      assessmentId,
      questionId: { in: questions.map((q) => q.id) },
    },
  });
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));

  // Calculate stream scores: SUM of 3 question weights
  const streamScores = new Map<string, number>();
  for (const stream of streams) {
    const streamQuestions = questions.filter((q) => q.domainId === stream.id);
    const weights = streamQuestions.map((q) => {
      const resp = responseMap.get(q.id);
      return resp?.scaleValue != null ? sammAnswerWeight(resp.scaleValue) : 0;
    });
    // Only calculate if at least one question is answered
    const hasAnswers = streamQuestions.some((q) => responseMap.has(q.id));
    if (hasAnswers) {
      streamScores.set(stream.id, weights.reduce((sum, w) => sum + w, 0));
    }
  }

  // Calculate practice scores: AVG of 2 stream scores
  const practiceScores = new Map<string, number>();
  for (const practice of practices) {
    const childStreams = streams.filter((s) => s.parentId === practice.id);
    const scored = childStreams
      .filter((s) => streamScores.has(s.id))
      .map((s) => streamScores.get(s.id)!);
    if (scored.length > 0) {
      practiceScores.set(
        practice.id,
        scored.reduce((a, b) => a + b, 0) / scored.length
      );
    }
  }

  // Calculate function scores: AVG of 3 practice scores
  const functionScores = new Map<string, number>();
  for (const func of functions) {
    const childPractices = practices.filter((p) => p.parentId === func.id);
    const scored = childPractices
      .filter((p) => practiceScores.has(p.id))
      .map((p) => practiceScores.get(p.id)!);
    if (scored.length > 0) {
      const avg = scored.reduce((a, b) => a + b, 0) / scored.length;
      functionScores.set(func.id, avg);

      // Store function-level domain score
      await db.maturityDomainScore.upsert({
        where: {
          assessmentId_domainId: { assessmentId, domainId: func.id },
        },
        update: {
          currentLevel: Math.floor(avg),
          assessedBy: userId,
          assessedAt: new Date(),
        },
        create: {
          assessmentId,
          domainId: func.id,
          currentLevel: Math.floor(avg),
          assessedBy: userId,
          assessedAt: new Date(),
        },
      });
    }
  }

  // Calculate overall score: AVG of 5 function scores
  const allFuncScores = Array.from(functionScores.values());
  if (allFuncScores.length > 0) {
    const overallScore = calculateMaturityScore(
      assessment.framework.type,
      allFuncScores
    );

    await db.maturityAssessment.update({
      where: { id: assessmentId },
      data: {
        overallLevel: Math.floor(overallScore.level),
        overallScore: overallScore.score,
      },
    });
  }
}

// =============================================================================
// Router
// =============================================================================

export const maturityRouter = createTRPCRouter({
  // ===========================================================================
  // Framework Operations
  // ===========================================================================

  /**
   * List available maturity frameworks
   */
  listFrameworks: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(
      z.object({
        type: z.nativeEnum(MaturityFrameworkType).optional(),
        includeInactive: z.boolean().default(false),
      }).nullish()
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      const frameworks = await db.maturityFramework.findMany({
        where: {
          OR: [
            { organizationId: null, isSystemTemplate: true }, // System templates
            { organizationId }, // Org-specific
          ],
          type: input?.type,
          isActive: input?.includeInactive ? undefined : true,
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });

      return frameworks;
    }),

  /**
   * Get framework with domains hierarchy
   */
  getFramework: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      const framework = await db.maturityFramework.findFirst({
        where: {
          id: input.id,
          OR: [
            { organizationId: null, isSystemTemplate: true },
            { organizationId },
          ],
        },
        include: {
          domains: {
            orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
          },
          // Questions are the actual "controls" for question-based maturity
          // frameworks (C2M2 practices, SAMM activities). Surface them so
          // the detail page and assessment can show them grouped by domain.
          questions: {
            where: {
              OR: [
                { organizationId: null }, // official
                { organizationId }, // org-customized
              ],
              isActive: true,
            },
            orderBy: [{ sortOrder: "asc" }, { practiceLevel: "asc" }],
          },
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Build hierarchical structure, preserving sortOrder at every level so
      // the UI tree reads in the framework's intended order (e.g. NIST CSF
      // GV → ID → PR → DE → RS → RC, not alphabetical).
      type DomainWithChildren = (typeof framework.domains)[number] & {
        children: DomainWithChildren[];
      };
      const domainMap = new Map<string, DomainWithChildren>(
        framework.domains.map((d) => [d.id, { ...d, children: [] }])
      );
      const rootDomains: DomainWithChildren[] = [];

      for (const domain of framework.domains) {
        const node = domainMap.get(domain.id)!;
        if (domain.parentId) {
          const parent = domainMap.get(domain.parentId);
          if (parent) parent.children.push(node);
        } else {
          rootDomains.push(node);
        }
      }

      const sortByOrder = (a: DomainWithChildren, b: DomainWithChildren) =>
        a.sortOrder - b.sortOrder;
      const sortRecursive = (nodes: DomainWithChildren[]) => {
        nodes.sort(sortByOrder);
        for (const n of nodes) sortRecursive(n.children);
      };
      sortRecursive(rootDomains);

      return {
        ...framework,
        domainHierarchy: rootDomains,
      };
    }),

  /**
   * Update testInstructions / acceptanceCriteria on a maturity domain.
   * ORG_ADMIN only — testing fields are org policy, not per-user state.
   * Allowed even on system-template domains since these fields are layered
   * on top of the upstream definition rather than mutating it.
   */
  updateDomainTestingFields: organizationProcedure
    .use(requireRole([UserRole.ORG_ADMIN]))
    .input(
      z.object({
        id: z.string(),
        testInstructions: z.string().nullable(),
        acceptanceCriteria: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      const domain = await db.maturityDomain.findFirst({
        where: {
          id: input.id,
          framework: {
            OR: [
              { organizationId: null, isSystemTemplate: true },
              { organizationId },
            ],
          },
        },
      });
      if (!domain) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }
      return db.maturityDomain.update({
        where: { id: input.id },
        data: {
          testInstructions: input.testInstructions,
          acceptanceCriteria: input.acceptanceCriteria,
        },
      });
    }),

  /**
   * Same as updateDomainTestingFields but for a MaturityQuestion (C2M2
   * practice / SAMM activity).
   */
  updateQuestionTestingFields: organizationProcedure
    .use(requireRole([UserRole.ORG_ADMIN]))
    .input(
      z.object({
        id: z.string(),
        testInstructions: z.string().nullable(),
        acceptanceCriteria: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      const question = await db.maturityQuestion.findFirst({
        where: {
          id: input.id,
          framework: {
            OR: [
              { organizationId: null, isSystemTemplate: true },
              { organizationId },
            ],
          },
        },
      });
      if (!question) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }
      return db.maturityQuestion.update({
        where: { id: input.id },
        data: {
          testInstructions: input.testInstructions,
          acceptanceCriteria: input.acceptanceCriteria,
        },
      });
    }),

  /**
   * Clone a maturity framework into the current organization. Used when an
   * admin wants an org-specific copy of a system template (NIST CSF, C2M2)
   * that can then be customized without affecting the upstream template.
   *
   * Clones: framework metadata, domains (preserving hierarchy), questions.
   * Does NOT clone: assessments, responses, scores — those are runtime data.
   */
  cloneFramework: organizationProcedure
    .use(requireRole([UserRole.ORG_ADMIN]))
    .input(
      z.object({
        sourceFrameworkId: z.string(),
        name: z.string().min(1).max(200),
        version: z.string().min(1).max(50).default("1.0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      if (!organizationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Organization context required" });
      }

      const source = await db.maturityFramework.findFirst({
        where: {
          id: input.sourceFrameworkId,
          OR: [
            { organizationId: null, isSystemTemplate: true },
            { organizationId },
          ],
        },
        include: {
          domains: { orderBy: [{ level: "asc" }, { sortOrder: "asc" }] },
          questions: { orderBy: { sortOrder: "asc" } },
        },
      });

      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source framework not found" });
      }

      return db.$transaction(async (tx) => {
        const cloned = await tx.maturityFramework.create({
          data: {
            organizationId,
            type: source.type,
            name: input.name,
            version: input.version,
            description: source.description,
            minLevel: source.minLevel,
            maxLevel: source.maxLevel,
            scoringLevels: source.scoringLevels as Prisma.InputJsonValue,
            isActive: true,
            isSystemTemplate: false,
          },
        });

        // Map source domain ids → cloned domain ids so we can re-wire parent
        // relationships in a second pass after all domains exist.
        const domainIdMap = new Map<string, string>();
        for (const domain of source.domains) {
          const created = await tx.maturityDomain.create({
            data: {
              frameworkId: cloned.id,
              code: domain.code,
              name: domain.name,
              description: domain.description,
              level: domain.level,
              sortOrder: domain.sortOrder,
              // Parent wired up below
            },
          });
          domainIdMap.set(domain.id, created.id);
        }

        for (const domain of source.domains) {
          if (!domain.parentId) continue;
          const newParentId = domainIdMap.get(domain.parentId);
          const newId = domainIdMap.get(domain.id);
          if (!newParentId || !newId) continue;
          await tx.maturityDomain.update({
            where: { id: newId },
            data: { parentId: newParentId },
          });
        }

        for (const question of source.questions) {
          await tx.maturityQuestion.create({
            data: {
              frameworkId: cloned.id,
              domainId: question.domainId
                ? domainIdMap.get(question.domainId) ?? null
                : null,
              organizationId, // org-owned, not official
              questionText: question.questionText,
              guidanceText: question.guidanceText,
              answerType: question.answerType,
              weight: question.weight,
              isOfficial: false,
              isActive: question.isActive,
              sortOrder: question.sortOrder,
              practiceCode: question.practiceCode,
              practiceLevel: question.practiceLevel,
              answerOptions:
                question.answerOptions === null
                  ? Prisma.JsonNull
                  : (question.answerOptions as Prisma.InputJsonValue),
            },
          });
        }

        return cloned;
      });
    }),

  // ===========================================================================
  // Assessment CRUD
  // ===========================================================================

  /**
   * Create a new maturity assessment
   */
  create: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(createAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required to create assessment",
        });
      }

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      // Verify framework exists and is accessible
      const framework = await db.maturityFramework.findFirst({
        where: {
          id: input.frameworkId,
          OR: [
            { organizationId: null, isSystemTemplate: true },
            { organizationId },
          ],
          isActive: true,
        },
        include: {
          domains: {
            where: { level: input.assessmentDepth },
          },
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found or not accessible",
        });
      }

      // Generate identifier
      const identifier = await generateAssessmentIdentifier(db, organizationId);

      // Per-function targets — applied to the Function-level MaturityDomain
      // rows (separate from `domains` which is filtered by assessmentDepth).
      // For non-CSF frameworks or when functionTargets is empty, each
      // domainScore falls back to input.targetLevel as before.
      const useFunctionTargets =
        !!input.functionTargets &&
        Object.keys(input.functionTargets).length > 0;

      let functionDomainsByCode: Record<string, { id: string }> = {};
      if (useFunctionTargets) {
        const functionDomains = await db.maturityDomain.findMany({
          where: {
            frameworkId: input.frameworkId,
            level: AssessmentDepth.FUNCTION,
          },
          select: { id: true, code: true },
        });
        functionDomainsByCode = Object.fromEntries(
          functionDomains.map((d) => [d.code, { id: d.id }])
        );
      }

      // For each domain that will be scored, figure out the target it
      // should start with: a per-domain value from functionTargets (keyed by
      // domain code — works at any level; CSF keys by Function code, C2M2
      // by Function code, SAMM by Function/Category/Subcategory code based
      // on assessment depth) or the single assessment-wide targetLevel.
      const domainScoresToCreate = framework.domains.map((domain) => {
        let resolvedTarget: number | null = input.targetLevel ?? null;
        if (
          useFunctionTargets &&
          input.functionTargets![domain.code] !== undefined
        ) {
          resolvedTarget = input.functionTargets![domain.code]!;
        }
        return {
          domainId: domain.id,
          currentLevel: null,
          targetLevel: resolvedTarget,
        };
      });

      // Create assessment with initial domain scores
      const assessment = await db.maturityAssessment.create({
        data: {
          organizationId,
          frameworkId: input.frameworkId,
          identifier,
          name: input.name,
          description: input.description,
          assessmentDepth: input.assessmentDepth,
          assessmentMode: input.assessmentMode,
          scoringScale: input.scoringScale ?? null,
          status: MaturityAssessmentStatus.DRAFT,
          targetLevel: input.targetLevel,
          targetDate: input.targetDate,
          ownerId: session.user.id,
          businessUnitId: input.businessUnitId ?? null,
          domainScores: {
            create: domainScoresToCreate,
          },
        },
        include: {
          framework: true,
          domainScores: {
            include: { domain: true },
          },
        },
      });

      // If user is assessing at FUNCTION depth with functionTargets, those
      // already landed on the domainScores above. Otherwise (CATEGORY/
      // SUBCATEGORY depth with functionTargets), we also need to persist the
      // function-level targets as separate rows so children can inherit
      // them. Create them if they don't already exist in the scored set.
      if (useFunctionTargets && input.assessmentDepth !== AssessmentDepth.FUNCTION) {
        const alreadyCreated = new Set(
          assessment.domainScores.map((s) => s.domainId)
        );
        const extraRows = Object.entries(input.functionTargets!)
          .map(([code, target]) => {
            const fnDomain = functionDomainsByCode[code];
            if (!fnDomain || alreadyCreated.has(fnDomain.id)) return null;
            return {
              assessmentId: assessment.id,
              domainId: fnDomain.id,
              currentLevel: null,
              targetLevel: target,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (extraRows.length > 0) {
          await db.maturityDomainScore.createMany({
            data: extraRows,
            skipDuplicates: true,
          });
        }
      }

      return assessment;
    }),

  /**
   * List maturity assessments
   */
  list: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(listAssessmentsSchema)
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      const where = {
        organizationId,
        ...(input.frameworkType && {
          framework: { type: input.frameworkType },
        }),
        ...(input.status && { status: input.status }),
        ...(input.businessUnitId && { businessUnitId: input.businessUnitId }),
      };

      const [assessments, total] = await Promise.all([
        db.maturityAssessment.findMany({
          where,
          include: {
            framework: true,
            owner: { select: { id: true, name: true, email: true } },
            businessUnit: { select: { id: true, name: true, code: true } },
            _count: {
              select: {
                domainScores: true,
                assignees: true,
                snapshots: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.maturityAssessment.count({ where }),
      ]);

      return {
        assessments,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  /**
   * Get assessment details
   */
  getById: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      const assessment = await db.maturityAssessment.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          framework: {
            include: {
              domains: {
                orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
              },
            },
          },
          owner: { select: { id: true, name: true, email: true, image: true } },
          submitter: { select: { id: true, name: true, email: true } },
          approver: { select: { id: true, name: true, email: true } },
          domainScores: {
            include: {
              domain: true,
              assessor: { select: { id: true, name: true, email: true } },
            },
          },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          snapshots: {
            orderBy: { snapshotDate: "desc" },
            take: 10,
          },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Calculate overall score from domain scores
      const scoredDomains = assessment.domainScores.filter(
        (ds) => ds.currentLevel !== null
      );
      const overallScore =
        scoredDomains.length > 0
          ? calculateMaturityScore(
              assessment.framework.type,
              scoredDomains.map((ds) => ds.currentLevel!)
            )
          : null;

      return {
        ...assessment,
        calculatedScore: overallScore,
      };
    }),

  /**
   * Update assessment
   */
  update: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(updateAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment exists and belongs to org
      const existing = await db.maturityAssessment.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Update assessment
      const { id, ...updateData } = input;
      const assessment = await db.maturityAssessment.update({
        where: { id },
        data: {
          ...updateData,
          // Track submission/approval
          ...(input.status === MaturityAssessmentStatus.IN_REVIEW && {
            submittedAt: new Date(),
            submittedBy: session.user.id,
          }),
          ...(input.status === MaturityAssessmentStatus.COMPLETED && {
            approvedAt: new Date(),
            approvedBy: session.user.id,
          }),
        },
        include: {
          framework: true,
          owner: { select: { id: true, name: true, email: true } },
        },
      });

      return assessment;
    }),

  /**
   * Delete assessment
   */
  delete: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment exists and belongs to org
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Only allow deletion of draft assessments
      if (assessment.status !== MaturityAssessmentStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only delete draft assessments",
        });
      }

      await db.maturityAssessment.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // ===========================================================================
  // Domain Scoring
  // ===========================================================================

  /**
   * Update a single domain score
   */
  updateDomainScore: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(updateDomainScoreSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment exists
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Enforce the NA invariant: if marked Not Applicable, currentLevel must
      // be null so aggregates skip the item cleanly.
      const normalizedCurrentLevel = input.isNotApplicable
        ? null
        : input.currentLevel;

      // Upsert domain score
      const score = await db.maturityDomainScore.upsert({
        where: {
          assessmentId_domainId: {
            assessmentId: input.assessmentId,
            domainId: input.domainId,
          },
        },
        update: {
          currentLevel: normalizedCurrentLevel,
          isNotApplicable: input.isNotApplicable ?? false,
          targetLevel: input.targetLevel,
          confidence: input.confidence,
          notes: input.notes,
          evidenceLinks: input.evidenceLinks ?? [],
          assessedBy: session.user.id,
          assessedAt: new Date(),
        },
        create: {
          assessmentId: input.assessmentId,
          domainId: input.domainId,
          currentLevel: normalizedCurrentLevel,
          isNotApplicable: input.isNotApplicable ?? false,
          targetLevel: input.targetLevel,
          confidence: input.confidence,
          notes: input.notes,
          evidenceLinks: input.evidenceLinks ?? [],
          assessedBy: session.user.id,
          assessedAt: new Date(),
        },
        include: {
          domain: true,
        },
      });

      // Recalculate and update overall score
      const allScores = await db.maturityDomainScore.findMany({
        where: { assessmentId: input.assessmentId },
        include: { assessment: { include: { framework: true } } },
      });

      const scoredDomains = allScores.filter((s) => s.currentLevel !== null);
      if (scoredDomains.length > 0 && scoredDomains[0]?.assessment) {
        const overallScore = calculateMaturityScore(
          scoredDomains[0].assessment.framework.type,
          scoredDomains.map((s) => s.currentLevel!)
        );

        await db.maturityAssessment.update({
          where: { id: input.assessmentId },
          data: {
            overallLevel: Math.floor(overallScore.level),
            overallScore: overallScore.score,
          },
        });
      }

      return score;
    }),

  /**
   * Bulk update domain scores
   */
  bulkUpdateDomainScores: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(bulkUpdateDomainScoresSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment exists
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: { framework: true },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Update all scores in a transaction
      const results = await db.$transaction(
        input.scores.map((score) =>
          db.maturityDomainScore.upsert({
            where: {
              assessmentId_domainId: {
                assessmentId: input.assessmentId,
                domainId: score.domainId,
              },
            },
            update: {
              currentLevel: score.currentLevel,
              targetLevel: score.targetLevel,
              confidence: score.confidence,
              notes: score.notes,
              assessedBy: session.user.id,
              assessedAt: new Date(),
            },
            create: {
              assessmentId: input.assessmentId,
              domainId: score.domainId,
              currentLevel: score.currentLevel,
              targetLevel: score.targetLevel,
              confidence: score.confidence,
              notes: score.notes,
              assessedBy: session.user.id,
              assessedAt: new Date(),
            },
          })
        )
      );

      // Recalculate overall score
      const allScores = await db.maturityDomainScore.findMany({
        where: { assessmentId: input.assessmentId },
      });

      const scoredDomains = allScores.filter((s) => s.currentLevel !== null);
      if (scoredDomains.length > 0) {
        const overallScore = calculateMaturityScore(
          assessment.framework.type,
          scoredDomains.map((s) => s.currentLevel!)
        );

        await db.maturityAssessment.update({
          where: { id: input.assessmentId },
          data: {
            overallLevel: Math.floor(overallScore.level),
            overallScore: overallScore.score,
          },
        });
      }

      return { updated: results.length };
    }),

  // ===========================================================================
  // Snapshots
  // ===========================================================================

  /**
   * Create a historical snapshot
   */
  createSnapshot: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(createSnapshotSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Get assessment with current scores
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: {
          domainScores: {
            include: { domain: true },
          },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Create snapshot
      const snapshot = await db.maturitySnapshot.create({
        data: {
          assessmentId: input.assessmentId,
          snapshotDate: new Date(),
          overallLevel: assessment.overallLevel ?? 0,
          overallScore: assessment.overallScore ?? 0,
          domainScores: assessment.domainScores.map((ds) => ({
            domainId: ds.domainId,
            domainCode: ds.domain.code,
            domainName: ds.domain.name,
            currentLevel: ds.currentLevel,
            targetLevel: ds.targetLevel,
            confidence: ds.confidence,
            notes: ds.notes,
          })),
          triggeredBy: session.user.id,
          reason: input.reason,
        },
      });

      return snapshot;
    }),

  /**
   * List snapshots for an assessment
   */
  listSnapshots: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(z.object({ assessmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment belongs to org
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      const snapshots = await db.maturitySnapshot.findMany({
        where: { assessmentId: input.assessmentId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { snapshotDate: "desc" },
      });

      return snapshots;
    }),

  // ===========================================================================
  // Multi-Assessor
  // ===========================================================================

  /**
   * Assign assessors to domains
   */
  assignAssessors: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(assignAssessorsSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment exists
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Remove existing assignments and create new ones
      await db.assessorAssignment.deleteMany({
        where: { assessmentId: input.assessmentId },
      });

      const assignments = await db.$transaction(
        input.assignments.map((assignment) =>
          db.assessorAssignment.create({
            data: {
              assessmentId: input.assessmentId,
              userId: assignment.userId,
              assignedDomains: assignment.domainCodes,
              status: AssessorAssignmentStatus.PENDING,
            },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          })
        )
      );

      return assignments;
    }),

  /**
   * Submit assessor's portion
   */
  submitAssessment: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(z.object({ assessmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Update the user's assignment status
      const assignment = await db.assessorAssignment.findFirst({
        where: {
          assessmentId: input.assessmentId,
          userId: session.user.id,
          assessment: { organizationId },
        },
      });

      if (!assignment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assignment not found",
        });
      }

      await db.assessorAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssessorAssignmentStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      // Check if all assessors have submitted
      const allAssignments = await db.assessorAssignment.findMany({
        where: { assessmentId: input.assessmentId },
      });

      const allSubmitted = allAssignments.every(
        (a) => a.status === AssessorAssignmentStatus.SUBMITTED
      );

      if (allSubmitted) {
        // Auto-transition to IN_REVIEW
        await db.maturityAssessment.update({
          where: { id: input.assessmentId },
          data: { status: MaturityAssessmentStatus.IN_REVIEW },
        });
      }

      return { success: true, allSubmitted };
    }),

  // ===========================================================================
  // Questions (Guided Assessment)
  // ===========================================================================

  /**
   * Get questions for a domain
   */
  getQuestionsForDomain: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(
      z.object({
        frameworkId: z.string(),
        domainId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      const questions = await db.maturityQuestion.findMany({
        where: {
          frameworkId: input.frameworkId,
          domainId: input.domainId ?? null,
          isActive: true,
          OR: [
            { organizationId: null, isOfficial: true },
            { organizationId },
          ],
        },
        orderBy: [{ isOfficial: "desc" }, { sortOrder: "asc" }],
      });

      return questions;
    }),

  /**
   * Submit question response
   */
  submitQuestionResponse: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        questionId: z.string(),
        answer: z.string().optional().nullable(),
        scaleValue: z.number().int().min(0).max(5).optional().nullable(),
        evidenceIds: z.array(z.string()).optional(),
        notes: z.string().max(5000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment belongs to org
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Upsert response
      const response = await db.maturityQuestionResponse.upsert({
        where: {
          assessmentId_questionId: {
            assessmentId: input.assessmentId,
            questionId: input.questionId,
          },
        },
        update: {
          answer: input.answer,
          scaleValue: input.scaleValue,
          evidenceIds: input.evidenceIds ?? [],
          notes: input.notes,
          answeredBy: session.user.id,
          answeredAt: new Date(),
        },
        create: {
          assessmentId: input.assessmentId,
          questionId: input.questionId,
          answer: input.answer,
          scaleValue: input.scaleValue,
          evidenceIds: input.evidenceIds ?? [],
          notes: input.notes,
          answeredBy: session.user.id,
        },
        include: {
          question: true,
        },
      });

      return response;
    }),

  // ===========================================================================
  // C2M2 Practice-Level Assessment
  // ===========================================================================

  /**
   * Get practices for a domain (C2M2)
   * Returns all practices organized by MIL level with completion status
   */
  getDomainPractices: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        domainId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment and get framework
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: { framework: true },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Get practices for the domain
      const practices = await db.maturityQuestion.findMany({
        where: {
          frameworkId: assessment.frameworkId,
          domainId: input.domainId,
          answerType: "PRACTICE",
          isActive: true,
        },
        orderBy: [{ practiceLevel: "asc" }, { sortOrder: "asc" }],
      });

      // Get existing responses for this assessment
      const responses = await db.maturityQuestionResponse.findMany({
        where: {
          assessmentId: input.assessmentId,
          questionId: { in: practices.map((p) => p.id) },
        },
      });

      const responseMap = new Map(responses.map((r) => [r.questionId, r]));

      // Organize practices by MIL level with completion status
      const practicesByLevel: Record<
        number,
        {
          id: string;
          code: string;
          text: string;
          guidance: string | null;
          // Org-authored testing fields shown read-only during scoring.
          testInstructions: string | null;
          acceptanceCriteria: string | null;
          isPerformed: boolean;
          implementationLevel: number | null;
          notes: string | null;
        }[]
      > = { 1: [], 2: [], 3: [] };

      for (const practice of practices) {
        const response = responseMap.get(practice.id);
        const level = practice.practiceLevel ?? 1;

        if (!practicesByLevel[level]) {
          practicesByLevel[level] = [];
        }

        practicesByLevel[level].push({
          id: practice.id,
          code: practice.practiceCode ?? "",
          text: practice.questionText,
          guidance: practice.guidanceText,
          testInstructions: practice.testInstructions,
          acceptanceCriteria: practice.acceptanceCriteria,
          isPerformed: response?.isPerformed ?? false,
          implementationLevel: response?.scaleValue ?? null,
          notes: response?.notes ?? null,
        });
      }

      // Calculate achieved MIL based on cumulative completion
      const achievedMIL = calculateAchievedMIL(practicesByLevel);

      return {
        practices: practicesByLevel,
        achievedMIL,
        totalPractices: practices.length,
        completedPractices: responses.filter((r) => r.isPerformed === true).length,
      };
    }),

  /**
   * Save practice response (C2M2)
   * Scores a practice with implementation level and notes
   * Implementation levels:
   *   0 = Not Implemented (fail)
   *   1 = Partially Implemented (fail)
   *   2 = Largely Implemented (pass)
   *   3 = Fully Implemented (pass)
   */
  savePracticeResponse: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        practiceId: z.string(),
        implementationLevel: z.number().int().min(0).max(3),
        notes: z.string().max(5000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment exists
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Verify practice exists
      const practice = await db.maturityQuestion.findUnique({
        where: { id: input.practiceId },
        include: { domain: true },
      });

      if (!practice || practice.answerType !== "PRACTICE") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Practice not found",
        });
      }

      // Determine if practice is "performed" based on implementation level
      // Fully (3) or Largely (2) = pass, Partially (1) or Not (0) = fail
      const isPerformed = isImplementationLevelPassing(input.implementationLevel);

      // Upsert response
      const response = await db.maturityQuestionResponse.upsert({
        where: {
          assessmentId_questionId: {
            assessmentId: input.assessmentId,
            questionId: input.practiceId,
          },
        },
        update: {
          isPerformed,
          scaleValue: input.implementationLevel,
          notes: input.notes,
          answeredBy: session.user.id,
          answeredAt: new Date(),
        },
        create: {
          assessmentId: input.assessmentId,
          questionId: input.practiceId,
          isPerformed,
          scaleValue: input.implementationLevel,
          notes: input.notes,
          answeredBy: session.user.id,
        },
      });

      // Recalculate domain MIL if practice has a domain
      if (practice.domainId) {
        await recalculateDomainMIL(db, input.assessmentId, practice.domainId, session.user.id);
      }

      return response;
    }),

  // ===========================================================================
  // NIST CSF Subcategory-Level Assessment
  // ===========================================================================

  /**
   * Get subcategories for a function (NIST CSF)
   * Returns all subcategories organized by category with completion status
   */
  getSubcategoriesForFunction: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        domainId: z.string(), // Function ID
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment and get framework
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: { framework: true },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Get the function domain
      const functionDomain = await db.maturityDomain.findUnique({
        where: { id: input.domainId },
      });

      if (!functionDomain || functionDomain.level !== "FUNCTION") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function domain not found",
        });
      }

      // Get all categories under this function
      const categories = await db.maturityDomain.findMany({
        where: {
          frameworkId: assessment.frameworkId,
          parentId: input.domainId,
          level: "CATEGORY",
        },
        orderBy: { sortOrder: "asc" },
      });

      // Get all subcategories under these categories
      const categoryIds = categories.map((c) => c.id);
      const subcategories = await db.maturityDomain.findMany({
        where: {
          frameworkId: assessment.frameworkId,
          parentId: { in: categoryIds },
          level: "SUBCATEGORY",
        },
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      });

      // Get existing responses for this assessment
      // We'll use the domain scores table for subcategory-level scoring
      const domainScores = await db.maturityDomainScore.findMany({
        where: {
          assessmentId: input.assessmentId,
          domainId: { in: subcategories.map((s) => s.id) },
        },
      });

      const scoreMap = new Map(domainScores.map((s) => [s.domainId, s]));

      // Organize subcategories by category
      const subcategoriesByCategory: Record<
        string,
        {
          category: {
            id: string;
            code: string;
            name: string;
            description: string | null;
          };
          subcategories: {
            id: string;
            code: string;
            name: string;
            description: string | null;
            // Org-authored testing fields surfaced read-only during scoring
            // so the assessor sees how to verify and what counts as evidence.
            testInstructions: string | null;
            acceptanceCriteria: string | null;
            implementationLevel: number | null;
            isPerformed: boolean;
            notes: string | null;
            confidence: string | null;
          }[];
        }
      > = {};

      for (const category of categories) {
        subcategoriesByCategory[category.id] = {
          category: {
            id: category.id,
            code: category.code,
            name: category.name,
            description: category.description,
          },
          subcategories: [],
        };
      }

      for (const sub of subcategories) {
        const parentId = sub.parentId;
        if (!parentId) continue;

        const categoryEntry = subcategoriesByCategory[parentId];
        if (!categoryEntry) continue;

        const score = scoreMap.get(sub.id);
        const implementationLevel = score?.currentLevel ?? null;
        const isPerformed = implementationLevel !== null && implementationLevel >= 2;

        categoryEntry.subcategories.push({
          id: sub.id,
          code: sub.code,
          name: sub.name,
          description: sub.description,
          testInstructions: sub.testInstructions,
          acceptanceCriteria: sub.acceptanceCriteria,
          implementationLevel,
          isPerformed,
          notes: score?.notes ?? null,
          confidence: score?.confidence ?? null,
        });
      }

      // Calculate completion stats
      const totalSubcategories = subcategories.length;
      const completedSubcategories = domainScores.filter(
        (s) => s.currentLevel !== null && s.currentLevel >= 2
      ).length;
      const scoredSubcategories = domainScores.filter(
        (s) => s.currentLevel !== null
      ).length;

      // Calculate average tier (for display)
      const scoredLevels = domainScores
        .filter((s) => s.currentLevel !== null)
        .map((s) => s.currentLevel!);
      const averageTier =
        scoredLevels.length > 0
          ? Math.round(
              scoredLevels.reduce((a, b) => a + b, 0) / scoredLevels.length
            )
          : null;

      return {
        categories: categories.map((c) => subcategoriesByCategory[c.id]).filter((c): c is NonNullable<typeof c> => c != null),
        totalSubcategories,
        completedSubcategories,
        scoredSubcategories,
        averageTier,
      };
    }),

  /**
   * Save subcategory response (NIST CSF)
   * Scores a subcategory with implementation level and notes
   */
  saveSubcategoryResponse: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        subcategoryId: z.string(),
        implementationLevel: z.number().int().min(0).max(3),
        notes: z.string().max(5000).optional().nullable(),
        confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment exists
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: { framework: true },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Verify subcategory exists
      const subcategory = await db.maturityDomain.findUnique({
        where: { id: input.subcategoryId },
        include: { parent: true },
      });

      if (!subcategory || subcategory.level !== "SUBCATEGORY") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subcategory not found",
        });
      }

      // Upsert domain score for the subcategory
      const score = await db.maturityDomainScore.upsert({
        where: {
          assessmentId_domainId: {
            assessmentId: input.assessmentId,
            domainId: input.subcategoryId,
          },
        },
        update: {
          currentLevel: input.implementationLevel,
          notes: input.notes,
          confidence: input.confidence,
          assessedBy: session.user.id,
          assessedAt: new Date(),
        },
        create: {
          assessmentId: input.assessmentId,
          domainId: input.subcategoryId,
          currentLevel: input.implementationLevel,
          notes: input.notes,
          confidence: input.confidence,
          assessedBy: session.user.id,
          assessedAt: new Date(),
        },
      });

      // Recalculate overall assessment score based on all function-level scores
      // For NIST CSF, we need to aggregate subcategory scores to function level
      await recalculateNistFunctionScore(
        db,
        input.assessmentId,
        subcategory.parent?.parentId ?? null, // Function ID
        session.user.id
      );

      return score;
    }),

  /**
   * Bulk save practice responses (C2M2)
   * Efficiently saves multiple practice responses at once
   */
  bulkSavePracticeResponses: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        domainId: z.string(),
        responses: z.array(
          z.object({
            practiceId: z.string(),
            isPerformed: z.boolean(),
            notes: z.string().max(5000).optional().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User session required",
        });
      }

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Verify assessment exists
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Save all responses in a transaction
      await db.$transaction(
        input.responses.map((resp) =>
          db.maturityQuestionResponse.upsert({
            where: {
              assessmentId_questionId: {
                assessmentId: input.assessmentId,
                questionId: resp.practiceId,
              },
            },
            update: {
              isPerformed: resp.isPerformed,
              notes: resp.notes,
              answeredBy: session.user.id,
              answeredAt: new Date(),
            },
            create: {
              assessmentId: input.assessmentId,
              questionId: resp.practiceId,
              isPerformed: resp.isPerformed,
              notes: resp.notes,
              answeredBy: session.user.id,
            },
          })
        )
      );

      // Recalculate domain MIL
      await recalculateDomainMIL(db, input.assessmentId, input.domainId, session.user.id);

      return { success: true, count: input.responses.length };
    }),

  // ===========================================================================
  // OWASP SAMM Assessment Operations
  // ===========================================================================

  /**
   * Get SAMM questions for a specific practice (CATEGORY domain).
   * Returns questions organized by stream with existing responses.
   */
  getSammQuestionsForPractice: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        practiceId: z.string(), // CATEGORY domain ID
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Organization context required" });
      }

      // Verify assessment
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: { framework: true },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }

      // Get the practice domain
      const practice = await db.maturityDomain.findUnique({
        where: { id: input.practiceId },
      });
      if (!practice || practice.level !== "CATEGORY") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Practice not found" });
      }

      // Get child streams (SUBCATEGORY)
      const streams = await db.maturityDomain.findMany({
        where: {
          frameworkId: assessment.frameworkId,
          parentId: input.practiceId,
          level: "SUBCATEGORY",
        },
        orderBy: { sortOrder: "asc" },
      });

      // Get questions for all streams
      const questions = await db.maturityQuestion.findMany({
        where: {
          frameworkId: assessment.frameworkId,
          domainId: { in: streams.map((s) => s.id) },
          answerType: "WEIGHTED_SCALE",
          isActive: true,
        },
        orderBy: [{ domainId: "asc" }, { practiceLevel: "asc" }],
      });

      // Get existing responses
      const responses = await db.maturityQuestionResponse.findMany({
        where: {
          assessmentId: input.assessmentId,
          questionId: { in: questions.map((q) => q.id) },
        },
      });
      const responseMap = new Map(responses.map((r) => [r.questionId, r]));

      // Organize by stream
      const streamData = streams.map((stream) => {
        const streamQuestions = questions
          .filter((q) => q.domainId === stream.id)
          .map((q) => {
            const resp = responseMap.get(q.id);
            return {
              id: q.id,
              code: q.practiceCode!,
              level: q.practiceLevel!,
              questionText: q.questionText,
              guidanceText: q.guidanceText,
              answerOptions: q.answerOptions as { value: number; label: string; weight: number }[] | null,
              answerIndex: resp?.scaleValue ?? null,
              answerWeight: resp?.scaleValue != null ? sammAnswerWeight(resp.scaleValue) : null,
              notes: resp?.notes ?? null,
              interviewee: resp?.interviewee ?? null,
            };
          });

        // Stream score = SUM of answered question weights
        const answeredWeights = streamQuestions
          .filter((q) => q.answerWeight !== null)
          .map((q) => q.answerWeight!);
        const streamScore = answeredWeights.length > 0
          ? answeredWeights.reduce((a, b) => a + b, 0)
          : null;

        return {
          id: stream.id,
          code: stream.code,
          name: stream.name,
          questions: streamQuestions,
          streamScore,
          answeredCount: answeredWeights.length,
          totalQuestions: streamQuestions.length,
        };
      });

      // Practice score = AVG of stream scores
      const scoredStreams = streamData.filter((s) => s.streamScore !== null);
      const practiceScore = scoredStreams.length > 0
        ? scoredStreams.reduce((a, b) => a + b.streamScore!, 0) / scoredStreams.length
        : null;

      return {
        practice: {
          id: practice.id,
          code: practice.code,
          name: practice.name,
        },
        streams: streamData,
        practiceScore,
        totalQuestions: questions.length,
        answeredQuestions: responses.length,
      };
    }),

  /**
   * Save a SAMM question response (weighted answer).
   * Triggers full SAMM score recalculation.
   */
  saveSammQuestionResponse: organizationProcedure
    .use(requireRole(MATURITY_MANAGE_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        questionId: z.string(),
        answerIndex: z.number().int().min(0).max(3),
        notes: z.string().max(5000).optional().nullable(),
        interviewee: z.string().max(500).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, session } = ctx;

      if (!session?.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User session required" });
      }
      if (!organizationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Organization context required" });
      }

      // Verify assessment
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }

      // Verify question exists and is SAMM type
      const question = await db.maturityQuestion.findUnique({
        where: { id: input.questionId },
      });
      if (!question || question.answerType !== "WEIGHTED_SCALE") {
        throw new TRPCError({ code: "NOT_FOUND", message: "SAMM question not found" });
      }

      // Get the answer label from answer options
      const answerOptions = question.answerOptions as { value: number; label: string; weight: number }[] | null;
      const answerLabel = answerOptions?.[input.answerIndex]?.label ?? `Option ${input.answerIndex}`;

      // Save response
      const response = await db.maturityQuestionResponse.upsert({
        where: {
          assessmentId_questionId: {
            assessmentId: input.assessmentId,
            questionId: input.questionId,
          },
        },
        update: {
          scaleValue: input.answerIndex,
          answer: answerLabel,
          notes: input.notes,
          interviewee: input.interviewee,
          answeredBy: session.user.id,
          answeredAt: new Date(),
        },
        create: {
          assessmentId: input.assessmentId,
          questionId: input.questionId,
          scaleValue: input.answerIndex,
          answer: answerLabel,
          notes: input.notes,
          interviewee: input.interviewee,
          answeredBy: session.user.id,
        },
      });

      // Recalculate all SAMM scores
      await recalculateSammScores(db, input.assessmentId, session.user.id);

      return response;
    }),

  /**
   * Get full SAMM score breakdown for charts.
   * Returns scores at all levels (functions, practices, streams).
   */
  getSammScoreBreakdown: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(z.object({ assessmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Organization context required" });
      }

      const assessment = await db.maturityAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: { framework: true },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }

      // Get all domains
      const allDomains = await db.maturityDomain.findMany({
        where: { frameworkId: assessment.frameworkId },
        orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
      });
      const functions = allDomains.filter((d) => d.level === "FUNCTION");
      const practices = allDomains.filter((d) => d.level === "CATEGORY");
      const streams = allDomains.filter((d) => d.level === "SUBCATEGORY");

      // Get all questions and responses
      const questions = await db.maturityQuestion.findMany({
        where: {
          frameworkId: assessment.frameworkId,
          answerType: "WEIGHTED_SCALE",
          isActive: true,
        },
      });
      const responses = await db.maturityQuestionResponse.findMany({
        where: {
          assessmentId: input.assessmentId,
          questionId: { in: questions.map((q) => q.id) },
        },
      });
      const responseMap = new Map(responses.map((r) => [r.questionId, r]));

      // Calculate stream scores
      const streamScoreMap = new Map<string, number>();
      for (const stream of streams) {
        const sq = questions.filter((q) => q.domainId === stream.id);
        const hasAnswers = sq.some((q) => responseMap.has(q.id));
        if (hasAnswers) {
          const score = sq.reduce((sum, q) => {
            const r = responseMap.get(q.id);
            return sum + (r?.scaleValue != null ? sammAnswerWeight(r.scaleValue) : 0);
          }, 0);
          streamScoreMap.set(stream.id, score);
        }
      }

      // Calculate practice scores
      const practiceScoreMap = new Map<string, number>();
      for (const practice of practices) {
        const childStreams = streams.filter((s) => s.parentId === practice.id);
        const scored = childStreams.filter((s) => streamScoreMap.has(s.id));
        if (scored.length > 0) {
          const avg = scored.reduce((sum, s) => sum + streamScoreMap.get(s.id)!, 0) / scored.length;
          practiceScoreMap.set(practice.id, avg);
        }
      }

      // Calculate function scores
      const functionScoreMap = new Map<string, number>();
      for (const func of functions) {
        const childPractices = practices.filter((p) => p.parentId === func.id);
        const scored = childPractices.filter((p) => practiceScoreMap.has(p.id));
        if (scored.length > 0) {
          const avg = scored.reduce((sum, p) => sum + practiceScoreMap.get(p.id)!, 0) / scored.length;
          functionScoreMap.set(func.id, avg);
        }
      }

      return {
        functions: functions.map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          score: functionScoreMap.get(f.id) ?? null,
        })),
        practices: practices.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          parentCode: functions.find((f) => f.id === p.parentId)?.code ?? "",
          score: practiceScoreMap.get(p.id) ?? null,
        })),
        streams: streams.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          parentCode: practices.find((p) => p.id === s.parentId)?.code ?? "",
          score: streamScoreMap.get(s.id) ?? null,
        })),
        overallScore: assessment.overallScore ? Number(assessment.overallScore) : null,
        totalQuestions: questions.length,
        answeredQuestions: responses.length,
      };
    }),

  // ===========================================================================
  // Dashboard
  // ===========================================================================

  /**
   * Get dashboard summary data
   * Returns aggregated statistics for the maturity dashboard
   */
  getDashboardSummary: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(z.object({ businessUnitId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Get all assessments with their scores
      const assessments = await db.maturityAssessment.findMany({
        where: {
          organizationId,
          status: { not: MaturityAssessmentStatus.ARCHIVED },
          ...(input?.businessUnitId && { businessUnitId: input.businessUnitId }),
        },
        include: {
          framework: true,
          owner: { select: { id: true, name: true, email: true } },
          domainScores: {
            include: { domain: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Summary by framework type
      const byFramework: Record<
        MaturityFrameworkType,
        {
          count: number;
          avgLevel: number;
          assessments: typeof assessments;
        }
      > = {
        NIST_CSF_2: { count: 0, avgLevel: 0, assessments: [] },
        C2M2: { count: 0, avgLevel: 0, assessments: [] },
        OWASP_SAMM: { count: 0, avgLevel: 0, assessments: [] },
      };

      for (const assessment of assessments) {
        const type = assessment.framework.type;
        byFramework[type].count++;
        byFramework[type].assessments.push(assessment);
        if (assessment.overallLevel !== null) {
          byFramework[type].avgLevel += assessment.overallLevel;
        }
      }

      // Calculate averages
      for (const type of Object.keys(byFramework) as MaturityFrameworkType[]) {
        const data = byFramework[type];
        const scoredCount = data.assessments.filter(
          (a) => a.overallLevel !== null
        ).length;
        if (scoredCount > 0) {
          data.avgLevel = Math.round((data.avgLevel / scoredCount) * 10) / 10;
        }
      }

      // Status distribution
      const statusDistribution = {
        draft: assessments.filter((a) => a.status === "DRAFT").length,
        inProgress: assessments.filter((a) => a.status === "IN_PROGRESS").length,
        inReview: assessments.filter((a) => a.status === "IN_REVIEW").length,
        completed: assessments.filter((a) => a.status === "COMPLETED").length,
      };

      // Recent assessments (last 5)
      const recentAssessments = assessments.slice(0, 5).map((a) => ({
        id: a.id,
        name: a.name,
        identifier: a.identifier,
        frameworkType: a.framework.type,
        frameworkName: a.framework.name,
        status: a.status,
        overallLevel: a.overallLevel,
        targetLevel: a.targetLevel,
        updatedAt: a.updatedAt,
        owner: a.owner,
      }));

      // Calculate overall org maturity (average across all assessments)
      const scoredAssessments = assessments.filter(
        (a) => a.overallLevel !== null
      );
      const overallOrgLevel =
        scoredAssessments.length > 0
          ? Math.round(
              (scoredAssessments.reduce((sum, a) => sum + (a.overallLevel ?? 0), 0) /
                scoredAssessments.length) *
                10
            ) / 10
          : null;

      return {
        totalAssessments: assessments.length,
        overallOrgLevel,
        byFramework,
        statusDistribution,
        recentAssessments,
      };
    }),

  /**
   * Get domain scores for radar chart
   * Returns domain-level scores for a specific assessment or latest by framework
   */
  getDomainScoresForChart: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(
      z.object({
        assessmentId: z.string().optional(),
        frameworkType: z.nativeEnum(MaturityFrameworkType).optional(),
        businessUnitId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      let assessmentId = input.assessmentId;

      // If no assessmentId provided, get the latest assessment for the framework type
      // Include all non-archived statuses to show any available data
      if (!assessmentId && input.frameworkType) {
        const latestAssessment = await db.maturityAssessment.findFirst({
          where: {
            organizationId,
            framework: { type: input.frameworkType },
            status: {
              in: [
                MaturityAssessmentStatus.COMPLETED,
                MaturityAssessmentStatus.IN_PROGRESS,
                MaturityAssessmentStatus.IN_REVIEW,
                MaturityAssessmentStatus.DRAFT,
              ]
            },
            ...(input.businessUnitId && { businessUnitId: input.businessUnitId }),
          },
          orderBy: { updatedAt: "desc" },
        });
        assessmentId = latestAssessment?.id;
      }

      if (!assessmentId) {
        return { domains: [], maxLevel: 4 };
      }

      // Get assessment with domain scores
      const assessment = await db.maturityAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        include: {
          framework: true,
          domainScores: {
            include: { domain: true },
            where: {
              domain: {
                level: "FUNCTION", // Only get top-level domains for radar chart
              },
            },
          },
        },
      });

      if (!assessment) {
        return { domains: [], maxLevel: 4 };
      }

      const domains = assessment.domainScores
        .filter((ds) => ds.domain.level === "FUNCTION")
        .sort((a, b) => a.domain.sortOrder - b.domain.sortOrder)
        .map((ds) => ({
          code: ds.domain.code,
          name: ds.domain.name,
          currentLevel: ds.currentLevel ?? 0,
          targetLevel: ds.targetLevel ?? assessment.targetLevel ?? assessment.framework.maxLevel,
        }));

      return {
        domains,
        maxLevel: assessment.framework.maxLevel,
        frameworkType: assessment.framework.type,
        assessmentName: assessment.name,
      };
    }),

  /**
   * Get maturity trend data from snapshots
   * Returns historical maturity levels for trend visualization
   */
  getMaturityTrend: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(
      z.object({
        assessmentId: z.string().optional(),
        frameworkType: z.nativeEnum(MaturityFrameworkType).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      let assessmentIds: string[] = [];

      if (input.assessmentId) {
        assessmentIds = [input.assessmentId];
      } else if (input.frameworkType) {
        // Get all assessments for this framework type
        const assessments = await db.maturityAssessment.findMany({
          where: {
            organizationId,
            framework: { type: input.frameworkType },
          },
          select: { id: true },
        });
        assessmentIds = assessments.map((a) => a.id);
      } else {
        // Get all assessments
        const assessments = await db.maturityAssessment.findMany({
          where: { organizationId },
          select: { id: true },
        });
        assessmentIds = assessments.map((a) => a.id);
      }

      if (assessmentIds.length === 0) {
        return { trend: [] };
      }

      // Get snapshots
      const snapshots = await db.maturitySnapshot.findMany({
        where: {
          assessmentId: { in: assessmentIds },
        },
        include: {
          assessment: {
            include: { framework: true },
          },
        },
        orderBy: { snapshotDate: "asc" },
        take: input.limit,
      });

      const trend = snapshots.map((s) => ({
        date: s.snapshotDate.toISOString(),
        level: s.overallLevel,
        score: Number(s.overallScore),
        assessmentName: s.assessment.name,
        frameworkType: s.assessment.framework.type,
      }));

      return { trend };
    }),

  /**
   * Get framework comparison data
   * Returns current maturity levels across all frameworks for comparison
   */
  getFrameworkComparison: organizationProcedure
    .use(requireRole(MATURITY_VIEW_ROLES))
    .input(z.object({ businessUnitId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Get latest completed/in-progress assessment for each framework type
      const frameworks: MaturityFrameworkType[] = ["NIST_CSF_2", "C2M2", "OWASP_SAMM"];
      const comparison: {
        frameworkType: MaturityFrameworkType;
        frameworkName: string;
        currentLevel: number | null;
        targetLevel: number | null;
        maxLevel: number;
        assessmentCount: number;
        latestAssessment: {
          id: string;
          name: string;
          status: MaturityAssessmentStatus;
          updatedAt: Date;
        } | null;
      }[] = [];

      for (const type of frameworks) {
        const assessments = await db.maturityAssessment.findMany({
          where: {
            organizationId,
            framework: { type },
            status: { not: MaturityAssessmentStatus.ARCHIVED },
            ...(input?.businessUnitId && { businessUnitId: input.businessUnitId }),
          },
          include: { framework: true },
          orderBy: { updatedAt: "desc" },
        });

        const latestWithScore = assessments.find((a) => a.overallLevel !== null);
        const latest = assessments[0] ?? null;

        comparison.push({
          frameworkType: type,
          frameworkName: latest?.framework.name ?? type.replace("_", " "),
          currentLevel: latestWithScore?.overallLevel ?? null,
          targetLevel: latestWithScore?.targetLevel ?? null,
          maxLevel: latest?.framework.maxLevel ?? 4,
          assessmentCount: assessments.length,
          latestAssessment: latest
            ? {
                id: latest.id,
                name: latest.name,
                status: latest.status,
                updatedAt: latest.updatedAt,
              }
            : null,
        });
      }

      return { comparison };
    }),
});
