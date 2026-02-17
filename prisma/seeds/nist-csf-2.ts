/**
 * NIST Cybersecurity Framework 2.0 Seed Data
 *
 * This seed creates the NIST CSF 2.0 framework template with:
 * - 6 Functions: Govern, Identify, Protect, Detect, Respond, Recover
 * - 22 Categories under those functions
 * - 106 Subcategories for detailed assessment
 * - Implementation Tiers 1-4 scoring configuration
 *
 * @see https://www.nist.gov/cyberframework
 */

import type { PrismaClient, AssessmentDepth } from "@prisma/client";

// NIST CSF 2.0 Implementation Tiers (1-4)
export const NIST_CSF_2_TIERS = [
  {
    value: 1,
    label: "Partial",
    description:
      "Risk management practices are not formalized, and risk is managed in an ad hoc and sometimes reactive manner. Prioritization of cybersecurity activities may not be directly informed by organizational risk objectives, the threat environment, or business/mission requirements.",
    criteria: [
      "Cybersecurity risk management is ad hoc",
      "Limited awareness of cybersecurity risk",
      "Irregular cybersecurity risk management processes",
      "Minimal external collaboration on cybersecurity",
    ],
  },
  {
    value: 2,
    label: "Risk Informed",
    description:
      "Risk management practices are approved by management but may not be established as organizational-wide policy. Prioritization of cybersecurity activities is directly informed by organizational risk objectives, the threat environment, or business/mission requirements.",
    criteria: [
      "Risk management practices approved by management",
      "Organization-wide awareness of cybersecurity risk",
      "Informal risk management processes",
      "Collaboration occurs but may not be consistent",
    ],
  },
  {
    value: 3,
    label: "Repeatable",
    description:
      "The organization's risk management practices are formally approved and expressed as policy. Organizational cybersecurity practices are regularly updated based on the application of risk management processes to changes in business/mission requirements and a changing threat and technology landscape.",
    criteria: [
      "Risk management practices formally documented as policy",
      "Organization-wide consistent risk management approach",
      "Regular updates based on risk assessments",
      "Active external collaboration",
    ],
  },
  {
    value: 4,
    label: "Adaptive",
    description:
      "The organization adapts its cybersecurity practices based on previous and current cybersecurity activities, including lessons learned and predictive indicators. Through a process of continuous improvement incorporating advanced cybersecurity technologies and practices, the organization actively adapts to a changing threat and technology landscape and responds in a timely and effective manner to evolving, sophisticated threats.",
    criteria: [
      "Continuous improvement of risk management",
      "Organization-wide, consistent, and adaptive approach",
      "Proactive adaptation based on lessons learned",
      "Active participation in information sharing",
    ],
  },
];

// NIST CSF 2.0 Functions (Level 1)
export const NIST_CSF_2_FUNCTIONS = [
  {
    code: "GV",
    name: "Govern",
    description:
      "The organization's cybersecurity risk management strategy, expectations, and policy are established, communicated, and monitored. The GOVERN Function provides outcomes to inform what an organization may do to achieve and prioritize the outcomes of the other five Functions in the context of its mission and stakeholder expectations.",
    sortOrder: 1,
  },
  {
    code: "ID",
    name: "Identify",
    description:
      "The organization's current cybersecurity risks are understood. Understanding its assets, suppliers, and related cybersecurity risks enables an organization to prioritize its efforts consistent with its risk management strategy and the mission needs identified under GOVERN.",
    sortOrder: 2,
  },
  {
    code: "PR",
    name: "Protect",
    description:
      "Safeguards to manage the organization's cybersecurity risks are used. Once assets and risks are identified, PROTECT supports the ability to secure those assets to prevent or lower the likelihood and impact of adverse cybersecurity events.",
    sortOrder: 3,
  },
  {
    code: "DE",
    name: "Detect",
    description:
      "Possible cybersecurity attacks and compromises are found and analyzed. DETECT enables timely discovery and analysis of anomalies, indicators of compromise, and other potentially adverse events that may indicate that cybersecurity attacks and incidents are occurring.",
    sortOrder: 4,
  },
  {
    code: "RS",
    name: "Respond",
    description:
      "Actions regarding a detected cybersecurity incident are taken. RESPOND supports the ability to contain the impact of cybersecurity incidents. Outcomes within this Function cover incident management, analysis, mitigation, reporting, and communication.",
    sortOrder: 5,
  },
  {
    code: "RC",
    name: "Recover",
    description:
      "Assets and operations affected by a cybersecurity incident are restored. RECOVER supports timely restoration of normal operations to reduce the impact of cybersecurity incidents and enable appropriate communication during recovery efforts.",
    sortOrder: 6,
  },
];

// NIST CSF 2.0 Categories (Level 2)
export const NIST_CSF_2_CATEGORIES = [
  // GOVERN Categories
  {
    code: "GV.OC",
    functionCode: "GV",
    name: "Organizational Context",
    description:
      "The circumstances — mission, stakeholder expectations, dependencies, and legal, regulatory, and contractual requirements — surrounding the organization's cybersecurity risk management decisions are understood.",
    sortOrder: 1,
  },
  {
    code: "GV.RM",
    functionCode: "GV",
    name: "Risk Management Strategy",
    description:
      "The organization's priorities, constraints, risk tolerance and appetite statements, and assumptions are established, communicated, and used to support operational risk decisions.",
    sortOrder: 2,
  },
  {
    code: "GV.RR",
    functionCode: "GV",
    name: "Roles, Responsibilities, and Authorities",
    description:
      "Cybersecurity roles, responsibilities, and authorities to foster accountability, performance assessment, and continuous improvement are established and communicated.",
    sortOrder: 3,
  },
  {
    code: "GV.PO",
    functionCode: "GV",
    name: "Policy",
    description:
      "Organizational cybersecurity policy is established, communicated, and enforced.",
    sortOrder: 4,
  },
  {
    code: "GV.OV",
    functionCode: "GV",
    name: "Oversight",
    description:
      "Results of organization-wide cybersecurity risk management activities and performance are used to inform, improve, and adjust the risk management strategy.",
    sortOrder: 5,
  },
  {
    code: "GV.SC",
    functionCode: "GV",
    name: "Cybersecurity Supply Chain Risk Management",
    description:
      "Cyber supply chain risk management processes are identified, established, managed, monitored, and improved by organizational stakeholders.",
    sortOrder: 6,
  },
  // IDENTIFY Categories
  {
    code: "ID.AM",
    functionCode: "ID",
    name: "Asset Management",
    description:
      "Assets (e.g., data, hardware, software, systems, facilities, services, people) that enable the organization to achieve business purposes are identified and managed consistent with their relative importance to organizational objectives and the organization's risk strategy.",
    sortOrder: 1,
  },
  {
    code: "ID.RA",
    functionCode: "ID",
    name: "Risk Assessment",
    description:
      "The cybersecurity risk to the organization, assets, and individuals is identified, analyzed, and prioritized.",
    sortOrder: 2,
  },
  {
    code: "ID.IM",
    functionCode: "ID",
    name: "Improvement",
    description:
      "Improvements to organizational cybersecurity risk management processes, procedures and activities are identified across all CSF Functions.",
    sortOrder: 3,
  },
  // PROTECT Categories
  {
    code: "PR.AA",
    functionCode: "PR",
    name: "Identity Management, Authentication, and Access Control",
    description:
      "Access to physical and logical assets is limited to authorized users, services, and hardware and managed commensurate with the assessed risk of unauthorized access.",
    sortOrder: 1,
  },
  {
    code: "PR.AT",
    functionCode: "PR",
    name: "Awareness and Training",
    description:
      "The organization's personnel are provided cybersecurity awareness and training so that they can perform their cybersecurity-related tasks.",
    sortOrder: 2,
  },
  {
    code: "PR.DS",
    functionCode: "PR",
    name: "Data Security",
    description:
      "Data are managed consistent with the organization's risk strategy to protect the confidentiality, integrity, and availability of information.",
    sortOrder: 3,
  },
  {
    code: "PR.PS",
    functionCode: "PR",
    name: "Platform Security",
    description:
      "The hardware, software (e.g., firmware, operating systems, applications), and services of physical and virtual platforms are managed consistent with the organization's risk strategy to protect their confidentiality, integrity, and availability.",
    sortOrder: 4,
  },
  {
    code: "PR.IR",
    functionCode: "PR",
    name: "Technology Infrastructure Resilience",
    description:
      "Security architectures are managed with the organization's risk strategy to protect asset confidentiality, integrity, and availability, and organizational resilience.",
    sortOrder: 5,
  },
  // DETECT Categories
  {
    code: "DE.CM",
    functionCode: "DE",
    name: "Continuous Monitoring",
    description:
      "Assets are monitored to find anomalies, indicators of compromise, and other potentially adverse events.",
    sortOrder: 1,
  },
  {
    code: "DE.AE",
    functionCode: "DE",
    name: "Adverse Event Analysis",
    description:
      "Anomalies, indicators of compromise, and other potentially adverse events are analyzed to characterize the events and detect cybersecurity incidents.",
    sortOrder: 2,
  },
  // RESPOND Categories
  {
    code: "RS.MA",
    functionCode: "RS",
    name: "Incident Management",
    description:
      "Responses to detected cybersecurity incidents are managed.",
    sortOrder: 1,
  },
  {
    code: "RS.AN",
    functionCode: "RS",
    name: "Incident Analysis",
    description:
      "Investigations are conducted to ensure effective response and support forensics and recovery activities.",
    sortOrder: 2,
  },
  {
    code: "RS.CO",
    functionCode: "RS",
    name: "Incident Response Reporting and Communication",
    description:
      "Response activities are coordinated with internal and external stakeholders as required by laws, regulations, or policies.",
    sortOrder: 3,
  },
  {
    code: "RS.MI",
    functionCode: "RS",
    name: "Incident Mitigation",
    description:
      "Activities are performed to prevent expansion of an event and mitigate its effects.",
    sortOrder: 4,
  },
  // RECOVER Categories
  {
    code: "RC.RP",
    functionCode: "RC",
    name: "Incident Recovery Plan Execution",
    description:
      "Restoration activities are performed to ensure operational availability of systems and services affected by cybersecurity incidents.",
    sortOrder: 1,
  },
  {
    code: "RC.CO",
    functionCode: "RC",
    name: "Incident Recovery Communication",
    description:
      "Restoration activities are coordinated with internal and external parties.",
    sortOrder: 2,
  },
];

