"use client";

import Link from "next/link";
import {
  BookCheck,
  Building2,
  ShieldAlert,
  Gauge,
  ArrowRight,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout";
import { api } from "@/trpc/react";

interface AssessmentCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  count: number | undefined;
  isLoading: boolean;
  isError: boolean;
}

function AssessmentCard({
  title,
  description,
  href,
  icon: Icon,
  iconBgClass,
  iconColorClass,
  count,
  isLoading,
  isError,
}: AssessmentCardProps) {
  const isEmpty = !isLoading && !isError && count === 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`rounded-md p-2 ${iconBgClass}`}>
            <Icon className={`h-[17px] w-[17px] ${iconColorClass}`} />
          </div>
          <div>
            <CardTitle className="text-[15px] font-bold">{title}</CardTitle>
            <CardDescription className="text-[13px] text-muted-foreground">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground">Unable to load count</p>
          ) : (
            <div>
              <div className="text-3xl font-bold tabular-nums text-foreground">
                {count ?? 0}
              </div>
              <div className="eyebrow mt-1">
                {count === 1 ? "assessment" : "assessments"}
              </div>
            </div>
          )}
        </div>
        <Button asChild variant={isEmpty ? "default" : "outline"} className="w-full">
          <Link href={href}>
            {isEmpty ? "Get started" : "Open"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function AssessmentsOverviewClient() {
  const complianceQuery = api.complianceAssessment.list.useQuery(
    { pageSize: 1 },
    { retry: false },
  );
  const vendorQuery = api.vendorAssessment.list.useQuery(
    { pageSize: 1 },
    { retry: false },
  );
  const riskQuery = api.riskAssessmentProject.list.useQuery(
    { limit: 1 },
    { retry: false },
  );
  const maturityQuery = api.maturity.list.useQuery(
    { pageSize: 1 },
    { retry: false },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ASSESSMENTS"
        title="Assessments"
        icon={<BookCheck />}
        description="All assessment programs in one place — Compliance, Vendor, Risk, and Maturity."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AssessmentCard
          title="Compliance Assessments"
          description="Framework-based control assessments (NIST, ISO, SOC 2)"
          href="/compliance/assessments"
          icon={BookCheck}
          iconBgClass="bg-primary/10"
          iconColorClass="text-primary"
          count={complianceQuery.data?.pagination.total}
          isLoading={complianceQuery.isLoading}
          isError={complianceQuery.isError}
        />
        <AssessmentCard
          title="Vendor Assessments"
          description="Third-party risk reviews and due diligence"
          href="/tprm/assessments"
          icon={Building2}
          iconBgClass="bg-primary/10"
          iconColorClass="text-primary"
          count={vendorQuery.data?.totalCount}
          isLoading={vendorQuery.isLoading}
          isError={vendorQuery.isError}
        />
        <AssessmentCard
          title="Risk Assessments"
          description="Qualitative and quantitative risk scoring"
          href="/risk-assessments"
          icon={ShieldAlert}
          iconBgClass="bg-primary/10"
          iconColorClass="text-primary"
          count={riskQuery.data?.total}
          isLoading={riskQuery.isLoading}
          isError={riskQuery.isError}
        />
        <AssessmentCard
          title="Maturity Assessments"
          description="Capability maturity models (NIST CSF 2.0, C2M2)"
          href="/maturity/dashboard"
          icon={Gauge}
          iconBgClass="bg-primary/10"
          iconColorClass="text-primary"
          count={maturityQuery.data?.pagination.total}
          isLoading={maturityQuery.isLoading}
          isError={maturityQuery.isError}
        />
      </div>
    </div>
  );
}
