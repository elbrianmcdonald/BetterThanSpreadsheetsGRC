/**
 * Business Impact Statement Generator Service
 *
 * Generates business impact statements for risks that translate technical findings
 * into business language for stakeholders.
 *
 * Story 4.8: Automated Business Impact Statement Generation
 * - AC1: Auto-generate impact statement when risk created or updated
 * - AC2: Three sections: Regulatory Impact, Operational Impact, Business Context
 * - AC28-AC32: Service implementation requirements
 *
 * @see Story 4.8: Automated Business Impact Statement Generation
 */

import type { PrismaClient, Severity, AssetCriticality, RiskTemplateCategory } from "@prisma/client";

/**
 * Framework info for regulatory impact generation
 */
interface FrameworkInfo {
  code: string;
  name: string;
}

/**
 * Options for generating business impact statement
 */
export interface GenerateBusinessImpactOptions {
  riskId: string;
  severity: Severity;
  assetCriticality: AssetCriticality;
  templateCategory?: RiskTemplateCategory | null;
}

/**
 * Result of business impact generation
 */
export interface BusinessImpactResult {
  statement: string;
  wordCount: number;
  sections: {
    regulatory: string;
    operational: string;
    businessContext: string;
  };
}

// ============================================
// Task 3: Regulatory Impact Rules (AC8-AC12)
// ============================================

/**
 * Framework-specific regulatory impact templates
 * @see AC8-AC11
 */
const REGULATORY_IMPACT_TEMPLATES: Record<string, string> = {
  // AC8: ISO 27001
  "ISO 27001": `This finding affects **ISO 27001 certification** requirements. Unresolved control gaps may result in certification suspension, audit findings, or failure to achieve initial certification. Organizations relying on ISO 27001 for customer assurance or contractual requirements face significant business risk from non-compliance.`,

  "ISO-27001": `This finding affects **ISO 27001 certification** requirements. Unresolved control gaps may result in certification suspension, audit findings, or failure to achieve initial certification. Organizations relying on ISO 27001 for customer assurance or contractual requirements face significant business risk from non-compliance.`,

  // AC9: SOC 2
  "SOC 2": `This control deficiency impacts **SOC 2 compliance**, which is increasingly required for enterprise customer contracts. SOC 2 report qualifications or exceptions may block sales opportunities with security-conscious customers and create competitive disadvantage. Enterprise prospects typically require clean SOC 2 Type II reports before contract signing.`,

  "SOC-2": `This control deficiency impacts **SOC 2 compliance**, which is increasingly required for enterprise customer contracts. SOC 2 report qualifications or exceptions may block sales opportunities with security-conscious customers and create competitive disadvantage. Enterprise prospects typically require clean SOC 2 Type II reports before contract signing.`,

  // AC10: GDPR
  "GDPR": `This finding has potential **GDPR implications** for data protection. GDPR violations carry fines up to **€20M or 4% of annual global revenue**, whichever is higher, plus mandatory breach notification requirements within 72 hours. Beyond financial penalties, GDPR violations can result in reputational damage and loss of customer trust in EU markets.`,

  // AC11: HIPAA
  "HIPAA": `This control gap has implications for **HIPAA compliance** regarding protected health information (PHI). HIPAA violations carry civil penalties up to **$50,000 per record** exposed, with potential criminal charges for willful neglect. Healthcare organizations must remediate promptly to avoid enforcement actions from HHS Office for Civil Rights.`,

  // NIST CSF
  "NIST CSF": `This finding relates to controls covered by the **NIST Cybersecurity Framework**. While NIST CSF is voluntary, many federal contractors and regulated industries use it as a baseline. Non-alignment may impact government contract eligibility and insurance underwriting assessments.`,

  "NIST-CSF": `This finding relates to controls covered by the **NIST Cybersecurity Framework**. While NIST CSF is voluntary, many federal contractors and regulated industries use it as a baseline. Non-alignment may impact government contract eligibility and insurance underwriting assessments.`,

  // PCI DSS
  "PCI DSS": `This finding affects **PCI DSS compliance** for payment card processing. Non-compliance may result in fines up to **$500,000 per incident**, increased transaction fees, or loss of payment processing privileges. Merchants must demonstrate compliance through quarterly scans and annual assessments.`,

  "PCI-DSS": `This finding affects **PCI DSS compliance** for payment card processing. Non-compliance may result in fines up to **$500,000 per incident**, increased transaction fees, or loss of payment processing privileges. Merchants must demonstrate compliance through quarterly scans and annual assessments.`,
};

