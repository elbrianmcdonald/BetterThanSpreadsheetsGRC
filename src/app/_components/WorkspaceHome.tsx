"use client";

/**
 * Workspace Home — "Triage Inbox"
 *
 * Post-login landing page (reproduces design_handoff "directionC" / Better than
 * Spreadsheets GRC.html, rendered in the consulting-grade theme). A grouped
 * worklist of the current user's assigned tasks (Overdue / Due today / This week /
 * Later) on the left, with a right rail: task-status donut, quick actions, and a
 * recent-activity feed. Wired to real data:
 *   - worklist + donut    -> assessmentTask.getMyKanbanAssignments
 *   - KPI strip           -> compliance.getComplianceSummary + finding.getStats
 *   - activity feed       -> audit.getByDateRange (ORG_ADMIN / CISO only)
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Shield,
  AlertTriangle,
  Search,
  Building2,
  Activity,
  FileText,
  Filter,
  ChevronDown,
  CheckCircle,
} from "lucide-react";
import {
  isPast,
  isToday,
  isThisWeek,
  formatDistanceToNowStrict,
  differenceInCalendarDays,
  format,
} from "date-fns";
import { UnifiedAssessmentType } from "@prisma/client";

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ helpers */

const typeIcon: Record<UnifiedAssessmentType, React.ElementType> = {
  RISK_DISCOVERY: Search,
  RISK_ASSESSMENT: Shield,
  FINDING_CREATION: AlertTriangle,
  VENDOR_ASSESSMENT: Building2,
  BIA_ASSESSMENT: Activity,
  COMPLIANCE_ASSESSMENT: FileText,
};

const typeLabel: Record<UnifiedAssessmentType, string> = {
  RISK_DISCOVERY: "Risk",
  RISK_ASSESSMENT: "Risk",
  FINDING_CREATION: "Finding",
  VENDOR_ASSESSMENT: "Vendor",
  BIA_ASSESSMENT: "BIA",
  COMPLIANCE_ASSESSMENT: "Assessment",
};

type Priority = "HIGH" | "MEDIUM" | "LOW";

/** Priority -> soft Badge tone + icon-chip tint (report tones, no candy). */
const priorityTone: Record<Priority, { variant: "high" | "info" | "neutral"; chip: string }> = {
  HIGH: { variant: "high", chip: "bg-severity-high/10 text-severity-high" },
  MEDIUM: { variant: "info", chip: "bg-primary/10 text-primary" },
  LOW: { variant: "neutral", chip: "bg-muted text-muted-foreground" },
};

type AnyTask = {
  id: string;
  identifier: string;
  title: string;
  unifiedType: UnifiedAssessmentType;
  entityId?: string | null;
  priority: string;
  dueDate?: Date | string | null;
  assignedBy?: { name: string | null } | null;
  businessUnit?: { name: string; code?: string | null } | null;
};

function taskRoute(t: AnyTask): string {
  if (t.entityId) {
    switch (t.unifiedType) {
      case "RISK_ASSESSMENT":
        return `/risks/${t.entityId}/edit`;
      case "FINDING_CREATION":
        return `/findings/${t.entityId}`;
      case "VENDOR_ASSESSMENT":
        return `/tprm/assessments/${t.entityId}`;
      case "BIA_ASSESSMENT":
        return `/bia/processes/${t.entityId}`;
      case "COMPLIANCE_ASSESSMENT":
        return `/compliance/assessments/${t.entityId}`;
      default:
        return `/assignments/my-assignments`;
    }
  }
  return `/assignments/my-assignments`;
}

/** Bucket an active task by its due date. */
type Bucket = "overdue" | "today" | "week" | "later";
function bucketOf(due: Date | null): Bucket {
  if (!due) return "later";
  if (isToday(due)) return "today";
  if (isPast(due)) return "overdue";
  if (isThisWeek(due, { weekStartsOn: 1 })) return "week";
  return "later";
}

const GROUP_META: Record<Bucket, { label: string; dot: string }> = {
  overdue: { label: "Overdue", dot: "bg-destructive" },
  today: { label: "Due today", dot: "bg-warning" },
  week: { label: "This week", dot: "bg-primary" },
  later: { label: "Later", dot: "bg-muted-foreground/40" },
};

/** Short, human "when" for a due date. */
function whenLabel(due: Date | null, bucket: Bucket): string {
  if (!due) return "—";
  if (bucket === "overdue") {
    const days = Math.abs(differenceInCalendarDays(due, new Date()));
    return days <= 0 ? "Overdue" : `${days}d overdue`;
  }
  if (bucket === "today") return "Today";
  if (bucket === "week") return format(due, "EEE");
  return format(due, "MMM d");
}

/* --------------------------------------------------------------- KPI strip */

