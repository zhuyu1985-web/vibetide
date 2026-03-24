"use client";

import { useState, useCallback, useTransition } from "react";
import type { Annotation, AnnotationColor } from "../../types";
import {
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from "@/app/actions/annotations";

export function useAnnotations(
  articleId: string,
  organizationId: string,
  initialAnnotations: Annotation[]
) {
  const [annotations, setAnnotations] =
    useState<Annotation[]>(initialAnnotations);
  const [isPending, startTransition] = useTransition();

  const addAnnotation = useCallback(
    (data: {
      quote: string;
      position: number;
      note?: string;
      color?: AnnotationColor;
    }) => {
      startTransition(async () => {
        const result = await createAnnotation(articleId, {
          organizationId,
          quote: data.quote,
          position: data.position,
          note: data.note,
          color: data.color ?? "yellow",
        });
        if (result) {
          const newAnnotation: Annotation = {
            id: result.annotationId,
            articleId,
            quote: data.quote,
            note: data.note,
            color: data.color ?? "yellow",
            position: data.position,
            isPinned: false,
            pinnedPosition: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setAnnotations((prev) =>
            [...prev, newAnnotation].sort((a, b) => a.position - b.position)
          );
        }
      });
    },
    [articleId, organizationId]
  );

  const removeAnnotation = useCallback((id: string) => {
    startTransition(async () => {
      await deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    });
  }, []);

  const editAnnotation = useCallback(
    (
      id: string,
      data: Partial<{
        note: string;
        color: AnnotationColor;
        isPinned: boolean;
        pinnedPosition: { x: number; y: number } | null;
      }>
    ) => {
      startTransition(async () => {
        await updateAnnotation(id, data);
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a
          )
        );
      });
    },
    []
  );

  return { annotations, isPending, addAnnotation, removeAnnotation, editAnnotation };
}