/**
 * Generate regulatory impact section based on affected frameworks
 * @see AC8-AC12
 */
export function generateRegulatoryImpact(frameworks: FrameworkInfo[]): string {
  // AC12: No frameworks affected
  if (frameworks.length === 0) {
    return `No direct regulatory compliance impact has been identified for this finding based on current evidence mappings. However, this does not eliminate security risk—organizations should still evaluate remediation priority based on operational impact and security best practices.`;
  }

  const impacts: string[] = [];
  const processedFrameworks = new Set<string>();

  for (const fw of frameworks) {
    // Normalize framework name for lookup
    const normalizedName = fw.name.trim();
    const normalizedCode = fw.code.trim();

    // Check for template match by name or code
    let template = REGULATORY_IMPACT_TEMPLATES[normalizedName];
    if (!template) {
      template = REGULATORY_IMPACT_TEMPLATES[normalizedCode];
    }

    // Skip if we already processed this framework type
    const key = normalizedName || normalizedCode;
    if (processedFrameworks.has(key)) continue;
    processedFrameworks.add(key);

    if (template) {
      impacts.push(template);
    } else {
      // Generic framework impact
      impacts.push(
        `This finding affects compliance with **${normalizedName || normalizedCode}** requirements. Organizations should evaluate the specific control requirements and potential consequences of non-compliance for their regulatory context.`
      );
    }
  }

  return impacts.join("\n\n");
}

// ============================================
// Task 4: Operational Impact Rules (AC13-AC17)
// ============================================

/**
 * Severity + Criticality impact matrix
 * @see AC13-AC16
 */
const OPERATIONAL_IMPACT_MATRIX: Record<string, string> = {
  // AC13: HIGH severity + CRITICAL asset
  "HIGH-CRITICAL": `**Critical risk of complete service outage** affecting all users and revenue-generating systems. This combination represents the highest operational risk category with potential for extended downtime, significant data loss, and widespread customer impact. Immediate remediation is essential to prevent business-critical failures.`,

  "HIGH-HIGH": `**Significant risk of service degradation** affecting key business functions and customer experience. This finding could result in partial outages, performance degradation, or data integrity issues impacting a substantial portion of users or critical business processes.`,

  // AC14: HIGH severity + HIGH asset
  "HIGH-MEDIUM": `**Elevated risk of service disruption** with potential impact to important business operations. While not affecting the most critical systems, this finding could cause noticeable service issues and should be prioritized for remediation.`,

  "HIGH-LOW": `**Moderate operational risk** affecting supporting systems. Although the affected assets have lower criticality, the high severity warrants attention to prevent escalation or use as an attack vector to more critical systems.`,

  "HIGH-NONE": `**Limited immediate operational impact** due to low asset criticality, but the high severity indicates potential security concerns that could affect other systems if exploited.`,

  // AC15: MEDIUM severity + combinations
  "MEDIUM-CRITICAL": `**Moderate risk to critical business systems** that requires prompt attention. While the severity is not at the highest level, the critical nature of affected assets means any disruption could have significant business consequences.`,

  "MEDIUM-HIGH": `**Moderate risk of data exposure or service disruption** impacting important business operations. This finding could lead to temporary service issues or limited data exposure affecting a subset of users or business functions.`,

  // AC15: MEDIUM severity + MEDIUM asset
  "MEDIUM-MEDIUM": `**Moderate risk of data exposure or service disruption** impacting standard operations. This combination represents a balanced risk that should be addressed within normal remediation timelines while monitoring for any changes in threat landscape.`,

  "MEDIUM-LOW": `**Low to moderate operational impact** affecting non-critical systems. Standard remediation timelines apply, with focus on preventing the issue from affecting higher-value assets.`,

  "MEDIUM-NONE": `**Minimal operational impact** expected. This finding primarily represents a best-practice deviation with low immediate risk to operations.`,

  // AC16: LOW severity + combinations
  "LOW-CRITICAL": `**Low severity finding affecting critical assets** - while the technical severity is low, the critical nature of affected systems warrants careful evaluation and timely remediation to maintain security posture.`,

  "LOW-HIGH": `**Limited operational impact** on important systems. This finding should be addressed during regular maintenance cycles to prevent accumulation of security debt.`,

  "LOW-MEDIUM": `**Limited operational impact** affecting standard business systems. Remediation can be scheduled during normal security maintenance windows.`,

  // AC16: LOW severity + LOW asset
  "LOW-LOW": `**Limited operational impact** affecting non-critical systems with minimal user impact. This finding is primarily a process or documentation issue with low likelihood of causing service disruption. Remediation can be prioritized alongside other low-risk items.`,

  "LOW-NONE": `**Minimal operational impact** expected. This is a minor finding that can be addressed opportunistically during other maintenance activities.`,
};

