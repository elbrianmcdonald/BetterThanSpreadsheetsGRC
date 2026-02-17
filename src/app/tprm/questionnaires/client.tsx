"use client";

/**
 * Questionnaire Templates List Client Component
 *
 * Epic 4: Questionnaire System
 * Story 4.1: Pre-Built Questionnaire Templates (FR27)
 * Story 4.2: Custom Questionnaire Builder (FR28)
 *
 * Client component that handles:
 * - Template listing with system and custom templates
 * - Search functionality
 * - Navigation to detail/edit pages
 */

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  FileQuestion,
  Search,
  Building2,
  Shield,
  ChevronRight,
  Copy,
} from "lucide-react";
import toast from "react-hot-toast";

import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";
import { useHasRole } from "@/hooks/useHasRole";

/**
 * Roles that can create/edit questionnaire templates
 */
const TEMPLATE_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
];

/**
 * Template type from API
 */
interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  isSystemTemplate: boolean;
  isActive: boolean;
  version: number;
  questionCount: number;
  sectionCount: number;
  createdAt: Date | string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

export function QuestionnaireListClient() {
  // Search state
  const [search, setSearch] = useState("");
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [copyName, setCopyName] = useState("");

  // Role checks
  const canManageTemplates = useHasRole(TEMPLATE_MANAGE_ROLES);

  // Fetch templates
  const { data: templates, isLoading, error } = api.questionnaire.listTemplates.useQuery({
    includeSystem: true,
    includeCustom: true,
    isActive: true,
    search: search || undefined,
  });

  // Copy template mutation
  const copyMutation = api.questionnaire.copyTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template copied successfully");
      setCopyDialogOpen(false);
      setSelectedTemplate(null);
      setCopyName("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to copy template");
    },
  });

  const handleCopyTemplate = (template: TemplateListItem) => {
    setSelectedTemplate(template);
    setCopyName(`${template.name} (Copy)`);
    setCopyDialogOpen(true);
  };

  const submitCopy = () => {
    if (!selectedTemplate || !copyName.trim()) return;
    copyMutation.mutate({
      templateId: selectedTemplate.id,
      newName: copyName.trim(),
    });
  };

  // Group templates by type
  const systemTemplates = templates?.filter((t) => t.isSystemTemplate) || [];
  const customTemplates = templates?.filter((t) => !t.isSystemTemplate) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3">
            <FileQuestion className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Questionnaire Templates</h1>
            <p className="text-sm text-muted-foreground">
              Manage questionnaire templates for vendor assessments
            </p>
          </div>
        </div>
        {canManageTemplates && (
          <Link href="/tprm/questionnaires/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>System Templates</CardDescription>
            <CardTitle className="text-3xl">{systemTemplates.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Pre-built templates
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Custom Templates</CardDescription>
            <CardTitle className="text-3xl">{customTemplates.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Organization templates
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Questions</CardDescription>
            <CardTitle className="text-3xl">
              {templates?.reduce((acc, t) => acc + t.questionCount, 0) || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileQuestion className="h-4 w-4" />
              Across all templates
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="p-8 text-center text-destructive">
            Failed to load templates: {error.message}
          </CardContent>
        </Card>
      )}

      {/* System Templates Section */}
      {!isLoading && !error && systemTemplates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">System Templates</h2>
            <Badge variant="secondary">Pre-built</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {systemTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onCopy={() => handleCopyTemplate(template)}
                canManage={canManageTemplates}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Templates Section */}
      {!isLoading && !error && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Custom Templates</h2>
            <Badge variant="outline">Organization</Badge>
          </div>
          {customTemplates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {customTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onCopy={() => handleCopyTemplate(template)}
                  canManage={canManageTemplates}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No custom templates yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your own questionnaire templates or copy a system template to customize it.
                </p>
                {canManageTemplates && (
                  <Link href="/tprm/questionnaires/new">
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Template
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Copy Template Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Template</DialogTitle>
            <DialogDescription>
              Create a new custom template based on "{selectedTemplate?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">New Template Name</label>
            <Input
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              placeholder="Enter template name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitCopy}
              disabled={!copyName.trim() || copyMutation.isPending}
            >
              {copyMutation.isPending ? "Copying..." : "Copy Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Template Card Component
 */
function TemplateCard({
  template,
  onCopy,
  canManage,
}: {
  template: TemplateListItem;
  onCopy: () => void;
  canManage: boolean;
}) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link href={`/tprm/questionnaires/${template.id}`}>
              <CardTitle className="text-lg hover:text-primary cursor-pointer">
                {template.name}
              </CardTitle>
            </Link>
            {template.isSystemTemplate && (
              <Badge variant="secondary" className="mt-1">System</Badge>
            )}
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCopy}
              title="Copy template"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        {template.description && (
          <CardDescription className="line-clamp-2 mt-2">
            {template.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{template.sectionCount} sections</span>
            <span>{template.questionCount} questions</span>
          </div>
          <Link href={`/tprm/questionnaires/${template.id}`}>
            <Button variant="ghost" size="sm">
              View
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
