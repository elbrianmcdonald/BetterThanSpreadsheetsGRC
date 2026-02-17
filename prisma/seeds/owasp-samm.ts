/**
 * OWASP SAMM (Software Assurance Maturity Model) v2.1 Seed Data
 *
 * This seed creates the OWASP SAMM v2.1 framework template with:
 * - 5 Business Functions: Governance, Design, Implementation, Verification, Operations
 * - 15 Security Practices (3 per function)
 * - 30 Activity Streams (2 per practice, A and B)
 * - 90 Assessment Questions (3 per stream, one per maturity level)
 * - 24 Answer Set templates with weighted 4-option scales
 *
 * Scoring model (per OWASP official guidance):
 *   Question weight    = answer weight (0, 0.25, 0.5, 1.0)
 *   Stream score       = SUM(3 question weights)          → range 0-3
 *   Practice score     = AVG(Stream A, Stream B)           → range 0-3
 *   Function score     = AVG(3 practice scores)            → range 0-3
 *   Overall score      = AVG(5 function scores)            → range 0-3
 *
 * @see https://owaspsamm.org/
 * @license CC-BY-SA 4.0
 */

import type { PrismaClient, AssessmentDepth } from "@prisma/client";
import { Prisma } from "@prisma/client";

// OWASP SAMM Maturity Levels (0-3)
export const SAMM_MATURITY_LEVELS = [
  {
    value: 0,
    label: "Level 0",
    description:
      "Implicit starting point representing an unfulfilled practice. Activities in this practice area are not yet being performed or are entirely ad hoc.",
    criteria: [
      "No structured activities performed",
      "No awareness of the practice area",
      "No dedicated resources or processes",
    ],
  },
  {
    value: 1,
    label: "Level 1",
    description:
      "Initial understanding and ad hoc provision of the practice. The organization has an initial understanding of the security practice and performs basic activities, though they may be inconsistent.",
    criteria: [
      "Initial understanding of the practice",
      "Basic activities are performed",
      "Ad hoc or inconsistent application",
      "Some awareness among team members",
    ],
  },
  {
    value: 2,
    label: "Level 2",
    description:
      "Increased efficiency and effectiveness of the practice. The organization has established processes and performs activities in a structured way with increased consistency.",
    criteria: [
      "Structured processes are established",
      "Activities are performed consistently",
      "Increased efficiency and effectiveness",
      "Practices are documented and repeatable",
      "Stakeholders are identified and engaged",
    ],
  },
  {
    value: 3,
    label: "Level 3",
    description:
      "Comprehensive mastery of the practice at scale. The organization demonstrates comprehensive mastery with continuous improvement, full organizational coverage, and proactive optimization.",
    criteria: [
      "Comprehensive mastery at scale",
      "Continuous improvement processes",
      "Full organizational coverage",
      "Proactive optimization and measurement",
      "Regular review and adaptation",
    ],
  },
];

// ============================================================================
// ANSWER SETS
// All 24 answer sets share identical weights: No=0, Partial=0.25, Half=0.5, Full=1.0
// The labels differ per set to provide context-specific language.
// ============================================================================

interface AnswerOption {
  value: number;
  label: string;
  weight: number;
}

const ANSWER_SETS: Record<number, AnswerOption[]> = {
  0: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some applications", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the applications", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the applications", weight: 1 },
  ],
  1: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, some of them", weight: 0.25 },
    { value: 2, label: "Yes, at least half of them", weight: 0.5 },
    { value: 3, label: "Yes, most or all of them", weight: 1 },
  ],
  2: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, some content", weight: 0.25 },
    { value: 2, label: "Yes, at least half of the content", weight: 0.5 },
    { value: 3, label: "Yes, most or all of the content", weight: 1 },
  ],
  3: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some of the training", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the training", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the training", weight: 1 },
  ],
  4: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, some of the time", weight: 0.25 },
    { value: 2, label: "Yes, at least half of the time", weight: 0.5 },
    { value: 3, label: "Yes, most or all of the time", weight: 1 },
  ],
  5: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, we started implementing it", weight: 0.25 },
    { value: 2, label: "Yes, for part of the organization", weight: 0.5 },
    { value: 3, label: "Yes, for the entire organization", weight: 1 },
  ],
  6: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some components", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the components", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the components", weight: 1 },
  ],
  7: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some incidents", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the incidents", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the incidents", weight: 1 },
  ],
  8: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some incident types", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the incident types", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the incident types", weight: 1 },
  ],
  9: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some of our data", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of our data", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of our data", weight: 1 },
  ],
  10: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, we do it when requested", weight: 0.25 },
    { value: 2, label: "Yes, we do it every few years", weight: 0.5 },
    { value: 3, label: "Yes, we do it at least annually", weight: 1 },
  ],
  11: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some of the assets", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the assets", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the assets", weight: 1 },
  ],
  12: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some of the technology domains", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the technology domains", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the technology domains", weight: 1 },
  ],
  13: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, it covers general risks", weight: 0.25 },
    { value: 2, label: "Yes, it covers organization-specific risks", weight: 0.5 },
    { value: 3, label: "Yes, it covers risks and opportunities", weight: 1 },
  ],
  14: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, we review it annually", weight: 0.25 },
    { value: 2, label: "Yes, we consult the plan before making significant decisions", weight: 0.5 },
    { value: 3, label: "Yes, we consult the plan often, and it is aligned with our application security strategy", weight: 1 },
  ],
  15: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, but review is ad-hoc", weight: 0.25 },
    { value: 2, label: "Yes, we review it at regular times", weight: 0.5 },
    { value: 3, label: "Yes, we review it at least annually", weight: 1 },
  ],
  16: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for one metrics category", weight: 0.25 },
    { value: 2, label: "Yes, for two metrics categories", weight: 0.5 },
    { value: 3, label: "Yes, for all three metrics categories", weight: 1 },
  ],
  17: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, sporadically", weight: 0.25 },
    { value: 2, label: "Yes, upon change of the application", weight: 0.5 },
    { value: 3, label: "Yes, at least annually", weight: 1 },
  ],
  18: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some of the metrics", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the metrics", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the metrics", weight: 1 },
  ],
  19: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, but reporting is ad-hoc", weight: 0.25 },
    { value: 2, label: "Yes, we report at regular times", weight: 0.5 },
    { value: 3, label: "Yes, we report at least annually", weight: 1 },
  ],
  20: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some obligations", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the obligations", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the obligations", weight: 1 },
  ],
  21: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, for some teams", weight: 0.25 },
    { value: 2, label: "Yes, for at least half of the teams", weight: 0.5 },
    { value: 3, label: "Yes, for most or all of the teams", weight: 1 },
  ],
  22: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, some of it", weight: 0.25 },
    { value: 2, label: "Yes, at least half of it", weight: 0.5 },
    { value: 3, label: "Yes, most or all of it", weight: 1 },
  ],
  23: [
    { value: 0, label: "No", weight: 0 },
    { value: 1, label: "Yes, but we improve it ad-hoc", weight: 0.25 },
    { value: 2, label: "Yes, we improve it at regular times", weight: 0.5 },
    { value: 3, label: "Yes, we improve it at least annually", weight: 1 },
  ],
};