/**
 * Asset-specific impact context
 * @see AC17
 */
const ASSET_CONTEXT_TEMPLATES: Record<string, string> = {
  database: `Database systems are particularly sensitive—breaches can result in data loss, integrity issues, and regulatory notification requirements.`,
  api: `API vulnerabilities can lead to service unavailability, data exposure, and potential exploitation across integrated systems.`,
  network: `Network security issues can enable lateral movement, man-in-the-middle attacks, and broader infrastructure compromise.`,
  application: `Application vulnerabilities are often the initial entry point for attackers and can cascade into broader system compromise.`,
  storage: `Storage system issues can result in data loss, unauthorized access to sensitive files, and backup integrity problems.`,
  identity: `Identity and access management gaps can enable privilege escalation and unauthorized access across the organization.`,
};

/**
 * Generate operational impact section based on severity and criticality
 * @see AC13-AC17
 */
export function generateOperationalImpact(
  severity: Severity,
  criticality: AssetCriticality,
  affectedSystems?: string | null
): string {
  const key = `${severity}-${criticality}`;
  let impact = OPERATIONAL_IMPACT_MATRIX[key];

  if (!impact) {
    impact = `Operational impact varies based on affected systems and remediation timeline. Organizations should evaluate the specific context of this finding within their operational environment.`;
  }

  // AC17: Add asset-specific context if affected systems are specified
  if (affectedSystems) {
    const lowercaseSystems = affectedSystems.toLowerCase();
    const assetContexts: string[] = [];

    for (const [assetType, context] of Object.entries(ASSET_CONTEXT_TEMPLATES)) {
      if (lowercaseSystems.includes(assetType)) {
        assetContexts.push(context);
      }
    }

    if (assetContexts.length > 0) {
      impact += "\n\n" + assetContexts.join(" ");
    }
  }

  return impact;
}

// ============================================
// Task 5: Business Context Templates (AC18-AC22)
// ============================================

/**
 * Risk category business context templates
 * @see AC18-AC22
 */
const BUSINESS_CONTEXT_TEMPLATES: Record<RiskTemplateCategory, string> = {
  // AC18: Cloud Infrastructure
  CLOUD_INFRASTRUCTURE: `Cloud misconfigurations are the **leading cause of data breaches** according to Verizon DBIR reports, with over 80% of breaches involving cloud-based assets. The shared responsibility model means organizations must actively secure their cloud deployments. Rapid remediation is critical given the ease with which attackers can discover and exploit cloud misconfigurations using automated scanning tools.`,

  // AC19: Access Control
  ACCESS_CONTROL: `Privileged access abuse and compromised credentials account for **74% of security breaches** according to IBM Security research. Implementing least-privilege access and multi-factor authentication significantly reduces breach risk. Organizations should treat access control findings as high priority given their role as the primary attack vector for both external threats and insider risk.`,

  // AC20: Data Security
  DATA_SECURITY: `The average cost of a data breach is **$4.45M globally** according to IBM Cost of Data Breach Report, with reputation damage and customer trust loss persisting for years beyond the incident. Data security investments provide direct ROI through breach prevention, and regulatory requirements increasingly mandate strong data protection controls.`,

  // AC21: Network Security
  NETWORK_SECURITY: `Network perimeter breaches enable attackers to **move laterally** within environments and deploy ransomware. The average ransomware payment exceeded $1.5M in 2023, with total costs including downtime often reaching 10x the ransom amount. Network segmentation and monitoring are essential to detect and contain intrusions before they escalate.`,

  // AC22: Application Security
  APPLICATION_SECURITY: `Application vulnerabilities represent the **#1 attack vector** according to OWASP Top 10, with injection flaws and broken access control leading to data exposure and account takeover. Modern applications require security throughout the development lifecycle, not just at deployment. Vulnerable applications can serve as entry points to backend systems and data.`,
};

/**
 * Default business context when no category is specified
 */
const DEFAULT_BUSINESS_CONTEXT = `Timely remediation of security findings reduces organizational risk exposure and demonstrates security maturity to customers, auditors, and regulators. Unaddressed security issues accumulate as "security debt" with compounding risk over time. Organizations that prioritize security investments typically experience fewer incidents and faster recovery when incidents do occur.`;

/**
 * Generate business context section based on risk category
 * @see AC18-AC22
 */
