"use client";

/**
 * Kanban Card Component
 *
 * Displays a single task card in the Kanban board.
 * Shows task identifier, title, type badge, priority, due date.
 * Includes action buttons based on status.
 */

import { format, isPast } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Clock,
  Play,
  CheckCircle,
  Eye,
  Building2,
  AlertTriangle,
  Shield,
  Search,
  FileText,
  Activity,
  GripVertical,
} from "lucide-react";
import { UnifiedAssessmentType, AssessmentTaskStatus } from "@prisma/client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Assessment type configuration */
const assessmentTypeConfig: Record<UnifiedAssessmentType, { label: string; icon: React.ElementType; color: string }> = {
  RISK_DISCOVERY: { label: "Risk Discovery", icon: Search, color: "bg-blue-100 text-blue-800" },
  RISK_ASSESSMENT: { label: "Risk Assessment", icon: Shield, color: "bg-purple-100 text-purple-800" },
  FINDING_CREATION: { label: "Finding", icon: AlertTriangle, color: "bg-amber-100 text-amber-800" },
  VENDOR_ASSESSMENT: { label: "Vendor", icon: Building2, color: "bg-green-100 text-green-800" },
  BIA_ASSESSMENT: { label: "BIA", icon: Activity, color: "bg-cyan-100 text-cyan-800" },
  COMPLIANCE_ASSESSMENT: { label: "Compliance", icon: FileText, color: "bg-indigo-100 text-indigo-800" },
};

/** Priority badge colors */
const priorityConfig = {
  HIGH: { color: "bg-red-100 text-red-700", label: "High" },
  MEDIUM: { color: "bg-amber-100 text-amber-700", label: "Medium" },
  LOW: { color: "bg-green-100 text-green-700", label: "Low" },
};

interface KanbanCardProps {
  task: {
    id: string;
    identifier: string;
    title: string;
    description?: string | null;
    unifiedType: UnifiedAssessmentType;
    entityId?: string | null;
    entityType?: string | null;
    priority: string;
    dueDate?: Date | null;
    status: AssessmentTaskStatus;
    businessUnit?: {
      id: string;
      name: string;
      code?: string | null;
    } | null;
  };
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  isLoading?: boolean;
}

/**
 * Get the appropriate route for a task based on its type and entity
 */
function getTaskRoute(task: KanbanCardProps["task"]): string {
  if (task.entityId) {
    switch (task.unifiedType) {
      case "RISK_ASSESSMENT":
        return `/risks/${task.entityId}/edit`;
      case "FINDING_CREATION":
        return `/findings/${task.entityId}`;
      case "VENDOR_ASSESSMENT":
        return `/tprm/assessments/${task.entityId}`;
      case "BIA_ASSESSMENT":
        return `/bia/processes/${task.entityId}`;
      case "COMPLIANCE_ASSESSMENT":
        return `/compliance/assessments/${task.entityId}`;
      default:
        return `/assignments/task/${task.id}`;
    }
  }
  // For RISK_DISCOVERY or tasks without entityId, go to task detail
  return `/risks/assessment/${task.id}`;
}

export function KanbanCard({ task, onStart, onComplete, isLoading }: KanbanCardProps) {
  const router = useRouter();
  const typeConfig = assessmentTypeConfig[task.unifiedType];
  const priorityStyle = priorityConfig[task.priority as keyof typeof priorityConfig];
  const TypeIcon = typeConfig?.icon || FileText;
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate));

  // Drag and drop setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleCardClick = () => {
    router.push(getTaskRoute(task));
  };

  const handleStartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStart?.(task.id);
  };

  const handleCompleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onComplete?.(task.id);
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(getTaskRoute(task));
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-none",
        isDragging && "opacity-50"
      )}
    >
      <Card
        className={cn(
          "cursor-pointer hover:shadow-md transition-shadow",
          isOverdue && task.status !== AssessmentTaskStatus.COMPLETED && "border-red-300 bg-red-50/30"
        )}
        onClick={handleCardClick}
      >
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Drag Handle */}
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-muted-foreground">
                {task.identifier}
              </span>
            </div>
            <Badge className={cn("text-xs", typeConfig?.color)}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {typeConfig?.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {/* Title */}
          <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>

          {/* Meta info row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Priority */}
            <Badge variant="outline" className={cn("text-xs", priorityStyle?.color)}>
              {priorityStyle?.label}
            </Badge>

            {/* Business Unit */}
            {task.businessUnit && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {task.businessUnit.code || task.businessUnit.name}
              </span>
            )}
          </div>

          {/* Due Date */}
          {task.dueDate && (
            <div className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue && task.status !== AssessmentTaskStatus.COMPLETED
                ? "text-red-600 font-medium"
                : "text-muted-foreground"
            )}>
              <Clock className="h-3 w-3" />
              {isOverdue && task.status !== AssessmentTaskStatus.COMPLETED ? "Overdue: " : "Due: "}
              {format(new Date(task.dueDate), "MMM d, yyyy")}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            {task.status === AssessmentTaskStatus.PENDING && onStart && (
              <Button
                size="sm"
                variant="default"
                onClick={handleStartClick}
                disabled={isLoading}
              >
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}
            {task.status === AssessmentTaskStatus.IN_PROGRESS && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleViewClick}
                >
                  Continue
                </Button>
                {onComplete && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleCompleteClick}
                    disabled={isLoading}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                )}
              </>
            )}
            {task.status === AssessmentTaskStatus.COMPLETED && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleViewClick}
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