function KpiStrip() {
  const { data: compliance } = api.compliance.getComplianceSummary.useQuery({});
  const { data: findingStats } = api.finding.getStats.useQuery();

  const openRisks = compliance?.riskMetrics?.openRisksCount ?? 0;
  const openFindings = findingStats?.openCount ?? 0;

  const tiles: { label: string; value: string | number; tone: string; href: string }[] = [
    {
      label: "Open risks",
      value: openRisks,
      tone: "text-primary",
      href: "/risks?status=OPEN,ASSIGNED",
    },
    {
      label: "Findings",
      value: openFindings,
      tone: "text-severity-high",
      href: "/findings?status=NEW,NEEDS_INFO,TRIAGED",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2.5">
      {tiles.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          className="min-w-[92px] rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:border-primary/30 hover:bg-accent"
        >
          <div className="text-[11.5px] font-medium text-muted-foreground">{t.label}</div>
          <div className={cn("mt-0.5 text-[22px] font-bold tabular-nums tracking-[-0.01em]", t.tone)}>
            {t.value}
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ status donut */

function StatusDonut({
  onTime,
  today,
  overdue,
}: {
  onTime: number;
  today: number;
  overdue: number;
}) {
  const total = onTime + today + overdue;
  const segs = [
    { label: "On-time", value: onTime, color: "var(--success)" },
    { label: "Due today", value: today, color: "var(--warning)" },
    { label: "Overdue", value: overdue, color: "var(--destructive)" },
  ];

  // Build a conic-gradient ring from the segments (hairline track when empty).
  let acc = 0;
  const stops = total
    ? segs
        .filter((s) => s.value > 0)
        .map((s) => {
          const start = (acc / total) * 360;
          acc += s.value;
          const end = (acc / total) * 360;
          return `${s.color} ${start}deg ${end}deg`;
        })
        .join(", ")
    : "var(--border) 0deg 360deg";

  const onTrackPct = total ? Math.round((onTime / total) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14.5px] font-bold text-foreground">Task status</h3>
        <Badge variant="success">{onTrackPct}% on track</Badge>
      </div>
      <div className="flex items-center gap-5">
        <div
          className="relative grid size-[112px] shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${stops})` }}
        >
          <div className="grid size-[84px] place-items-center rounded-full bg-card text-center">
            <div className="text-[20px] font-bold tabular-nums leading-none text-foreground">
              {total}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">tasks</div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          {segs.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              <span className="flex-1 text-[12.5px] text-secondary-foreground">{s.label}</span>
              <span className="text-[13.5px] font-bold tabular-nums text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- quick actions */

const QUICK_ACTIONS: { label: string; icon: React.ElementType; href: string }[] = [
  { label: "New Risk", icon: Shield, href: "/risks/new" },
  { label: "New Finding", icon: AlertTriangle, href: "/findings/new" },
];

function QuickActions() {
  return (
    <div>
      <h3 className="text-[14.5px] font-bold text-foreground">Quick actions</h3>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {QUICK_ACTIONS.map((a) => {
          const Ic = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-secondary px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-accent"
            >
              <Ic className="h-[17px] w-[17px] text-primary" />
              <span className="text-[12.5px] font-semibold text-foreground">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- activity */

const AUDIT_VERB: Record<string, string> = {
  CREATE: "created",
  CREATED: "created",
  UPDATE: "updated",
  UPDATED: "updated",
  DELETE: "deleted",
  DELETED: "deleted",
  STATUS_CHANGE: "changed status of",
  LOGIN: "signed in",
  EXPORT: "exported",
};

function humanizeEntity(entityType?: string | null): string {
  if (!entityType) return "an item";
  return entityType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
}

function ActivityFeed({ enabled }: { enabled: boolean }) {
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
    return { startDate: start, endDate: end, page: 1, pageSize: 6 };
  }, []);

  const { data, isLoading } = api.audit.getByDateRange.useQuery(range, { enabled });

  const logs = data?.logs ?? [];

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="text-[14.5px] font-bold text-foreground">Activity</h3>
        {enabled && (
          <Link href="/admin/settings" className="text-[12px] font-semibold text-primary hover:text-primary/80">
            All
          </Link>
        )}
      </div>

      {!enabled ? (
        <p className="py-2 text-[12.5px] text-muted-foreground">
          Activity timeline is available to administrators.
        </p>
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="py-2 text-[12.5px] text-muted-foreground">No recent activity.</p>
      ) : (
        <div className="flex flex-col">
          {logs.map((log, i) => {
            const verb =
              AUDIT_VERB[String(log.action)] ??
              String(log.action).toLowerCase().replace(/_/g, " ");
            const who = log.User?.name ?? "System";
            return (
              <div key={log.id} className="flex gap-3" style={{ paddingBottom: i === logs.length - 1 ? 0 : 15 }}>
                <div className="flex flex-col items-center">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Activity className="h-3.5 w-3.5" />
                  </span>
                  {i !== logs.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="pt-0.5">
                  <div className="text-[12.5px] leading-[1.45] text-secondary-foreground">
                    <strong className="font-semibold text-foreground">{who}</strong> {verb}{" "}
                    <strong className="font-semibold text-foreground">{humanizeEntity(log.entityType)}</strong>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(log.timestamp), { addSuffix: true })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- inbox + page */

const FILTER_CHIPS = ["Assigned to me", "All types", "Any priority"];

export function WorkspaceHome({
  firstName,
  isAdmin,
}: {
  firstName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { data, isLoading } = api.assessmentTask.getMyKanbanAssignments.useQuery({
    includeCompleted: false,
  });

  const active: AnyTask[] = useMemo(
    () => [...(data?.todo ?? []), ...(data?.inProgress ?? [])] as AnyTask[],
    [data]
  );

  const grouped = useMemo(() => {
    const g: Record<Bucket, AnyTask[]> = { overdue: [], today: [], week: [], later: [] };
    for (const t of active) {
      const due = t.dueDate ? new Date(t.dueDate) : null;
      g[bucketOf(due)].push(t);
    }
    return g;
  }, [active]);

  const counts = useMemo(
    () => ({
      overdue: grouped.overdue.length,
      today: grouped.today.length,
      onTime: grouped.week.length + grouped.later.length,
      total: active.length,
    }),
    [grouped, active]
  );

  const order: Bucket[] = ["overdue", "today", "week", "later"];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Workspace</p>
          <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.018em] text-foreground">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <span className="tabular-nums">{counts.total}</span> open{" "}
            {counts.total === 1 ? "task" : "tasks"}
            {counts.overdue > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-destructive tabular-nums">
                  {counts.overdue} overdue
                </span>
              </>
            )}
          </p>
        </div>
        <KpiStrip />
      </div>

      {/* Grid: inbox + rail */}
      <div className="grid grid-cols-1 items-start gap-[22px] xl:grid-cols-[1fr_320px]">
        {/* Inbox */}
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Filter className="h-[15px] w-[15px] text-muted-foreground" />
            {FILTER_CHIPS.map((c, i) => (
              <span
                key={c}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold",
                  i === 0
                    ? "bg-accent text-primary"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {c}
                <ChevronDown className="h-3 w-3" />
              </span>
            ))}
            <span className="ml-auto font-mono text-[12.5px] text-muted-foreground tabular-nums">
              {counts.total} items
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <CheckCircle className="h-10 w-10 text-success" />
              <p className="text-[15px] font-semibold text-foreground">You&apos;re all caught up</p>
              <p className="text-[13px] text-muted-foreground">No tasks assigned to you right now.</p>
            </div>
          ) : (
            order
              .filter((b) => grouped[b].length > 0)
              .map((b) => {
                const meta = GROUP_META[b];
                return (
                  <div key={b}>
                    <div className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-2.5">
                      <span className={cn("size-[7px] rounded-full", meta.dot)} />
                      <span className="font-mono text-[11.5px] font-bold uppercase tracking-[0.05em] text-secondary-foreground">
                        {meta.label}
                      </span>
                      <span className="text-[11.5px] font-semibold text-muted-foreground tabular-nums">
                        {grouped[b].length}
                      </span>
                    </div>
                    {grouped[b].map((t) => {
                      const Ic = typeIcon[t.unifiedType] ?? FileText;
                      const due = t.dueDate ? new Date(t.dueDate) : null;
                      const pr = (["HIGH", "MEDIUM", "LOW"].includes(t.priority)
                        ? t.priority
                        : "MEDIUM") as Priority;
                      const tone = priorityTone[pr];
                      const who = t.assignedBy?.name ?? t.businessUnit?.name ?? "Unassigned";
                      return (
                        <button
                          key={t.id}
                          onClick={() => router.push(taskRoute(t))}
                          className="flex w-full items-center gap-3.5 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-secondary/60"
                        >
                          <span className="size-[18px] shrink-0 rounded-[5px] border-[1.8px] border-input" />
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-items-center rounded-[9px]",
                              tone.chip
                            )}
                          >
                            <Ic className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {t.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                              <span className="font-mono">{t.identifier}</span>
                              <span>·</span>
                              <span>{typeLabel[t.unifiedType]}</span>
                              <span>·</span>
                              <span className="truncate">{who}</span>
                            </span>
                          </span>
                          <Badge variant={tone.variant} className="shrink-0">
                            {pr === "HIGH" ? "High" : pr === "MEDIUM" ? "Medium" : "Low"}
                          </Badge>
                          <span
                            className={cn(
                              "w-16 shrink-0 text-right text-[12px] font-semibold tabular-nums",
                              b === "overdue" ? "text-destructive" : "text-secondary-foreground"
                            )}
                          >
                            {whenLabel(due, b)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
          )}
        </div>

        {/* Rail */}
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-card px-5 py-[18px] shadow-sm">
            <StatusDonut onTime={counts.onTime} today={counts.today} overdue={counts.overdue} />
          </div>
          <div className="rounded-lg border border-border bg-card px-5 py-[18px] shadow-sm">
            <QuickActions />
          </div>
          <div className="rounded-lg border border-border bg-card px-5 py-[18px] shadow-sm">
            <ActivityFeed enabled={isAdmin} />
          </div>
        </div>
      </div>
    </div>
  );
}
