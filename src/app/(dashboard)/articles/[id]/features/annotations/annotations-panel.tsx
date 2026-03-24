"use client";

import { useEffect, useRef } from "react";
import { useArticlePageStore } from "../../store";
import { useAnnotations } from "./use-annotations";
import { AnnotationCard } from "./annotation-card";
import type { Annotation, AnnotationColor } from "../../types";

interface AnnotationsPanelProps {
  articleId: string;
  organizationId: string;
  initialAnnotations: Annotation[];
}

export function AnnotationsPanel({
  articleId,
  organizationId,
  initialAnnotations,
}: AnnotationsPanelProps) {
  const { annotations, editAnnotation, removeAnnotation } = useAnnotations(
    articleId,
    organizationId,
    initialAnnotations
  );

  const highlightAnnotationId = useArticlePageStore(
    (s) => s.highlightAnnotationId
  );
  const scrollToAnnotation = useArticlePageStore((s) => s.scrollToAnnotation);

  // Refs map for scrolling each card into view
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // When highlightAnnotationId changes, scroll the matching card into view
  useEffect(() => {
    if (!highlightAnnotationId) return;
    const el = cardRefs.current.get(highlightAnnotationId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightAnnotationId]);

  function handleCopy(annotation: Annotation) {
    const text = annotation.note
      ? `"${annotation.quote}"\n\n${annotation.note}`
      : `"${annotation.quote}"`;
    void navigator.clipboard.writeText(text);
  }

  function handleChangeColor(id: string, color: AnnotationColor) {
    editAnnotation(id, { color });
  }

  function handleTogglePin(annotation: Annotation) {
    editAnnotation(annotation.id, { isPinned: !annotation.isPinned });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0">
        <span className="text-xs text-muted-foreground">
          共 {annotations.length} 条批注
        </span>
      </div>

      {/* Annotation list */}
      <div className="flex-1 overflow-y-auto">
        {annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
            <span className="text-2xl">✏️</span>
            <p className="text-sm text-muted-foreground">暂无批注</p>
            <p className="text-xs text-muted-foreground/60">
              在阅读模式中选中文字即可创建批注
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(annotation.id, el);
                  else cardRefs.current.delete(annotation.id);
                }}
              >
                <AnnotationCard
                  annotation={annotation}
                  isHighlighted={highlightAnnotationId === annotation.id}
                  onChangeColor={(color) =>
                    handleChangeColor(annotation.id, color)
                  }
                  onDelete={() => removeAnnotation(annotation.id)}
                  onTogglePin={() => handleTogglePin(annotation)}
                  onCopy={() => handleCopy(annotation)}
                  onClick={() => scrollToAnnotation(annotation.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
