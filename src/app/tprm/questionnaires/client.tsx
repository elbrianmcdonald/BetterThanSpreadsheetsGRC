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
import { WRITE_ROLES } from "@/lib/auth/roles";
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
import { PageHeader, StatTile } from "@/components/layout";

/**
 * Roles that can create/edit questionnaire templates
 */
const TEMPLATE_MANAGE_ROLES: UserRole[] = WRITE_ROLES;

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
      <PageHeader
        eyebrow="THIRD-PARTY RISK"
        title="Questionnaire Templates"
        icon={<FileQuestion />}
        description="Manage questionnaire templates for vendor assessments"
        actions={
          canManageTemplates && (
            <Link href="/tprm/questionnaires/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </Link>
          )
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatTile
          label="SYSTEM TEMPLATES"
          value={systemTemplates.length}
          sub="Pre-built templates"
          icon={<Shield />}
          accent
        />
        <StatTile
          label="CUSTOM TEMPLATES"
          value={customTemplates.length}
          sub="Organization templates"
          icon={<Building2 />}
        />
        <StatTile
          label="TOTAL QUESTIONS"
          value={templates?.reduce((acc, t) => acc + t.questionCount, 0) || 0}
          sub="Across all templates"
          icon={<FileQuestion />}
        />
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
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">System Templates</h2>
            <Badge variant="info">Pre-built</Badge>
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
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Custom Templates</h2>
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
                <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/70" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">No custom templates yet</h3>
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
    <Card className="group transition-colors hover:border-primary/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link href={`/tprm/questionnaires/${template.id}`}>
              <CardTitle className="text-lg text-foreground hover:text-primary cursor-pointer">
                {template.name}
              </CardTitle>
            </Link>
            {template.isSystemTemplate && (
              <Badge variant="info" className="mt-1">System</Badge>
            )}
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onCopy}
              title="Copy template"
              className="text-muted-foreground/70"
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
            <span><span className="font-mono">{template.sectionCount}</span> sections</span>
            <span><span className="font-mono">{template.questionCount}</span> questions</span>
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