// NIST CSF 2.0 Implementation Examples mapped to subcategory codes
// Source: NIST CSF 2.0 csf-export.json (363 examples across 106 subcategories)
// Ordered to match framework structure (GV, ID, PR, DE, RS, RC)
export const IMPLEMENTATION_EXAMPLES: Record<string, string[]> = {
  // GV.OC - Organizational Context
  "GV.OC-01": [
    "Share the organization's mission (e.g., through vision and mission statements, marketing, and service strategies) to provide a basis for identifying risks that may impede that mission",
  ],
  "GV.OC-02": [
    "Identify relevant internal stakeholders and their cybersecurity-related expectations (e.g., performance and risk expectations of officers, directors, and advisors; cultural expectations of employees)",
    "Identify relevant external stakeholders and their cybersecurity-related expectations (e.g., privacy expectations of customers, business expectations of partnerships, compliance expectations of regulators, ethics expectations of society)",
  ],
  "GV.OC-03": [
    "Determine a process to track and manage legal and regulatory requirements regarding protection of individuals' information (e.g., Health Insurance Portability and Accountability Act, California Consumer Privacy Act, General Data Protection Regulation)",
    "Determine a process to track and manage contractual requirements for cybersecurity management of supplier, customer, and partner information",
    "Align the organization's cybersecurity strategy with legal, regulatory, and contractual requirements",
  ],
  "GV.OC-04": [
    "Establish criteria for determining the criticality of capabilities and services as viewed by internal and external stakeholders",
    "Determine (e.g., from a business impact analysis) assets and business operations that are vital to achieving mission objectives and the potential impact of a loss (or partial loss) of such operations",
    "Establish and communicate resilience objectives (e.g., recovery time objectives) for delivering critical capabilities and services in various operating states (e.g., under attack, during recovery, normal operation)",
  ],
  "GV.OC-05": [
    "Create an inventory of the organization's dependencies on external resources (e.g., facilities, cloud-based hosting providers) and their relationships to organizational assets and business functions",
    "Identify and document external dependencies that are potential points of failure for the organization's critical capabilities and services, and share that information with appropriate personnel",
  ],
  // GV.RM - Risk Management Strategy
  "GV.RM-01": [
    "Update near-term and long-term cybersecurity risk management objectives as part of annual strategic planning and when major changes occur",
    "Establish measurable objectives for cybersecurity risk management (e.g., manage the quality of user training, ensure adequate risk protection for industrial control systems)",
    "Senior leaders agree about cybersecurity objectives and use them for measuring and managing risk and performance",
  ],
  "GV.RM-02": [
    "Determine and communicate risk appetite statements that convey expectations about the appropriate level of risk for the organization",
    "Translate risk appetite statements into specific, measurable, and broadly understandable risk tolerance statements",
    "Refine organizational objectives and risk appetite periodically based on known risk exposure and residual risk",
  ],
  "GV.RM-03": [
    "Aggregate and manage cybersecurity risks alongside other enterprise risks (e.g., compliance, financial, operational, regulatory, reputational, safety)",
    "Include cybersecurity risk managers in enterprise risk management planning",
    "Establish criteria for escalating cybersecurity risks within enterprise risk management",
  ],
  "GV.RM-04": [
    "Specify criteria for accepting and avoiding cybersecurity risk for various classifications of data",
    "Determine whether to purchase cybersecurity insurance",
    "Document conditions under which shared responsibility models are acceptable (e.g., outsourcing certain cybersecurity functions, having a third party perform financial transactions on behalf of the organization, using public cloud-based services)",
  ],
  "GV.RM-05": [
    "Determine how to update senior executives, directors, and management on the organization's cybersecurity posture at agreed-upon intervals",
    "Identify how all departments across the organization - such as management, operations, internal auditors, legal, acquisition, physical security, and HR - will communicate with each other about cybersecurity risks",
  ],
  "GV.RM-06": [
    "Establish criteria for using a quantitative approach to cybersecurity risk analysis, and specify probability and exposure formulas",
    "Create and use templates (e.g., a risk register) to document cybersecurity risk information (e.g., risk description, exposure, treatment, and ownership)",
    "Establish criteria for risk prioritization at the appropriate levels within the enterprise",
    "Use a consistent list of risk categories to support integrating, aggregating, and comparing cybersecurity risks",
  ],
  "GV.RM-07": [
    "Define and communicate guidance and methods for identifying opportunities and including them in risk discussions (e.g., strengths, weaknesses, opportunities, and threats [SWOT] analysis)",
    "Identify stretch goals and document them",
    "Calculate, document, and prioritize positive risks alongside negative risks",
  ],
  // GV.RR - Roles, Responsibilities, and Authorities
  "GV.RR-01": [
    "Leaders (e.g., directors) agree on their roles and responsibilities in developing, implementing, and assessing the organization's cybersecurity strategy",
    "Share leaders' expectations regarding a secure and ethical culture, especially when current events present the opportunity to highlight positive or negative examples of cybersecurity risk management",
    "Leaders direct the CISO to maintain a comprehensive cybersecurity risk strategy and review and update it at least annually and after major events",
    "Conduct reviews to ensure adequate authority and coordination among those responsible for managing cybersecurity risk",
  ],
  "GV.RR-02": [
    "Document risk management roles and responsibilities in policy",
    "Document who is responsible and accountable for cybersecurity risk management activities and how those teams and individuals are to be consulted and informed",
    "Include cybersecurity responsibilities and performance requirements in personnel descriptions",
    "Document performance goals for personnel with cybersecurity risk management responsibilities, and periodically measure performance to identify areas for improvement",
    "Clearly articulate cybersecurity responsibilities within operations, risk functions, and internal audit functions",
  ],
  "GV.RR-03": [
    "Conduct periodic management reviews to ensure that those given cybersecurity risk management responsibilities have the necessary authority",
    "Identify resource allocation and investment in line with risk tolerance and response",
    "Provide adequate and sufficient people, process, and technical resources to support the cybersecurity strategy",
  ],
  "GV.RR-04": [
    "Integrate cybersecurity risk management considerations into human resources processes (e.g., personnel screening, onboarding, change notification, offboarding)",
    "Consider cybersecurity knowledge to be a positive factor in hiring, training, and retention decisions",
    "Conduct background checks prior to onboarding new personnel for sensitive roles, and periodically repeat background checks for personnel with such roles",
    "Define and enforce obligations for personnel to be aware of, adhere to, and uphold security policies as they relate to their roles",
  ],
  // GV.PO - Policy
  "GV.PO-01": [
    "Create, disseminate, and maintain an understandable, usable risk management policy with statements of management intent, expectations, and direction",
    "Periodically review policy and supporting processes and procedures to ensure that they align with risk management strategy objectives and priorities, as well as the high-level direction of the cybersecurity policy",
    "Require approval from senior management on policy",
    "Communicate cybersecurity risk management policy and supporting processes and procedures across the organization",
    "Require personnel to acknowledge receipt of policy when first hired, annually, and whenever policy is updated",
  ],
  "GV.PO-02": [
    "Update policy based on periodic reviews of cybersecurity risk management results to ensure that policy and supporting processes and procedures adequately maintain risk at an acceptable level",
    "Provide a timeline for reviewing changes to the organization's risk environment (e.g., changes in risk or in the organization's mission objectives), and communicate recommended policy updates",
    "Update policy to reflect changes in legal and regulatory requirements",
    "Update policy to reflect changes in technology (e.g., adoption of artificial intelligence) and changes to the business (e.g., acquisition of a new business, new contract requirements)",
  ],
  // GV.OV - Oversight
  "GV.OV-01": [
    "Measure how well the risk management strategy and risk results have helped leaders make decisions and achieve organizational objectives",
    "Examine whether cybersecurity risk strategies that impede operations or innovation should be adjusted",
  ],
  "GV.OV-02": [
    "Review audit findings to confirm whether the existing cybersecurity strategy has ensured compliance with internal and external requirements",
    "Review the performance oversight of those in cybersecurity-related roles to determine whether policy changes are necessary",
    "Review strategy in light of cybersecurity incidents",
  ],
  "GV.OV-03": [
    "Review key performance indicators (KPIs) to ensure that organization-wide policies and procedures achieve objectives",
    "Review key risk indicators (KRIs) to identify risks the organization faces, including likelihood and potential impact",
    "Collect and communicate metrics on cybersecurity risk management with senior leadership",
  ],
  // GV.SC - Cybersecurity Supply Chain Risk Management
  "GV.SC-01": [
    "Establish a strategy that expresses the objectives of the cybersecurity supply chain risk management program",
    "Develop the cybersecurity supply chain risk management program, including a plan (with milestones), policies, and procedures that guide implementation and improvement of the program, and share the policies and procedures with the organizational stakeholders",
    "Develop and implement program processes based on the strategy, objectives, policies, and procedures that are agreed upon and performed by the organizational stakeholders",
    "Establish a cross-organizational mechanism that ensures alignment between functions that contribute to cybersecurity supply chain risk management, such as cybersecurity, IT, operations, legal, human resources, and engineering",
  ],
  "GV.SC-02": [
    "Identify one or more specific roles or positions that will be responsible and accountable for planning, resourcing, and executing cybersecurity supply chain risk management activities",
    "Document cybersecurity supply chain risk management roles and responsibilities in policy",
    "Create responsibility matrixes to document who will be responsible and accountable for cybersecurity supply chain risk management activities and how those teams and individuals will be consulted and informed",
    "Include cybersecurity supply chain risk management responsibilities and performance requirements in personnel descriptions to ensure clarity and improve accountability",
    "Document performance goals for personnel with cybersecurity risk management-specific responsibilities, and periodically measure them to demonstrate and improve performance",
    "Develop roles and responsibilities for suppliers, customers, and business partners to address shared responsibilities for applicable cybersecurity risks, and integrate them into organizational policies and applicable third-party agreements",
    "Internally communicate cybersecurity supply chain risk management roles and responsibilities for third parties",
    "Establish rules and protocols for information sharing and reporting processes between the organization and its suppliers",
  ],
  "GV.SC-03": [
    "Identify areas of alignment and overlap with cybersecurity and enterprise risk management",
    "Establish integrated control sets for cybersecurity risk management and cybersecurity supply chain risk management",
    "Integrate cybersecurity supply chain risk management into improvement processes",
    "Escalate material cybersecurity risks in supply chains to senior management, and address them at the enterprise risk management level",
  ],
  "GV.SC-04": [
    "Develop criteria for supplier criticality based on, for example, the sensitivity of data processed or possessed by suppliers, the degree of access to the organization's systems, and the importance of the products or services to the organization's mission",
    "Keep a record of all suppliers, and prioritize suppliers based on the criticality criteria",
  ],
  "GV.SC-05": [
    "Establish security requirements for suppliers, products, and services commensurate with their criticality level and potential impact if compromised",
    "Include all cybersecurity and supply chain requirements that third parties must follow and how compliance with the requirements may be verified in default contractual language",
    "Define the rules and protocols for information sharing between the organization and its suppliers and sub-tier suppliers in agreements",
    "Manage risk by including security requirements in agreements based on their criticality and potential impact if compromised",
    "Define security requirements in service-level agreements (SLAs) for monitoring suppliers for acceptable security performance throughout the supplier relationship lifecycle",
    "Contractually require suppliers to disclose cybersecurity features, functions, and vulnerabilities of their products and services for the life of the product or the term of service",
    "Contractually require suppliers to provide and maintain a current component inventory (e.g., software or hardware bill of materials) for critical products",
    "Contractually require suppliers to vet their employees and guard against insider threats",
    "Contractually require suppliers to provide evidence of performing acceptable security practices through, for example, self-attestation, conformance to known standards, certifications, or inspections",
    "Specify in contracts and other agreements the rights and responsibilities of the organization, its suppliers, and their supply chains, with respect to potential cybersecurity risks",
  ],
  "GV.SC-06": [
    "Perform thorough due diligence on prospective suppliers that is consistent with procurement planning and commensurate with the level of risk, criticality, and complexity of each supplier relationship",
    "Assess the suitability of the technology and cybersecurity capabilities and the risk management practices of prospective suppliers",
    "Conduct supplier risk assessments against business and applicable cybersecurity requirements",
    "Assess the authenticity, integrity, and security of critical products prior to acquisition and use",
  ],
  "GV.SC-07": [
    "Adjust assessment formats and frequencies based on the third party's reputation and the criticality of the products or services they provide",
    "Evaluate third parties' evidence of compliance with contractual cybersecurity requirements, such as self-attestations, warranties, certifications, and other artifacts",
    "Monitor critical suppliers to ensure that they are fulfilling their security obligations throughout the supplier relationship lifecycle using a variety of methods and techniques, such as inspections, audits, tests, or other forms of evaluation",
    "Monitor critical suppliers, services, and products for changes to their risk profiles, and reevaluate supplier criticality and risk impact accordingly",
    "Plan for unexpected supplier and supply chain-related interruptions to ensure business continuity",
  ],
  "GV.SC-08": [
    "Define and use rules and protocols for reporting incident response and recovery activities and the status between the organization and its suppliers",
    "Identify and document the roles and responsibilities of the organization and its suppliers for incident response",
    "Include critical suppliers in incident response exercises and simulations",
    "Define and coordinate crisis communication methods and protocols between the organization and its critical suppliers",
    "Conduct collaborative lessons learned sessions with critical suppliers",
  ],
  "GV.SC-09": [
    "Policies and procedures require provenance records for all acquired technology products and services",
    "Periodically provide risk reporting to leaders about how acquired components are proven to be untampered and authentic",
    "Communicate regularly among cybersecurity risk managers and operations personnel about the need to acquire software patches, updates, and upgrades only from authenticated and trustworthy software providers",
    "Review policies to ensure that they require approved supplier personnel to perform maintenance on supplier products",
    "Policies and procedure require checking upgrades to critical hardware for unauthorized changes",
  ],
  "GV.SC-10": [
    "Establish processes for terminating critical relationships under both normal and adverse circumstances",
    "Define and implement plans for component end-of-life maintenance support and obsolescence",
    "Verify that supplier access to organization resources is deactivated promptly when it is no longer needed",
    "Verify that assets containing the organization's data are returned or properly disposed of in a timely, controlled, and safe manner",
    "Develop and execute a plan for terminating or transitioning supplier relationships that takes supply chain security risk and resiliency into account",
    "Mitigate risks to data and systems created by supplier termination",
    "Manage data leakage risks associated with supplier termination",
  ],
  // ID.AM - Asset Management
  "ID.AM-01": [
    "Maintain inventories for all types of hardware, including IT, IoT, OT, and mobile devices",
    "Constantly monitor networks to detect new hardware and automatically update inventories",
  ],
  "ID.AM-02": [
    "Maintain inventories for all types of software and services, including commercial-off-the-shelf, open-source, custom applications, API services, and cloud-based applications and services",
    "Constantly monitor all platforms, including containers and virtual machines, for software and service inventory changes",
    "Maintain an inventory of the organization's systems",
  ],
  "ID.AM-03": [
    "Maintain baselines of communication and data flows within the organization's wired and wireless networks",
    "Maintain baselines of communication and data flows between the organization and third parties",
    "Maintain baselines of communication and data flows for the organization's infrastructure-as-a-service (IaaS) usage",
    "Maintain documentation of expected network ports, protocols, and services that are typically used among authorized systems",
  ],
  "ID.AM-04": [
    "Inventory all external services used by the organization, including third-party infrastructure-as-a-service (IaaS), platform-as-a-service (PaaS), and software-as-a-service (SaaS) offerings; APIs; and other externally hosted application services",
    "Update the inventory when a new external service is going to be utilized to ensure adequate cybersecurity risk management monitoring of the organization's use of that service",
  ],
  "ID.AM-05": [
    "Define criteria for prioritizing each class of assets",
    "Apply the prioritization criteria to assets",
    "Track the asset priorities and update them periodically or when significant changes to the organization occur",
  ],
  "ID.AM-07": [
    "Maintain a list of the designated data types of interest (e.g., personally identifiable information, protected health information, financial account numbers, organization intellectual property, operational technology data)",
    "Continuously discover and analyze ad hoc data to identify new instances of designated data types",
    "Assign data classifications to designated data types through tags or labels",
    "Track the provenance, data owner, and geolocation of each instance of designated data types",
  ],
  "ID.AM-08": [
    "Integrate cybersecurity considerations throughout the life cycles of systems, hardware, software, and services",
    "Integrate cybersecurity considerations into product life cycles",
    "Identify unofficial uses of technology to meet mission objectives (i.e., shadow IT)",
    "Periodically identify redundant systems, hardware, software, and services that unnecessarily increase the organization's attack surface",
    "Properly configure and secure systems, hardware, software, and services prior to their deployment in production",
    "Update inventories when systems, hardware, software, and services are moved or transferred within the organization",
    "Securely destroy stored data based on the organization's data retention policy using the prescribed destruction method, and keep and manage a record of the destructions",
    "Securely sanitize data storage when hardware is being retired, decommissioned, reassigned, or sent for repairs or replacement",
    "Offer methods for destroying paper, storage media, and other physical forms of data storage",
  ],
  // ID.RA - Risk Assessment
  "ID.RA-01": [
    "Use vulnerability management technologies to identify unpatched and misconfigured software",
    "Assess network and system architectures for design and implementation weaknesses that affect cybersecurity",
    "Review, analyze, or test organization-developed software to identify design, coding, and default configuration vulnerabilities",
    "Assess facilities that house critical computing assets for physical vulnerabilities and resilience issues",
    "Monitor sources of cyber threat intelligence for information on new vulnerabilities in products and services",
    "Review processes and procedures for weaknesses that could be exploited to affect cybersecurity",
  ],
  "ID.RA-02": [
    "Configure cybersecurity tools and technologies with detection or response capabilities to securely ingest cyber threat intelligence feeds",
    "Receive and review advisories from reputable third parties on current threat actors and their tactics, techniques, and procedures (TTPs)",
    "Monitor sources of cyber threat intelligence for information on the types of vulnerabilities that emerging technologies may have",
  ],
  "ID.RA-03": [
    "Use cyber threat intelligence to maintain awareness of the types of threat actors likely to target the organization and the TTPs they are likely to use",
    "Perform threat hunting to look for signs of threat actors within the environment",
    "Implement processes for identifying internal threat actors",
  ],
  "ID.RA-04": [
    "Business leaders and cybersecurity risk management practitioners work together to estimate the likelihood and impact of risk scenarios and record them in risk registers",
    "Enumerate the potential business impacts of unauthorized access to the organization's communications, systems, and data processed in or by those systems",
    "Account for the potential impacts of cascading failures for systems of systems",
  ],
  "ID.RA-05": [
    "Develop threat models to better understand risks to the data and identify appropriate risk responses",
    "Prioritize cybersecurity resource allocations and investments based on estimated likelihoods and impacts",
  ],
  "ID.RA-06": [
    "Apply the vulnerability management plan's criteria for deciding whether to accept, transfer, mitigate, or avoid risk",
    "Apply the vulnerability management plan's criteria for selecting compensating controls to mitigate risk",
    "Track the progress of risk response implementation (e.g., plan of action and milestones [POA&M], risk register, risk detail report)",
    "Use risk assessment findings to inform risk response decisions and actions",
    "Communicate planned risk responses to affected stakeholders in priority order",
  ],
  "ID.RA-07": [
    "Implement and follow procedures for the formal documentation, review, testing, and approval of proposed changes and requested exceptions",
    "Document the possible risks of making or not making each proposed change, and provide guidance on rolling back changes",
    "Document the risks related to each requested exception and the plan for responding to those risks",
    "Periodically review risks that were accepted based upon planned future actions or milestones",
  ],
  "ID.RA-08": [
    "Conduct vulnerability information sharing between the organization and its suppliers following the rules and protocols defined in contracts",
    "Assign responsibilities and verify the execution of procedures for processing, analyzing the impact of, and responding to cybersecurity threat, vulnerability, or incident disclosures by suppliers, customers, partners, and government cybersecurity organizations",
  ],
  "ID.RA-09": [
    "Assess the authenticity and cybersecurity of critical technology products and services prior to acquisition and use",
  ],
  "ID.RA-10": [
    "Conduct supplier risk assessments against business and applicable cybersecurity requirements, including the supply chain",
  ],
  // ID.IM - Improvement
  "ID.IM-01": [
    "Perform self-assessments of critical services that take current threats and TTPs into consideration",
    "Invest in third-party assessments or independent audits of the effectiveness of the organization's cybersecurity program to identify areas that need improvement",
    "Constantly evaluate compliance with selected cybersecurity requirements through automated means",
  ],
  "ID.IM-02": [
    "Identify improvements for future incident response activities based on findings from incident response assessments (e.g., tabletop exercises and simulations, tests, internal reviews, independent audits)",
    "Identify improvements for future business continuity, disaster recovery, and incident response activities based on exercises performed in coordination with critical service providers and product suppliers",
    "Involve internal stakeholders (e.g., senior executives, legal department, HR) in security tests and exercises as appropriate",
    "Perform penetration testing to identify opportunities to improve the security posture of selected high-risk systems as approved by leadership",
    "Exercise contingency plans for responding to and recovering from the discovery that products or services did not originate with the contracted supplier or partner or were altered before receipt",
    "Collect and analyze performance metrics using security tools and services to inform improvements to the cybersecurity program",
  ],
  "ID.IM-03": [
    "Conduct collaborative lessons learned sessions with suppliers",
    "Annually review cybersecurity policies, processes, and procedures to take lessons learned into account",
    "Use metrics to assess operational cybersecurity performance over time",
  ],
  "ID.IM-04": [
    "Establish contingency plans (e.g., incident response, business continuity, disaster recovery) for responding to and recovering from adverse events that can interfere with operations, expose confidential information, or otherwise endanger the organization's mission and viability",
    "Include contact and communication information, processes for handling common scenarios, and criteria for prioritization, escalation, and elevation in all contingency plans",
    "Create a vulnerability management plan to identify and assess all types of vulnerabilities and to prioritize, test, and implement risk responses",
    "Communicate cybersecurity plans (including updates) to those responsible for carrying them out and to affected parties",
    "Review and update all cybersecurity plans annually or when a need for significant improvements is identified",
  ],
  // PR.AA - Identity Management, Authentication, and Access Control
  "PR.AA-01": [
    "Initiate requests for new access or additional access for employees, contractors, and others, and track, review, and fulfill the requests, with permission from system or data owners when needed",
    "Issue, manage, and revoke cryptographic certificates and identity tokens, cryptographic keys (i.e., key management), and other credentials",
    "Select a unique identifier for each device from immutable hardware characteristics or an identifier securely provisioned to the device",
    "Physically label authorized hardware with an identifier for inventory and servicing purposes",
  ],
  "PR.AA-02": [
    "Verify a person's claimed identity at enrollment time using government-issued identity credentials (e.g., passport, visa, driver's license)",
    "Issue a different credential for each person (i.e., no credential sharing)",
  ],
  "PR.AA-03": [
    "Require multifactor authentication",
    "Enforce policies for the minimum strength of passwords, PINs, and similar authenticators",
    "Periodically reauthenticate users, services, and hardware based on risk (e.g., in zero trust architectures)",
    "Ensure that authorized personnel can access accounts essential for protecting safety under emergency conditions",
  ],
  "PR.AA-04": [
    "Protect identity assertions that are used to convey authentication and user information through single sign-on systems",
    "Protect identity assertions that are used to convey authentication and user information between federated systems",
    "Implement standards-based approaches for identity assertions in all contexts, and follow all guidance for the generation (e.g., data models, metadata), protection (e.g., digital signing, encryption), and verification (e.g., signature validation) of identity assertions",
  ],
  "PR.AA-05": [
    "Review logical and physical access privileges periodically and whenever someone changes roles or leaves the organization, and promptly rescind privileges that are no longer needed",
    "Take attributes of the requester and the requested resource into account for authorization decisions (e.g., geolocation, day/time, requester endpoint's cyber health)",
    "Restrict access and privileges to the minimum necessary (e.g., zero trust architecture)",
    "Periodically review the privileges associated with critical business functions to confirm proper separation of duties",
  ],
  "PR.AA-06": [
    "Use security guards, security cameras, locked entrances, alarm systems, and other physical controls to monitor facilities and restrict access",
    "Employ additional physical security controls for areas that contain high-risk assets",
    "Escort guests, vendors, and other third parties within areas that contain business-critical assets",
  ],
  // PR.AT - Awareness and Training
  "PR.AT-01": [
    "Provide basic cybersecurity awareness and training to employees, contractors, partners, suppliers, and all other users of the organization's non-public resources",
    "Train personnel to recognize social engineering attempts and other common attacks, report attacks and suspicious activity, comply with acceptable use policies, and perform basic cyber hygiene tasks (e.g., patching software, choosing passwords, protecting credentials)",
    "Explain the consequences of cybersecurity policy violations, both to individual users and the organization as a whole",
    "Periodically assess or test users on their understanding of basic cybersecurity practices",
    "Require annual refreshers to reinforce existing practices and introduce new practices",
  ],
  "PR.AT-02": [
    "Identify the specialized roles within the organization that require additional cybersecurity training, such as physical and cybersecurity personnel, finance personnel, senior leadership, and anyone with access to business-critical data",
    "Provide role-based cybersecurity awareness and training to all those in specialized roles, including contractors, partners, suppliers, and other third parties",
    "Periodically assess or test users on their understanding of cybersecurity practices for their specialized roles",
    "Require annual refreshers to reinforce existing practices and introduce new practices",
  ],
  // PR.DS - Data Security
  "PR.DS-01": [
    "Use encryption, digital signatures, and cryptographic hashes to protect the confidentiality and integrity of stored data in files, databases, virtual machine disk images, container images, and other resources",
    "Use full disk encryption to protect data stored on user endpoints",
    "Confirm the integrity of software by validating signatures",
    "Restrict the use of removable media to prevent data exfiltration",
    "Physically secure removable media containing unencrypted sensitive information, such as within locked offices or file cabinets",
  ],
  "PR.DS-02": [
    "Use encryption, digital signatures, and cryptographic hashes to protect the confidentiality and integrity of network communications",
    "Automatically encrypt or block outbound emails and other communications that contain sensitive data, depending on the data classification",
    "Block access to personal email, file sharing, file storage services, and other personal communications applications and services from organizational systems and networks",
    "Prevent reuse of sensitive data from production environments (e.g., customer records) in development, testing, and other non-production environments",
  ],
  "PR.DS-10": [
    "Remove data that must remain confidential (e.g., from processors and memory) as soon as it is no longer needed",
    "Protect data in use from access by other users and processes of the same platform",
  ],
  "PR.DS-11": [
    "Continuously back up critical data in near-real-time, and back up other data frequently at agreed-upon schedules",
    "Test backups and restores for all types of data sources at least annually",
    "Securely store some backups offline and offsite so that an incident or disaster will not damage them",
    "Enforce geographic separation and geolocation restrictions for data backup storage",
  ],
  // PR.PS - Platform Security
  "PR.PS-01": [
    "Establish, test, deploy, and maintain hardened baselines that enforce the organization's cybersecurity policies and provide only essential capabilities (i.e., principle of least functionality)",
    "Review all default configuration settings that may potentially impact cybersecurity when installing or upgrading software",
    "Monitor implemented software for deviations from approved baselines",
  ],
  "PR.PS-02": [
    "Perform routine and emergency patching within the timeframes specified in the vulnerability management plan",
    "Update container images, and deploy new container instances to replace rather than update existing instances",
    "Replace end-of-life software and service versions with supported, maintained versions",
    "Uninstall and remove unauthorized software and services that pose undue risks",
    "Uninstall and remove any unnecessary software components (e.g., operating system utilities) that attackers might misuse",
    "Define and implement plans for software and service end-of-life maintenance support and obsolescence",
  ],
  "PR.PS-03": [
    "Replace hardware when it lacks needed security capabilities or when it cannot support software with needed security capabilities",
    "Define and implement plans for hardware end-of-life maintenance support and obsolescence",
    "Perform hardware disposal in a secure, responsible, and auditable manner",
  ],
  "PR.PS-04": [
    "Configure all operating systems, applications, and services (including cloud-based services) to generate log records",
    "Configure log generators to securely share their logs with the organization's logging infrastructure systems and services",
    "Configure log generators to record the data needed by zero-trust architectures",
  ],
  "PR.PS-05": [
    "When risk warrants it, restrict software execution to permitted products only or deny the execution of prohibited and unauthorized software",
    "Verify the source of new software and the software's integrity before installing it",
    "Configure platforms to use only approved DNS services that block access to known malicious domains",
    "Configure platforms to allow the installation of organization-approved software only",
  ],
  "PR.PS-06": [
    "Protect all components of organization-developed software from tampering and unauthorized access",
    "Secure all software produced by the organization, with minimal vulnerabilities in their releases",
    "Maintain the software used in production environments, and securely dispose of software once it is no longer needed",
  ],
  // PR.IR - Technology Infrastructure Resilience
  "PR.IR-01": [
    "Logically segment organization networks and cloud-based platforms according to trust boundaries and platform types (e.g., IT, IoT, OT, mobile, guests), and permit required communications only between segments",
    "Logically segment organization networks from external networks, and permit only necessary communications to enter the organization's networks from the external networks",
    "Implement zero trust architectures to restrict network access to each resource to the minimum necessary",
    "Check the cyber health of endpoints before allowing them to access and use production resources",
  ],
  "PR.IR-02": [
    "Protect organizational equipment from known environmental threats, such as flooding, fire, wind, and excessive heat and humidity",
    "Include protection from environmental threats and provisions for adequate operating infrastructure in requirements for service providers that operate systems on the organization's behalf",
  ],
  "PR.IR-03": [
    "Avoid single points of failure in systems and infrastructure",
    "Use load balancing to increase capacity and improve reliability",
    "Use high-availability components like redundant storage and power supplies to improve system reliability",
  ],
  "PR.IR-04": [
    "Monitor usage of storage, power, compute, network bandwidth, and other resources",
    "Forecast future needs, and scale resources accordingly",
  ],
  // DE.CM - Continuous Monitoring
  "DE.CM-01": [
    "Monitor DNS, BGP, and other network services for adverse events",
    "Monitor wired and wireless networks for connections from unauthorized endpoints",
    "Monitor facilities for unauthorized or rogue wireless networks",
    "Compare actual network flows against baselines to detect deviations",
    "Monitor network communications to identify changes in security postures for zero trust purposes",
  ],
  "DE.CM-02": [
    "Monitor logs from physical access control systems (e.g., badge readers) to find unusual access patterns (e.g., deviations from the norm) and failed access attempts",
    "Review and monitor physical access records (e.g., from visitor registration, sign-in sheets)",
    "Monitor physical access controls (e.g., locks, latches, hinge pins, alarms) for signs of tampering",
    "Monitor the physical environment using alarm systems, cameras, and security guards",
  ],
  "DE.CM-03": [
    "Use behavior analytics software to detect anomalous user activity to mitigate insider threats",
    "Monitor logs from logical access control systems to find unusual access patterns and failed access attempts",
    "Continuously monitor deception technology, including user accounts, for any usage",
  ],
  "DE.CM-06": [
    "Monitor remote and onsite administration and maintenance activities that external providers perform on organizational systems",
    "Monitor activity from cloud-based services, internet service providers, and other service providers for deviations from expected behavior",
  ],
  "DE.CM-09": [
    "Monitor email, web, file sharing, collaboration services, and other common attack vectors to detect malware, phishing, data leaks and exfiltration, and other adverse events",
    "Monitor authentication attempts to identify attacks against credentials and unauthorized credential reuse",
    "Monitor software configurations for deviations from security baselines",
    "Monitor hardware and software for signs of tampering",
    "Use technologies with a presence on endpoints to detect cyber health issues (e.g., missing patches, malware infections, unauthorized software), and redirect the endpoints to a remediation environment before access is authorized",
  ],
  // DE.AE - Adverse Event Analysis
  "DE.AE-02": [
    "Use security information and event management (SIEM) or other tools to continuously monitor log events for known malicious and suspicious activity",
    "Utilize up-to-date cyber threat intelligence in log analysis tools to improve detection accuracy and characterize threat actors, their methods, and indicators of compromise",
    "Regularly conduct manual reviews of log events for technologies that cannot be sufficiently monitored through automation",
    "Use log analysis tools to generate reports on their findings",
  ],
  "DE.AE-03": [
    "Constantly transfer log data generated by other sources to a relatively small number of log servers",
    "Use event correlation technology (e.g., SIEM) to collect information captured by multiple sources",
    "Utilize cyber threat intelligence to help correlate events among log sources",
  ],
  "DE.AE-04": [
    "Use SIEMs or other tools to estimate impact and scope, and review and refine the estimates",
    "A person creates their own estimates of impact and scope",
  ],
  "DE.AE-06": [
    "Use cybersecurity software to generate alerts and provide them to the security operations center (SOC), incident responders, and incident response tools",
    "Incident responders and other authorized personnel can access log analysis findings at all times",
    "Automatically create and assign tickets in the organization's ticketing system when certain types of alerts occur",
    "Manually create and assign tickets in the organization's ticketing system when technical staff discover indicators of compromise",
  ],
  "DE.AE-07": [
    "Securely provide cyber threat intelligence feeds to detection technologies, processes, and personnel",
    "Securely provide information from asset inventories to detection technologies, processes, and personnel",
    "Rapidly acquire and analyze vulnerability disclosures for the organization's technologies from suppliers, vendors, and third-party security advisories",
  ],
  "DE.AE-08": [
    "Apply incident criteria to known and assumed characteristics of activity in order to determine whether an incident should be declared",
    "Take known false positives into account when applying incident criteria",
  ],
  // RS.MA - Incident Management
  "RS.MA-01": [
    "Detection technologies automatically report confirmed incidents",
    "Request incident response assistance from the organization's incident response outsourcer",
    "Designate an incident lead for each incident",
    "Initiate execution of additional cybersecurity plans as needed to support incident response (for example, business continuity and disaster recovery)",
  ],
  "RS.MA-02": [
    "Preliminarily review incident reports to confirm that they are cybersecurity-related and necessitate incident response activities",
    "Apply criteria to estimate the severity of an incident",
  ],
  "RS.MA-03": [
    "Further review and categorize incidents based on the type of incident (e.g., data breach, ransomware, DDoS, account compromise)",
    "Prioritize incidents based on their scope, likely impact, and time-critical nature",
    "Select incident response strategies for active incidents by balancing the need to quickly recover from an incident with the need to observe the attacker or conduct a more thorough investigation",
  ],
  "RS.MA-04": [
    "Track and validate the status of all ongoing incidents",
    "Coordinate incident escalation or elevation with designated internal and external stakeholders",
  ],
  "RS.MA-05": [
    "Apply incident recovery criteria to known and assumed characteristics of the incident to determine whether incident recovery processes should be initiated",
    "Take the possible operational disruption of incident recovery activities into account",
  ],
  // RS.AN - Incident Analysis
  "RS.AN-03": [
    "Determine the sequence of events that occurred during the incident and which assets and resources were involved in each event",
    "Attempt to determine what vulnerabilities, threats, and threat actors were directly or indirectly involved in the incident",
    "Analyze the incident to find the underlying, systemic root causes",
    "Check any cyber deception technology for additional information on attacker behavior",
  ],
  "RS.AN-06": [
    "Require each incident responder and others (e.g., system administrators, cybersecurity engineers) who perform incident response tasks to record their actions and make the record immutable",
    "Require the incident lead to document the incident in detail and be responsible for preserving the integrity of the documentation and the sources of all information being reported",
  ],
  "RS.AN-07": [
    "Collect, preserve, and safeguard the integrity of all pertinent incident data and metadata (e.g., data source, date/time of collection) based on evidence preservation and chain-of-custody procedures",
  ],
  "RS.AN-08": [
    "Review other potential targets of the incident to search for indicators of compromise and evidence of persistence",
    "Automatically run tools on targets to look for indicators of compromise and evidence of persistence",
  ],
  // RS.CO - Incident Response Reporting and Communication
  "RS.CO-02": [
    "Follow the organization's breach notification procedures after discovering a data breach incident, including notifying affected customers",
    "Notify business partners and customers of incidents in accordance with contractual requirements",
    "Notify law enforcement agencies and regulatory bodies of incidents based on criteria in the incident response plan and management approval",
  ],
  "RS.CO-03": [
    "Securely share information consistent with response plans and information sharing agreements",
    "Voluntarily share information about an attacker's observed TTPs, with all sensitive data removed, with an Information Sharing and Analysis Center (ISAC)",
    "Notify HR when malicious insider activity occurs",
    "Regularly update senior leadership on the status of major incidents",
    "Follow the rules and protocols defined in contracts for incident information sharing between the organization and its suppliers",
    "Coordinate crisis communication methods between the organization and its critical suppliers",
  ],
  // RS.MI - Incident Mitigation
  "RS.MI-01": [
    "Cybersecurity technologies (e.g., antivirus software) and cybersecurity features of other technologies (e.g., operating systems, network infrastructure devices) automatically perform containment actions",
    "Allow incident responders to manually select and perform containment actions",
    "Allow a third party (e.g., internet service provider, managed security service provider) to perform containment actions on behalf of the organization",
    "Automatically transfer compromised endpoints to a remediation virtual local area network (VLAN)",
  ],
  "RS.MI-02": [
    "Cybersecurity technologies and cybersecurity features of other technologies (e.g., operating systems, network infrastructure devices) automatically perform eradication actions",
    "Allow incident responders to manually select and perform eradication actions",
    "Allow a third party (e.g., managed security service provider) to perform eradication actions on behalf of the organization",
  ],
  // RC.RP - Incident Recovery Plan Execution
  "RC.RP-01": [
    "Begin recovery procedures during or after incident response processes",
    "Make all individuals with recovery responsibilities aware of the plans for recovery and the authorizations required to implement each aspect of the plans",
  ],
  "RC.RP-02": [
    "Select recovery actions based on the criteria defined in the incident response plan and available resources",
    "Change planned recovery actions based on a reassessment of organizational needs and resources",
  ],
  "RC.RP-03": [
    "Check restoration assets for indicators of compromise, file corruption, and other integrity issues before use",
  ],
  "RC.RP-04": [
    "Use business impact and system categorization records (including service delivery objectives) to validate that essential services are restored in the appropriate order",
    "Work with system owners to confirm the successful restoration of systems and the return to normal operations",
    "Monitor the performance of restored systems to verify the adequacy of the restoration",
  ],
  "RC.RP-05": [
    "Check restored assets for indicators of compromise and remediation of root causes of the incident before production use",
    "Verify the correctness and adequacy of the restoration actions taken before putting a restored system online",
  ],
  "RC.RP-06": [
    "Prepare an after-action report that documents the incident itself, the response and recovery actions taken, and lessons learned",
    "Declare the end of incident recovery once the criteria are met",
  ],
  // RC.CO - Incident Recovery Communication
  "RC.CO-03": [
    "Securely share recovery information, including restoration progress, consistent with response plans and information sharing agreements",
    "Regularly update senior leadership on recovery status and restoration progress for major incidents",
    "Follow the rules and protocols defined in contracts for incident information sharing between the organization and its suppliers",
    "Coordinate crisis communication between the organization and its critical suppliers",
  ],
  "RC.CO-04": [
    "Follow the organization's breach notification procedures for recovering from a data breach incident",
    "Explain the steps being taken to recover from the incident and to prevent a recurrence",
  ],
};

