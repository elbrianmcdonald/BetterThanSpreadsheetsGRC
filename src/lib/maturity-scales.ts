/**
 * Scoring scales for maturity assessments.
 *
 * NIST CSF 2.0 offers the user a choice between two scales at creation:
 *   - NIST Implementation Tiers (0=None, 1=Partial, 2=Risk Informed,
 *     3=Repeatable, 4=Adaptive)
 *   - CMMI Maturity Levels (1=Initial, 2=Managed, 3=Defined,
 *     4=Quantitatively Managed, 5=Optimizing)
 *
 * "Not Applicable" is represented outside the numeric scale via the
 * isNotApplicable flag on MaturityDomainScore — not a level value.
 */

import { MaturityScoringScale } from "@prisma/client";

export interface MaturityLevelOption {
  value: number;
  label: string;
  description: string;
}

export interface ScaleDefinition {
  scale: MaturityScoringScale;
  displayName: string;
  minLevel: number;
  maxLevel: number;
  levels: MaturityLevelOption[];
}

export const NIST_TIERS_SCALE: ScaleDefinition = {
  scale: MaturityScoringScale.NIST_TIERS,
  displayName: "NIST Implementation Tiers",
  minLevel: 0,
  maxLevel: 4,
  levels: [
    {
      value: 0,
      label: "None",
      description: "Not yet implemented.",
    },
    {
      value: 1,
      label: "Partial",
      description:
        "Risk management practices are ad hoc and reactive; limited organizational awareness.",
    },
    {
      value: 2,
      label: "Risk Informed",
      description:
        "Management-approved risk practices, informed by business objectives; not yet organization-wide policy.",
    },
    {
      value: 3,
      label: "Repeatable",
      description:
        "Formal organization-wide policy, regular updates based on risk assessments, active external collaboration.",
    },
    {
      value: 4,
      label: "Adaptive",
      description:
        "Continuous improvement, proactive adaptation to threats, active information sharing.",
    },
  ],
};

export const CMMI_MATURITY_SCALE: ScaleDefinition = {
  scale: MaturityScoringScale.CMMI_MATURITY,
  displayName: "CMMI Maturity Levels",
  minLevel: 1,
  maxLevel: 5,
  levels: [
    {
      value: 1,
      label: "Initial",
      description:
        "Processes are unpredictable, poorly controlled, and reactive.",
    },
    {
      value: 2,
      label: "Managed",
      description:
        "Processes are characterized for projects and are often reactive.",
    },
    {
      value: 3,
      label: "Defined",
      description:
        "Processes are characterized for the organization and are proactive.",
    },
    {
      value: 4,
      label: "Quantitatively Managed",
      description: "Processes are measured and controlled.",
    },
    {
      value: 5,
      label: "Optimizing",
      description: "Focus is on continuous process improvement.",
    },
  ],
};

export const NOT_APPLICABLE_LABEL = "Not Applicable";

/** Look up a scale by enum value. */
export function getScaleDefinition(
  scale: MaturityScoringScale | null | undefined
): ScaleDefinition | null {
  if (!scale) return null;
  return scale === MaturityScoringScale.NIST_TIERS
    ? NIST_TIERS_SCALE
    : CMMI_MATURITY_SCALE;
}

/** Label for a given level value within a scale (falls back to the raw int). */
export function labelForLevel(
  scale: MaturityScoringScale | null | undefined,
  level: number | null | undefined
): string {
  if (level === null || level === undefined) return "—";
  const def = getScaleDefinition(scale);
  return def?.levels.find((l) => l.value === level)?.label ?? `Level ${level}`;
}

export const ALL_SCALES: ScaleDefinition[] = [
  NIST_TIERS_SCALE,
  CMMI_MATURITY_SCALE,
];
