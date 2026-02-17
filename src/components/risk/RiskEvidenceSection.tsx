"use client";

/**
 * Risk Evidence Section Component
 *
 * Displays evidence files linked to a risk, organized by link type
 * (Finding vs Remediation evidence).
 *
 * @see Story 3.6: AC7-AC14 - Evidence Linking UI on Risk Detail Page
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Link2,
  Unlink,
  Search,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  ExternalLink,
} from "lucide-react";
import { formatFileSize } from "@/utils/file-validation";
import { formatDate } from "@/utils/date-format";
import { useSession } from "next-auth/react";
import { UserRole, type RiskEvidenceLinkType } from "@prisma/client";
import toast from "react-hot-toast";
import { LinkEvidenceModal } from "./LinkEvidenceModal";

interface RiskEvidenceSectionProps {
  /** Risk ID to display evidence for */
  riskId: string;
  /** Whether to show action buttons (link/unlink) */
  showActions?: boolean;
}

interface EvidenceItem {
  id: string;
  title: string;
  originalFileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: Date;
  linkedAt: Date;
  linkedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  linkType: RiskEvidenceLinkType;
  isActive: boolean;
}

/** Roles that can link/unlink evidence */
const CAN_LINK_ROLES: UserRole[] = [
  UserRole.SECURITY_ENGINEER,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.IT_STAKEHOLDER,
];

/**
 * Evidence Card Component
 */
function EvidenceCard({
  evidence,
  onUnlink,
  canUnlink,
  isUnlinking,
}: {
  evidence: EvidenceItem;
  onUnlink: () => void;
  canUnlink: boolean;
  isUnlinking: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
        !evidence.isActive ? "opacity-60 bg-gray-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <a
              href={`/evidence/${evidence.id}`}
              className="font-medium text-gray-900 hover:text-blue-600 hover:underline truncate"
            >
              {evidence.title}
            </a>
            {!evidence.isActive && (
              <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                Deleted
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate mb-2">
            {evidence.originalFileName} ({formatFileSize(evidence.fileSize)})
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Linked {formatDate(evidence.linkedAt)}
            </span>
            {evidence.linkedBy && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {evidence.linkedBy.name || evidence.linkedBy.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`/evidence/${evidence.id}`}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="View evidence details"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          {canUnlink && evidence.isActive && (
            <button
              onClick={onUnlink}
              disabled={isUnlinking}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
              title="Unlink evidence"
            >
              <Unlink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Evidence Group Component (Finding or Remediation)
 */
function EvidenceGroup({
  title,
  icon: Icon,
  iconColor,
  evidence,
  emptyMessage,
  onUnlink,
  canUnlink,
  unlinkingId,
}: {
  title: string;
  icon: typeof AlertTriangle;
  iconColor: string;
  evidence: EvidenceItem[];
  emptyMessage: string;
  onUnlink: (evidenceId: string) => void;
  canUnlink: boolean;
  unlinkingId: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <h4 className="font-medium text-gray-900">{title}</h4>
        <Badge variant="secondary" className="ml-auto">
          {evidence.length}
        </Badge>
      </div>
      {evidence.length === 0 ? (
        <p className="text-sm text-gray-500 italic py-4 text-center border border-dashed rounded-lg">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-2">
          {evidence.map((item) => (
            <EvidenceCard
              key={item.id}
              evidence={item}
              onUnlink={() => onUnlink(item.id)}
              canUnlink={canUnlink}
              isUnlinking={unlinkingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RiskEvidenceSection({
  riskId,
  showActions = true,
}: RiskEvidenceSectionProps) {
  const { data: session } = useSession();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const utils = api.useUtils();

  // Check if user can link/unlink evidence
  const userRole = session?.user?.role as UserRole | undefined;
  const canLink = userRole && CAN_LINK_ROLES.includes(userRole);

  // Fetch linked evidence
  const { data, isLoading, error } = api.risk.getRiskEvidence.useQuery(
    { riskId },
    { enabled: !!riskId }
  );

  // Unlink mutation
  const unlinkMutation = api.risk.unlinkEvidenceFromRisk.useMutation({
    onMutate: () => {
      // Optimistic update handled by setUnlinkingId
    },
    onSuccess: () => {
      toast.success("Evidence unlinked successfully");
      void utils.risk.getRiskEvidence.invalidate({ riskId });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to unlink evidence");
    },
    onSettled: () => {
      setUnlinkingId(null);
    },
  });

  const handleUnlink = (evidenceId: string) => {
    setUnlinkingId(evidenceId);
    unlinkMutation.mutate({ riskId, evidenceId });
  };

  const handleLinkSuccess = () => {
    setIsLinkModalOpen(false);
    void utils.risk.getRiskEvidence.invalidate({ riskId });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-blue-500" />
            Linked Evidence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-blue-500" />
            Linked Evidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-sm">
            Failed to load linked evidence: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-blue-500" />
            Linked Evidence
            {data && data.totalCount > 0 && (
              <Badge variant="secondary">{data.totalCount}</Badge>
            )}
          </CardTitle>
          {showActions && canLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLinkModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Link2 className="h-4 w-4" />
              Link Evidence
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Finding Evidence */}
          <EvidenceGroup
            title="Finding Evidence"
            icon={AlertTriangle}
            iconColor="text-amber-500"
            evidence={data?.findingEvidence || []}
            emptyMessage="No finding evidence linked yet"
            onUnlink={handleUnlink}
            canUnlink={!!canLink}
            unlinkingId={unlinkingId}
          />

          {/* Remediation Evidence */}
          <EvidenceGroup
            title="Remediation Evidence"
            icon={CheckCircle2}
            iconColor="text-green-500"
            evidence={data?.remediationEvidence || []}
            emptyMessage="No remediation evidence linked yet"
            onUnlink={handleUnlink}
            canUnlink={!!canLink}
            unlinkingId={unlinkingId}
          />

          {/* Empty state */}
          {data?.totalCount === 0 && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No evidence linked to this risk</p>
              {canLink && (
                <p className="text-sm text-gray-400 mt-2">
                  Click "Link Evidence" to attach supporting documentation
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Evidence Modal */}
      {isLinkModalOpen && (
        <LinkEvidenceModal
          riskId={riskId}
          onClose={() => setIsLinkModalOpen(false)}
          onSuccess={handleLinkSuccess}
        />
      )}
    </>
  );
}