// ============================================================================
// BUSINESS FUNCTIONS (Level 1 - FUNCTION)
// ============================================================================

export const SAMM_BUSINESS_FUNCTIONS = [
  {
    code: "G",
    name: "Governance",
    description:
      "The Governance business function covers the strategic and organizational aspects of software security, including policies, metrics, education, and compliance management. It establishes the foundation for a security program that supports the other business functions.",
    sortOrder: 1,
  },
  {
    code: "D",
    name: "Design",
    description:
      "The Design business function covers security activities performed during the design phase of software development, including threat assessment, security requirements definition, and secure architecture practices.",
    sortOrder: 2,
  },
  {
    code: "I",
    name: "Implementation",
    description:
      "The Implementation business function covers security activities performed during the build and deployment phases, including secure build processes, secure deployment practices, and defect management.",
    sortOrder: 3,
  },
  {
    code: "V",
    name: "Verification",
    description:
      "The Verification business function covers security testing and validation activities, including architecture assessment, requirements-driven testing, and security testing to ensure software meets security objectives.",
    sortOrder: 4,
  },
  {
    code: "O",
    name: "Operations",
    description:
      "The Operations business function covers security activities related to running and maintaining software, including incident management, environment management, and operational management.",
    sortOrder: 5,
  },
];

// ============================================================================
// SECURITY PRACTICES (Level 2 - CATEGORY)
// Each function has exactly 3 practices
// ============================================================================

export const SAMM_SECURITY_PRACTICES = [
  // Governance
  { code: "G-SM", functionCode: "G", name: "Strategy and Metrics", description: "Establish and maintain a strategic plan and metrics for the application security program that aligns with the organization's business strategy and risk appetite.", sortOrder: 1 },
  { code: "G-PC", functionCode: "G", name: "Policy and Compliance", description: "Develop and maintain application security policies and manage compliance with external requirements and internal standards.", sortOrder: 2 },
  { code: "G-EG", functionCode: "G", name: "Education and Guidance", description: "Provide security awareness training and technical guidance to development teams to build organizational security culture and capability.", sortOrder: 3 },

  // Design
  { code: "D-TA", functionCode: "D", name: "Threat Assessment", description: "Identify and evaluate security threats through application risk profiling and threat modeling to inform security decisions during design.", sortOrder: 1 },
  { code: "D-SR", functionCode: "D", name: "Security Requirements", description: "Define and manage security requirements for software development, including supplier security expectations.", sortOrder: 2 },
  { code: "D-SA", functionCode: "D", name: "Secure Architecture", description: "Promote secure design through architecture principles, shared security services, and technology management.", sortOrder: 3 },

  // Implementation
  { code: "I-SB", functionCode: "I", name: "Secure Build", description: "Ensure the build process produces secure artifacts through automated security checks and dependency management.", sortOrder: 1 },
  { code: "I-SD", functionCode: "I", name: "Secure Deployment", description: "Implement secure deployment processes including artifact integrity verification and secret management.", sortOrder: 2 },
  { code: "I-DM", functionCode: "I", name: "Defect Management", description: "Track, manage, and remediate security defects with defined SLAs and feedback loops for continuous improvement.", sortOrder: 3 },

  // Verification
  { code: "V-AA", functionCode: "V", name: "Architecture Assessment", description: "Review application architecture for security objectives, threat mitigations, and control effectiveness.", sortOrder: 1 },
  { code: "V-RT", functionCode: "V", name: "Requirements-driven Testing", description: "Verify security requirements through control verification and abuse case testing.", sortOrder: 2 },
  { code: "V-ST", functionCode: "V", name: "Security Testing", description: "Perform automated and manual security testing including SAST, DAST, and penetration testing.", sortOrder: 3 },

  // Operations
  { code: "O-IM", functionCode: "O", name: "Incident Management", description: "Detect, respond to, and learn from security incidents through established processes and procedures.", sortOrder: 1 },
  { code: "O-EM", functionCode: "O", name: "Environment Management", description: "Maintain secure operational environments through configuration hardening and patch management.", sortOrder: 2 },
  { code: "O-OM", functionCode: "O", name: "Operational Management", description: "Manage operational security including data protection and system lifecycle management.", sortOrder: 3 },
];

// ============================================================================
// ACTIVITY STREAMS (Level 3 - SUBCATEGORY)
// Each practice has exactly 2 streams (A and B)
// ============================================================================

export const SAMM_ACTIVITY_STREAMS = [
  // Governance - Strategy and Metrics
  { code: "G-SM-A", practiceCode: "G-SM", name: "Create and Promote", sortOrder: 1 },
  { code: "G-SM-B", practiceCode: "G-SM", name: "Measure and Improve", sortOrder: 2 },

  // Governance - Policy and Compliance
  { code: "G-PC-A", practiceCode: "G-PC", name: "Policy and Standards", sortOrder: 1 },
  { code: "G-PC-B", practiceCode: "G-PC", name: "Compliance Management", sortOrder: 2 },

  // Governance - Education and Guidance
  { code: "G-EG-A", practiceCode: "G-EG", name: "Training and Awareness", sortOrder: 1 },
  { code: "G-EG-B", practiceCode: "G-EG", name: "Organization and Culture", sortOrder: 2 },

  // Design - Threat Assessment
  { code: "D-TA-A", practiceCode: "D-TA", name: "Application Risk Profile", sortOrder: 1 },
  { code: "D-TA-B", practiceCode: "D-TA", name: "Threat Modeling", sortOrder: 2 },

  // Design - Security Requirements
  { code: "D-SR-A", practiceCode: "D-SR", name: "Software Requirements", sortOrder: 1 },
  { code: "D-SR-B", practiceCode: "D-SR", name: "Supplier Security", sortOrder: 2 },

  // Design - Secure Architecture
  { code: "D-SA-A", practiceCode: "D-SA", name: "Architecture Design", sortOrder: 1 },
  { code: "D-SA-B", practiceCode: "D-SA", name: "Technology Management", sortOrder: 2 },

  // Implementation - Secure Build
  { code: "I-SB-A", practiceCode: "I-SB", name: "Build Process", sortOrder: 1 },
  { code: "I-SB-B", practiceCode: "I-SB", name: "Software Dependencies", sortOrder: 2 },

  // Implementation - Secure Deployment
  { code: "I-SD-A", practiceCode: "I-SD", name: "Deployment Process", sortOrder: 1 },
  { code: "I-SD-B", practiceCode: "I-SD", name: "Secret Management", sortOrder: 2 },

  // Implementation - Defect Management
  { code: "I-DM-A", practiceCode: "I-DM", name: "Defect Tracking", sortOrder: 1 },
  { code: "I-DM-B", practiceCode: "I-DM", name: "Metrics and Feedback", sortOrder: 2 },

  // Verification - Architecture Assessment
  { code: "V-AA-A", practiceCode: "V-AA", name: "Architecture Validation", sortOrder: 1 },
  { code: "V-AA-B", practiceCode: "V-AA", name: "Architecture Mitigation", sortOrder: 2 },

  // Verification - Requirements-driven Testing
  { code: "V-RT-A", practiceCode: "V-RT", name: "Control Verification", sortOrder: 1 },
  { code: "V-RT-B", practiceCode: "V-RT", name: "Misuse/Abuse Testing", sortOrder: 2 },

  // Verification - Security Testing
  { code: "V-ST-A", practiceCode: "V-ST", name: "Scalable Baseline", sortOrder: 1 },
  { code: "V-ST-B", practiceCode: "V-ST", name: "Deep Understanding", sortOrder: 2 },

  // Operations - Incident Management
  { code: "O-IM-A", practiceCode: "O-IM", name: "Incident Detection", sortOrder: 1 },
  { code: "O-IM-B", practiceCode: "O-IM", name: "Incident Response", sortOrder: 2 },

  // Operations - Environment Management
  { code: "O-EM-A", practiceCode: "O-EM", name: "Configuration Hardening", sortOrder: 1 },
  { code: "O-EM-B", practiceCode: "O-EM", name: "Patching and Updating", sortOrder: 2 },

  // Operations - Operational Management
  { code: "O-OM-A", practiceCode: "O-OM", name: "Data Protection", sortOrder: 1 },
  { code: "O-OM-B", practiceCode: "O-OM", name: "System Decommissioning / Legacy Management", sortOrder: 2 },
];