// NIST CSF 2.0 Subcategories (Level 3) - Complete list of 106 subcategories
export const NIST_CSF_2_SUBCATEGORIES = [
  // GV.OC - Organizational Context
  { code: "GV.OC-01", categoryCode: "GV.OC", name: "The organizational mission is understood and informs cybersecurity risk management", sortOrder: 1 },
  { code: "GV.OC-02", categoryCode: "GV.OC", name: "Internal and external stakeholders are understood, and their needs and expectations regarding cybersecurity risk management are understood and considered", sortOrder: 2 },
  { code: "GV.OC-03", categoryCode: "GV.OC", name: "Legal, regulatory, and contractual requirements regarding cybersecurity — including privacy and civil liberties obligations — are understood and managed", sortOrder: 3 },
  { code: "GV.OC-04", categoryCode: "GV.OC", name: "Critical objectives, capabilities, and services that external stakeholders depend on or expect from the organization are understood and communicated", sortOrder: 4 },
  { code: "GV.OC-05", categoryCode: "GV.OC", name: "Outcomes, capabilities, and services that the organization depends on are understood and communicated", sortOrder: 5 },

  // GV.RM - Risk Management Strategy
  { code: "GV.RM-01", categoryCode: "GV.RM", name: "Risk management objectives are established and agreed to by organizational stakeholders", sortOrder: 1 },
  { code: "GV.RM-02", categoryCode: "GV.RM", name: "Risk appetite and risk tolerance statements are established, communicated, and maintained", sortOrder: 2 },
  { code: "GV.RM-03", categoryCode: "GV.RM", name: "Cybersecurity risk management activities and outcomes are included in enterprise risk management processes", sortOrder: 3 },
  { code: "GV.RM-04", categoryCode: "GV.RM", name: "Strategic direction that describes appropriate risk response options is established and communicated", sortOrder: 4 },
  { code: "GV.RM-05", categoryCode: "GV.RM", name: "Lines of communication across the organization are established for cybersecurity risks, including risks from suppliers and other third parties", sortOrder: 5 },
  { code: "GV.RM-06", categoryCode: "GV.RM", name: "A standardized method for calculating, documenting, categorizing, and prioritizing cybersecurity risks is established and communicated", sortOrder: 6 },
  { code: "GV.RM-07", categoryCode: "GV.RM", name: "Strategic opportunities (i.e., positive risks) are characterized and are included in organizational cybersecurity risk discussions", sortOrder: 7 },

  // GV.RR - Roles, Responsibilities, and Authorities
  { code: "GV.RR-01", categoryCode: "GV.RR", name: "Organizational leadership is responsible and accountable for cybersecurity risk and fosters a culture that is risk-aware, ethical, and continually improving", sortOrder: 1 },
  { code: "GV.RR-02", categoryCode: "GV.RR", name: "Roles, responsibilities, and authorities related to cybersecurity risk management are established, communicated, understood, and enforced", sortOrder: 2 },
  { code: "GV.RR-03", categoryCode: "GV.RR", name: "Adequate resources are allocated commensurate with the cybersecurity risk strategy, roles, responsibilities, and policies", sortOrder: 3 },
  { code: "GV.RR-04", categoryCode: "GV.RR", name: "Cybersecurity is included in human resources practices", sortOrder: 4 },

  // GV.PO - Policy
  { code: "GV.PO-01", categoryCode: "GV.PO", name: "Policy for managing cybersecurity risks is established based on organizational context, cybersecurity strategy, and priorities and is communicated and enforced", sortOrder: 1 },
  { code: "GV.PO-02", categoryCode: "GV.PO", name: "Policy for managing cybersecurity risks is reviewed, updated, communicated, and enforced to reflect changes in requirements, threats, technology, and organizational mission", sortOrder: 2 },

  // GV.OV - Oversight
  { code: "GV.OV-01", categoryCode: "GV.OV", name: "Cybersecurity risk management strategy outcomes are reviewed to inform and adjust strategy and direction", sortOrder: 1 },
  { code: "GV.OV-02", categoryCode: "GV.OV", name: "The cybersecurity risk management strategy is reviewed and adjusted to ensure coverage of organizational requirements and risks", sortOrder: 2 },
  { code: "GV.OV-03", categoryCode: "GV.OV", name: "Organizational cybersecurity risk management performance is evaluated and reviewed for adjustments needed", sortOrder: 3 },

  // GV.SC - Cybersecurity Supply Chain Risk Management
  { code: "GV.SC-01", categoryCode: "GV.SC", name: "A cybersecurity supply chain risk management program, strategy, objectives, policies, and processes are established and agreed to by organizational stakeholders", sortOrder: 1 },
  { code: "GV.SC-02", categoryCode: "GV.SC", name: "Cybersecurity roles and responsibilities for suppliers, customers, and partners are established, communicated, and coordinated internally and externally", sortOrder: 2 },
  { code: "GV.SC-03", categoryCode: "GV.SC", name: "Cybersecurity supply chain risk management is integrated into cybersecurity and enterprise risk management, risk assessment, and improvement processes", sortOrder: 3 },
  { code: "GV.SC-04", categoryCode: "GV.SC", name: "Suppliers are known and prioritized by criticality", sortOrder: 4 },
  { code: "GV.SC-05", categoryCode: "GV.SC", name: "Requirements to address cybersecurity risks in supply chains are established, prioritized, and integrated into contracts and other agreements with suppliers and other relevant third parties", sortOrder: 5 },
  { code: "GV.SC-06", categoryCode: "GV.SC", name: "Planning and due diligence are performed to reduce risks before entering into formal supplier or other third-party relationships", sortOrder: 6 },
  { code: "GV.SC-07", categoryCode: "GV.SC", name: "The risks posed by a supplier, their products and services, and other third parties are identified, recorded, prioritized, assessed, responded to, and monitored over the course of the relationship", sortOrder: 7 },
  { code: "GV.SC-08", categoryCode: "GV.SC", name: "Relevant suppliers and other third parties are included in incident planning, response, and recovery activities", sortOrder: 8 },
  { code: "GV.SC-09", categoryCode: "GV.SC", name: "Supply chain security practices are integrated into cybersecurity and enterprise risk management programs, and their performance is monitored throughout the technology product and service life cycle", sortOrder: 9 },
  { code: "GV.SC-10", categoryCode: "GV.SC", name: "Cybersecurity supply chain risk management plans include provisions for activities that occur after the conclusion of a partnership or service agreement", sortOrder: 10 },

  // ID.AM - Asset Management
  { code: "ID.AM-01", categoryCode: "ID.AM", name: "Inventories of hardware managed by the organization are maintained", sortOrder: 1 },
  { code: "ID.AM-02", categoryCode: "ID.AM", name: "Inventories of software, services, and systems managed by the organization are maintained", sortOrder: 2 },
  { code: "ID.AM-03", categoryCode: "ID.AM", name: "Representations of the organization's authorized network communication and internal and external network data flows are maintained", sortOrder: 3 },
  { code: "ID.AM-04", categoryCode: "ID.AM", name: "Inventories of services provided by suppliers are maintained", sortOrder: 4 },
  { code: "ID.AM-05", categoryCode: "ID.AM", name: "Assets are prioritized based on classification, criticality, resources, and impact on the mission", sortOrder: 5 },
  { code: "ID.AM-07", categoryCode: "ID.AM", name: "Inventories of data and corresponding metadata for designated data types are maintained", sortOrder: 6 },
  { code: "ID.AM-08", categoryCode: "ID.AM", name: "Systems, hardware, software, services, and data are managed throughout their life cycles", sortOrder: 7 },

  // ID.RA - Risk Assessment
  { code: "ID.RA-01", categoryCode: "ID.RA", name: "Vulnerabilities in assets are identified, validated, and recorded", sortOrder: 1 },
  { code: "ID.RA-02", categoryCode: "ID.RA", name: "Cyber threat intelligence is received from information sharing forums and sources", sortOrder: 2 },
  { code: "ID.RA-03", categoryCode: "ID.RA", name: "Internal and external threats to the organization are identified and recorded", sortOrder: 3 },
  { code: "ID.RA-04", categoryCode: "ID.RA", name: "Potential impacts and likelihoods of threats exploiting vulnerabilities are identified and recorded", sortOrder: 4 },
  { code: "ID.RA-05", categoryCode: "ID.RA", name: "Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent risk and inform risk response prioritization", sortOrder: 5 },
  { code: "ID.RA-06", categoryCode: "ID.RA", name: "Risk responses are chosen, prioritized, planned, tracked, and communicated", sortOrder: 6 },
  { code: "ID.RA-07", categoryCode: "ID.RA", name: "Changes and exceptions are managed, assessed for risk impact, recorded, and tracked", sortOrder: 7 },
  { code: "ID.RA-08", categoryCode: "ID.RA", name: "Processes for receiving, analyzing, and responding to vulnerability disclosures are established", sortOrder: 8 },
  { code: "ID.RA-09", categoryCode: "ID.RA", name: "The authenticity and integrity of hardware and software are assessed prior to acquisition and use", sortOrder: 9 },
  { code: "ID.RA-10", categoryCode: "ID.RA", name: "Critical suppliers are assessed prior to acquisition", sortOrder: 10 },

  // ID.IM - Improvement
  { code: "ID.IM-01", categoryCode: "ID.IM", name: "Improvements are identified from evaluations", sortOrder: 1 },
  { code: "ID.IM-02", categoryCode: "ID.IM", name: "Improvements are identified from security tests and exercises, including those done in coordination with suppliers and relevant third parties", sortOrder: 2 },
  { code: "ID.IM-03", categoryCode: "ID.IM", name: "Improvements are identified from execution of operational processes, procedures, and activities", sortOrder: 3 },
  { code: "ID.IM-04", categoryCode: "ID.IM", name: "Incident response plans and other cybersecurity plans that affect operations are established, communicated, maintained, and improved", sortOrder: 4 },

  // PR.AA - Identity Management, Authentication, and Access Control
  { code: "PR.AA-01", categoryCode: "PR.AA", name: "Identities and credentials for authorized users, services, and hardware are managed by the organization", sortOrder: 1 },
  { code: "PR.AA-02", categoryCode: "PR.AA", name: "Identities are proofed and bound to credentials based on the context of interactions", sortOrder: 2 },
  { code: "PR.AA-03", categoryCode: "PR.AA", name: "Users, services, and hardware are authenticated", sortOrder: 3 },
  { code: "PR.AA-04", categoryCode: "PR.AA", name: "Identity assertions are protected, conveyed, and verified", sortOrder: 4 },
  { code: "PR.AA-05", categoryCode: "PR.AA", name: "Access permissions, entitlements, and authorizations are defined in a policy, managed, enforced, and reviewed, and incorporate the principles of least privilege and separation of duties", sortOrder: 5 },
  { code: "PR.AA-06", categoryCode: "PR.AA", name: "Physical access to assets is managed, monitored, and enforced commensurate with risk", sortOrder: 6 },

  // PR.AT - Awareness and Training
  { code: "PR.AT-01", categoryCode: "PR.AT", name: "Personnel are provided with awareness and training so that they possess the knowledge and skills to perform general tasks with cybersecurity risks in mind", sortOrder: 1 },
  { code: "PR.AT-02", categoryCode: "PR.AT", name: "Individuals in specialized roles are provided with awareness and training so that they possess the knowledge and skills to perform relevant tasks with cybersecurity risks in mind", sortOrder: 2 },

  // PR.DS - Data Security
  { code: "PR.DS-01", categoryCode: "PR.DS", name: "The confidentiality, integrity, and availability of data-at-rest are protected", sortOrder: 1 },
  { code: "PR.DS-02", categoryCode: "PR.DS", name: "The confidentiality, integrity, and availability of data-in-transit are protected", sortOrder: 2 },
  { code: "PR.DS-10", categoryCode: "PR.DS", name: "The confidentiality, integrity, and availability of data-in-use are protected", sortOrder: 3 },
  { code: "PR.DS-11", categoryCode: "PR.DS", name: "Backups of data are created, protected, maintained, and tested", sortOrder: 4 },

  // PR.PS - Platform Security
  { code: "PR.PS-01", categoryCode: "PR.PS", name: "Configuration management practices are established and applied", sortOrder: 1 },
  { code: "PR.PS-02", categoryCode: "PR.PS", name: "Software is maintained, replaced, and removed commensurate with risk", sortOrder: 2 },
  { code: "PR.PS-03", categoryCode: "PR.PS", name: "Hardware is maintained, replaced, and removed commensurate with risk", sortOrder: 3 },
  { code: "PR.PS-04", categoryCode: "PR.PS", name: "Log records are generated and made available for continuous monitoring", sortOrder: 4 },
  { code: "PR.PS-05", categoryCode: "PR.PS", name: "Installation and execution of unauthorized software are prevented", sortOrder: 5 },
  { code: "PR.PS-06", categoryCode: "PR.PS", name: "Secure software development practices are integrated, and their performance is monitored throughout the software development life cycle", sortOrder: 6 },

  // PR.IR - Technology Infrastructure Resilience
  { code: "PR.IR-01", categoryCode: "PR.IR", name: "Networks and environments are protected from unauthorized logical access and usage", sortOrder: 1 },
  { code: "PR.IR-02", categoryCode: "PR.IR", name: "The organization's technology assets are protected from environmental threats", sortOrder: 2 },
  { code: "PR.IR-03", categoryCode: "PR.IR", name: "Mechanisms are implemented to achieve resilience requirements in normal and adverse situations", sortOrder: 3 },
  { code: "PR.IR-04", categoryCode: "PR.IR", name: "Adequate resource capacity to ensure availability is maintained", sortOrder: 4 },

  // DE.CM - Continuous Monitoring
  { code: "DE.CM-01", categoryCode: "DE.CM", name: "Networks and network services are monitored to find potentially adverse events", sortOrder: 1 },
  { code: "DE.CM-02", categoryCode: "DE.CM", name: "The physical environment is monitored to find potentially adverse events", sortOrder: 2 },
  { code: "DE.CM-03", categoryCode: "DE.CM", name: "Personnel activity and technology usage are monitored to find potentially adverse events", sortOrder: 3 },
  { code: "DE.CM-06", categoryCode: "DE.CM", name: "External service provider activities and services are monitored to find potentially adverse events", sortOrder: 4 },
  { code: "DE.CM-09", categoryCode: "DE.CM", name: "Computing hardware and software, runtime environments, and their data are monitored to find potentially adverse events", sortOrder: 5 },

  // DE.AE - Adverse Event Analysis
  { code: "DE.AE-02", categoryCode: "DE.AE", name: "Potentially adverse events are analyzed to better understand associated activities", sortOrder: 1 },
  { code: "DE.AE-03", categoryCode: "DE.AE", name: "Information is correlated from multiple sources", sortOrder: 2 },
  { code: "DE.AE-04", categoryCode: "DE.AE", name: "The estimated impact and scope of adverse events are understood", sortOrder: 3 },
  { code: "DE.AE-06", categoryCode: "DE.AE", name: "Information on adverse events is provided to authorized staff and tools", sortOrder: 4 },
  { code: "DE.AE-07", categoryCode: "DE.AE", name: "Cyber threat intelligence and other contextual information are integrated into the analysis", sortOrder: 5 },
  { code: "DE.AE-08", categoryCode: "DE.AE", name: "Incidents are declared when adverse events meet the defined incident criteria", sortOrder: 6 },

  // RS.MA - Incident Management
  { code: "RS.MA-01", categoryCode: "RS.MA", name: "The incident response plan is executed in coordination with relevant third parties once an incident is declared", sortOrder: 1 },
  { code: "RS.MA-02", categoryCode: "RS.MA", name: "Incident reports are triaged and validated", sortOrder: 2 },
  { code: "RS.MA-03", categoryCode: "RS.MA", name: "Incidents are categorized and prioritized", sortOrder: 3 },
  { code: "RS.MA-04", categoryCode: "RS.MA", name: "Incidents are escalated or elevated as needed", sortOrder: 4 },
  { code: "RS.MA-05", categoryCode: "RS.MA", name: "The criteria for initiating incident recovery are applied", sortOrder: 5 },

  // RS.AN - Incident Analysis
  { code: "RS.AN-03", categoryCode: "RS.AN", name: "Analysis is performed to establish what has taken place during an incident and the root cause of the incident", sortOrder: 1 },
  { code: "RS.AN-06", categoryCode: "RS.AN", name: "Actions performed during an investigation are recorded, and the records' integrity and provenance are preserved", sortOrder: 2 },
  { code: "RS.AN-07", categoryCode: "RS.AN", name: "Incident data and metadata are collected, and their integrity and provenance are preserved", sortOrder: 3 },
  { code: "RS.AN-08", categoryCode: "RS.AN", name: "An incident's magnitude is estimated and validated", sortOrder: 4 },

  // RS.CO - Incident Response Reporting and Communication
  { code: "RS.CO-02", categoryCode: "RS.CO", name: "Internal and external stakeholders are notified of incidents", sortOrder: 1 },
  { code: "RS.CO-03", categoryCode: "RS.CO", name: "Information is shared with designated internal and external stakeholders", sortOrder: 2 },

  // RS.MI - Incident Mitigation
  { code: "RS.MI-01", categoryCode: "RS.MI", name: "Incidents are contained", sortOrder: 1 },
  { code: "RS.MI-02", categoryCode: "RS.MI", name: "Incidents are eradicated", sortOrder: 2 },

  // RC.RP - Incident Recovery Plan Execution
  { code: "RC.RP-01", categoryCode: "RC.RP", name: "The recovery portion of the incident response plan is executed once initiated from the incident response process", sortOrder: 1 },
  { code: "RC.RP-02", categoryCode: "RC.RP", name: "Recovery actions are selected, scoped, prioritized, and performed", sortOrder: 2 },
  { code: "RC.RP-03", categoryCode: "RC.RP", name: "The integrity of backups and other restoration assets is verified before using them for restoration", sortOrder: 3 },
  { code: "RC.RP-04", categoryCode: "RC.RP", name: "Critical mission functions and cybersecurity risk management are considered to establish post-incident operational norms", sortOrder: 4 },
  { code: "RC.RP-05", categoryCode: "RC.RP", name: "The integrity of restored assets is verified, systems and services are restored, and normal operations are confirmed", sortOrder: 5 },
  { code: "RC.RP-06", categoryCode: "RC.RP", name: "The end of incident recovery is declared based on criteria, and incident-related documentation is completed", sortOrder: 6 },

  // RC.CO - Incident Recovery Communication
  { code: "RC.CO-03", categoryCode: "RC.CO", name: "Recovery activities and progress in restoring operational capabilities are communicated to designated internal and external stakeholders", sortOrder: 1 },
  { code: "RC.CO-04", categoryCode: "RC.CO", name: "Public updates on incident recovery are shared using approved methods and messaging", sortOrder: 2 },
];

