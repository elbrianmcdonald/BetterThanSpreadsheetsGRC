"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { TestResult, UserRole } from "@prisma/client";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TEST_RESULT_OPTIONS,
  labelForTestResult,
  testResultBadgeColor,
} from "./enum-labels";

const CAN_MUTATE: UserRole[] = [
  UserRole.ADMINISTRATOR,
  UserRole.ANALYST,
  UserRole.ANALYST,
];

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

export function TestingTab({ controlId }: { controlId: string }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canMutate = !!userRole && CAN_MUTATE.includes(userRole);

  const [recordOpen, setRecordOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: records,
    isLoading,
    error,
  } = api.orgControlTestRecord.list.useQuery({ orgControlId: controlId });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Test history</h3>
          <p className="text-sm text-muted-foreground">
            Each row records a single control test run and its result.
          </p>
        </div>
        {canMutate && (
          <Button onClick={() => setRecordOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record test
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error.message}</p>
          ) : !records?.length ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <FlaskConical className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              No test records yet — record the first test to start tracking.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Tester</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Deficiencies</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Next due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => {
                  const isExpanded = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(r.testedAt)}</TableCell>
                        <TableCell className="text-sm">
                          {r.TestedBy?.name ?? r.TestedBy?.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={testResultBadgeColor(r.result)}>
                            {labelForTestResult(r.result)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r._count.Deficiencies > 0 ? (
                            <Badge variant="secondary">{r._count.Deficiencies}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {truncate(r.findings, 80) || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(r.nextDueDate)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && r.findings && (
                        <TableRow className="bg-gray-50">
                          <TableCell />
                          <TableCell colSpan={6} className="text-sm">
                            <p className="text-xs uppercase text-muted-foreground mb-1">Findings</p>
                            <p className="whitespace-pre-wrap text-gray-700">{r.findings}</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecordTestDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        controlId={controlId}
      />
    </div>
  );
}

function RecordTestDialog({
  open,
  onOpenChange,
  controlId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  const [testedAt, setTestedAt] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [result, setResult] = useState<TestResult>(TestResult.PASS);
  const [findings, setFindings] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");

  const createMutation = api.orgControlTestRecord.create.useMutation({
    onSuccess: () => {
      toast.success("Test recorded");
      void utils.orgControlTestRecord.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      void utils.organizationalControl.list.invalidate();
      onOpenChange(false);
      // Reset form
      setResult(TestResult.PASS);
      setFindings("");
      setNextDueDate("");
    },
    onError: (e) => toast.error(e.message || "Failed to record test"),
  });

  const handleSubmit = () => {
    createMutation.mutate({
      orgControlId: controlId,
      testedAt: new Date(testedAt),
      result,
      findings: findings.trim() || null,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record test</DialogTitle>
          <DialogDescription>
            Log a control test run. If you leave the next-due date blank, we&apos;ll compute one
            from the control&apos;s review cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="testedAt">Tested on</Label>
            <Input
              id="testedAt"
              type="date"
              value={testedAt}
              onChange={(e) => setTestedAt(e.target.value)}
            />
          </div>

          <div>
            <Label>Result</Label>
            <Select value={result} onValueChange={(v) => setResult(v as TestResult)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEST_RESULT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="findings">Findings</Label>
            <Textarea
              id="findings"
              rows={4}
              placeholder="What was observed during this test..."
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="nextDueDate">Next test due (optional)</Label>
            <Input
              id="nextDueDate"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to derive from the control&apos;s review cycle.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Record test"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