// ============================================================================
// ASSESSMENT QUESTIONS (90 total - one per stream per maturity level)
// Each question has a specific answer set with context-appropriate labels
// ============================================================================

interface SammQuestion {
  code: string;       // SAMM question ID, e.g. "G-SM-A-1-1"
  streamCode: string; // Parent stream, e.g. "G-SM-A"
  level: number;      // Maturity level: 1, 2, or 3
  question: string;   // Interview question text
  guidance: string;   // Quality criteria / guidance
  answerSet: number;  // Answer set code (0-23)
}

export const SAMM_QUESTIONS: SammQuestion[] = [
  // ======================================================================
  // GOVERNANCE - Strategy and Metrics
  // ======================================================================
  // Stream A: Create and Promote
  { code: "G-SM-A-1-1", streamCode: "G-SM-A", level: 1, answerSet: 13,
    question: "Do you understand the enterprise-wide risk appetite for your applications?",
    guidance: "You capture the risk appetite of your organization's executive leadership\n You have a current and shared understanding of the functional and technical threats to the organization\n Risk appetite considers operational efficiency and cost" },
  { code: "G-SM-A-2-1", streamCode: "G-SM-A", level: 2, answerSet: 14,
    question: "Do you have a strategic plan for application security and use it to make decisions?",
    guidance: "You have a plan to improve application security and it is regularly updated\n The plan includes a clearly defined metrics program\n The plan is aligned with the organization's business strategy and risk appetite\n The plan is shared with relevant stakeholders" },
  { code: "G-SM-A-3-1", streamCode: "G-SM-A", level: 3, answerSet: 15,
    question: "Do you regularly review and update the Strategic Plan for Application Security?",
    guidance: "You review the plan at least yearly or upon significant changes\n The plan is updated based on application security metrics and industry developments\n The plan provides a clear roadmap for improving application security" },

  // Stream B: Measure and Improve
  { code: "G-SM-B-1-1", streamCode: "G-SM-B", level: 1, answerSet: 16,
    question: "Do you use a set of metrics to measure the effectiveness and efficiency of the application security program across applications?",
    guidance: "You document metrics for at least one of the following categories: effort, result, environment\n Metrics are collected and accessible to relevant stakeholders\n Metrics are used to identify quick wins" },
  { code: "G-SM-B-2-1", streamCode: "G-SM-B", level: 2, answerSet: 18,
    question: "Did you define Key Performance Indicators (KPI) from available application security metrics?",
    guidance: "You defined KPIs for the application security program\n KPIs are aligned with organizational objectives\n You measure and report on KPIs at regular intervals\n KPIs include both qualitative and quantitative measures" },
  { code: "G-SM-B-3-1", streamCode: "G-SM-B", level: 3, answerSet: 15,
    question: "Do you update the Application Security strategy and roadmap based on application security metrics and KPIs?",
    guidance: "KPIs and metrics are continuously measured and reported\n Application security strategy and roadmap are updated based on KPI outcomes\n Changes to strategy are communicated to stakeholders" },

  // ======================================================================
  // GOVERNANCE - Policy and Compliance
  // ======================================================================
  // Stream A: Policy and Standards
  { code: "G-PC-A-1-1", streamCode: "G-PC-A", level: 1, answerSet: 0,
    question: "Do you have and apply a common set of policies and standards throughout your organization?",
    guidance: "You have an application security policy addressing development and deployment\n The policies are aligned with existing organizational policies and standards\n The standards are adapted to the organization's technology and processes\n The policies and standards are available to all relevant stakeholders" },
  { code: "G-PC-A-2-1", streamCode: "G-PC-A", level: 2, answerSet: 2,
    question: "Do you publish the organization's policies as test scripts or run-books for easy interpretation by development teams?",
    guidance: "Policies are available as actionable test scripts or run-books\n Development teams can interpret and apply policies directly\n Test scripts are aligned with the current policy versions\n You have a process to update test scripts when policies change" },
  { code: "G-PC-A-3-1", streamCode: "G-PC-A", level: 3, answerSet: 19,
    question: "Do you regularly report on policy and standard compliance, and use that information to guide compliance improvement efforts?",
    guidance: "You measure compliance with policies and standards\n Compliance metrics are regularly reported to management\n Non-compliance triggers improvement actions\n You track the effectiveness of improvement actions" },

  // Stream B: Compliance Management
  { code: "G-PC-B-1-1", streamCode: "G-PC-B", level: 1, answerSet: 0,
    question: "Do you have a complete picture of your external compliance obligations?",
    guidance: "You have a list of all compliance obligations\n The list includes industry regulations, customer requirements, and contractual obligations\n Relevant stakeholders are aware of the compliance obligations\n The list is reviewed and updated regularly" },
  { code: "G-PC-B-2-1", streamCode: "G-PC-B", level: 2, answerSet: 20,
    question: "Do you have a standard set of security requirements and verification procedures addressing the organization's external compliance obligations?",
    guidance: "Security requirements are mapped to compliance obligations\n Verification procedures are defined for each requirement\n You track compliance status against requirements\n Non-compliance is addressed through defined processes" },
  { code: "G-PC-B-3-1", streamCode: "G-PC-B", level: 3, answerSet: 19,
    question: "Do you regularly report on adherence to external compliance obligations and use that information to guide efforts to close compliance gaps?",
    guidance: "Compliance reporting is regular and comprehensive\n Reports identify compliance gaps and trends\n Gaps trigger remediation efforts with clear ownership\n Remediation effectiveness is tracked" },

  // ======================================================================
  // GOVERNANCE - Education and Guidance
  // ======================================================================
  // Stream A: Training and Awareness
  { code: "G-EG-A-1-1", streamCode: "G-EG-A", level: 1, answerSet: 1,
    question: "Do you require employees involved with application development to take SDLC training?",
    guidance: "Training is available for all roles involved in software development\n Training covers basic secure development principles\n Training completion is tracked\n Training content is relevant and current" },
  { code: "G-EG-A-2-1", streamCode: "G-EG-A", level: 2, answerSet: 3,
    question: "Is training customized for individual roles such as developers, testers, or security champions?",
    guidance: "Role-based training is available for key roles\n Training content is customized to role-specific needs\n Training is updated based on emerging threats and technologies\n Feedback mechanisms improve training quality" },
  { code: "G-EG-A-3-1", streamCode: "G-EG-A", level: 3, answerSet: 3,
    question: "Have you implemented a Learning Management System or equivalent to track employee training and certification in the secure development lifecycle?",
    guidance: "A Learning Management System tracks all security training\n Certification programs validate competency\n Training effectiveness is measured\n Continuous learning paths are available" },

  // Stream B: Organization and Culture
  { code: "G-EG-B-1-1", streamCode: "G-EG-B", level: 1, answerSet: 21,
    question: "Have you identified a Security Champion for each development team?",
    guidance: "Security Champions are identified for development teams\n Champions have access to security resources and guidance\n Champions serve as a bridge between development and security teams\n The role is recognized by the organization" },
  { code: "G-EG-B-2-1", streamCode: "G-EG-B", level: 2, answerSet: 5,
    question: "Does the organization have a Secure Software Center of Excellence (SSCE)?",
    guidance: "An SSCE or equivalent body exists\n It provides centralized security guidance and resources\n It drives security standards and best practices\n It serves as a community for security knowledge sharing" },
  { code: "G-EG-B-3-1", streamCode: "G-EG-B", level: 3, answerSet: 5,
    question: "Is there a centralized portal where developers and application security professionals from different teams and business units are able to communicate and share knowledge?",
    guidance: "A knowledge sharing portal exists and is actively used\n Cross-team communication on security topics is facilitated\n Best practices and lessons learned are shared\n The portal is maintained and kept current" },

  // ======================================================================
  // DESIGN - Threat Assessment
  // ======================================================================
  // Stream A: Application Risk Profile
  { code: "D-TA-A-1-1", streamCode: "D-TA-A", level: 1, answerSet: 1,
    question: "Do you classify applications according to business risk based on a simple and predefined set of questions?",
    guidance: "An agreed-upon risk classification exists\n The application team understands the risk classification\n The risk classification covers critical aspects of business risks the organization is facing\n The organization has an inventory for the applications in scope" },
  { code: "D-TA-A-2-1", streamCode: "D-TA-A", level: 2, answerSet: 0,
    question: "Do you use centralized and quantified application risk profiles to evaluate business risk?",
    guidance: "Risk profiles use a quantified risk scoring methodology\n Profiles are centrally managed and accessible\n Risk assessments consider multiple dimensions (financial, reputation, compliance)\n Risk profiles inform security investment decisions" },
  { code: "D-TA-A-3-1", streamCode: "D-TA-A", level: 3, answerSet: 17,
    question: "Do you regularly review and update the risk profiles for your applications?",
    guidance: "Risk profiles are reviewed at regular intervals\n Reviews consider changes in business context and threat landscape\n Updates are communicated to relevant stakeholders\n Historical risk profile data is maintained for trend analysis" },

  // Stream B: Threat Modeling
  { code: "D-TA-B-1-1", streamCode: "D-TA-B", level: 1, answerSet: 1,
    question: "Do you identify and manage architectural design flaws with threat modeling?",
    guidance: "You perform threat modeling for high-risk applications\n You use simple threat checklists, such as STRIDE\n You persist the outcome of a threat model for later use" },
  { code: "D-TA-B-2-1", streamCode: "D-TA-B", level: 2, answerSet: 0,
    question: "Do you use a standard methodology, aligned with your application risk levels?",
    guidance: "A standard threat modeling methodology is used\n The methodology is aligned with application risk levels\n Threat models are reviewed and updated\n Results feed into security requirements" },
  { code: "D-TA-B-3-1", streamCode: "D-TA-B", level: 3, answerSet: 15,
    question: "Do you regularly review and update the threat modeling methodology for your applications?",
    guidance: "Threat modeling methodology is regularly reviewed\n Updates incorporate new attack patterns and threats\n Effectiveness of threat modeling is measured\n Lessons learned feed into methodology improvements" },

  // ======================================================================
  // DESIGN - Security Requirements
  // ======================================================================
  // Stream A: Software Requirements
  { code: "D-SR-A-1-1", streamCode: "D-SR-A", level: 1, answerSet: 0,
    question: "Do project teams specify security requirements during development?",
    guidance: "Teams derive security requirements from functional requirements and customer or organization concerns\n Security requirements are specific, measurable, and reasonable\n Security requirements are in line with the organizational baseline" },
  { code: "D-SR-A-2-1", streamCode: "D-SR-A", level: 2, answerSet: 4,
    question: "Do you define, structure, and include prioritization in the artifacts of the security requirements gathering process?",
    guidance: "Security requirements take into consideration domain specific knowledge when applying policies and guidance to product development\n Domain experts are involved in the requirements definition process\n You have an agreed upon structured notation for security requirements\n Development teams have a security champion dedicated to reviewing security requirements and outcomes" },
  { code: "D-SR-A-3-1", streamCode: "D-SR-A", level: 3, answerSet: 0,
    question: "Do you use a standard requirements framework to streamline the elicitation of security requirements?",
    guidance: "A security requirements framework is available for project teams\n The framework is categorized by common requirements and standards-based requirements\n The framework gives clear guidance on the quality of requirements and how to describe them\n The framework is adaptable to specific business requirements" },

  // Stream B: Supplier Security
  { code: "D-SR-B-1-1", streamCode: "D-SR-B", level: 1, answerSet: 4,
    question: "Do stakeholders review vendor collaborations for security requirements and methodology?",
    guidance: "You consider including specific security requirements, activities, and processes when creating third-party agreements\n A vendor questionnaire is available and used to assess the strengths and weaknesses of your suppliers" },
  { code: "D-SR-B-2-1", streamCode: "D-SR-B", level: 2, answerSet: 4,
    question: "Do vendors meet the security responsibilities and quality measures of service level agreements defined by the organization?",
    guidance: "You discuss security requirements with the vendor when creating vendor agreements\n Vendor agreements provide specific guidance on security defect remediation within an agreed upon timeframe\n The organization has a templated agreement of responsibilities and service levels for key vendor security processes\n You measure key performance indicators" },
  { code: "D-SR-B-3-1", streamCode: "D-SR-B", level: 3, answerSet: 4,
    question: "Are vendors aligned with standard security controls and software development tools and processes that the organization utilizes?",
    guidance: "The vendor has a secure SDLC that includes secure build, secure deployment, defect management, and incident management, meets the security expectations of your organization, and is able to demonstrate operating effectiveness of practices.\n You verify the solution meets quality and security objectives before every major release\n When standard verification processes are not available, you use compensating controls such as software composition analysis and independent penetration testing" },

  // ======================================================================
  // DESIGN - Secure Architecture
  // ======================================================================
  // Stream A: Architecture Design
  { code: "D-SA-A-1-1", streamCode: "D-SA-A", level: 1, answerSet: 0,
    question: "Do teams use security principles during design?",
    guidance: "You have an agreed upon checklist of security principles\n You store your checklist in an accessible location\n Relevant stakeholders understand security principles" },
  { code: "D-SA-A-2-1", streamCode: "D-SA-A", level: 2, answerSet: 0,
    question: "Do you use shared security services during design?",
    guidance: "You have a documented list of reusable security services, available to relevant stakeholders\n You have reviewed the baseline security posture for each selected service\n Your designers are trained to integrate each selected service following available guidance" },
  { code: "D-SA-A-3-1", streamCode: "D-SA-A", level: 3, answerSet: 0,
    question: "Do you base your design on available reference architectures?",
    guidance: "You have one or more approved reference architectures documented and available to stakeholders\n You improve the reference architectures continuously based on insights and best practices\n You provide a set of components, libraries, and tools to implement each reference architecture" },

  // Stream B: Technology Management
  { code: "D-SA-B-1-1", streamCode: "D-SA-B", level: 1, answerSet: 0,
    question: "Do you evaluate the security quality of important technologies used for development?",
    guidance: "You have a list of the most important technologies used in, or in support of, each application\n You identify and track technological risks\n You ensure the risks to these technologies are in line with the organizational baseline" },
  { code: "D-SA-B-2-1", streamCode: "D-SA-B", level: 2, answerSet: 12,
    question: "Do you have a list of recommended technologies for the organization?",
    guidance: "The list is based on technologies used in the software portfolio\n Lead architects and developers review and approve the list\n You share the list across the organization\n You review and update the list at least yearly" },
  { code: "D-SA-B-3-1", streamCode: "D-SA-B", level: 3, answerSet: 0,
    question: "Do you enforce the use of recommended technologies within the organization?",
    guidance: "You monitor applications regularly for the correct use of the recommended technologies\n You solve violations against the list according to organizational policies\n You take action if the number of violations falls outside the yearly objectives" },

  // ======================================================================
  // IMPLEMENTATION - Secure Build
  // ======================================================================
  // Stream A: Build Process
  { code: "I-SB-A-1-1", streamCode: "I-SB-A", level: 1, answerSet: 0,
    question: "Is your full build process formally described?",
    guidance: "You have a formal description of the full build process\n The build process is documented and available to relevant team members\n The build process includes security-relevant steps" },
  { code: "I-SB-A-2-1", streamCode: "I-SB-A", level: 2, answerSet: 0,
    question: "Is the build process fully automated?",
    guidance: "The build process is fully automated\n Build scripts are version controlled\n Build environments are reproducible\n Build outputs are consistent and verifiable" },
  { code: "I-SB-A-3-1", streamCode: "I-SB-A", level: 3, answerSet: 0,
    question: "Do you enforce automated security checks in your build processes?",
    guidance: "Automated security checks are integrated into the build pipeline\n Build failures on security checks block deployment\n Security check results are tracked and reported\n False positives are managed effectively" },

  // Stream B: Software Dependencies
  { code: "I-SB-B-1-1", streamCode: "I-SB-B", level: 1, answerSet: 0,
    question: "Do you have solid knowledge about dependencies you're relying on?",
    guidance: "You maintain a bill of materials for third-party dependencies\n Dependencies are tracked across applications\n Known vulnerabilities in dependencies are identified" },
  { code: "I-SB-B-2-1", streamCode: "I-SB-B", level: 2, answerSet: 0,
    question: "Do you handle 3rd party dependency risk by a formal process?",
    guidance: "A formal process manages dependency risks\n Dependencies are evaluated before adoption\n Vulnerable dependencies are remediated within defined timeframes\n Dependency updates are tracked and managed" },
  { code: "I-SB-B-3-1", streamCode: "I-SB-B", level: 3, answerSet: 0,
    question: "Do you prevent build of software if it's affected by vulnerabilities in dependencies?",
    guidance: "Build processes block on known vulnerable dependencies\n Severity-based policies determine blocking criteria\n Exceptions are documented and time-limited\n Dependency security is continuously monitored" },

  // ======================================================================
  // IMPLEMENTATION - Secure Deployment
  // ======================================================================
  // Stream A: Deployment Process
  { code: "I-SD-A-1-1", streamCode: "I-SD-A", level: 1, answerSet: 0,
    question: "Do you use repeatable deployment processes?",
    guidance: "Deployment processes are documented and repeatable\n Deployment steps are consistent across environments\n Deployment includes basic security verification" },
  { code: "I-SD-A-2-1", streamCode: "I-SD-A", level: 2, answerSet: 0,
    question: "Are deployment processes automated and employing security checks?",
    guidance: "Deployment processes are automated\n Security checks are part of the deployment pipeline\n Deployment configurations are version controlled\n Rollback procedures are defined and tested" },
  { code: "I-SD-A-3-1", streamCode: "I-SD-A", level: 3, answerSet: 0,
    question: "Do you consistently validate the integrity of deployed artifacts?",
    guidance: "Artifact integrity is validated before deployment\n Cryptographic signing is used for artifacts\n Deployment integrity checks are automated\n Integrity violations block deployment" },

  // Stream B: Secret Management
  { code: "I-SD-B-1-1", streamCode: "I-SD-B", level: 1, answerSet: 0,
    question: "Do you limit access to application secrets according to the least privilege principle?",
    guidance: "Application secrets are managed separately from source code\n Access to secrets follows least privilege\n Secrets are not hardcoded in application code" },
  { code: "I-SD-B-2-1", streamCode: "I-SD-B", level: 2, answerSet: 0,
    question: "Do you inject production secrets into configuration files during deployment?",
    guidance: "Secrets are injected at deployment time, not stored in code\n A secrets management solution is used\n Secret rotation procedures are defined\n Access to production secrets is audited" },
  { code: "I-SD-B-3-1", streamCode: "I-SD-B", level: 3, answerSet: 0,
    question: "Do you practice proper lifecycle management for application secrets?",
    guidance: "Secrets have defined lifecycles including rotation schedules\n Secret rotation is automated where possible\n Compromised secrets are revoked immediately\n Secret usage is monitored and audited" },

  // ======================================================================
  // IMPLEMENTATION - Defect Management
  // ======================================================================
  // Stream A: Defect Tracking
  { code: "I-DM-A-1-1", streamCode: "I-DM-A", level: 1, answerSet: 0,
    question: "Do you track all known security defects in accessible locations?",
    guidance: "Security defects are tracked in a centralized system\n Defects are accessible to relevant team members\n Basic severity classification is applied\n Defect status is kept current" },
  { code: "I-DM-A-2-1", streamCode: "I-DM-A", level: 2, answerSet: 0,
    question: "Do you keep an overview of the state of security defects across the organization?",
    guidance: "Organization-wide defect overview is maintained\n Defects are classified by severity and status\n Trends are tracked over time\n Management has visibility into defect status" },
  { code: "I-DM-A-3-1", streamCode: "I-DM-A", level: 3, answerSet: 0,
    question: "Do you enforce SLAs for fixing security defects?",
    guidance: "SLAs are defined for each severity level\n SLA compliance is tracked and reported\n SLA violations trigger escalation procedures\n SLA metrics drive process improvements" },

  // Stream B: Metrics and Feedback
  { code: "I-DM-B-1-1", streamCode: "I-DM-B", level: 1, answerSet: 0,
    question: "Do you use basic metrics about recorded security defects to carry out quick win improvement activities?",
    guidance: "Basic defect metrics are collected\n Metrics identify patterns and quick wins\n Improvement activities are prioritized by impact\n Results of improvements are tracked" },
  { code: "I-DM-B-2-1", streamCode: "I-DM-B", level: 2, answerSet: 0,
    question: "Do you improve your security assurance program upon standardized metrics?",
    guidance: "Standardized defect metrics are defined\n Metrics drive program improvements\n Trends are analyzed to identify systemic issues\n Improvement effectiveness is measured" },
  { code: "I-DM-B-3-1", streamCode: "I-DM-B", level: 3, answerSet: 0,
    question: "Do you regularly evaluate the effectiveness of your security metrics so that its input helps drive your security strategy?",
    guidance: "Metrics effectiveness is regularly evaluated\n Metrics directly influence security strategy\n Feedback loops ensure continuous improvement\n Stakeholders trust and act on metrics data" },

  // ======================================================================
  // VERIFICATION - Architecture Assessment
  // ======================================================================
  // Stream A: Architecture Validation
  { code: "V-AA-A-1-1", streamCode: "V-AA-A", level: 1, answerSet: 0,
    question: "Do you review the application architecture for key security objectives on an ad-hoc basis?",
    guidance: "Architecture reviews consider key security objectives\n Reviews are performed for high-risk applications\n Review findings are documented\n Findings feed into development activities" },
  { code: "V-AA-A-2-1", streamCode: "V-AA-A", level: 2, answerSet: 0,
    question: "Do you regularly review the security mechanisms of your architecture?",
    guidance: "Architecture security reviews are performed regularly\n Reviews cover all critical security mechanisms\n Review results are tracked over time\n Findings are addressed systematically" },
  { code: "V-AA-A-3-1", streamCode: "V-AA-A", level: 3, answerSet: 0,
    question: "Do you regularly review the effectiveness of the security controls?",
    guidance: "Security control effectiveness is regularly validated\n Validation includes both technical and process controls\n Ineffective controls are improved or replaced\n Control effectiveness metrics are reported" },

  // Stream B: Architecture Mitigation
  { code: "V-AA-B-1-1", streamCode: "V-AA-B", level: 1, answerSet: 0,
    question: "Do you review the application architecture for mitigations of typical threats on an ad-hoc basis?",
    guidance: "Architecture reviews consider common threat mitigations\n Reviews are performed for high-risk applications\n Mitigation gaps are identified and documented\n Gap remediation is prioritized" },
  { code: "V-AA-B-2-1", streamCode: "V-AA-B", level: 2, answerSet: 0,
    question: "Do you regularly evaluate the threats to your architecture?",
    guidance: "Architecture threat evaluations are performed regularly\n Evaluations consider current threat landscape\n Findings drive mitigation improvements\n Evaluation methodology is standardized" },
  { code: "V-AA-B-3-1", streamCode: "V-AA-B", level: 3, answerSet: 0,
    question: "Do you regularly update your reference architectures based on architecture assessment findings?",
    guidance: "Reference architectures are updated based on assessment findings\n Updates incorporate lessons learned\n Architecture patterns reflect current best practices\n Changes are communicated to development teams" },

  // ======================================================================
  // VERIFICATION - Requirements-driven Testing
  // ======================================================================
  // Stream A: Control Verification
  { code: "V-RT-A-1-1", streamCode: "V-RT-A", level: 1, answerSet: 1,
    question: "Do you test applications for the correct functioning of standard security controls?",
    guidance: "Security control tests are performed\n Tests cover standard security controls (authentication, authorization, etc.)\n Test results are documented\n Failed tests trigger remediation" },
  { code: "V-RT-A-2-1", streamCode: "V-RT-A", level: 2, answerSet: 1,
    question: "Do you consistently write and execute test scripts to verify the functionality of security requirements?",
    guidance: "Test scripts verify security requirements\n Scripts are consistently executed across projects\n Test coverage includes both positive and negative cases\n Test results are tracked and reported" },
  { code: "V-RT-A-3-1", streamCode: "V-RT-A", level: 3, answerSet: 0,
    question: "Do you automatically test applications for security regressions?",
    guidance: "Security regression tests are automated\n Tests run as part of the CI/CD pipeline\n Regressions block deployment\n Test suite is maintained and expanded" },

  // Stream B: Misuse/Abuse Testing
  { code: "V-RT-B-1-1", streamCode: "V-RT-B", level: 1, answerSet: 0,
    question: "Do you test applications using randomization or fuzzing techniques?",
    guidance: "Fuzzing or randomized testing is performed\n Tests target input validation and error handling\n Results are analyzed for security implications\n Findings are remediated" },
  { code: "V-RT-B-2-1", streamCode: "V-RT-B", level: 2, answerSet: 4,
    question: "Do you create abuse cases from functional requirements and use them to drive security tests?",
    guidance: "Abuse cases are derived from functional requirements\n Abuse cases drive targeted security tests\n Tests cover business logic vulnerabilities\n Results inform security improvements" },
  { code: "V-RT-B-3-1", streamCode: "V-RT-B", level: 3, answerSet: 4,
    question: "Do you perform denial of service and security stress testing?",
    guidance: "DoS and stress testing is performed regularly\n Tests simulate realistic attack scenarios\n Results inform capacity and resilience planning\n Findings are addressed systematically" },

  // ======================================================================
  // VERIFICATION - Security Testing
  // ======================================================================
  // Stream A: Scalable Baseline
  { code: "V-ST-A-1-1", streamCode: "V-ST-A", level: 1, answerSet: 1,
    question: "Do you scan applications with automated security testing tools?",
    guidance: "Automated security testing tools (SAST, DAST) are used\n Scanning covers critical applications\n Results are reviewed and triaged\n High-severity findings are addressed" },
  { code: "V-ST-A-2-1", streamCode: "V-ST-A", level: 2, answerSet: 1,
    question: "Do you customize the automated security tools to your applications and technology stacks?",
    guidance: "Security tools are customized for the technology stack\n Custom rules reduce false positives\n Tool configurations are maintained and shared\n Customization improves finding quality" },
  { code: "V-ST-A-3-1", streamCode: "V-ST-A", level: 3, answerSet: 22,
    question: "Do you integrate automated security testing into the build and deploy process?",
    guidance: "Security testing is integrated into CI/CD pipelines\n Tests run automatically on each build or deploy\n Security gates enforce quality standards\n Pipeline integration is maintained and monitored" },

  // Stream B: Deep Understanding
  { code: "V-ST-B-1-1", streamCode: "V-ST-B", level: 1, answerSet: 6,
    question: "Do you manually review the security quality of selected high-risk components?",
    guidance: "Manual security reviews are performed for high-risk components\n Reviews cover code, configuration, and architecture\n Reviewers have appropriate security expertise\n Findings are documented and tracked" },
  { code: "V-ST-B-2-1", streamCode: "V-ST-B", level: 2, answerSet: 0,
    question: "Do you perform penetration testing for your applications at regular intervals?",
    guidance: "Penetration testing is performed regularly\n Tests cover both internal and external attack surfaces\n Testing scope aligns with risk profiles\n Findings are remediated within defined timeframes" },
  { code: "V-ST-B-3-1", streamCode: "V-ST-B", level: 3, answerSet: 23,
    question: "Do you use the results of security testing to improve the development lifecycle?",
    guidance: "Security testing results drive development improvements\n Root causes are analyzed and addressed\n Improvements are tracked and measured\n Feedback loops ensure continuous enhancement" },

  // ======================================================================
  // OPERATIONS - Incident Management
  // ======================================================================
  // Stream A: Incident Detection
  { code: "O-IM-A-1-1", streamCode: "O-IM-A", level: 1, answerSet: 0,
    question: "Do you analyze log data for security incidents periodically?",
    guidance: "Log data is collected from key systems\n Logs are periodically reviewed for security incidents\n Basic alerting is in place for critical events\n Log analysis findings are acted upon" },
  { code: "O-IM-A-2-1", streamCode: "O-IM-A", level: 2, answerSet: 0,
    question: "Do you follow a documented process for incident detection?",
    guidance: "Incident detection process is documented\n Detection covers multiple data sources\n Detection rules are maintained and updated\n Process effectiveness is measured" },
  { code: "O-IM-A-3-1", streamCode: "O-IM-A", level: 3, answerSet: 0,
    question: "Do you review and update the incident detection process regularly?",
    guidance: "Detection process is regularly reviewed and updated\n Reviews incorporate lessons from past incidents\n New detection capabilities are added proactively\n Process improvements are tracked" },

  // Stream B: Incident Response
  { code: "O-IM-B-1-1", streamCode: "O-IM-B", level: 1, answerSet: 7,
    question: "Do you respond to detected incidents?",
    guidance: "Detected incidents are responded to\n Response actions are taken promptly\n Incident outcomes are documented\n Lessons learned are captured" },
  { code: "O-IM-B-2-1", streamCode: "O-IM-B", level: 2, answerSet: 8,
    question: "Do you use a repeatable process for incident handling?",
    guidance: "Incident handling process is documented and repeatable\n Process covers classification, containment, eradication, and recovery\n Roles and responsibilities are defined\n Process is tested through tabletop exercises" },
  { code: "O-IM-B-3-1", streamCode: "O-IM-B", level: 3, answerSet: 4,
    question: "Do you have a dedicated incident response team available?",
    guidance: "A dedicated incident response team is available\n Team members are trained and certified\n Team conducts regular exercises\n Response capabilities are continuously improved" },

  // ======================================================================
  // OPERATIONS - Environment Management
  // ======================================================================
  // Stream A: Configuration Hardening
  { code: "O-EM-A-1-1", streamCode: "O-EM-A", level: 1, answerSet: 6,
    question: "Do you harden configurations for key components of your technology stacks?",
    guidance: "Hardening is applied to key infrastructure components\n Hardening baselines exist for common technologies\n Configurations are documented\n Default credentials and settings are changed" },
  { code: "O-EM-A-2-1", streamCode: "O-EM-A", level: 2, answerSet: 6,
    question: "Do you have hardening baselines for your components?",
    guidance: "Hardening baselines are defined for all component types\n Baselines are based on industry standards (CIS, DISA STIGs)\n Baselines are regularly reviewed and updated\n Compliance with baselines is verified" },
  { code: "O-EM-A-3-1", streamCode: "O-EM-A", level: 3, answerSet: 6,
    question: "Do you monitor and enforce conformity with hardening baselines?",
    guidance: "Automated monitoring verifies baseline conformity\n Deviations trigger alerts and remediation\n Conformity status is reported regularly\n Enforcement is automated where possible" },

  // Stream B: Patching and Updating
  { code: "O-EM-B-1-1", streamCode: "O-EM-B", level: 1, answerSet: 6,
    question: "Do you identify and patch vulnerable components?",
    guidance: "Vulnerable components are identified through scanning\n Patches are applied for critical vulnerabilities\n Patching timeframes are defined\n Patch status is tracked" },
  { code: "O-EM-B-2-1", streamCode: "O-EM-B", level: 2, answerSet: 6,
    question: "Do you follow an established process for updating components of your technology stacks?",
    guidance: "A formal patching process is established\n Process covers all technology stack components\n Patch testing is performed before deployment\n Patch compliance is measured" },
  { code: "O-EM-B-3-1", streamCode: "O-EM-B", level: 3, answerSet: 6,
    question: "Do you regularly evaluate components and review patch level status?",
    guidance: "Components are regularly evaluated for patch status\n Patch level reviews are comprehensive\n Outdated components are identified and addressed\n Patch management effectiveness is measured" },

  // ======================================================================
  // OPERATIONS - Operational Management
  // ======================================================================
  // Stream A: Data Protection
  { code: "O-OM-A-1-1", streamCode: "O-OM-A", level: 1, answerSet: 0,
    question: "Do you protect and handle information according to protection requirements for data stored and processed on each application?",
    guidance: "Data protection requirements are defined per application\n Data handling procedures exist\n Sensitive data is identified and classified\n Basic protection controls are in place" },
  { code: "O-OM-A-2-1", streamCode: "O-OM-A", level: 2, answerSet: 9,
    question: "Do you maintain a data catalog, including types, sensitivity levels, and processing and storage locations?",
    guidance: "A data catalog is maintained\n Catalog includes sensitivity classifications\n Processing and storage locations are documented\n Catalog is regularly updated" },
  { code: "O-OM-A-3-1", streamCode: "O-OM-A", level: 3, answerSet: 10,
    question: "Do you regularly review and update the data catalog and your data protection policies and procedures?",
    guidance: "Data catalog is regularly reviewed and updated\n Data protection policies are reviewed periodically\n Reviews incorporate regulatory changes\n Updates are communicated to stakeholders" },

  // Stream B: System Decommissioning / Legacy Management
  { code: "O-OM-B-1-1", streamCode: "O-OM-B", level: 1, answerSet: 0,
    question: "Do you identify and remove systems, applications, application dependencies, or services that are no longer used, have reached end of life, or are no longer actively developed or supported?",
    guidance: "End-of-life systems are identified\n Decommissioning procedures exist\n Dependencies on legacy systems are tracked\n Removal is performed safely" },
  { code: "O-OM-B-2-1", streamCode: "O-OM-B", level: 2, answerSet: 4,
    question: "Do you follow an established process for removing all associated resources, as part of decommissioning unused applications?",
    guidance: "A formal decommissioning process exists\n Process covers all associated resources (data, infrastructure, accounts)\n Decommissioning is verified and documented\n Dependencies are resolved before decommissioning" },
  { code: "O-OM-B-3-1", streamCode: "O-OM-B", level: 3, answerSet: 11,
    question: "Do you regularly evaluate the lifecycle state and support status of every software asset and underlying infrastructure component, and estimate their end of life?",
    guidance: "Software asset lifecycle status is regularly evaluated\n Infrastructure component support status is tracked\n End-of-life estimates are maintained\n Lifecycle management informs planning and budgeting" },
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

/**
 * Seed the OWASP SAMM v2.1 framework
 */
export async function seedOwaspSammFramework(prisma: PrismaClient): Promise<string> {
  console.log("Creating OWASP SAMM v2.1 Framework...");

  // Check if framework already exists (system templates have null organizationId)
  let framework = await prisma.maturityFramework.findFirst({
    where: {
      type: "OWASP_SAMM",
      version: "2.1",
      isSystemTemplate: true,
      organizationId: null,
    },
  });

  if (!framework) {
    // Create the framework
    framework = await prisma.maturityFramework.create({
      data: {
        type: "OWASP_SAMM",
        name: "OWASP SAMM",
        version: "2.1",
        description:
          "The OWASP Software Assurance Maturity Model (SAMM) provides an effective and measurable way for all types of organizations to analyze and improve their software security posture. SAMM v2.1 covers 5 Business Functions with 15 Security Practices, assessed through 90 interview questions across 3 maturity levels. Licensed under Creative Commons Attribution-ShareAlike 4.0.",
        minLevel: 0,
        maxLevel: 3,
        scoringLevels: SAMM_MATURITY_LEVELS,
        isActive: true,
        isSystemTemplate: true,
        organizationId: null,
      },
    });
  }

  console.log(`  Created framework: ${framework.name} (${framework.id})`);

  // ---- Create Business Functions (FUNCTION level) ----
  const functionMap = new Map<string, string>();
  for (const func of SAMM_BUSINESS_FUNCTIONS) {
    const domain = await prisma.maturityDomain.upsert({
      where: {
        frameworkId_code: {
          frameworkId: framework.id,
          code: func.code,
        },
      },
      update: {},
      create: {
        frameworkId: framework.id,
        code: func.code,
        name: func.name,
        description: func.description,
        level: "FUNCTION" as AssessmentDepth,
        sortOrder: func.sortOrder,
        parentId: null,
      },
    });
    functionMap.set(func.code, domain.id);
    console.log(`  Created Business Function: ${func.code} - ${func.name}`);
  }

  // ---- Create Security Practices (CATEGORY level) ----
  const practiceMap = new Map<string, string>();
  for (const practice of SAMM_SECURITY_PRACTICES) {
    const parentId = functionMap.get(practice.functionCode);
    if (!parentId) {
      console.warn(`  Warning: Parent function ${practice.functionCode} not found for practice ${practice.code}`);
      continue;
    }

    const domain = await prisma.maturityDomain.upsert({
      where: {
        frameworkId_code: {
          frameworkId: framework.id,
          code: practice.code,
        },
      },
      update: {},
      create: {
        frameworkId: framework.id,
        code: practice.code,
        name: practice.name,
        description: practice.description,
        level: "CATEGORY" as AssessmentDepth,
        sortOrder: practice.sortOrder,
        parentId: parentId,
      },
    });
    practiceMap.set(practice.code, domain.id);
  }
  console.log(`  Created ${SAMM_SECURITY_PRACTICES.length} Security Practices`);

  // ---- Create Activity Streams (SUBCATEGORY level) ----
  const streamMap = new Map<string, string>();
  for (const stream of SAMM_ACTIVITY_STREAMS) {
    const parentId = practiceMap.get(stream.practiceCode);
    if (!parentId) {
      console.warn(`  Warning: Parent practice ${stream.practiceCode} not found for stream ${stream.code}`);
      continue;
    }

    const domain = await prisma.maturityDomain.upsert({
      where: {
        frameworkId_code: {
          frameworkId: framework.id,
          code: stream.code,
        },
      },
      update: {},
      create: {
        frameworkId: framework.id,
        code: stream.code,
        name: stream.name,
        description: null,
        level: "SUBCATEGORY" as AssessmentDepth,
        sortOrder: stream.sortOrder,
        parentId: parentId,
      },
    });
    streamMap.set(stream.code, domain.id);
  }
  console.log(`  Created ${SAMM_ACTIVITY_STREAMS.length} Activity Streams`);

  // ---- Create Questions (MaturityQuestion records) ----
  let questionCount = 0;
  for (const q of SAMM_QUESTIONS) {
    const domainId = streamMap.get(q.streamCode);
    if (!domainId) {
      console.warn(`  Warning: Stream ${q.streamCode} not found for question ${q.code}`);
      continue;
    }

    const answerOptions = ANSWER_SETS[q.answerSet] ?? ANSWER_SETS[0];

    await prisma.maturityQuestion.upsert({
      where: {
        frameworkId_practiceCode: {
          frameworkId: framework.id,
          practiceCode: q.code,
        },
      },
      update: {
        questionText: q.question,
        guidanceText: q.guidance,
        practiceLevel: q.level,
        domainId: domainId,
        answerOptions: answerOptions as unknown as Prisma.InputJsonValue,
      },
      create: {
        frameworkId: framework.id,
        domainId: domainId,
        practiceCode: q.code,
        practiceLevel: q.level,
        questionText: q.question,
        guidanceText: q.guidance,
        answerType: "WEIGHTED_SCALE",
        answerOptions: answerOptions as unknown as Prisma.InputJsonValue,
        isOfficial: true,
        isActive: true,
        sortOrder: questionCount,
      },
    });
    questionCount++;
  }
  console.log(`  Created ${questionCount} Assessment Questions`);

  console.log(`OWASP SAMM v2.1 Framework seeded successfully!\n`);
  return framework.id;
}