export function generateBusinessContext(
  category: RiskTemplateCategory | null | undefined
): string {
  if (!category) {
    return DEFAULT_BUSINESS_CONTEXT;
  }

  return BUSINESS_CONTEXT_TEMPLATES[category] || DEFAULT_BUSINESS_CONTEXT;
}

// ============================================
// Task 2: Main Service Function (AC28-AC32)
// ============================================

/**
 * Get frameworks affected by a risk through linked evidence
 */
async function getFrameworksAffected(
  riskId: string,
  db: PrismaClient
): Promise<FrameworkInfo[]> {
  // Get all evidence linked to this risk
  const linkedEvidence = await db.riskEvidence.findMany({
    where: { riskId },
    select: {
      Evidence: {
        select: {
          EvidenceControlDomain: {
            select: {
              ControlDomain: {
                select: {
                  ControlDomainMapping: {
                    select: {
                      frameworkCode: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Collect unique framework codes
  const frameworkCodes = new Set<string>();
  linkedEvidence.forEach((re) => {
    re.Evidence.EvidenceControlDomain.forEach((ecd) => {
      ecd.ControlDomain.ControlDomainMapping.forEach((cdm) => {
        frameworkCodes.add(cdm.frameworkCode);
      });
    });
  });

  // Get framework names for display
  if (frameworkCodes.size === 0) {
    return [];
  }

  const frameworks = await db.framework.findMany({
    where: {
      code: { in: Array.from(frameworkCodes) },
    },
    select: { code: true, name: true },
    distinct: ["code"],
  });

  return frameworks;
}

/**
 * Count words in a string
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Generate complete business impact statement
 *
 * @see AC28: Accepts risk with related data
 * @see AC29: Queries frameworks affected, severity, criticality, template category
 * @see AC30: Applies template-based rules to generate each section
 * @see AC31: Returns formatted impact statement (markdown)
 * @see AC32: Idempotent (same inputs → same output)
 */
export async function generateBusinessImpact(
  options: GenerateBusinessImpactOptions,
  db: PrismaClient,
  affectedSystems?: string | null
): Promise<BusinessImpactResult> {
  const { riskId, severity, assetCriticality, templateCategory } = options;

  // AC29: Query frameworks affected
  const frameworks = await getFrameworksAffected(riskId, db);

  // Generate sections (AC2, AC30)
  const regulatorySection = generateRegulatoryImpact(frameworks);
  const operationalSection = generateOperationalImpact(
    severity,
    assetCriticality,
    affectedSystems
  );
  const businessContextSection = generateBusinessContext(templateCategory);

  // AC31: Combine into formatted markdown
  const sections = {
    regulatory: regulatorySection,
    operational: operationalSection,
    businessContext: businessContextSection,
  };

  // AC7: Build statement with 200-500 word length
  const statement = `## Regulatory Impact

${regulatorySection}

## Operational Impact

${operationalSection}

## Business Context

${businessContextSection}`;

  const wordCount = countWords(statement);

  return {
    statement,
    wordCount,
    sections,
  };
}

/**
 * Generate and save business impact statement for a risk
 *
 * This function generates the impact statement and updates the risk record.
 * It respects the impactStatementManuallyEdited flag (AC33-AC36).
 *
 * @see AC1: Generated when risk created or updated
 * @see AC6: Stored in Risk.businessImpactStatement field
 */
export async function generateAndSaveBusinessImpact(
  riskId: string,
  db: PrismaClient
): Promise<BusinessImpactResult | null> {
  // Fetch risk with required fields
  const risk = await db.risk.findUnique({
    where: { id: riskId },
    select: {
      id: true,
      severity: true,
      assetCriticality: true,
      affectedSystems: true,
      impactStatementManuallyEdited: true,
      Template: {
        select: {
          category: true,
        },
      },
    },
  });

  if (!risk) {
    throw new Error(`Risk not found: ${riskId}`);
  }

  // AC36: Skip regeneration if manually edited
  if (risk.impactStatementManuallyEdited) {
    return null;
  }

  // Generate impact statement
  const result = await generateBusinessImpact(
    {
      riskId: risk.id,
      severity: risk.severity,
      assetCriticality: risk.assetCriticality,
      templateCategory: risk.Template?.category || null,
    },
    db,
    risk.affectedSystems
  );

  // AC6: Save to businessImpactStatement field
  await db.risk.update({
    where: { id: riskId },
    data: {
      businessImpactStatement: result.statement,
      impactStatementGeneratedAt: new Date(),
    },
  });

  return result;
}
