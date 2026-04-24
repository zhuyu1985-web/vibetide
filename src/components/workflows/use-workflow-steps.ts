import { useState, useCallback } from "react";
import type { WorkflowStepDef } from "@/db/schema/workflows";

// ---------------------------------------------------------------------------
// Hook: step CRUD & reorder logic for workflow editor
// ---------------------------------------------------------------------------

export function useWorkflowSteps(initialSteps: WorkflowStepDef[] = []) {
  const [steps, setSteps] = useState<WorkflowStepDef[]>(initialSteps);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

  // ── Add steps ──

  const addSkillStep = useCallback(
    (skillSlug: string, skillName: string, skillCategory: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: skillName,
        type: "skill",
        config: {
          skillSlug,
          skillName,
          skillCategory,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  const addOutputStep = useCallback(
    (action: string, actionLabel: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: actionLabel,
        type: "output",
        config: {
          outputAction: action,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  const addAIStep = useCallback(
    (aiDescription: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: "AI 自定义",
        type: "skill",
        config: {
          skillSlug: "ai_custom",
          skillName: "AI 自定义",
          skillCategory: "content_gen",
          description: aiDescription,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  // ── Update / delete ──

  const saveStep = useCallback((updatedStep: WorkflowStepDef) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === updatedStep.id ? updatedStep : s))
    );
    setHasChanges(true);
  }, []);

  const deleteStep = useCallback(
    (stepId: string) => {
      setSteps((prev) => {
        const filtered = prev.filter((s) => s.id !== stepId);
        return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
      });
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
      }
      setHasChanges(true);
    },
    [selectedStepId]
  );

  // ── Reorder ──

  const moveUp = useCallback((stepId: string) => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx <= 0) return prev;
      const newSteps = [...sorted];
      const temp = newSteps[idx].order;
      newSteps[idx] = { ...newSteps[idx], order: newSteps[idx - 1].order };
      newSteps[idx - 1] = { ...newSteps[idx - 1], order: temp };
      return newSteps;
    });
    setHasChanges(true);
  }, []);

  const moveDown = useCallback((stepId: string) => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const newSteps = [...sorted];
      const temp = newSteps[idx].order;
      newSteps[idx] = { ...newSteps[idx], order: newSteps[idx + 1].order };
      newSteps[idx + 1] = { ...newSteps[idx + 1], order: temp };
      return newSteps;
    });
    setHasChanges(true);
  }, []);

  // ── Bulk replace (used by AI generation) ──

  const replaceSteps = useCallback((newSteps: WorkflowStepDef[]) => {
    setSteps(newSteps);
    setHasChanges(true);
  }, []);

  return {
    steps,
    selectedStepId,
    selectedStep,
    hasChanges,
    setSelectedStepId,
    setHasChanges,
    addSkillStep,
    addOutputStep,
    addAIStep,
    saveStep,
    deleteStep,
    moveUp,
    moveDown,
    replaceSteps,
  };
}
