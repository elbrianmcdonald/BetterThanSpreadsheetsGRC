"use client";

/**
 * Vendor Portal Client Component
 *
 * Epic 6: Vendor Portal
 * FR37: Vendor Contact can access portal via secure token link
 * FR38: View assigned questionnaires in portal
 * FR39: Complete responses (text, yes/no, multi-choice, file upload)
 * FR40: Save progress and resume later
 * FR41: Submit completed responses
 * FR42: Pre-fill from previous submissions
 * FR43: Update pre-filled responses
 * FR44: Confirmation when submitted
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Save, Send, Clock, FileText } from "lucide-react";

interface VendorPortalClientProps {
  token: string;
}

type QuestionType = "TEXT" | "YES_NO" | "MULTI_CHOICE" | "FILE_UPLOAD";

interface QuestionChoice {
  id: string;
  choiceText: string;
  sortOrder: number;
}

interface QuestionResponse {
  id: string;
  textResponse: string | null;
  selectedChoiceId: string | null;
  fileUrl: string | null;
  fileName: string | null;
  isPreFilled: boolean;
  wasModified: boolean;
}

interface Question {
  id: string;
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  helpText: string | null;
  sortOrder: number;
  choices: QuestionChoice[];
  response: QuestionResponse | null;
}

interface Section {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  questions: Question[];
}

export function VendorPortalClient({ token }: VendorPortalClientProps) {
  const [responses, setResponses] = useState<Record<string, { textResponse?: string; selectedChoiceId?: string }>>({});
  const [savingQuestions, setSavingQuestions] = useState<Set<string>>(new Set());
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPreFilled, setHasPreFilled] = useState(false);

  // Validate token
  const {
    data: validationData,
    isLoading: isValidating,
    error: validationError,
  } = api.vendorPortal.validateToken.useQuery({ token });

  // Get questionnaire data
  const {
    data: questionnaireData,
    isLoading: isLoadingQuestionnaire,
    error: questionnaireError,
    refetch: refetchQuestionnaire,
  } = api.vendorPortal.getQuestionnaireByToken.useQuery(
    { token },
    { enabled: !!validationData?.valid }
  );

  // Pre-fill mutation
  const prefillMutation = api.vendorPortal.prefillFromPrevious.useMutation({
    onSuccess: (data) => {
      if (data.prefilledCount > 0) {
        toast.success(data.message);
        void refetchQuestionnaire();
      }
      setHasPreFilled(true);
    },
    onError: (error) => {
      console.error("Pre-fill error:", error);
      setHasPreFilled(true); // Don't block on error
    },
  });

  // Save response mutation
  const saveResponseMutation = api.vendorPortal.saveResponse.useMutation({
    onSuccess: (_, variables) => {
      setSavingQuestions((prev) => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      setSavedQuestions((prev) => {
        const next = new Set(prev);
        next.add(variables.questionId);
        return next;
      });
      // Clear saved indicator after 2 seconds
      setTimeout(() => {
        setSavedQuestions((prev) => {
          const next = new Set(prev);
          next.delete(variables.questionId);
          return next;
        });
      }, 2000);
    },
    onError: (error, variables) => {
      setSavingQuestions((prev) => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      toast.error(`Failed to save response: ${error.message}`);
    },
  });

  // Submit questionnaire mutation
  const submitMutation = api.vendorPortal.submitQuestionnaire.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void refetchQuestionnaire();
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSubmitting(false);
    },
  });

  // Initialize responses from questionnaire data
  useEffect(() => {
    if (questionnaireData) {
      const initialResponses: Record<string, { textResponse?: string; selectedChoiceId?: string }> = {};
      for (const section of questionnaireData.sections) {
        for (const question of section.questions) {
          if (question.response) {
            initialResponses[question.id] = {
              textResponse: question.response.textResponse ?? undefined,
              selectedChoiceId: question.response.selectedChoiceId ?? undefined,
            };
          }
        }
      }
      setResponses(initialResponses);
    }
  }, [questionnaireData]);

  // Try to pre-fill from previous submission
  useEffect(() => {
    if (
      validationData?.valid &&
      validationData.questionnaire.status !== "COMPLETED" &&
      !hasPreFilled
    ) {
      prefillMutation.mutate({ token });
    }
  }, [validationData, hasPreFilled, token, prefillMutation]);

  // Debounced save function
  const saveResponse = useCallback(
    (questionId: string, value: { textResponse?: string; selectedChoiceId?: string }) => {
      setSavingQuestions((prev) => new Set(prev).add(questionId));
      saveResponseMutation.mutate({
        token,
        questionId,
        textResponse: value.textResponse,
        selectedChoiceId: value.selectedChoiceId,
      });
    },
    [token, saveResponseMutation]
  );

  // Handle text response change (with debounce)
  const handleTextChange = useCallback(
    (questionId: string, value: string) => {
      setResponses((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], textResponse: value },
      }));

      // Debounce save - save 1 second after user stops typing
      const timeoutId = setTimeout(() => {
        saveResponse(questionId, { textResponse: value });
      }, 1000);

      return () => clearTimeout(timeoutId);
    },
    [saveResponse]
  );

  // Handle choice selection (immediate save)
  const handleChoiceChange = useCallback(
    (questionId: string, choiceId: string) => {
      setResponses((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], selectedChoiceId: choiceId },
      }));
      saveResponse(questionId, { selectedChoiceId: choiceId });
    },
    [saveResponse]
  );

  // Handle submit
  const handleSubmit = () => {
    setIsSubmitting(true);
    submitMutation.mutate({ token });
  };

  // Loading state
  if (isValidating || isLoadingQuestionnaire) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">Loading questionnaire...</p>
      </div>
    );
  }

  // Error state
  if (validationError || questionnaireError) {
    const error = validationError ?? questionnaireError;
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Unable to Access Questionnaire</h2>
          <p className="mt-2 text-center text-gray-600">
            {error?.message ?? "An unexpected error occurred"}
          </p>
          <p className="mt-4 text-sm text-gray-500">
            If you believe this is an error, please contact the organization that sent you this link.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Completed state
  if (questionnaireData?.questionnaire.status === "COMPLETED") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex flex-col items-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Questionnaire Submitted</h2>
          <p className="mt-2 text-center text-gray-600">
            Thank you for completing this questionnaire.
          </p>
          {questionnaireData.questionnaire.completedAt && (
            <p className="mt-2 text-sm text-gray-500">
              Submitted on {new Date(questionnaireData.questionnaire.completedAt).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // No data
  if (!questionnaireData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">No questionnaire data available</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate progress
  const totalQuestions = questionnaireData.sections.reduce(
    (sum, section) => sum + section.questions.length,
    0
  );
  const answeredQuestions = Object.keys(responses).filter(
    (qId) => responses[qId]?.textResponse || responses[qId]?.selectedChoiceId
  ).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{questionnaireData.template.name}</CardTitle>
              <CardDescription className="mt-1">
                {questionnaireData.template.description}
              </CardDescription>
            </div>
            <Badge variant="outline" className="ml-4">
              <FileText className="mr-1 h-3 w-3" />
              {questionnaireData.questionnaire.vendorName}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium">{answeredQuestions} of {totalQuestions} questions</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            <Clock className="mr-1 inline h-4 w-4" />
            Your responses are automatically saved as you type.
          </p>
        </CardContent>
      </Card>

      {/* Sections */}
      {questionnaireData.sections.map((section, sectionIndex) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              Section {sectionIndex + 1}: {section.name}
            </CardTitle>
            {section.description && (
              <CardDescription>{section.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {section.questions.map((question, questionIndex) => (
              <QuestionField
                key={question.id}
                question={question}
                questionNumber={`${sectionIndex + 1}.${questionIndex + 1}`}
                value={responses[question.id]}
                onTextChange={handleTextChange}
                onChoiceChange={handleChoiceChange}
                isSaving={savingQuestions.has(question.id)}
                isSaved={savedQuestions.has(question.id)}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Submit Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {progressPercent === 100 ? (
                <span className="text-green-600">All questions answered</span>
              ) : (
                <span>{totalQuestions - answeredQuestions} questions remaining</span>
              )}
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting || savingQuestions.size > 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Questionnaire
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Question Field Component
interface QuestionFieldProps {
  question: Question;
  questionNumber: string;
  value?: { textResponse?: string; selectedChoiceId?: string };
  onTextChange: (questionId: string, value: string) => void;
  onChoiceChange: (questionId: string, choiceId: string) => void;
  isSaving: boolean;
  isSaved: boolean;
}

function QuestionField({
  question,
  questionNumber,
  value,
  onTextChange,
  onChoiceChange,
  isSaving,
  isSaved,
}: QuestionFieldProps) {
  const isPreFilled = question.response?.isPreFilled && !question.response?.wasModified;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <Label className="text-base font-medium">
            {questionNumber}. {question.questionText}
            {question.isRequired && <span className="ml-1 text-red-500">*</span>}
          </Label>
          {question.helpText && (
            <p className="mt-1 text-sm text-gray-500">{question.helpText}</p>
          )}
        </div>
        <div className="ml-4 flex items-center gap-2">
          {isPreFilled && (
            <Badge variant="secondary" className="text-xs">
              Pre-filled
            </Badge>
          )}
          {isSaving && (
            <span className="flex items-center text-xs text-gray-500">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          {isSaved && (
            <span className="flex items-center text-xs text-green-600">
              <Save className="mr-1 h-3 w-3" />
              Saved
            </span>
          )}
        </div>
      </div>

      {/* Text Question */}
      {question.questionType === "TEXT" && (
        <Textarea
          value={value?.textResponse ?? ""}
          onChange={(e) => onTextChange(question.id, e.target.value)}
          placeholder="Enter your response..."
          rows={3}
          className="w-full"
        />
      )}

      {/* Yes/No Question */}
      {question.questionType === "YES_NO" && (
        <RadioGroup
          value={value?.textResponse ?? ""}
          onValueChange={(val) => onTextChange(question.id, val)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Yes" id={`${question.id}-yes`} />
            <Label htmlFor={`${question.id}-yes`}>Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="No" id={`${question.id}-no`} />
            <Label htmlFor={`${question.id}-no`}>No</Label>
          </div>
        </RadioGroup>
      )}

      {/* Multi-Choice Question */}
      {question.questionType === "MULTI_CHOICE" && question.choices.length > 0 && (
        <RadioGroup
          value={value?.selectedChoiceId ?? ""}
          onValueChange={(val) => onChoiceChange(question.id, val)}
          className="space-y-2"
        >
          {question.choices.map((choice) => (
            <div key={choice.id} className="flex items-center space-x-2">
              <RadioGroupItem value={choice.id} id={choice.id} />
              <Label htmlFor={choice.id}>{choice.choiceText}</Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {/* File Upload Question (placeholder) */}
      {question.questionType === "FILE_UPLOAD" && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">
            File upload functionality coming soon
          </p>
        </div>
      )}
    </div>
  );
}