/**
 * Seed the NIST CSF 2.0 framework
 */
export async function seedNistCsf2Framework(prisma: PrismaClient): Promise<string> {
  console.log("Creating NIST CSF 2.0 Framework...");

  // Check if framework already exists (system templates have null organizationId)
  let framework = await prisma.maturityFramework.findFirst({
    where: {
      type: "NIST_CSF_2",
      version: "2.0",
      isSystemTemplate: true,
      organizationId: null,
    },
  });

  if (!framework) {
    // Create the framework
    framework = await prisma.maturityFramework.create({
      data: {
        type: "NIST_CSF_2",
        name: "NIST Cybersecurity Framework 2.0",
        version: "2.0",
        description:
          "The NIST Cybersecurity Framework (CSF) 2.0 provides a comprehensive and flexible approach for organizations to understand, assess, prioritize, and communicate cybersecurity risks. It consists of six Functions (Govern, Identify, Protect, Detect, Respond, Recover), 22 Categories, and 106 Subcategories.",
        minLevel: 1,
        maxLevel: 4,
        scoringLevels: NIST_CSF_2_TIERS,
        isActive: true,
        isSystemTemplate: true,
        organizationId: null,
      },
    });
  }

  console.log(`Created framework: ${framework.name} (${framework.id})`);

  // Create Functions (Level 1 domains)
  const functionMap = new Map<string, string>();
  for (const func of NIST_CSF_2_FUNCTIONS) {
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
    console.log(`  Created Function: ${func.code} - ${func.name}`);
  }

  // Create Categories (Level 2 domains)
  const categoryMap = new Map<string, string>();
  for (const cat of NIST_CSF_2_CATEGORIES) {
    const parentId = functionMap.get(cat.functionCode);
    if (!parentId) {
      console.warn(`  Warning: Parent function ${cat.functionCode} not found for category ${cat.code}`);
      continue;
    }

    const domain = await prisma.maturityDomain.upsert({
      where: {
        frameworkId_code: {
          frameworkId: framework.id,
          code: cat.code,
        },
      },
      update: {},
      create: {
        frameworkId: framework.id,
        code: cat.code,
        name: cat.name,
        description: cat.description,
        level: "CATEGORY" as AssessmentDepth,
        sortOrder: cat.sortOrder,
        parentId: parentId,
      },
    });
    categoryMap.set(cat.code, domain.id);
  }
  console.log(`  Created ${NIST_CSF_2_CATEGORIES.length} Categories`);

  // Create Subcategories (Level 3 domains)
  for (const sub of NIST_CSF_2_SUBCATEGORIES) {
    const parentId = categoryMap.get(sub.categoryCode);
    if (!parentId) {
      console.warn(`  Warning: Parent category ${sub.categoryCode} not found for subcategory ${sub.code}`);
      continue;
    }

    // Build description from implementation examples
    const examples = IMPLEMENTATION_EXAMPLES[sub.code];
    const description = examples
      ? "Implementation Examples:\n" + examples.map((ex) => `- ${ex}`).join("\n")
      : null;

    await prisma.maturityDomain.upsert({
      where: {
        frameworkId_code: {
          frameworkId: framework.id,
          code: sub.code,
        },
      },
      update: {
        description,
      },
      create: {
        frameworkId: framework.id,
        code: sub.code,
        name: sub.name,
        description,
        level: "SUBCATEGORY" as AssessmentDepth,
        sortOrder: sub.sortOrder,
        parentId: parentId,
      },
    });
  }
  console.log(`  Created ${NIST_CSF_2_SUBCATEGORIES.length} Subcategories`);

  console.log(`NIST CSF 2.0 Framework seeded successfully!\n`);
  return framework.id;
}
