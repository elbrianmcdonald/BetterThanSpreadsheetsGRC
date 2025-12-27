"use client";

/**
 * MITRE ATT&CK Techniques Client Component
 *
 * Story 13.6: Technique Search & Browse UI
 *
 * Provides search and filtering for MITRE techniques with detail view.
 */

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crosshair,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Target,
} from "lucide-react";

export function TechniquesClient() {
  const searchParams = useSearchParams();

  // Filter state
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [tacticFilter, setTacticFilter] = useState(searchParams.get("tactic") ?? "all");
  const [showSubTechniques, setShowSubTechniques] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);

  // Detail dialog state
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useMemo(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch tactics for filter
  const { data: tactics } = api.mitre.getTactics.useQuery();

  // Fetch techniques
  const { data: techniquesData, isLoading } = api.mitre.getTechniques.useQuery({
    tacticId: tacticFilter !== "all" ? tacticFilter : undefined,
    includeSubTechniques: showSubTechniques,
    page,
    pageSize,
  });

  // Search techniques
  const { data: searchResults, isLoading: searchLoading } = api.mitre.searchTechniques.useQuery(
    {
      query: debouncedSearch,
      tacticId: tacticFilter !== "all" ? tacticFilter : undefined,
      includeSubTechniques: showSubTechniques,
      limit: 50,
    },
    { enabled: debouncedSearch.length > 0 }
  );

  // Fetch technique details for dialog
  const { data: techniqueDetails } = api.mitre.getTechniqueById.useQuery(
    { id: selectedTechniqueId ?? "" },
    { enabled: !!selectedTechniqueId }
  );

  // Use search results if searching, otherwise use paginated list
  const displayTechniques = debouncedSearch ? searchResults : techniquesData?.techniques;
  const showPagination = !debouncedSearch && techniquesData;

  const selectedTacticName = tacticFilter !== "all"
    ? tactics?.find((t) => t.id === tacticFilter)?.name
    : null;

  return (
    <AppLayout breadcrumbs={[{ label: "MITRE ATT&CK", href: "/mitre/tactics" }, { label: "Techniques" }]}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Crosshair className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">MITRE ATT&CK Techniques</h1>
          <p className="text-sm text-muted-foreground">
            Search and browse attack techniques for threat modeling
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by technique ID or name (e.g., T1566, Phishing)..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-10"
              />
              {search && debouncedSearch !== search && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Tactic Filter */}
            <Select
              value={tacticFilter}
              onValueChange={(v) => {
                setTacticFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Tactics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tactics</SelectItem>
                {tactics?.map((tactic) => (
                  <SelectItem key={tactic.id} value={tactic.id}>
                    {tactic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sub-techniques Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showSub"
                checked={showSubTechniques}
                onCheckedChange={(checked) => {
                  setShowSubTechniques(checked === true);
                  setPage(0);
                }}
              />
              <Label htmlFor="showSub" className="text-sm whitespace-nowrap">
                Show sub-techniques
              </Label>
            </div>

            {/* Clear */}
            {(search || tacticFilter !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setTacticFilter("all");
                  setPage(0);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Active filters */}
          {(search || selectedTacticName) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {search}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} />
                </Badge>
              )}
              {selectedTacticName && (
                <Badge variant="secondary" className="gap-1">
                  Tactic: {selectedTacticName}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setTacticFilter("all")} />
                </Badge>
              )}
              <span className="text-sm text-muted-foreground ml-2">
                {debouncedSearch
                  ? `${searchResults?.length ?? 0} results`
                  : `${techniquesData?.total ?? 0} techniques`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Techniques List */}
      <div className="space-y-3">
        {isLoading || searchLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : !displayTechniques || displayTechniques.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No Techniques Found</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                {search
                  ? "No techniques match your search. Try different keywords."
                  : "No techniques available. Sync MITRE data from the Tactics page."}
              </p>
            </CardContent>
          </Card>
        ) : (
          displayTechniques.map((technique) => (
            <Card
              key={technique.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedTechniqueId(technique.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono">
                      {technique.externalId}
                    </Badge>
                    {technique.isSubTechnique && (
                      <Badge variant="secondary" className="text-xs">
                        Sub-technique
                      </Badge>
                    )}
                    {technique.parent && (
                      <span className="text-sm text-muted-foreground">
                        of {technique.parent.externalId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {"subTechniqueCount" in technique &&
                     typeof (technique as { subTechniqueCount?: number }).subTechniqueCount === "number" &&
                     (technique as { subTechniqueCount: number }).subTechniqueCount > 0 && (
                      <Badge variant="secondary">
                        {(technique as { subTechniqueCount: number }).subTechniqueCount} sub-techniques
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-base">{technique.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1">
                  {technique.tactics.map((tactic) => (
                    <Badge key={tactic.id} variant="outline" className="text-xs">
                      {tactic.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {showPagination && techniquesData.total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, techniquesData.total)} of{" "}
            {techniquesData.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {Math.ceil(techniquesData.total / pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!techniquesData.hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Technique Detail Dialog */}
      <Dialog
        open={!!selectedTechniqueId}
        onOpenChange={(open) => !open && setSelectedTechniqueId(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {techniqueDetails ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono">
                    {techniqueDetails.externalId}
                  </Badge>
                  {techniqueDetails.isSubTechnique && (
                    <Badge variant="secondary">Sub-technique</Badge>
                  )}
                  <a
                    href={techniqueDetails.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <DialogTitle>{techniqueDetails.name}</DialogTitle>
                {techniqueDetails.parent && (
                  <DialogDescription>
                    Sub-technique of {techniqueDetails.parent.externalId} - {techniqueDetails.parent.name}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-4">
                {/* Tactics */}
                <div>
                  <h4 className="font-medium mb-2">Tactics:</h4>
                  <div className="flex flex-wrap gap-1">
                    {techniqueDetails.tactics.map((tactic) => (
                      <Badge key={tactic.id} variant="outline">
                        {tactic.externalId} - {tactic.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Description:</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {techniqueDetails.description}
                  </p>
                </div>

                {/* Detection */}
                {techniqueDetails.detection && (
                  <div>
                    <h4 className="font-medium mb-2">Detection:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {techniqueDetails.detection}
                    </p>
                  </div>
                )}

                {/* Sub-techniques */}
                {techniqueDetails.subTechniques.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">
                      Sub-techniques ({techniqueDetails.subTechniques.length}):
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {techniqueDetails.subTechniques.map((sub) => (
                        <Badge
                          key={sub.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => setSelectedTechniqueId(sub.id)}
                        >
                          {sub.externalId} - {sub.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link to MITRE */}
                <div className="pt-4 border-t">
                  <a
                    href={techniqueDetails.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View on MITRE ATT&CK
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
