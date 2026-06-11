"use client";

/**
 * Step 1: Scope & Setup (Polymorphic Engagement rework).
 *
 * - The wrapped assessment is read-only here (chosen at create time). A summary
 *   card shows its name + kind and links to its native detail page.
 * - Client / sector / size / window / consultancy persist via
 *   `engagement.update` on blur.
 * - A domain multi-select scopes `inScopeDomains` (used to organize the
 *   stakeholder / evidence planning).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSESS_DOMAINS } from "@/lib/engagement/assessment-methodology";
import { InfoCallout } from "../InfoCallout";
import type { EngagementDetail } from "../types";

interface Props {
  engagement: EngagementDetail;
  readOnly?: boolean;
}

const KIND_LABELS: Record<string, string> = {
  COMPLIANCE: "Compliance",
  MATURITY: "Maturity",
  RISK: "Risk",
  VENDOR: "Vendor (TPRM)",
  BIA: "Business Impact",
};

const FIELDS = [
  { key: "clientName", label: "Client name", placeholder: "Acme Industries" },
  { key: "sector", label: "Sector", placeholder: "Manufacturing" },
  { key: "size", label: "Size", placeholder: "1,200 staff · 3 sites" },
  { key: "engagementWindow", label: "Engagement window", placeholder: "Q2 2026" },
  { key: "consultancy", label: "Consultancy", placeholder: "Your firm" },
] as const;

export function Step1Scope({ engagement, readOnly }: Props) {
  const utils = api.useUtils();
  const updateMutation = api.engagement.update.useMutation({
    onSuccess: () => {
      void utils.engagement.getById.invalidate({ id: engagement.id });
    },
  });

  // Local form state hydrated from the engagement, persisted on blur.
  const [form, setForm] = useState({
    clientName: engagement.clientName ?? "",
    sector: engagement.sector ?? "",
    size: engagement.size ?? "",
    engagementWindow: engagement.engagementWindow ?? "",
    consultancy: engagement.consultancy ?? "",
  });

  useEffect(() => {
    setForm({
      clientName: engagement.clientName ?? "",
      sector: engagement.sector ?? "",
      size: engagement.size ?? "",
      engagementWindow: engagement.engagementWindow ?? "",
      consultancy: engagement.consultancy ?? "",
    });
  }, [
    engagement.clientName,
    engagement.sector,
    engagement.size,
    engagement.engagementWindow,
    engagement.consultancy,
  ]);

  const selected = new Set(engagement.inScopeDomains);
  const linked = engagement.linkedAssessment;
  const kindLabel =
    KIND_LABELS[engagement.assessmentKind] ?? engagement.assessmentKind;

  function saveField(key: keyof typeof form) {
    const value = form[key].trim();
    const current = (engagement[key] ?? "") as string;
    if (value === current.trim()) return;
    updateMutation.mutate({ id: engagement.id, [key]: value });
  }

  function toggleDomain(domainId: string) {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(domainId)) next.delete(domainId);
    else next.add(domainId);
    updateMutation.mutate({
      id: engagement.id,
      inScopeDomains: Array.from(next),
    });
  }

  return (
    <div className="space-y-6">
      <InfoCallout>
        Configure the engagement before fieldwork. The{" "}
        <strong>wrapped assessment was chosen at creation</strong> and holds the
        scoring; the in-scope domains below organize your stakeholder and
        evidence planning.
      </InfoCallout>

      {/* Wrapped assessment — read-only summary */}
      <Card className="p-5">
        <p className="eyebrow mb-2">Wrapped assessment</p>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {linked?.name ?? "Assessment unavailable"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {kindLabel} assessment
              {linked?.status ? ` · ${linked.status}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">{kindLabel}</Badge>
            {linked?.href ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={linked.href}>
                  Open assessment
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        {!linked ? (
          <p className="mt-3 text-xs text-destructive">
            The wrapped assessment could not be resolved. It may have been
            deleted.
          </p>
        ) : null}
      </Card>

      {/* Scope inputs */}
      <Card className="p-5">
        <p className="eyebrow mb-3">Client & window</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={`scope-${f.key}`}>{f.label}</Label>
              <Input
                id={`scope-${f.key}`}
                value={form[f.key]}
                placeholder={f.placeholder}
                disabled={readOnly}
                onChange={(e) =>
                  setForm((s) => ({ ...s, [f.key]: e.target.value }))
                }
                onBlur={() => saveField(f.key)}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Domain multi-select */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">In-scope domains</p>
          <span className="text-xs text-muted-foreground">
            {selected.size} of {ASSESS_DOMAINS.length} selected
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ASSESS_DOMAINS.map((d) => {
            const isOn = selected.has(d.id);
            return (
              <button
                key={d.id}
                type="button"
                disabled={readOnly}
                onClick={() => toggleDomain(d.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  isOn
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-secondary",
                  readOnly && "cursor-default",
                )}
              >
                <Checkbox checked={isOn} className="mt-0.5 pointer-events-none" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{d.name}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {d.desc}
                  </span>
                </span>
                {isOn ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
