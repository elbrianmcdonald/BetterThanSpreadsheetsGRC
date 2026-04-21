"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Anchor = "ASSET" | "PROCESS";

export function NewSystemContingencyClient() {
  const router = useRouter();
  const [anchor, setAnchor] = useState<Anchor>("ASSET");
  const [assetId, setAssetId] = useState<string>("");
  const [processId, setProcessId] = useState<string>("");

  const { data: assets } = api.asset.list.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: anchor === "ASSET" }
  );
  const { data: processes } = api.businessProcess.list.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: anchor === "PROCESS" }
  );

  const createMutation = api.biaSystemContingency.create.useMutation({
    onSuccess: (bia) => {
      toast.success("BIA created");
      router.push(`/bia/system-contingency/${bia.id}`);
    },
    onError: (e) => toast.error(e.message || "Failed to create BIA"),
  });

  const handleSubmit = () => {
    if (anchor === "ASSET" && !assetId) {
      toast.error("Select an asset");
      return;
    }
    if (anchor === "PROCESS" && !processId) {
      toast.error("Select a business process");
      return;
    }
    createMutation.mutate({
      assetId: anchor === "ASSET" ? assetId : null,
      businessProcessId: anchor === "PROCESS" ? processId : null,
    });
  };

  const assetList = assets?.items ?? [];
  const processList = processes?.items ?? [];

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        {
          label: "System Contingency BIA",
          href: "/bia/system-contingency",
        },
        { label: "New" },
      ]}
    >
      <div className="container max-w-2xl mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            New System Contingency BIA
          </h1>
          <Button variant="outline" asChild>
            <Link href="/bia/system-contingency">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anchor</CardTitle>
            <CardDescription>
              Pick what the BIA applies to. After creation you can add
              narrative, processes, resources, and recovery priorities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <RadioGroup
              value={anchor}
              onValueChange={(v) => setAnchor(v as Anchor)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ASSET" id="anchor-asset" />
                <Label htmlFor="anchor-asset">Asset (information system)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="PROCESS" id="anchor-process" />
                <Label htmlFor="anchor-process">Business process</Label>
              </div>
            </RadioGroup>

            {anchor === "ASSET" ? (
              <div>
                <Label>Asset</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an asset…" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetList.map((a: { id: string; identifier: string; name: string }) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.identifier} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Business process</Label>
                <Select value={processId} onValueChange={setProcessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a process…" />
                  </SelectTrigger>
                  <SelectContent>
                    {processList.map(
                      (p: { id: string; identifier: string; name: string }) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.identifier} — {p.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create & edit"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
