"use client";

/**
 * Questionnaire Builder Client Component
 *
 * Epic 4: Questionnaire System
 * Story 4.2: Custom Questionnaire Builder (FR28)
 * Story 4.3: Edit Questionnaire Templates (FR29)
 *
 * Interactive form for creating and editing questionnaire templates.
 * Supports sections, multiple question types, and drag-and-drop ordering.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileQuestion,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
  FileText,
  ToggleLeft,
  List,
  Upload,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { QuestionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/react";

// ============================================================================
// Form Schema
// ============================================================================

const questionChoiceSchema = z.object({
  choiceText: z.string().min(1, "Choice text is required"),
  isConcerning: z.boolean(),
});

const questionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  helpText: z.string().optional(),
  questionType: z.nativeEnum(QuestionType),
  isRequired: z.boolean(),
  isLongText: z.boolean(),
  choices: z.array(questionChoiceSchema).optional(),
});

const sectionSchema = z.object({
  title: z.string().min(1, "Section title is required"),
  description: z.string().optional(),
  questions: z.array(questionSchema).min(1, "At least one question is required"),
});

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().optional(),
  sections: z.array(sectionSchema).min(1, "At least one section is required"),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

// ============================================================================
// Question Type Config
// ============================================================================

const QUESTION_TYPES = [
  { value: QuestionType.TEXT, label: "Text", icon: FileText, description: "Short or long text answer" },
  { value: QuestionType.YES_NO, label: "Yes/No", icon: ToggleLeft, description: "Simple yes or no selection" },
  { value: QuestionType.MULTI_CHOICE, label: "Multiple Choice", icon: List, description: "Single selection from options" },
  { value: QuestionType.FILE_UPLOAD, label: "File Upload", icon: Upload, description: "Upload a file as evidence" },
];

// ============================================================================
// Component
// ============================================================================

interface QuestionnaireBuilderClientProps {
  mode: "create" | "edit";
  templateId?: string;
  defaultValues?: TemplateFormValues;
}

export function QuestionnaireBuilderClient({
  mode,
  templateId,
  defaultValues,
}: QuestionnaireBuilderClientProps) {
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  // Default empty form
  const emptyDefaults: TemplateFormValues = {
    name: "",
    description: "",
    sections: [
      {
        title: "General Information",
        description: "",
        questions: [
          {
            questionText: "",
            helpText: "",
            questionType: QuestionType.TEXT,
            isRequired: false,
            isLongText: false,
            choices: [],
          },
        ],
      },
    ],
  };

  // Form setup
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: defaultValues ?? emptyDefaults,
  });

  // Sections field array
  const {
    fields: sectionFields,
    append: appendSection,
    remove: removeSection,
    move: moveSection,
  } = useFieldArray({
    control: form.control,
    name: "sections",
  });

  // Create mutation
  const createMutation = api.questionnaire.createTemplate.useMutation({
    onSuccess: (template) => {
      toast.success("Template created successfully");
      router.push(`/tprm/questionnaires/${template.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create template");
    },
  });

  // Update mutation
  const updateMutation = api.questionnaire.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template updated successfully");
      router.push(`/tprm/questionnaires/${templateId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update template");
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (data: TemplateFormValues) => {
    // Transform data to include sortOrder
    const transformedData = {
      name: data.name,
      description: data.description,
      sections: data.sections.map((section, sIdx) => ({
        title: section.title,
        description: section.description,
        sortOrder: sIdx,
        questions: section.questions.map((question, qIdx) => ({
          ...question,
          sortOrder: qIdx,
          choices: question.choices?.map((choice, cIdx) => ({
            ...choice,
            sortOrder: cIdx,
          })),
        })),
      })),
    };

    if (mode === "edit" && templateId) {
      await updateMutation.mutateAsync({ id: templateId, ...transformedData });
    } else {
      await createMutation.mutateAsync(transformedData);
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const addSection = () => {
    appendSection({
      title: `Section ${sectionFields.length + 1}`,
      description: "",
      questions: [
        {
          questionText: "",
          questionType: QuestionType.TEXT,
          isRequired: false,
          isLongText: false,
        },
      ],
    });
    setExpandedSections((prev) => new Set([...prev, sectionFields.length]));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3">
          <FileQuestion className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">
            {mode === "create" ? "Create Questionnaire Template" : "Edit Template"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Build a questionnaire with sections and questions
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Template Info */}
          <Card>
            <CardHeader>
              <CardTitle>Template Information</CardTitle>
              <CardDescription>
                Basic details about this questionnaire template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Security Assessment Questionnaire" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the purpose and scope of this questionnaire"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Sections */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sections & Questions</CardTitle>
                  <CardDescription>
                    Organize your questions into logical sections
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={addSection}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {sectionFields.map((section, sectionIndex) => (
                <SectionEditor
                  key={section.id}
                  sectionIndex={sectionIndex}
                  form={form}
                  isExpanded={expandedSections.has(sectionIndex)}
                  onToggle={() => toggleSection(sectionIndex)}
                  onRemove={() => removeSection(sectionIndex)}
                  canRemove={sectionFields.length > 1}
                  onMoveUp={() => sectionIndex > 0 && moveSection(sectionIndex, sectionIndex - 1)}
                  onMoveDown={() =>
                    sectionIndex < sectionFields.length - 1 &&
                    moveSection(sectionIndex, sectionIndex + 1)
                  }
                  isFirst={sectionIndex === 0}
                  isLast={sectionIndex === sectionFields.length - 1}
                />
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/tprm/questionnaires")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {mode === "create" ? "Create Template" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ============================================================================
// Section Editor Component
// ============================================================================

interface SectionEditorProps {
  sectionIndex: number;
  form: ReturnType<typeof useForm<TemplateFormValues>>;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function SectionEditor({
  sectionIndex,
  form,
  isExpanded,
  onToggle,
  onRemove,
  canRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SectionEditorProps) {
  // Questions field array for this section
  const {
    fields: questionFields,
    append: appendQuestion,
    remove: removeQuestion,
    move: moveQuestion,
  } = useFieldArray({
    control: form.control,
    name: `sections.${sectionIndex}.questions`,
  });

  const sectionTitle = form.watch(`sections.${sectionIndex}.title`);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
              <div>
                <div className="font-medium">
                  Section {sectionIndex + 1}: {sectionTitle || "Untitled Section"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {questionFields.length} question{questionFields.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onMoveUp}
                disabled={isFirst}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onMoveDown}
                disabled={isLast}
              >
                ↓
              </Button>
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4 border-t">
            {/* Section Title & Description */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`sections.${sectionIndex}.title`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Security Controls" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`sections.${sectionIndex}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of this section" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Questions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Questions</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendQuestion({
                      questionText: "",
                      questionType: QuestionType.TEXT,
                      isRequired: false,
                      isLongText: false,
                      choices: [],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
              {questionFields.map((question, questionIndex) => (
                <QuestionEditor
                  key={question.id}
                  sectionIndex={sectionIndex}
                  questionIndex={questionIndex}
                  form={form}
                  onRemove={() => removeQuestion(questionIndex)}
                  canRemove={questionFields.length > 1}
                  onMoveUp={() =>
                    questionIndex > 0 && moveQuestion(questionIndex, questionIndex - 1)
                  }
                  onMoveDown={() =>
                    questionIndex < questionFields.length - 1 &&
                    moveQuestion(questionIndex, questionIndex + 1)
                  }
                  isFirst={questionIndex === 0}
                  isLast={questionIndex === questionFields.length - 1}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// Question Editor Component
// ============================================================================

interface QuestionEditorProps {
  sectionIndex: number;
  questionIndex: number;
  form: ReturnType<typeof useForm<TemplateFormValues>>;
  onRemove: () => void;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function QuestionEditor({
  sectionIndex,
  questionIndex,
  form,
  onRemove,
  canRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: QuestionEditorProps) {
  const questionType = form.watch(
    `sections.${sectionIndex}.questions.${questionIndex}.questionType`
  );

  // Choices field array for multi-choice questions
  const {
    fields: choiceFields,
    append: appendChoice,
    remove: removeChoice,
  } = useFieldArray({
    control: form.control,
    name: `sections.${sectionIndex}.questions.${questionIndex}.choices`,
  });

  const questionTypeConfig = QUESTION_TYPES.find((t) => t.value === questionType);
  const Icon = questionTypeConfig?.icon || FileText;

  return (
    <div className="p-4 border rounded-lg bg-muted/30">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className="gap-1">
            <Icon className="h-3 w-3" />
            Q{sectionIndex + 1}.{questionIndex + 1}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
            disabled={isFirst}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
            disabled={isLast}
          >
            ↓
          </Button>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Question Text */}
        <FormField
          control={form.control}
          name={`sections.${sectionIndex}.questions.${questionIndex}.questionText`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter your question"
                  className="min-h-[60px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          {/* Question Type */}
          <FormField
            control={form.control}
            name={`sections.${sectionIndex}.questions.${questionIndex}.questionType`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {QUESTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Required */}
          <FormField
            control={form.control}
            name={`sections.${sectionIndex}.questions.${questionIndex}.isRequired`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Required</FormLabel>
                  <FormDescription className="text-xs">
                    Vendor must answer
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Long Text (for TEXT type) */}
          {questionType === QuestionType.TEXT && (
            <FormField
              control={form.control}
              name={`sections.${sectionIndex}.questions.${questionIndex}.isLongText`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Long Text</FormLabel>
                    <FormDescription className="text-xs">
                      Multi-line input
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Help Text */}
        <FormField
          control={form.control}
          name={`sections.${sectionIndex}.questions.${questionIndex}.helpText`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Help Text (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Additional guidance for respondents" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Choices for Multi-Choice */}
        {questionType === QuestionType.MULTI_CHOICE && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium">Answer Choices</h5>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendChoice({ choiceText: "", isConcerning: false })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Choice
              </Button>
            </div>
            {choiceFields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add at least one choice for this question
              </p>
            )}
            {choiceFields.map((choice, choiceIndex) => (
              <div key={choice.id} className="flex items-center gap-2">
                <div className="w-4 h-4 border rounded-full flex-shrink-0" />
                <FormField
                  control={form.control}
                  name={`sections.${sectionIndex}.questions.${questionIndex}.choices.${choiceIndex}.choiceText`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Choice text" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`sections.${sectionIndex}.questions.${questionIndex}.choices.${choiceIndex}.isConcerning`}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-xs flex items-center gap-1 cursor-pointer">
                        <AlertCircle className="h-3 w-3 text-orange-500" />
                        Concerning
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeChoice(choiceIndex)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
