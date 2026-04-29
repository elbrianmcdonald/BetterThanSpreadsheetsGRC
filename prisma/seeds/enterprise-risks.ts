import type { PrismaClient } from '@prisma/client';

export const ENTERPRISE_RISK_BASELINES: Array<{
  name: string;
  description: string;
}> = [
  { name: 'Subsidiary & Business Partner Risk', description: 'Risks introduced by subsidiaries, suppliers, or business partners — including contract, dependency, and oversight failures.' },
  { name: 'Disruption of Critical IT Services', description: 'Loss of availability of business-critical IT services (outages, capacity, infrastructure failure).' },
  { name: 'New Acquisition Risk', description: 'Integration, due-diligence, and inherited control risks from M&A activity.' },
  { name: 'Data Breach / Privacy Incident', description: 'Unauthorized disclosure or loss of sensitive, regulated, or personal data.' },
  { name: 'Financial Loss due to Fraud', description: 'Internal or external fraud causing direct financial loss.' },
  { name: 'System Compromise', description: 'Compromise of organizational systems through intrusion, malware, or credential abuse.' },
  { name: 'Physical Harm to People', description: 'Threats to the safety and physical wellbeing of employees, customers, or the public.' },
  { name: 'Physical Harm to Environment', description: 'Damage or harm to the natural or built environment.' },
  { name: 'Loss of Payment Processing', description: 'Inability to authorize or settle payments — direct revenue and operational impact.' },
  { name: 'Major Reputational Loss', description: 'Events causing significant brand, trust, or stakeholder confidence damage.' },
];

export async function seedEnterpriseRisks(
  prisma: PrismaClient,
  organizationId: string
): Promise<{ count: number }> {
  for (const baseline of ENTERPRISE_RISK_BASELINES) {
    await prisma.enterpriseRisk.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: baseline.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: baseline.name,
        description: baseline.description,
      },
    });
  }
  return { count: ENTERPRISE_RISK_BASELINES.length };
}
